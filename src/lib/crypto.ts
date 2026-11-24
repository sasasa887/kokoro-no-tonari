import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * 会話本文のアプリ側暗号化（企画書「非機能要件」：AES-256-GCM、鍵は環境変数だけに置く）。
 * 形式: "v1:<iv base64>:<authTag base64>:<ciphertext base64>"
 */
const VERSION = "v1";
const IV_BYTES = 12;

export function loadKey(raw = process.env.CONTENT_ENCRYPTION_KEY): Buffer {
  if (!raw) throw new Error("CONTENT_ENCRYPTION_KEY が設定されていません");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CONTENT_ENCRYPTION_KEY は32バイトを base64 にしたものを指定してください");
  }
  return key;
}

export function encryptText(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptText(payload: string, key: Buffer): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || ctB64 === undefined) {
    throw new Error("暗号文の形式が不正です");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
