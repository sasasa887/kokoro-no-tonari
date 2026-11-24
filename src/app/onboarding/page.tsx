"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Character } from "@/components/Character";
import { CrisisCard } from "@/components/CrisisCard";
import { isEligibleAge, MAX_AGE, MIN_AGE } from "@/lib/age";
import { COACH_TYPES, COACHES, type CoachType } from "@/lib/coach";
import { allConsented, CONSENT_ITEMS, type ConsentState } from "@/lib/consent";

type Step = "age" | "underage" | "consent" | "profile";

const THIS_YEAR = new Date().getFullYear();
// サーバー側の上限（MAX_AGE 歳）と同じ範囲を選べるようにする
const YEARS = Array.from({ length: MAX_AGE + 1 }, (_, i) => THIS_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("age");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [consents, setConsents] = useState<Partial<ConsentState>>({});
  const [nickname, setNickname] = useState("");
  const [coach, setCoach] = useState<CoachType>("gentle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const birthMonth = year && month ? `${year}-${month.padStart(2, "0")}` : "";

  function submitAge() {
    if (!birthMonth) return;
    setStep(isEligibleAge(birthMonth) ? "consent" : "underage");
  }

  async function submitProfile() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthMonth, consents, nickname, coach }),
      });
      if (res.status === 403) return setStep("underage");
      if (res.status === 429) {
        setError("短い時間に何度も登録が行われました。しばらくしてからお試しください。");
        return;
      }
      if (!res.ok) throw new Error();
      router.push("/chat");
    } catch {
      setError("登録できませんでした。通信の状態を確かめて、もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-5 py-8">
      <div className="flex items-center gap-3">
        <Character emotion={step === "underage" ? "concerned" : "calm"} size={56} />
        <p className="text-sm text-muted">はじめに、少しだけ確認させてください。</p>
      </div>

      {step === "age" && (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">生まれた年と月を教えてください</h1>
          <p className="text-sm text-muted">このアプリは{MIN_AGE}歳以上の方が対象です。</p>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">生まれた年</span>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface p-3"
              >
                <option value="">年</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
            </label>
            <label className="w-28">
              <span className="sr-only">生まれた月</span>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface p-3"
              >
                <option value="">月</option>
                {MONTHS.map((m) => (
                  <option key={m} value={String(m)}>
                    {m}月
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={!birthMonth}
            onClick={submitAge}
            className="w-full rounded-full bg-accent py-3 font-semibold text-white disabled:opacity-40"
          >
            次へ
          </button>
        </section>
      )}

      {step === "underage" && (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">ごめんなさい、このアプリは{MIN_AGE}歳以上の方が対象です</h1>
          <p className="text-sm">
            悩みがあるときは、ひとりで抱えずに相談してください。年齢に関係なく話を聞いてくれる窓口があります。
          </p>
          <CrisisCard />
        </section>
      )}

      {step === "consent" && (
        <section className="space-y-3">
          <h1 className="text-xl font-bold">3つのことに同意してください</h1>
          {CONSENT_ITEMS.map((item) => (
            <div key={item.key} className="rounded-2xl border border-line bg-surface p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={consents[item.key] === true}
                  onChange={(e) => setConsents((c) => ({ ...c, [item.key]: e.target.checked }))}
                  className="mt-1 size-5 accent-[var(--accent)]"
                />
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-sm">{item.summary}</span>
                </span>
              </label>
              <details className="mt-2 pl-8 text-sm text-muted">
                <summary className="cursor-pointer">詳しく見る</summary>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {item.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
          <button
            type="button"
            disabled={!allConsented(consents)}
            onClick={() => setStep("profile")}
            className="w-full rounded-full bg-accent py-3 font-semibold text-white disabled:opacity-40"
          >
            同意してはじめる
          </button>
          <p className="text-center text-xs text-muted">
            同意いただけない場合、会話の内容をAIに送れないためご利用いただけません。
          </p>
        </section>
      )}

      {step === "profile" && (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">呼び名とコーチを選んでください</h1>
          <label className="block">
            <span className="text-sm font-medium">コーチからの呼ばれ方</span>
            <input
              value={nickname}
              maxLength={20}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例：ゆう"
              className="mt-1 w-full rounded-xl border border-line bg-surface p-3"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">コーチのタイプ</legend>
            {COACH_TYPES.map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${
                  coach === t ? "border-accent bg-accent-soft" : "border-line bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name="coach"
                  checked={coach === t}
                  onChange={() => setCoach(t)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  <span className="block font-semibold">{COACHES[t].label}</span>
                  <span className="block text-sm text-muted">{COACHES[t].forWhom}に</span>
                </span>
              </label>
            ))}
          </fieldset>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            disabled={!nickname.trim() || submitting}
            onClick={submitProfile}
            className="w-full rounded-full bg-accent py-3 font-semibold text-white disabled:opacity-40"
          >
            {submitting ? "準備しています…" : "話しはじめる"}
          </button>
        </section>
      )}
    </main>
  );
}
