"use client";

/** 気分の1タップ入力（企画書：会話の前後に5段階の顔アイコン。文字のラベルも付ける。飛ばせる） */
export const MOODS = [
  { value: 1, face: "😣", label: "とてもつらい" },
  { value: 2, face: "😞", label: "つらい" },
  { value: 3, face: "😐", label: "ふつう" },
  { value: 4, face: "🙂", label: "良い" },
  { value: 5, face: "😄", label: "とても良い" },
] as const;

export function MoodPicker({
  question,
  onPick,
  onSkip,
}: {
  question: string;
  onPick: (value: number) => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-3 text-center font-medium">{question}</p>
      <div className="grid grid-cols-5 gap-1">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onPick(m.value)}
            className="flex flex-col items-center gap-1 rounded-xl py-2 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="text-3xl" aria-hidden>
              {m.face}
            </span>
            <span className="text-[11px] leading-tight text-muted">{m.label}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onSkip} className="mt-3 w-full text-sm text-muted underline">
        今はとばす
      </button>
    </div>
  );
}
