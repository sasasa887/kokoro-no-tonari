-- 保存期間を過ぎたデータの削除を毎日実行する（企画書「非機能要件」：会話本文180日、操作ログ1年）
-- Supabase では pg_cron 拡張を使う。ダッシュボードの Database > Extensions で有効にできない環境では、
-- 下の create extension でも有効になる。
create extension if not exists pg_cron;

-- 同じ名前のジョブがあれば置き換える（何度実行しても1件になる）
select cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-data';

-- 毎日 3:15（UTC）＝日本時間 12:15 に実行する
select cron.schedule('purge-expired-data', '15 3 * * *', $$select public.purge_expired_data()$$);
