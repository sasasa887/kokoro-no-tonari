import { NextResponse, type NextRequest } from "next/server";
import { PROFILE_COOKIE } from "@/lib/profile";

/** 初回設定（年齢確認と同意）を終えていない人は対話画面に入れない */
export function middleware(request: NextRequest) {
  if (!request.cookies.get(PROFILE_COOKIE)) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*"],
};
