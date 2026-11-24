import { z } from "zod";

export const EMOTIONS = ["happy", "calm", "concerned", "thinking", "cheer"] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** 対話の返答。crisis と emotion を先に出させ、reply を最後にしてストリーミング表示する。 */
export const ChatOutputSchema = z.object({
  crisis: z.boolean(),
  emotion: z.enum(EMOTIONS),
  reply: z.string(),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

export const CHAT_OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    crisis: { type: "boolean" },
    emotion: { type: "string", enum: [...EMOTIONS] },
    reply: { type: "string" },
  },
  required: ["crisis", "emotion", "reply"],
  additionalProperties: false,
} as const;

export const TAGS = ["仕事", "学業", "人間関係", "健康", "生活", "その他"] as const;

export const ReflectionSchema = z.object({
  summary: z.string(),
  insights: z.array(z.string()),
  next_step: z.string(),
  mood_estimate: z.number().int().min(1).max(5),
  tags: z.array(z.enum(TAGS)),
});
export type Reflection = z.infer<typeof ReflectionSchema>;

/** 利用者の1回の入力の上限（画面の maxLength と同じ） */
export const MAX_USER_CHARS = 2000;
/** AIの返答はモデルが長く書くこともあるため、上限を広めにとる */
export const MAX_ASSISTANT_CHARS = 8000;

export const ChatMessageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().min(1).max(MAX_USER_CHARS) }),
  z.object({ role: z.literal("assistant"), content: z.string().min(1).max(MAX_ASSISTANT_CHARS) }),
]);
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** 振り返りに使う会話の上限件数（画面はこれより古い分を切り落として送る） */
export const MAX_REFLECTION_MESSAGES = 200;

/** AIに送るのは直近20発言まで（企画書「AI設計」：費用を抑える） */
export const MAX_HISTORY = 20;
/** 1回の対話で送る文字数の上限（画面はこの範囲に切り詰め、サーバーは余裕をみた上限で拒否する） */
export const MAX_HISTORY_CHARS = 30_000;
export const MAX_CHAT_REQUEST_CHARS = 40_000;
/** 振り返りに送る文字数の上限 */
export const MAX_REFLECTION_CHARS = 60_000;

export function totalChars(messages: ChatMessage[]): number {
  return messages.reduce((n, m) => n + m.content.length, 0);
}

/**
 * 新しい発言から順に、件数と文字数の上限に収まる分だけ残す。最後の発言は必ず残す。
 * API の制約に合わせ、先頭は user にそろえる。
 */
export function trimToBudget(messages: ChatMessage[], maxMessages: number, maxChars: number): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0 && kept.length < maxMessages; i--) {
    const m = messages[i];
    if (kept.length > 0 && chars + m.content.length > maxChars) break;
    kept.unshift(m);
    chars += m.content.length;
  }
  while (kept.length > 1 && kept[0].role !== "user") kept.shift();
  return kept;
}

export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  return trimToBudget(messages, MAX_HISTORY, MAX_HISTORY_CHARS);
}
