#!/bin/sh
# コミットしようとしているファイルに、他人に見られて困るものが含まれていないかを調べる。
# .githooks/pre-commit から呼ばれる。手動でも `sh scripts/check-secrets.sh` で実行できる。
# 見つけたらコミットを止める（終了コード 1）。

status=0

# ステージされたファイル（削除は除く）
files=$(git diff --cached --name-only --diff-filter=ACMR)
[ -z "$files" ] && exit 0

# 1) ファイル名で止める
for f in $files; do
  base=$(basename "$f")
  case "$base" in
    .env.example) continue ;;
    .env|.env.*|*.pem|*.key|*.p12|*.pfx|id_rsa*|id_ed25519*|*service-account*.json|*credentials*.json)
      echo "✗ 秘密のファイルはコミットできません: $f"
      status=1
      ;;
  esac
done

# 2) 中身で止める（API キーや秘密鍵らしき文字列）
patterns='sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sb_secret_[A-Za-z0-9_-]{20,}|service_role.{0,40}eyJ[A-Za-z0-9_-]{20,}'
for f in $files; do
  [ "$f" = "scripts/check-secrets.sh" ] && continue
  # 値そのものは画面やログに出さず、行番号だけを示す
  lines=$(git show ":$f" 2>/dev/null | grep -InE "$patterns" | cut -d: -f1 | tr '\n' ' ')
  if [ -n "$lines" ]; then
    echo "✗ $f に秘密の値らしき文字列があります（行: $lines）"
    status=1
  fi
done

# 3) .env.example に値が入っていないか（既定値として許すものを除く）
if echo "$files" | grep -qx ".env.example"; then
  filled=$(git show ":.env.example" | grep -E '^(ANTHROPIC_API_KEY|SESSION_SECRET|CONTENT_ENCRYPTION_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=.+')
  if [ -n "$filled" ]; then
    echo "✗ .env.example には値を書かず、名前だけにしてください:"
    echo "$filled" | sed 's/=.*/=…/; s/^/    /'
    status=1
  fi
fi

if [ $status -ne 0 ]; then
  echo ""
  echo "秘密の値は .env.local（Git の対象外）か、Vercel・Supabase の環境変数に入れてください。"
  echo "誤検知でどうしても必要な場合だけ、内容を確かめたうえで git commit --no-verify を使ってください。"
fi
exit $status
