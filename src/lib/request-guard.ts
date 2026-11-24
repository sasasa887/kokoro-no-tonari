/**
 * 他サイトからの書き込みリクエスト（CSRF）を拒否する。
 * - Content-Type が application/json 以外は拒否（HTML フォームから直接送れないようにする）
 * - Origin や Sec-Fetch-Site が別サイトを示す場合は拒否
 * Cookie は SameSite=Lax だが、/api/onboarding は Cookie を使わずに同意を記録するため、
 * これがないと別サイトのフォームから「同意済み」の Cookie を作れてしまう。
 */
export function rejectCrossSite(request: Request): Response | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    if (originHost !== host) return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
