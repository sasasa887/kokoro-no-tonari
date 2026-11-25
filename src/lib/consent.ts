/**
 * 同意画面の定義（企画書「機能一覧：同意画面」「非機能要件：同意画面」）。
 * 3つの同意を1画面にまとめ、要点は2行以内、詳細は折りたたみで示す。
 * 文面を変えたら CONSENT_VERSION を上げ、変更点だけを示して同意を取り直す。
 */
export const CONSENT_VERSION = "2026-11-draft1";

export type ConsentKey = "terms" | "sensitive" | "offshore";

export type ConsentItem = {
  key: ConsentKey;
  title: string;
  summary: string;
  details: string[];
};

export const CONSENT_ITEMS: ConsentItem[] = [
  {
    key: "terms",
    title: "利用規約",
    summary: "AIのコーチと話して気持ちを整理するアプリです。医療や診断の代わりにはなりません。",
    details: [
      "対象は18歳以上の方です。",
      "AIの返答は誤ることがあります。体調や治療のことは医療機関に相談してください。",
      "危険を感じる内容があったときは、専門の相談窓口をご案内します。",
      "会話の本文は180日で自動的に削除します。アカウントを削除するとすべてのデータをすぐに消します。",
    ],
  },
  {
    key: "sensitive",
    title: "心と体の健康に関する情報",
    summary: "会話には心身の健康に関する内容が含まれることがあります。それを保存して使うことに同意します。",
    details: [
      "病歴や通院のことなど、法律で「要配慮個人情報」とされる情報が会話に含まれる場合があります。",
      "保存した内容は、AIの返答・振り返り・気分のグラフを作るためだけに使います。",
      "会話の本文は暗号化して保存し、本人以外は読めないようにしています。",
    ],
  },
  {
    key: "offshore",
    title: "外国の会社への提供",
    summary: "AIが返事をするために、会話を米国の会社（Anthropic）に送ります。学習には使われません。",
    details: [
      "提供先：Anthropic（米国）。API の入出力は原則30日以内に削除され、利用ポリシー違反と判定された場合は最長2年保持されます。",
      "このアプリの配信とデータの保管に、米国企業の Vercel と Supabase を使います（保管場所は東京リージョン）。",
      "米国の個人情報保護制度については、個人情報保護委員会の資料をご確認ください。",
    ],
  },
];

export type ConsentState = Record<ConsentKey, boolean>;

export function allConsented(state: Partial<ConsentState>): state is ConsentState {
  return CONSENT_ITEMS.every((item) => state[item.key] === true);
}
