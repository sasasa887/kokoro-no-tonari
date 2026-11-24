import { NextResponse, type NextRequest } from "next/server";
import { PROFILE_COOKIE, readProfile } from "@/lib/profile";

/**
 * 初回設定（年齢確認と同意）を終えていない人、Cookie が改ざん・期限切れの人、
 * 同意した規約の版が古い人は、対話画面に入れず初回設定に戻す。
 */
export async function middleware(request: NextRequest) {
  const profile = await readProfile(request.cookies.get(PROFILE_COOKIE)?.value);
  if (!profile) {
    const res = NextResponse.redirect(new URL("/onboarding", request.url));
    res.cookies.delete(PROFILE_COOKIE);
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*"],
};
