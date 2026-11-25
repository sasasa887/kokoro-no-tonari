import { beforeEach, describe, expect, it } from "vitest";
import { clientIp, consumeRateLimit, resetRateLimits } from "./rate-limit";

beforeEach(() => resetRateLimits());

describe("consumeRateLimit", () => {
  it("上限までは通し、超えたら止める", () => {
    const now = 1_000;
    expect(consumeRateLimit("k", 2, 60_000, now)).toBe(true);
    expect(consumeRateLimit("k", 2, 60_000, now)).toBe(true);
    expect(consumeRateLimit("k", 2, 60_000, now)).toBe(false);
  });

  it("期間が過ぎたら数え直す", () => {
    expect(consumeRateLimit("k", 1, 60_000, 0)).toBe(true);
    expect(consumeRateLimit("k", 1, 60_000, 59_999)).toBe(false);
    expect(consumeRateLimit("k", 1, 60_000, 60_000)).toBe(true);
  });

  it("キーごとに別々に数える", () => {
    expect(consumeRateLimit("a", 1, 60_000, 0)).toBe(true);
    expect(consumeRateLimit("b", 1, 60_000, 0)).toBe(true);
  });
});

describe("clientIp", () => {
  it("x-forwarded-for の先頭を使う", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } });
    expect(clientIp(req)).toBe("203.0.113.5");
  });
});
