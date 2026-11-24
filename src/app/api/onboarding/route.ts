import { NextResponse } from "next/server";
import { z } from "zod";
import { isEligibleAge } from "@/lib/age";
import { COACH_TYPES } from "@/lib/coach";
import { allConsented, CONSENT_VERSION } from "@/lib/consent";
import { PROFILE_COOKIE, PROFILE_MAX_AGE_SECONDS, signProfile, type Profile } from "@/lib/profile";
import { clientIp, consumeRateLimit, LIMITS } from "@/lib/rate-limit";

const BodySchema = z.object({
  birthMonth: z.string().regex(/^\d{4}-\d{2}$/),
  consents: z.object({ terms: z.boolean(), sensitive: z.boolean(), offshore: z.boolean() }),
  nickname: z.string().trim().min(1).max(20),
  coach: z.enum(COACH_TYPES),
});

export async function POST(request: Request) {
  const { limit, windowMs } = LIMITS.onboardingPerIp();
  if (!consumeRateLimit(`onboarding:${clientIp(request)}`, limit, windowMs)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const body = parsed.data;

  // 画面側でも確認しているが、サーバーでも必ず確かめる。18歳未満の生年月は保存しない
  let eligible = false;
  try {
    eligible = isEligibleAge(body.birthMonth);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!eligible) {
    return NextResponse.json({ error: "underage" }, { status: 403 });
  }
  if (!allConsented(body.consents)) {
    return NextResponse.json({ error: "consent_required" }, { status: 400 });
  }

  const profile: Profile = {
    id: crypto.randomUUID(),
    nickname: body.nickname,
    coach: body.coach,
    consentVersion: CONSENT_VERSION,
    consentedAt: new Date().toISOString(),
  };

  // TODO(ログインとDB): Supabase の profiles に birth_month と各同意の日時を保存する
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PROFILE_COOKIE, await signProfile(profile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PROFILE_MAX_AGE_SECONDS,
  });
  return res;
}
