-- ココロのとなり：初期スキーマ（企画書「データ設計」）
-- すべてのテーブルで RLS を有効にし、本人のデータだけを読み書きできるようにする。
-- 会話の本文（messages.content、reflections の文章）はアプリ側で AES-256-GCM により暗号化してから保存する。

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  default_coach text not null check (default_coach in ('gentle', 'logical', 'cheer')),
  birth_month date not null,
  consent_version text not null,
  agreed_terms_at timestamptz not null,
  agreed_sensitive_at timestamptz not null,
  agreed_offshore_at timestamptz not null,
  agreed_voice_at timestamptz,
  created_at timestamptz not null default now(),
  -- 18歳以上に限定（生年月の1日生まれとみなし、日本時間の日付で判定する）
  constraint profiles_adult check (birth_month <= ((now() at time zone 'Asia/Tokyo')::date - interval '18 years'))
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  coach_type text not null check (coach_type in ('gentle', 'logical', 'cheer')),
  status text not null default 'active' check (status in ('active', 'ended')),
  crisis_flag boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null, -- 暗号文 "v1:iv:tag:ct"
  input_type text not null default 'text' check (input_type in ('text', 'voice')),
  emotion text check (emotion in ('happy', 'calm', 'concerned', 'thinking', 'cheer')),
  created_at timestamptz not null default now()
);
create index messages_session_idx on public.messages (session_id, created_at);
create index messages_created_idx on public.messages (created_at);

create table public.reflections (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  summary text not null, -- 暗号文
  insights text not null, -- 暗号文（JSON 配列を暗号化）
  next_step text not null, -- 暗号文
  mood_before smallint check (mood_before between 1 and 5),
  mood_after smallint check (mood_after between 1 and 5),
  mood_ai_estimate smallint check (mood_ai_estimate between 1 and 5),
  helpful boolean,
  voice_fatigue smallint check (voice_fatigue between 1 and 3),
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index reflections_user_created_idx on public.reflections (user_id, created_at desc);

-- 成功の指標を測るための操作ログ。会話の本文は含めない
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  session_id uuid references public.sessions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index events_name_created_idx on public.events (name, created_at);

-- ---- RLS ----
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.reflections enable row level security;
alter table public.events enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own sessions" on public.sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- 会話に紐づく行は、user_id が本人であることに加えて、session_id の会話も本人のものであることを確かめる
-- （他人の会話の ID に行を書き込んだり、振り返りの主キーを先に取ったりできないようにする）
create policy "own messages" on public.messages
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );
create policy "own reflections" on public.reflections
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );
-- 操作ログは本人が追加だけできる（読み取りは管理用の集計で行う）
create policy "insert own events" on public.events
  for insert
  with check (
    user_id = auth.uid()
    and (
      session_id is null
      or exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
    )
  );

-- ---- 保存期間（企画書「非機能要件」） ----
-- 会話の本文は180日、操作ログは1年で削除する。振り返りと気分は本人が消すまで残す。
create or replace function public.purge_expired_data() returns void
language sql security definer set search_path = public as $$
  delete from public.messages where created_at < now() - interval '180 days';
  delete from public.events where created_at < now() - interval '1 year';
$$;
revoke all on function public.purge_expired_data() from public, anon, authenticated;
-- 定期実行の登録は 0002_schedule_purge.sql で行う
