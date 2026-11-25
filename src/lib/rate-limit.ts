/**
 * 回数制限（固定ウィンドウ、メモリ上）。
 * サーバーレスではインスタンスごとに数えるため完全ではない。
 * 「ログインとDB」で Supabase に移したら、1日の発言数は DB で数える（企画書「安全性とプライバシー」）。
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 50_000;

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      // まだ満杯なら古いものから消す（全消去すると、大量のキーを作るだけで全員の上限が戻ってしまう）
      for (const k of buckets.keys()) {
        if (buckets.size < MAX_KEYS) break;
        buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function resetRateLimits() {
  buckets.clear();
}

/**
 * 利用者の IP。Vercel が設定する x-real-ip を優先する。
 * x-forwarded-for は利用者が自由に書けるため、Vercel 以外の環境で使う場合は
 * 前段のプロキシが上書きしていることを確かめる。
 */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export const LIMITS = {
  /** 1人1日の発言数 */
  chatPerProfile: () => ({ limit: intEnv("DAILY_MESSAGE_LIMIT", 60), windowMs: DAY_MS }),
  /** 同じ IP からの1日の発言数（Cookie を作り直して上限を逃れるのを防ぐ） */
  chatPerIp: () => ({ limit: intEnv("DAILY_MESSAGE_LIMIT_PER_IP", 200), windowMs: DAY_MS }),
  reflectionPerProfile: () => ({ limit: 20, windowMs: DAY_MS }),
  onboardingPerIp: () => ({ limit: 10, windowMs: HOUR_MS }),
};
