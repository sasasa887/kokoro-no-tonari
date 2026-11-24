import type { NextConfig } from "next";

/**
 * セキュリティヘッダー。
 * - frame-ancestors / X-Frame-Options：同意画面を他サイトの iframe に埋め込み、
 *   チェックを押させる（クリックジャッキング）ことを防ぐ
 * - Permissions-Policy：マイクは自分のサイトからだけ使える（音声入力は仕上げフェーズ）
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
