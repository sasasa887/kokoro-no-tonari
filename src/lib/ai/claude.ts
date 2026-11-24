import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildChatSystemPrompt, REFLECTION_SYSTEM_PROMPT, type CoachType } from "@/lib/coach";
import { detectCrisisKeywords } from "@/lib/crisis";
import { ReplyExtractor } from "./reply-extractor";
import {
  CHAT_OUTPUT_JSON_SCHEMA,
  ChatOutputSchema,
  ReflectionSchema,
  trimHistory,
  type ChatMessage,
  type ChatOutput,
  type Reflection,
} from "./schema";

/**
 * モデルは環境変数で切り替える（企画書「運用コストとリスク」：対話のモデルは Haiku 5.5 と Opus 5.5 を比べて決める）。
 * 既定はどちらも Claude Opus 5.5。
 */
const CHAT_MODEL = process.env.CHAT_MODEL ?? "claude-opus-5-5";
const REFLECTION_MODEL = process.env.REFLECTION_MODEL ?? "claude-opus-5-5";
const EFFORTS = ["low", "medium", "high"] as const;
type Effort = (typeof EFFORTS)[number];

/** 想定外の値は API の 400 で全会話が止まるため、既定の low に戻す */
export function parseEffort(raw: string | undefined): Effort {
  const v = raw?.trim().toLowerCase();
  if (!v) return "low";
  if ((EFFORTS as readonly string[]).includes(v)) return v as Effort;
  console.warn(`CHAT_EFFORT の値が不正なため low を使います: ${raw}`);
  return "low";
}
const CHAT_EFFORT = parseEffort(process.env.CHAT_EFFORT);

/** 安全分類器による拒否が起きたとき、サーバー側で別モデルに引き継がせる（ベータ機能） */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AIRefusalError extends Error {}
export class AIOutputError extends Error {}

export function isMockMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  /** 安全分類器で拒否され別モデルが引き継いだ。表示中の返答を消して書き直す */
  | { type: "reset" }
  | { type: "final"; output: ChatOutput };

export async function* streamChat(params: {
  coach: CoachType;
  nickname: string;
  messages: ChatMessage[];
  /** 利用者が画面を閉じたら API のストリームも止める */
  signal?: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const history = trimHistory(params.messages);
  if (isMockMode()) {
    yield* mockChat(history);
    return;
  }

  const stream = getClient().beta.messages.stream(
    {
    model: CHAT_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: [
      {
        type: "text",
        text: buildChatSystemPrompt(params.coach, params.nickname),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: history,
    output_config: {
      effort: CHAT_EFFORT,
      format: { type: "json_schema", schema: CHAT_OUTPUT_JSON_SCHEMA },
    },
    },
    { signal: params.signal },
  );

  let extractor = new ReplyExtractor();
  for await (const event of stream) {
    if (event.type === "content_block_start" && event.content_block.type === "fallback") {
      extractor = new ReplyExtractor();
      yield { type: "reset" };
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const text = extractor.push(event.delta.text);
      if (text) yield { type: "delta", text };
    }
  }

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new AIRefusalError("AIが返答を控えました");
  yield { type: "final", output: parseChatOutput(lastTextAfterFallback(message.content)) };
}

/** 最後の fallback ブロックより後の text だけを使う（前のモデルの途中までの出力は捨てる） */
function lastTextAfterFallback(content: Anthropic.Beta.BetaContentBlock[]): string {
  let text = "";
  for (const block of content) {
    if (block.type === "fallback") text = "";
    else if (block.type === "text") text += block.text;
  }
  return text;
}

export function parseChatOutput(raw: string): ChatOutput {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AIOutputError("AIの出力を JSON として読めませんでした");
  }
  const result = ChatOutputSchema.safeParse(json);
  if (!result.success) throw new AIOutputError("AIの出力が想定した形式ではありません");
  return result.data;
}

export async function createReflection(messages: ChatMessage[]): Promise<Reflection> {
  if (isMockMode()) return mockReflection(messages);

  const transcript = messages
    .map((m) => `${m.role === "user" ? "利用者" : "コーチ"}：${m.content}`)
    .join("\n");

  const response = await getClient().beta.messages.parse({
    model: REFLECTION_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: REFLECTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `次の会話を振り返りとしてまとめてください。\n\n${transcript}` }],
    output_config: { format: zodOutputFormat(ReflectionSchema) },
  });

  if (response.stop_reason === "refusal") throw new AIRefusalError("AIが振り返りの作成を控えました");
  if (!response.parsed_output) throw new AIOutputError("振り返りを読み取れませんでした");
  return response.parsed_output;
}

// ---- APIキーがないときのモック（画面の確認とテスト用） ----

async function* mockChat(history: ChatMessage[]): AsyncGenerator<ChatStreamEvent> {
  const last = history.at(-1)?.content ?? "";
  const crisis = detectCrisisKeywords(last);
  const reply = crisis
    ? "そう思うほどつらい気持ちなんですね。話してくれてありがとう。ひとりで抱えずに、画面の相談窓口や身近な人にも話してみてほしいです。（デモ用の返答です）"
    : `「${last.slice(0, 30)}」と感じているんですね。話してくれてありがとう。いま一番気になっていることは何ですか？（デモ用の返答です）`;
  const chars = Array.from(reply);
  for (let i = 0; i < chars.length; i += 6) {
    await new Promise((r) => setTimeout(r, 30));
    yield { type: "delta", text: chars.slice(i, i + 6).join("") };
  }
  yield { type: "final", output: { crisis, emotion: "concerned", reply } };
}

function mockReflection(messages: ChatMessage[]): Reflection {
  const firstUser = messages.find((m) => m.role === "user")?.content ?? "";
  return {
    summary: `「${firstUser.slice(0, 40)}」について話しました。（デモ用の振り返りです）`,
    insights: ["気になっていることを言葉にできた"],
    next_step: "明日、気になっていることを1つだけメモに書き出してみる",
    mood_estimate: 3,
    tags: ["その他"],
  };
}
