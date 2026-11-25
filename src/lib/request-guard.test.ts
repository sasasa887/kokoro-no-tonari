import { describe, expect, it } from "vitest";
import { rejectCrossSite } from "./request-guard";

function req(headers: Record<string, string>) {
  return new Request("https://app.example/api/onboarding", { method: "POST", headers: { host: "app.example", ...headers } });
}

describe("rejectCrossSite", () => {
  it("同じサイトからの JSON は通す", () => {
    expect(
      rejectCrossSite(req({ "content-type": "application/json", origin: "https://app.example", "sec-fetch-site": "same-origin" })),
    ).toBeNull();
  });

  it("JSON 以外（フォーム送信など）は拒否する", () => {
    expect(rejectCrossSite(req({ "content-type": "text/plain" }))?.status).toBe(415);
    expect(rejectCrossSite(req({ "content-type": "application/x-www-form-urlencoded" }))?.status).toBe(415);
  });

  it("別サイトからの送信は拒否する", () => {
    expect(rejectCrossSite(req({ "content-type": "application/json", origin: "https://evil.example" }))?.status).toBe(403);
    expect(rejectCrossSite(req({ "content-type": "application/json", "sec-fetch-site": "cross-site" }))?.status).toBe(403);
  });
});
