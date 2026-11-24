import { z } from "zod";
import { COACH_TYPES } from "./coach";

/**
 * デモモードのプロフィール（Supabase 接続前の仮置き）。
 * Supabase の Auth と profiles テーブルにつないだら、この Cookie は使わない。
 */
export const PROFILE_COOKIE = "kt_profile";

export const ProfileSchema = z.object({
  nickname: z.string().trim().min(1).max(20),
  coach: z.enum(COACH_TYPES),
  consentVersion: z.string(),
  consentedAt: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export function parseProfileCookie(value: string | undefined): Profile | null {
  if (!value) return null;
  try {
    const result = ProfileSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
