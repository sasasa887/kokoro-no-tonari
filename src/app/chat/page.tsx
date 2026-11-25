"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Character } from "@/components/Character";
import { CrisisCard } from "@/components/CrisisCard";
import { MoodPicker } from "@/components/MoodPicker";
import {
  MAX_REFLECTION_CHARS,
  MAX_REFLECTION_MESSAGES,
  MAX_USER_CHARS,
  trimHistory,
  trimToBudget,
  type ChatMessage,
  type Emotion,
  type Reflection,
} from "@/lib/ai/schema";

type Phase = "moodBefore" | "chat" | "moodAfter" | "reflecting" | "reflection" | "reflectionFailed";

// 入力途中の文章は、タブを閉じれば消える sessionStorage に置く（共有端末に悩みの文章を残さない）
const DRAFT_KEY = "kt_draft";

const ERROR_TEXT: Record<string, string> = {
  rate_limited: "いま混み合っているみたい。少し待ってから送ってみてください。",
  daily_limit: "今日はたくさん話したね。続きはまた明日話そう。",
  default: "ごめん、いまうまく返事ができないみたい。",
};

class UnauthorizedError extends Error {}

function readDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(text: string) {
  try {
    if (text) sessionStorage.setItem(DRAFT_KEY, text);
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // 端末に保存できなくても会話は続けられる
  }
}

