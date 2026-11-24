import type { Emotion } from "@/lib/ai/schema";

/**
 * 仮のキャラクター（企画書：感情ラベル5種類に対応する画像を、仕上げフェーズで差し替える）。
 */
const MOUTHS: Record<Emotion, string> = {
  happy: "M38 62 Q50 74 62 62",
  calm: "M40 64 Q50 69 60 64",
  concerned: "M40 67 Q50 61 60 67",
  thinking: "M42 65 L58 63",
  cheer: "M36 60 Q50 78 64 60 Z",
};

const LABELS: Record<Emotion, string> = {
  happy: "うれしそう",
  calm: "おだやか",
  concerned: "心配そう",
  thinking: "考えている",
  cheer: "応援している",
};

export function Character({ emotion = "calm", size = 72 }: { emotion?: Emotion; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`コーチ（${LABELS[emotion]}）`}>
      <circle cx="50" cy="52" r="40" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="3" />
      <ellipse cx="24" cy="18" rx="9" ry="12" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="3" />
      <ellipse cx="76" cy="18" rx="9" ry="12" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="3" />
      {emotion === "thinking" ? (
        <>
          <path d="M33 46 L43 46" stroke="var(--foreground)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="62" cy="46" r="4" fill="var(--foreground)" />
        </>
      ) : (
        <>
          <circle cx="38" cy="46" r="4" fill="var(--foreground)" />
          <circle cx="62" cy="46" r="4" fill="var(--foreground)" />
        </>
      )}
      <circle cx="28" cy="58" r="5" fill="var(--accent)" opacity="0.35" />
      <circle cx="72" cy="58" r="5" fill="var(--accent)" opacity="0.35" />
      <path
        d={MOUTHS[emotion]}
        stroke="var(--foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        fill={emotion === "cheer" ? "var(--foreground)" : "none"}
      />
    </svg>
  );
}
