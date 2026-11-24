# ココロのとなり

キャラクターのAIコーチに話しかけてモヤモヤを整理し、気分の変化を見える化する Web アプリ。
18歳以上の社会人と学生が対象。企画書（Claude Docs「AIメンタルコーチアプリ 企画書」）にもとづいて作っている。

## いまできること（1週目「設計と環境構築」の範囲）

- 年齢確認（18歳未満は登録できず、相談窓口を案内）
- 同意画面（利用規約・要配慮個人情報・外国への提供の3つを1画面で。詳細は折りたたみ）
- 呼び名とコーチのタイプ（3種類）の選択
- 会話の前後の気分入力（5段階、飛ばせる）
- AIとの対話（返答をストリーミング表示。構造化出力で crisis / emotion / reply を受け取る）
- 危機の検知（キーワード判定と AI の判定の両方。相談窓口のカードを表示）
- 会話の振り返り（話したこと・気づき・次の一歩・AIによる気分の推定）
- エラー時の再送（入力した文章は残す）、入力中の文章の一時保存
- Supabase の DB スキーマ（RLS、保存期間の削除処理）と、会話本文の暗号化（AES-256-GCM）の部品

`ANTHROPIC_API_KEY` がなければ、決まった返答を返すモックで動く。

デモモードのプロフィールは HMAC で署名した Cookie に入れている（`SESSION_SECRET`、本番では必須）。
対話と振り返りには1日の回数制限がある。ただしメモリ上で数えているため、サーバーレスでは目安にとどまる。
本物の API キーで一般公開するのは、Supabase の Auth と DB での上限管理に移してからにする。

## まだつないでいないもの（次の作業）

- Supabase の Auth（ログイン）と DB への保存。今はプロフィールを Cookie に入れるデモモード
- 1日の発言数の上限、履歴一覧、気分グラフ、設定画面
- 音声入力、キャラクターの画像、声の疲れ度チェック（仕上げフェーズ）

## 動かし方

```bash
npm install
cp .env.example .env.local   # 必要なら ANTHROPIC_API_KEY などを入れる
npm run dev
```

## 公開するときの設定

- Vercel の関数は東京リージョン（`vercel.json` の `regions: ["hnd1"]`）で動かす。同意画面とプライバシーポリシーの説明と合わせるため、変えないこと。
- Supabase のプロジェクトは東京リージョン（Northeast Asia (Tokyo)）で作る。
- `supabase/migrations` を順に当てる。`0002_schedule_purge.sql` で、保存期間を過ぎたデータを毎日削除するジョブ（pg_cron）が登録される。登録できたかは `select * from cron.job;` で確かめる。

## 確認

```bash
npm test          # 年齢判定・危機キーワード・暗号化・返答の取り出しの単体テスト
npm run typecheck
npm run lint
npm run build
```

## 構成

| 場所 | 内容 |
| --- | --- |
| `src/app/onboarding` | 年齢確認 → 同意 → 呼び名とコーチ |
| `src/app/chat` | 気分入力、対話、振り返り |
| `src/app/api/chat` | 対話 API（NDJSON でストリーミング） |
| `src/app/api/reflection` | 振り返り API |
| `src/lib/ai` | Claude API の呼び出し、出力のスキーマ、返答の逐次取り出し |
| `src/lib/crisis.ts` | 危機キーワードの判定と相談窓口の案内 |
| `src/lib/consent.ts` | 同意画面の文面（版を管理） |
| `src/lib/crypto.ts` | 会話本文の暗号化 |
| `supabase/migrations` | DB スキーマと RLS |

## AIの設定

- 既定のモデルは対話・振り返りとも Claude Opus 5.5（`CHAT_MODEL` / `REFLECTION_MODEL` で切り替え）。対話のモデルは品質評価で Haiku 5.5 と比べて決める。
- 安全分類器による拒否が起きたときに、サーバー側で別のモデルが引き継ぐ機能（ベータ、`fallbacks: "default"`）を有効にしている。不要なら `src/lib/ai/claude.ts` の `fallbacks` と `betas` を外す。
- 相談窓口の案内（`src/lib/crisis.ts`）の内容は、公開前に厚生労働省のページで確認する。
