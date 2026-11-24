import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { z } from "zod";
import { AIOutputError, AIRefusalError, streamChat } from "@/lib/ai/claude";
import { ChatMessageSchema, MAX_HISTORY } from "@/lib/ai/schema";
import { detectCrisisKeywords } from "@/lib/crisis";
import { PROFILE_COOKIE, readProfile } from "@/lib/profile";
import { clientIp, consumeRateLimit, LIMITS } from "@/lib/rate-limit";

/** 画面は直近の発言だけを送る。余裕をもたせつつ、巨大なリクエストは受け付けない */
const BodySchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(MAX_HISTORY * 2),
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
  const profile = await readProfile((await cookies()).get(PROFILE_COOKIE)?.value);
  if (!profile) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const { messages } = parsed.data;
  const last = messages.at(-1);
  if (!last || last.role !== "user") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // 危機の判定は上限に達していても行い、窓口は必ず出せるようにする
  const keywordCrisis = detectCrisisKeywords(last.content);

  const perProfile = LIMITS.chatPerProfile();
  const perIp = LIMITS.chatPerIp();
  if (
    !consumeRateLimit(`chat:${profile.id}`, perProfile.limit, perProfile.windowMs) ||
    !consumeRateLimit(`chat-ip:${clientIp(request)}`, perIp.limit, perIp.windowMs)
  ) {
    return Response.json({ error: "daily_limit", crisis: keywordCrisis }, { status: 429 });
  }

  // TODO(ログインとDB): 発言を暗号化して messages に保存し、1日の上限は DB で数える
  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());
  let closed = false;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          closed = true; // 利用者が画面を閉じた
        }
      };
      if (keywordCrisis) send({ type: "crisis" });
      try {
        for await (const event of streamChat({
          coach: profile.coach,
          nickname: profile.nickname,
          messages,
          signal: abort.signal,
        })) {
          if (closed) break;
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
        if (!closed && !abort.signal.aborted) {
          send({ type: "error", code: errorCode(error), crisis: keywordCrisis });
          // 会話の本文はログに出さない（企画書「安全性とプライバシー」）
          console.error("chat failed:", errorCode(error));
        }
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // すでに閉じられている
          }
        }
      }
    },
    cancel() {
      closed = true;
      abort.abort();
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