export default function ChatPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("moodBefore");
  const [moodBefore, setMoodBefore] = useState<number | null>(null);
  const [moodAfter, setMoodAfter] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [emotion, setEmotion] = useState<Emotion>("calm");
  const [crisis, setCrisis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // effect は何も返さない形にする（scrollIntoView などの戻り値を後片付け関数と誤認させない）
  useEffect(() => {
    setInput(readDraft());
  }, []);
  useEffect(() => {
    writeDraft(input);
  }, [input]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, crisis]);

  async function send(text: string, history: ChatMessage[]) {
    const next: ChatMessage[] = [...history, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setStreaming("");
    setEmotion("thinking");

    let reply = "";
    let finished = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // AIに送るのは直近の発言だけ（長い会話でも上限に引っかからない）
        body: JSON.stringify({ messages: trimHistory(next) }),
      });
      if (res.status === 401) throw new UnauthorizedError();
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        if (data.crisis) setCrisis(true);
        throw new Error("daily_limit");
      }
      if (!res.ok || !res.body) throw new Error(String(res.status));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "crisis") setCrisis(true);
          else if (ev.type === "reset") {
            reply = "";
            setStreaming("");
          } else if (ev.type === "delta") {
            reply += ev.text;
            setStreaming(reply);
          } else if (ev.type === "done") {
            finished = true;
            setEmotion(ev.emotion);
            if (ev.crisis) setCrisis(true);
            setMessages([...next, { role: "assistant", content: ev.reply }]);
          } else if (ev.type === "error") {
            if (ev.crisis) setCrisis(true);
            throw new Error(ev.code);
          }
        }
      }
      if (!finished) throw new Error("incomplete");
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        // 入力中の文章は端末に残したまま、初回設定（同意の取り直し）へ移る
        writeDraft(text);
        router.push("/onboarding");
        return;
      }
      // 入力した文章は消さずに戻し、再送できるようにする（企画書「エラー時の画面」）
      const code = e instanceof Error ? e.message : "unknown";
      setMessages(history);
      setInput(text);
      setEmotion("concerned");
      setError(ERROR_TEXT[code] ?? ERROR_TEXT.default);
    } finally {
      setStreaming(null);
    }
  }

  async function makeReflection() {
    setPhase("reflecting");
    try {
      const res = await fetch("/api/reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: trimToBudget(messages, MAX_REFLECTION_MESSAGES, MAX_REFLECTION_CHARS),
        }),
      });
      if (res.status === 401) {
        router.push("/onboarding");
        return;
      }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { reflection: Reflection };
      setReflection(data.reflection);
      setPhase("reflection");
    } catch {
      setPhase("reflectionFailed");
    }
  }

  const busy = streaming !== null;

  return (
    <main className="flex flex-1 flex-col gap-4 py-4">
      <header className="flex items-center gap-3">
        <Character emotion={emotion} size={56} />
        <div className="flex-1">
          <p className="font-semibold">コーチ</p>
          {moodBefore && <p className="text-xs text-muted">会話の前の気分：{moodBefore} / 5</p>}
        </div>
        {phase === "chat" && messages.length >= 2 && !busy && (
          <button
            type="button"
            onClick={() => setPhase("moodAfter")}
            className="rounded-full border border-line px-3 py-1 text-sm"
          >
            おわる
          </button>
        )}
      </header>

      {crisis && <CrisisCard />}

      {phase === "moodBefore" && (
        <MoodPicker
          question="いまの気分はどれに近いですか？"
          onPick={(v) => {
            setMoodBefore(v);
            setPhase("chat");
          }}
          onSkip={() => setPhase("chat")}
        />
      )}

      {phase !== "moodBefore" && (
        <ol className="flex flex-1 flex-col gap-3" aria-live="polite">
          <li className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-surface px-4 py-2 shadow-sm">
            こんにちは。今日はどんなことがありましたか？
          </li>
          {messages.map((m, i) => (
            <li
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${
                m.role === "user"
                  ? "self-end rounded-tr-sm bg-accent text-white"
                  : "self-start rounded-tl-sm bg-surface shadow-sm"
              }`}
            >
              {m.content}
            </li>
          ))}
          {streaming !== null && (
            <li className="max-w-[85%] self-start whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-surface px-4 py-2 shadow-sm">
              {streaming || <span className="text-muted">…</span>}
            </li>
          )}
        </ol>
      )}

      {error && (
        <p role="status" className="rounded-xl bg-danger-soft p-3 text-sm">
          {error}入力した文章は残してあります。もう一度送ってみてください。
        </p>
      )}

      {phase === "chat" && (
        <form
          className="sticky bottom-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && !busy) send(input.trim(), messages);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            maxLength={MAX_USER_CHARS}
            placeholder="いま思っていることを書いてみてください"
            aria-label="メッセージ"
            className="flex-1 resize-none rounded-2xl border border-line bg-surface p-3"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="rounded-2xl bg-accent px-4 font-semibold text-white disabled:opacity-40"
          >
            {error ? "再送" : "送る"}
          </button>
        </form>
      )}

      {phase === "moodAfter" && (
        <MoodPicker
          question="話してみて、いまの気分はどうですか？"
          onPick={(v) => {
            setMoodAfter(v);
            makeReflection();
          }}
          onSkip={makeReflection}
        />
      )}

      {phase === "reflecting" && <p className="text-center text-muted">振り返りをまとめています…</p>}

      {phase === "reflectionFailed" && (
        <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <p>振り返りをうまく作れませんでした。会話は残っています。</p>
          <button type="button" onClick={makeReflection} className="mt-2 font-semibold text-accent underline">
            もう一度つくる
          </button>
        </div>
      )}

      {phase === "reflection" && reflection && (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-bold">今日の振り返り</h2>
          <p>{reflection.summary}</p>
          <div>
            <h3 className="text-sm font-semibold text-muted">気づき</h3>
            <ul className="list-disc pl-5">
              {reflection.insights.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-accent-soft p-3">
            <h3 className="text-sm font-semibold">次の一歩</h3>
            <p>{reflection.next_step}</p>
          </div>
          <p className="text-xs text-muted">
            気分：{moodBefore ?? "未入力"} → {moodAfter ?? `未入力（AIの推定 ${reflection.mood_estimate}）`}
          </p>
          <Link href="/" className="block text-center font-semibold text-accent underline">
            ホームへ戻る
          </Link>
        </section>
      )}

      <div ref={bottomRef} />
    </main>
  );
}
