import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { z } from "zod";
import { AIOutputError, AIRefusalError, streamChat } from "@/lib/ai/claude";
import { ChatMessageSchema } from "@/lib/ai/schema";
import { detectCrisisKeywords } from "@/lib/crisis";
import { parseProfileCookie, PROFILE_COOKIE } from "@/lib/profile";

const BodySchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(200),
});

/**
 * 1行1イベントの NDJSON で返す。
 * {"type":"crisis"}           キーワード判定で危機を検知（AIの返答を待たずに窓口を出す）
 * {"type":"delta","text"}     返答の本文の断片
 * {"type":"reset"}            別モデルへの引き継ぎで本文を書き直す
 * {"type":"done","emotion","crisis","reply"}
 * {"type":"error","code"}     画面は入力文を残したまま再送ボタンを出す
 */
export async function POST(request: Request) {
  const profile = parseProfileCookie((await cookies()).get(PROFILE_COOKIE)?.value);
  if (!profile) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const { messages } = parsed.data;
  if (messages.at(-1)?.role !== "user") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // TODO(ログインとDB): 1日の発言数の上限を確認し、発言を暗号化して messages に保存する
  const keywordCrisis = detectCrisisKeywords(messages.at(-1)!.content);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      if (keywordCrisis) send({ type: "crisis" });
      try {
        for await (const event of streamChat({ coach: profile.coach, nickname: profile.nickname, messages })) {
          if (event.type === "final") {
            send({
              type: "done",
              emotion: event.output.emotion,
              crisis: event.output.crisis || keywordCrisis,
              reply: event.output.reply,
            });
          } else {
            send(event);
          }
        }
      } catch (error) {
        send({ type: "error", code: errorCode(error), crisis: keywordCrisis });
        // 会話の本文はログに出さない（企画書「安全性とプライバシー」）
        console.error("chat failed:", errorCode(error));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function errorCode(error: unknown): string {
  if (error instanceof AIRefusalError) return "refusal";
  if (error instanceof AIOutputError) return "bad_output";
  if (error instanceof Anthropic.RateLimitError) return "rate_limited";
  if (error instanceof Anthropic.APIConnectionError) return "connection";
  if (error instanceof Anthropic.APIError) return `api_${error.status ?? "unknown"}`;
  return "unknown";
}
