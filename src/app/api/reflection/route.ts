import { cookies } from "next/headers";
import { z } from "zod";
import { createReflection } from "@/lib/ai/claude";
import { ChatMessageSchema } from "@/lib/ai/schema";
import { parseProfileCookie, PROFILE_COOKIE } from "@/lib/profile";

const BodySchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(200),
});

export async function POST(request: Request) {
  const profile = parseProfileCookie((await cookies()).get(PROFILE_COOKIE)?.value);
  if (!profile) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  try {
    const reflection = await createReflection(parsed.data.messages);
    // TODO(ログインとDB): reflections に保存する（本文は暗号化）
    return Response.json({ reflection });
  } catch {
    // 振り返りの作成に失敗しても会話は残し、あとで作り直せるようにする（企画書「エラー時の画面」）
    return Response.json({ error: "reflection_failed" }, { status: 502 });
  }
}
