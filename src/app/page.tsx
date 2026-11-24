import Link from "next/link";
import { cookies } from "next/headers";
import { Character } from "@/components/Character";
import { parseProfileCookie, PROFILE_COOKIE } from "@/lib/profile";

export default async function Home() {
  const profile = parseProfileCookie((await cookies()).get(PROFILE_COOKIE)?.value);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <Character emotion="happy" size={120} />
      <div>
        <h1 className="text-2xl font-bold">ココロのとなり</h1>
        <p className="mt-2 text-muted">
          {profile ? `${profile.nickname}さん、おかえりなさい。` : "モヤモヤを、話して、整理しよう。"}
        </p>
      </div>
      <Link
        href={profile ? "/chat" : "/onboarding"}
        className="w-full rounded-full bg-accent px-6 py-3 font-semibold text-white"
      >
        {profile ? "話しはじめる" : "はじめる"}
      </Link>
      <p className="text-xs text-muted">18歳以上の方が対象です</p>
    </main>
  );
}
