import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptText, encryptText, loadKey } from "./crypto";

const key = randomBytes(32);

describe("encryptText / decryptText", () => {
  it("暗号化した本文を元に戻せる", () => {
    const plain = "上司の言い方がつらかった。😢";
    const enc = encryptText(plain, key);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("上司");
    expect(decryptText(enc, key)).toBe(plain);
  });

  it("同じ本文でも毎回違う暗号文になる", () => {
    expect(encryptText("同じ", key)).not.toBe(encryptText("同じ", key));
  });

  it("改ざんや違う鍵では復号できない", () => {
    const enc = encryptText("秘密", key);
    const parts = enc.split(":");
    const tampered = [...parts.slice(0, 3), Buffer.from("x").toString("base64")].join(":");
    expect(() => decryptText(tampered, key)).toThrow();
    expect(() => decryptText(enc, randomBytes(32))).toThrow();
  });
});

describe("loadKey", () => {
  it("32バイト以外の鍵を拒否する", () => {
    expect(() => loadKey(randomBytes(16).toString("base64"))).toThrow();
    expect(() => loadKey(undefined)).toThrow();
    expect(loadKey(key.toString("base64")).length).toBe(32);
  });
});
