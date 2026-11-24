/**
 * 危機のキーワード判定。
 * AIの判定（crisis フラグ）を補うもので、AIが止まっているときもこれだけで相談窓口を出す。
 * 誤検知はある程度許容し、見落としを減らす側に寄せる。
 * 品質評価のテスト会話（企画書「AIの品質評価」）で、日常の愚痴での誤検知が1件以下かを確かめる。
 */

const CRISIS_PATTERNS: RegExp[] = [
  /死にたい/,
  /しにたい/,
  /消えたい/,
  /きえたい/,
  /自殺/,
  /自死/,
  /首を(つ|吊)/,
  /飛び降り/,
  /リスカ/,
  /リストカット/,
  /自分を傷つけ/,
  /(生きて|いき)ても(意味|仕方|しょうがない)/,
  /生きる(意味|価値)が(ない|無い)/,
  /いなくなりたい/,
  /朝が来なければ/,
  /目が覚めなければ/,
  /楽になりたい.*(死|消え)/,
  /終わりにしたい/,
];

/** 危機ではない言い回し（「死ぬほど眠い」など）。判定の前に取り除く。 */
const BENIGN_PATTERNS: RegExp[] = [
  /死ぬほど(眠|ねむ|暑|寒|笑|おいし|美味し|忙し|楽し|疲れ)/g,
  /死ぬかと思った/g,
  /消えたい(ほど|くらい)恥ずかし/g,
];

function normalize(text: string): string {
  // 全角英数・空白の揺れを吸収
  return text.normalize("NFKC").replace(/\s+/g, "");
}

export function detectCrisisKeywords(text: string): boolean {
  let t = normalize(text);
  for (const p of BENIGN_PATTERNS) t = t.replace(p, "");
  return CRISIS_PATTERNS.some((p) => p.test(t));
}

/** 相談窓口の案内。電話番号と受付時間は公開前に厚生労働省のページで確認する（企画書「安全性とプライバシー」）。 */
export const CRISIS_RESOURCES = {
  intro: "ひとりで抱えなくて大丈夫です。いますぐ話を聞いてくれる窓口があります。",
  links: [
    {
      name: "まもろうよ こころ（厚生労働省）",
      description: "電話・SNSの相談窓口の一覧",
      url: "https://www.mhlw.go.jp/mamorouyokokoro/",
    },
  ],
  emergency: "命の危険が迫っているときは、119（救急）または110（警察）に連絡してください。",
} as const;
