import { describe, expect, it } from "vitest";
import { CONSENT_VERSION } from "./consent";
import { readProfile, signProfile, type Profile } from "./profile";

const profile: Profile = {
  id: "8b0c8f2e-5f0a-4c8e-9d2a-0f3b1c2d4e5f",
  nickname: "ゆう",
  coach: "gentle",
  consentVersion: CONSENT_VERSION,
  consentedAt: "2026-11-24T00:00:00.000Z",
};

describe("signProfile / readProfile", () => {
  it("署名した Cookie を読み戻せる", async () => {
    expect(await readProfile(await signProfile(profile))).toEqual(profile);
  });

  it("署名のない Cookie や改ざんされた Cookie は受け付けない", async () => {
    const signed = await signProfile(profile);
    const [body, sig] = signed.split(".");
    expect(await readProfile(body)).toBeNull();
    expect(await readProfile(JSON.stringify(profile))).toBeNull();

    const forged = Buffer.from(JSON.stringify({ ...profile, nickname: "なりすまし" })).toString("base64url");
    expect(await readProfile(`${forged}.${sig}`)).toBeNull();
    expect(await readProfile(`${body}.${sig.slice(0, -2)}xx`)).toBeNull();
  });

  it("同意した規約の版が古い Cookie は受け付けない", async () => {
    const old = await signProfile({ ...profile, consentVersion: "old-version" });
    expect(await readProfile(old)).toBeNull();
  });

  it("空や壊れた値でも例外を出さずに null を返す", async () => {
    expect(await readProfile(undefined)).toBeNull();
    expect(await readProfile("")).toBeNull();
    expect(await readProfile("@@@.###")).toBeNull();
  });
});
