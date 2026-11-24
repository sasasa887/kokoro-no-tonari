import { z } from "zod";
import { COACH_TYPES } from "./coach";
import { CONSENT_VERSION } from "./consent";

/**
 * デモモードのプロフィール（Supabase 接続前の仮置き）。
 * HMAC-SHA256 で署名した Cookie に入れ、改ざんや自作の Cookie を受け付けない。
 * Supabase の Auth と profiles テーブルにつないだら、この Cookie は使わない。
 * Web Crypto だけを使い、middleware（Edge）と API（Node）の両方で動くようにしている。
 */
export const PROFILE_COOKIE = "kt_profile";
export const PROFILE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string().trim().min(1).max(20),
  coach: z.enum(COACH_TYPES),
  consentVersion: z.string(),
  consentedAt: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

const DEV_SECRET = "dev-only-secret-do-not-use-in-production";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_SECRET !== "1") {
    throw new Error("SESSION_SECRET（32文字以上）が設定されていません");
  }
  return DEV_SECRET;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signProfile(profile: Profile): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(profile)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

/**
 * 署名が正しく、形式が合い、同意した規約の版が現在のものと同じときだけプロフィールを返す。
 * それ以外（改ざん・期限切れ・古い同意）は null を返し、呼び出し側は初回設定に戻す。
 */
export async function readProfile(value: string | undefined): Promise<Profile | null> {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(sig),
      new TextEncoder().encode(body),
    );
    if (!ok) return null;
    const result = ProfileSchema.safeParse(JSON.parse(new TextDecoder().decode(fromBase64Url(body))));
    if (!result.success) return null;
    if (result.data.consentVersion !== CONSENT_VERSION) return null;
    return result.data;
  } catch {
    return null;
  }
}
