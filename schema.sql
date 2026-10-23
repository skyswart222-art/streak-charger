-- =====================================================================
-- Streak Charger database (Stage 1: accounts and sync · Stage 2: friends)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- It is safe to run again: it only creates things that don't exist yet
-- and replaces the functions and security rules with the latest version.
-- =====================================================================

-- ---------- Profiles: one per account, holds the public display name ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (display_name ~ '^[A-Za-z0-9_.]{3,20}$'),
  avatar_url   text,
  streak       integer not null default 0 check (streak >= 0),   -- highest live streak across trackers
  tier_idx     integer not null default 0 check (tier_idx >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Display names are unique regardless of capitals ("Sky" and "sky" clash).
create unique index if not exists profiles_display_name_unique on public.profiles (lower(display_name));
-- Stats the database works out from your logged bets (Stage 2). Nobody can type these in.
alter table public.profiles add column if not exists best_streak    integer not null default 0;
alter table public.profiles add column if not exists streak_tracker text;
alter table public.profiles add column if not exists banked         double precision not null default 0;
-- Live progress on the tracker friends see (worked out by recompute_profile_stats, never typed in).
create table if not exists public.profile_live (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  tracker    text,
  streak     integer not null default 0,
  balance    double precision,
  start      double precision,
  target     double precision,
  to_go      integer,
  frac       double precision not null default 0,
  pending    boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.profile_live enable row level security;
-- Odds of the bet running on that tracker, so friends can see how risky it is.
alter table public.profile_live add column if not exists odds double precision;

-- ---------- Settings: themes, achievements, recent sports, stats layout ----------
create table if not exists public.user_settings (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Trackers (the tabs) ----------
-- Times are stored as milliseconds since 1970, exactly as the app uses them.
create table if not exists public.trackers (
  id            text primary key check (length(id) between 4 and 40),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (length(name) between 1 and 30),
  accent        text not null,
  start_balance double precision not null check (start_balance > 0),
  target        double precision not null check (target > 0),
  odds_mode     text not null check (odds_mode in ('auto', 'fixed')),
  fixed_odds    double precision not null check (fixed_odds > 1),
  paused        boolean not null default false,
  target_edits  jsonb not null default '[]'::jsonb,
  position      integer not null default 0,
  created_at    bigint not null,
  updated_at    timestamptz not null default now()
);
create index if not exists trackers_user_idx on public.trackers (user_id);
-- Unticked in Tracker options: only you can see this tracker. It stays out of the feed, leaderboards and challenges.
alter table public.trackers add column if not exists shared boolean not null default true;

-- ---------- Bets ----------
create table if not exists public.bets (
  id          text primary key check (length(id) between 4 and 40),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tracker_id  text not null references public.trackers (id) on delete cascade,
  odds        double precision not null check (odds > 1),
  sport       text not null check (length(sport) between 1 and 40),
  text        text not null check (length(text) between 1 and 120),
  link        text not null default '' check (length(link) <= 2000),
  result      text not null check (result in ('pending', 'win', 'loss')),
  created_at  bigint not null,
  settled_at  bigint,
  edits       jsonb not null default '[]'::jsonb check (jsonb_typeof(edits) = 'array'),
  updated_at  timestamptz not null default now()
);
create index if not exists bets_user_idx on public.bets (user_id);
create index if not exists bets_tracker_idx on public.bets (tracker_id, created_at);

-- ---------- Run actions: bank, end run, pause, resume, target change ----------
create table if not exists public.tracker_actions (
  id          text primary key check (length(id) between 4 and 40),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tracker_id  text not null references public.trackers (id) on delete cascade,
  type        text not null check (type in ('bank', 'end', 'pause', 'resume', 'target')),
  at          bigint not null,
  payload     jsonb not null default '{}'::jsonb
);
create index if not exists actions_tracker_idx on public.tracker_actions (tracker_id, at);

-- =====================================================================
-- Rules the database enforces itself, so they hold even if someone
-- bypasses the app.
-- =====================================================================
create or replace function public.now_ms() returns bigint language sql stable as
$$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- New bets: always yours, can't be dated in the future, and must go in one of your trackers.
create or replace function public.guard_bet_insert() returns trigger language plpgsql as $$
begin
  new.user_id := auth.uid();
  if new.created_at > public.now_ms() + 300000 then
    raise exception 'A bet can''t be dated in the future.';
  end if;
  if not exists (select 1 from public.trackers t where t.id = new.tracker_id and t.user_id = new.user_id) then
    raise exception 'That tracker isn''t yours.';
  end if;
  if new.result <> 'pending' and new.settled_at is null then new.settled_at := new.created_at; end if;
  return new;
end $$;

-- Bet edits follow the app's rules:
--   * bet text, sport and link lock 24 hours after the bet was logged
--   * odds can be changed any time, but every change is written to the edit history ("edited" tag)
--   * a result can be corrected for 24 hours after it was set, and the correction is recorded
--   * the edit history can only grow, never be rewritten
create or replace function public.guard_bet_update() returns trigger language plpgsql as $$
declare
  now_ms  bigint := public.now_ms();
  n_old   integer := jsonb_array_length(old.edits);
  grew    boolean := jsonb_array_length(new.edits) > n_old;
  details boolean := (new.text, new.sport, new.link) is distinct from (old.text, old.sport, old.link);
begin
  if new.user_id <> old.user_id or new.tracker_id <> old.tracker_id or new.created_at <> old.created_at then
    raise exception 'A bet can''t be moved to another tracker or re-dated.';
  end if;
  if jsonb_array_length(new.edits) < n_old
     or (n_old > 0 and (select jsonb_agg(e order by i) from jsonb_array_elements(new.edits) with ordinality as x(e, i) where i <= n_old) <> old.edits) then
    raise exception 'A bet''s edit history can''t be changed or removed.';
  end if;
  if details and now_ms - old.created_at > 86400000 then
    raise exception 'Bet, sport and link lock 24 hours after the bet is logged. Only the odds can still change.';
  end if;
  if (details or new.odds <> old.odds) and not grew then
    raise exception 'Every change to a logged bet has to be recorded in its edit history.';
  end if;
  if new.result <> old.result then
    if old.result <> 'pending' then
      if now_ms - coalesce(old.settled_at, old.created_at) > 86400000 then
        raise exception 'This result locked 24 hours after it was set.';
      end if;
      if not grew then raise exception 'Result corrections have to be recorded in the edit history.'; end if;
    end if;
  end if;
  -- settled_at is stamped when a bet is settled and cleared if it goes back to pending.
  if new.result = 'pending' then
    new.settled_at := null;
  elsif old.result = 'pending' then
    if new.settled_at is null or new.settled_at > now_ms + 300000 then new.settled_at := now_ms; end if;
  else
    new.settled_at := old.settled_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Logged bets can never be deleted. The only exception is when a whole account is deleted.
create or replace function public.guard_bet_delete() returns trigger language plpgsql as $$
begin
  if exists (select 1 from auth.users u where u.id = old.user_id) then
    raise exception 'Logged bets can''t be deleted.';
  end if;
  return old;
end $$;

create or replace function public.guard_tracker_write() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  elsif new.user_id <> old.user_id or new.created_at <> old.created_at then
    raise exception 'A tracker can''t change owner or creation date.';
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.guard_action_insert() returns trigger language plpgsql as $$
begin
  new.user_id := auth.uid();
  if new.at > public.now_ms() + 300000 then raise exception 'An action can''t be dated in the future.'; end if;
  if not exists (select 1 from public.trackers t where t.id = new.tracker_id and t.user_id = new.user_id) then
    raise exception 'That tracker isn''t yours.';
  end if;
  return new;
end $$;

create or replace function public.guard_profile_update() returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at then raise exception 'Not allowed.'; end if;
  -- Streak, tier and banked total come from your logged bets only (see recompute_profile_stats).
  if current_user in ('authenticated', 'anon') then
    new.streak := old.streak; new.tier_idx := old.tier_idx; new.best_streak := old.best_streak;
    new.streak_tracker := old.streak_tracker; new.banked := old.banked;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists bets_guard_insert on public.bets;
create trigger bets_guard_insert before insert on public.bets for each row execute function public.guard_bet_insert();
drop trigger if exists bets_guard_update on public.bets;
create trigger bets_guard_update before update on public.bets for each row execute function public.guard_bet_update();
drop trigger if exists bets_guard_delete on public.bets;
create trigger bets_guard_delete before delete on public.bets for each row execute function public.guard_bet_delete();
drop trigger if exists trackers_guard on public.trackers;
create trigger trackers_guard before insert or update on public.trackers for each row execute function public.guard_tracker_write();
drop trigger if exists actions_guard_insert on public.tracker_actions;
create trigger actions_guard_insert before insert on public.tracker_actions for each row execute function public.guard_action_insert();
drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update before update on public.profiles for each row execute function public.guard_profile_update();

-- ---------- New account → profile with the display name chosen at sign-up ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Lets the sign-up form check a name before the account is created.
create or replace function public.name_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select name ~ '^[A-Za-z0-9_.]{3,20}$'
     and not exists (select 1 from public.profiles p where lower(p.display_name) = lower(name) and p.id is distinct from auth.uid());
$$;
grant execute on function public.name_available(text) to anon, authenticated;

-- =====================================================================
-- Row Level Security: who can read and change what
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.user_settings   enable row level security;
alter table public.trackers        enable row level security;
alter table public.bets            enable row level security;
alter table public.tracker_actions enable row level security;

-- Profiles: any signed-in user can see names, photos and streaks (needed for friends and
-- leaderboards later). You can only change your own.
drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Settings: only your own.
drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Trackers: read, add and change your own. No delete rule, so trackers can't be deleted.
drop policy if exists "read own trackers" on public.trackers;
create policy "read own trackers" on public.trackers for select to authenticated using (user_id = auth.uid());
drop policy if exists "add own trackers" on public.trackers;
create policy "add own trackers" on public.trackers for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "change own trackers" on public.trackers;
create policy "change own trackers" on public.trackers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bets: read, add and change your own. No delete rule, plus the delete guard above.
drop policy if exists "read own bets" on public.bets;
create policy "read own bets" on public.bets for select to authenticated using (user_id = auth.uid());
drop policy if exists "add own bets" on public.bets;
create policy "add own bets" on public.bets for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "change own bets" on public.bets;
create policy "change own bets" on public.bets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Actions: read and add your own. They are a permanent record, so no changes or deletes.
drop policy if exists "read own actions" on public.tracker_actions;
create policy "read own actions" on public.tracker_actions for select to authenticated using (user_id = auth.uid());
drop policy if exists "add own actions" on public.tracker_actions;
create policy "add own actions" on public.tracker_actions for insert to authenticated with check (user_id = auth.uid());

-- =====================================================================
-- Profile photos: a public "avatars" bucket; each user writes only in
-- a folder named after their own user id.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar read own folder" on storage.objects;
create policy "avatar read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar upload own folder" on storage.objects;
create policy "avatar upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar replace own folder" on storage.objects;
create policy "avatar replace own folder" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar delete own folder" on storage.objects;
create policy "avatar delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Stage 2 · Streaks worked out by the database
-- Every time bets, run actions or trackers change, the owner's profile
-- is recalculated from their logged bets, using the same rules as the app.
-- =====================================================================
create or replace function public.tier_for(n integer) returns integer language sql immutable as $$
  select (select count(*) from unnest(array[0,5,10,15,20,25,35,50,65,80,90,100,125,150,175,200]) m where m <= n)::integer - 1;
$$;

create or replace function public.recompute_profile_stats(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t record; e record;
  bal double precision; amt double precision; streak integer;
  live integer := 0; live_name text; ever integer := 0; banked_total double precision := 0;
  odds double precision; need integer; pick record; picked boolean := false; pick_streak integer := -1;
begin
  -- Only trackers you show to others count towards the streak friends and the community see.
  for t in select * from public.trackers where user_id = uid and shared order by position, created_at loop
    bal := t.start_balance; streak := 0;
    for e in
      select 0 as k, b.created_at as at, b.id as id, b.result, b.odds, null::text as type, null::jsonb as payload
        from public.bets b where b.tracker_id = t.id
      union all
      select 1, a.at, a.id, null, null, a.type, a.payload from public.tracker_actions a where a.tracker_id = t.id
      order by at, k, id
    loop
      if e.k = 0 then
        if e.result = 'win' then bal := bal * e.odds; streak := streak + 1; ever := greatest(ever, streak);
        elsif e.result = 'loss' then bal := t.start_balance; streak := 0;
        end if;
      elsif e.type = 'bank' then
        amt := case when jsonb_typeof(e.payload -> 'amount') = 'number' then (e.payload ->> 'amount')::double precision else 0 end;
        amt := greatest(0, least(amt, bal)); bal := bal - amt; banked_total := banked_total + amt;
      elsif e.type = 'end' then
        banked_total := banked_total + bal; bal := t.start_balance; streak := 0;
      end if;
    end loop;
    if streak > live then live := streak; live_name := t.name; end if;
    -- Progress shown to friends: the tracker with the live streak (or the first one), worked out like the
    -- app's ring: wins so far out of wins so far plus wins still needed at the tracker's typical odds.
    if streak > pick_streak then
      if t.odds_mode = 'auto' then
        select percentile_cont(0.5) within group (order by x.odds) into odds
          from (select b.odds from public.bets b where b.tracker_id = t.id order by b.created_at desc, b.id desc limit 10) x;
      end if;
      odds := coalesce(case when t.odds_mode = 'auto' then odds end, t.fixed_odds);
      need := case when bal >= t.target then 0 when odds <= 1 or bal <= 0 then null
                   else greatest(1, ceil(ln(t.target / bal) / ln(odds) - 1e-9))::integer end;
      select t.name as name, streak as streak, bal as balance, t.start_balance as start, t.target as target, need as to_go,
             case when bal >= t.target then 1.0 when need is null or streak + need = 0 then 0.0 else streak::double precision / (streak + need) end as frac,
             exists (select 1 from public.bets b where b.tracker_id = t.id and b.result = 'pending') as pending,
             (select b.odds from public.bets b where b.tracker_id = t.id and b.result = 'pending' order by b.created_at desc, b.id desc limit 1) as pending_odds
        into pick;
      picked := true; pick_streak := streak;
    end if;
  end loop;
  if picked then
    insert into public.profile_live (user_id, tracker, streak, balance, start, target, to_go, frac, pending, odds, updated_at)
    values (uid, pick.name, pick.streak, round(pick.balance::numeric, 2), pick.start, pick.target, pick.to_go, pick.frac, pick.pending, pick.pending_odds, now())
    on conflict (user_id) do update set tracker = excluded.tracker, streak = excluded.streak, balance = excluded.balance, start = excluded.start,
      target = excluded.target, to_go = excluded.to_go, frac = excluded.frac, pending = excluded.pending, odds = excluded.odds, updated_at = now();
  else
    delete from public.profile_live where user_id = uid;
  end if;
  update public.profiles
     set streak = live, tier_idx = public.tier_for(live), best_streak = ever, streak_tracker = live_name, banked = round(banked_total::numeric, 2)
   where id = uid;
end $$;
revoke all on function public.recompute_profile_stats(uuid) from public, anon, authenticated;

create or replace function public.after_activity_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  for uid in select distinct user_id from changed loop perform public.recompute_profile_stats(uid); end loop;
  return null;
end $$;
drop trigger if exists bets_stats_insert on public.bets;
create trigger bets_stats_insert after insert on public.bets referencing new table as changed for each statement execute function public.after_activity_change();
drop trigger if exists bets_stats_update on public.bets;
create trigger bets_stats_update after update on public.bets referencing new table as changed for each statement execute function public.after_activity_change();
drop trigger if exists actions_stats_insert on public.tracker_actions;
create trigger actions_stats_insert after insert on public.tracker_actions referencing new table as changed for each statement execute function public.after_activity_change();
drop trigger if exists trackers_stats_insert on public.trackers;
create trigger trackers_stats_insert after insert on public.trackers referencing new table as changed for each statement execute function public.after_activity_change();
drop trigger if exists trackers_stats_update on public.trackers;
create trigger trackers_stats_update after update on public.trackers referencing new table as changed for each statement execute function public.after_activity_change();

-- Bring existing accounts up to date.
select public.recompute_profile_stats(id) from public.profiles;

-- =====================================================================
-- Stage 2 · Friends
-- A request is one row. The person who receives it can accept (it becomes
-- a friendship) or decline (it's removed). Either friend can unfriend.
-- All changes go through the functions below; nobody edits rows directly.
-- =====================================================================
create table if not exists public.friendships (
  id          bigint generated always as identity primary key,
  requester   uuid not null references public.profiles (id) on delete cascade,
  addressee   uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);
alter table public.friendships enable row level security;
drop policy if exists "see your own friendships" on public.friendships;
create policy "see your own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));

-- Send a request. If they already asked you, this accepts theirs instead.
-- Returns 'sent' or 'friends'.
create or replace function public.friend_request(target uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); f public.friendships;
begin
  if me is null then raise exception 'Log in first.'; end if;
  if target = me then raise exception 'You can''t add yourself.'; end if;
  if not exists (select 1 from public.profiles where id = target) then raise exception 'That person doesn''t exist.'; end if;
  select * into f from public.friendships
   where least(requester, addressee) = least(me, target) and greatest(requester, addressee) = greatest(me, target) for update;
  if found then
    if f.status = 'accepted' then return 'friends'; end if;
    if f.requester = me then return 'sent'; end if;
    update public.friendships set status = 'accepted', accepted_at = now() where id = f.id;
    return 'friends';
  end if;
  if (select count(*) from public.friendships where requester = me and status = 'pending') >= 100 then
    raise exception 'You have too many requests waiting. Cancel some first.';
  end if;
  insert into public.friendships (requester, addressee) values (me, target);
  return 'sent';
end $$;

-- Accept or decline a request someone sent you.
create or replace function public.friend_respond(other uuid, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Log in first.'; end if;
  if accept then
    update public.friendships set status = 'accepted', accepted_at = now()
     where requester = other and addressee = me and status = 'pending';
    if not found then raise exception 'That request isn''t there any more.'; end if;
    return 'friends';
  end if;
  delete from public.friendships where requester = other and addressee = me and status = 'pending';
  return 'declined';
end $$;

-- Cancel a request you sent, or unfriend someone.
create or replace function public.friend_remove(other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  delete from public.friendships
   where least(requester, addressee) = least(auth.uid(), other) and greatest(requester, addressee) = greatest(auth.uid(), other);
end $$;

-- Your friends and requests, with each person's public profile.
create or replace function public.my_friends()
returns table (id uuid, display_name text, avatar_url text, streak integer, tier_idx integer, best_streak integer,
               streak_tracker text, banked double precision, status text, incoming boolean, since timestamptz)
language sql stable set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, p.streak, p.tier_idx, p.best_streak, p.streak_tracker, p.banked,
         f.status, f.addressee = auth.uid(), coalesce(f.accepted_at, f.created_at)
    from public.friendships f
    join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
   where auth.uid() in (f.requester, f.addressee);
$$;

-- Find people by display name (names starting with the search come first).
create or replace function public.search_profiles(q text)
returns table (id uuid, display_name text, avatar_url text, streak integer, tier_idx integer)
language sql stable set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, p.streak, p.tier_idx
    from public.profiles p
   where length(trim(q)) >= 2 and p.id <> auth.uid()
     and strpos(lower(p.display_name), lower(trim(q))) > 0
   order by strpos(lower(p.display_name), lower(trim(q))), length(p.display_name), p.display_name
   limit 20;
$$;

revoke all on function public.friend_request(uuid), public.friend_respond(uuid, boolean), public.friend_remove(uuid),
                       public.my_friends(), public.search_profiles(text) from public, anon;
grant execute on function public.friend_request(uuid), public.friend_respond(uuid, boolean), public.friend_remove(uuid),
                          public.my_friends(), public.search_profiles(text) to authenticated;

-- =====================================================================
-- Stage 3 · Leaderboard
-- Ranks your friends (and you), or everyone, by live streak, best streak
-- or banked total. Everyone-rankings leave out people on zero. Your own
-- row always comes back, even when you're outside the top.
-- =====================================================================
drop function if exists public.leaderboard(text, text, integer);
create or replace function public.leaderboard(scope text default 'friends', metric text default 'streak', lim integer default 50)
returns table (rank bigint, id uuid, display_name text, avatar_url text, streak integer, tier_idx integer,
               best_streak integer, banked double precision, streak_tracker text, score double precision, is_me boolean,
               live jsonb)
language sql stable security definer set search_path = public as $$
  with pool as (
    select p.*,
           case metric when 'best' then p.best_streak::double precision when 'banked' then p.banked else p.streak::double precision end as score
      from public.profiles p
     where auth.uid() is not null
       and (p.id = auth.uid()
            or (scope = 'everyone')
            or exists (select 1 from public.friendships f
                        where f.status = 'accepted'
                          and ((f.requester = auth.uid() and f.addressee = p.id) or (f.addressee = auth.uid() and f.requester = p.id))))
  ), ranked as (
    select rank() over (order by score desc) as rank, pool.* from pool
     where scope <> 'everyone' or score > 0 or id = auth.uid()
  )
  select r.rank, r.id, r.display_name, r.avatar_url, r.streak, r.tier_idx, r.best_streak, r.banked, r.streak_tracker, r.score, r.id = auth.uid(),
         (select to_jsonb(l) - 'user_id' - 'updated_at' from public.profile_live l where l.user_id = r.id)
    from ranked r
   where r.rank <= least(greatest(lim, 1), 100) or r.id = auth.uid()
   order by r.rank, r.display_name;
$$;
revoke all on function public.leaderboard(text, text, integer) from public, anon;
grant execute on function public.leaderboard(text, text, integer) to authenticated;

-- =====================================================================
-- Stage 4 · Chat
-- One-to-one messages between friends. A message can carry one of your
-- own logged bets; the database checks it's yours and shows its live
-- result. Messages can't be edited or deleted. Only the two people in a
-- chat can read it.
-- =====================================================================
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships f where f.status = 'accepted'
                  and least(f.requester, f.addressee) = least(a, b) and greatest(f.requester, f.addressee) = greatest(a, b));
$$;

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  sender     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient  uuid not null references public.profiles (id) on delete cascade,
  body       text not null default '' check (length(body) <= 1000),
  bet_id     text references public.bets (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  check (sender <> recipient),
  check (length(trim(body)) > 0 or bet_id is not null)
);
create index if not exists messages_pair_idx on public.messages (least(sender, recipient), greatest(sender, recipient), id desc);
create index if not exists messages_unread_idx on public.messages (recipient) where read_at is null;
-- Photos and voice notes: the file lives in the private "chat-media" bucket, the message points at it.
alter table public.messages add column if not exists media_path text, add column if not exists media_kind text, add column if not exists media_meta jsonb;
create index if not exists messages_media_idx on public.messages (media_path) where media_path is not null;
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.messages'::regclass and contype = 'c'
             and conname <> 'messages_has_content' and pg_get_constraintdef(oid) ilike '%bet_id IS NOT NULL%' loop
    execute format('alter table public.messages drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.messages drop constraint if exists messages_has_content;
alter table public.messages add constraint messages_has_content check (length(trim(body)) > 0 or bet_id is not null or media_path is not null);
alter table public.messages drop constraint if exists messages_media_ok;
alter table public.messages add constraint messages_media_ok check ((media_path is null) = (media_kind is null) and (media_kind is null or media_kind in ('photo', 'voice')));

-- Checks an attachment before a message can point at it: your own upload, a sensible name,
-- and only the size or length details the app shows.
create or replace function public.check_chat_media(path text, kind text, meta jsonb, sender uuid) returns jsonb
language plpgsql stable set search_path = public as $$
begin
  if kind not in ('photo', 'voice') or path !~ ('^' || sender::text || '/[A-Za-z0-9_-]{6,64}\.(jpg|m4a|mp4|aac|webm|ogg)$') then
    raise exception 'That attachment can''t be sent.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'chat-media' and o.name = path) then
    raise exception 'That attachment didn''t finish uploading. Try again.';
  end if;
  if kind = 'photo' then
    return jsonb_build_object('w', least(greatest(coalesce((meta->>'w')::int, 0), 0), 10000), 'h', least(greatest(coalesce((meta->>'h')::int, 0), 0), 10000));
  end if;
  return jsonb_build_object('dur', round(least(greatest(coalesce((meta->>'dur')::numeric, 0), 0), 300), 1));
exception when invalid_text_representation then
  raise exception 'That attachment can''t be sent.';
end $$;

create table if not exists public.message_reactions (
  message_id bigint not null references public.messages (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji      text not null check (emoji in ('🔥', '💪', '😂', '😬', '👏', '❤️')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create or replace function public.guard_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.sender := auth.uid(); new.created_at := now(); new.read_at := null;
  if new.sender is null then raise exception 'Log in first.'; end if;
  if not public.are_friends(new.sender, new.recipient) then raise exception 'You can only message your friends.'; end if;
  if new.bet_id is not null and not exists (select 1 from public.bets b where b.id = new.bet_id and b.user_id = new.sender) then
    raise exception 'You can only share your own bets.';
  end if;
  if new.media_path is not null or new.media_kind is not null then
    new.media_meta := public.check_chat_media(new.media_path, new.media_kind, new.media_meta, new.sender);
  else new.media_meta := null; end if;
  if (select count(*) from public.messages m where m.sender = new.sender and m.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Slow down a little. Try again in a minute.';
  end if;
  new.body := trim(new.body);
  return new;
end $$;
drop trigger if exists messages_guard_insert on public.messages;
create trigger messages_guard_insert before insert on public.messages for each row execute function public.guard_message_insert();

alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
drop policy if exists "read your chats" on public.messages;
create policy "read your chats" on public.messages for select to authenticated using (auth.uid() in (sender, recipient));
drop policy if exists "message your friends" on public.messages;
create policy "message your friends" on public.messages for insert to authenticated with check (sender = auth.uid());
drop policy if exists "see reactions in your chats" on public.message_reactions;
create policy "see reactions in your chats" on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and auth.uid() in (m.sender, m.recipient)));

-- Messages in one chat, newest last, with any shared bet's live details, the reactions and any photo or voice note.
drop function if exists public.chat_messages(uuid, bigint, integer);
create or replace function public.chat_messages(other uuid, before_id bigint default null, lim integer default 60)
returns table (id bigint, sender uuid, body text, created_at timestamptz, read_at timestamptz, bet jsonb, reactions jsonb,
               media_path text, media_kind text, media_meta jsonb)
language sql stable security definer set search_path = public as $$
  select * from (
    select m.id, m.sender, m.body, m.created_at, m.read_at,
           case when b.id is null then null else jsonb_build_object('id', b.id, 'text', b.text, 'sport', b.sport, 'odds', b.odds,
             'result', b.result, 'created_at', b.created_at, 'tracker', t.name) end,
           coalesce((select jsonb_object_agg(r.user_id, r.emoji) from public.message_reactions r where r.message_id = m.id), '{}'::jsonb),
           m.media_path, m.media_kind, m.media_meta
      from public.messages m
      left join public.bets b on b.id = m.bet_id
      left join public.trackers t on t.id = b.tracker_id
     where auth.uid() is not null
       and ((m.sender = auth.uid() and m.recipient = other) or (m.sender = other and m.recipient = auth.uid()))
       and (before_id is null or m.id < before_id)
     order by m.id desc
     limit least(greatest(lim, 1), 200)
  ) x order by x.id;
$$;

-- Your chats: the latest message with each person, how many you haven't read, and their profile.
drop function if exists public.my_chats();
create or replace function public.my_chats()
returns table (id uuid, display_name text, avatar_url text, streak integer, tier_idx integer, best_streak integer,
               streak_tracker text, banked double precision, last_id bigint, last_body text, last_has_bet boolean,
               last_from_me boolean, last_at timestamptz, unread bigint, last_media text)
language sql stable security definer set search_path = public as $$
  with mine as (
    select m.*, case when m.sender = auth.uid() then m.recipient else m.sender end as other_id
      from public.messages m where auth.uid() is not null and auth.uid() in (m.sender, m.recipient)
  ), latest as (
    select distinct on (other_id) * from mine order by other_id, id desc
  )
  select p.id, p.display_name, p.avatar_url, p.streak, p.tier_idx, p.best_streak, p.streak_tracker, p.banked,
         l.id, l.body, l.bet_id is not null, l.sender = auth.uid(), l.created_at,
         (select count(*) from mine u where u.other_id = l.other_id and u.recipient = auth.uid() and u.read_at is null),
         l.media_kind
    from latest l join public.profiles p on p.id = l.other_id
   order by l.id desc;
$$;

-- Mark everything someone sent you as read.
create or replace function public.chat_mark_read(other uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_at = now() where recipient = auth.uid() and sender = other and read_at is null;
$$;

-- React to a message in one of your chats (the same emoji again, or null, removes it).
create or replace function public.chat_react(msg bigint, emoji text) returns void
language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if not exists (select 1 from public.messages m where m.id = msg and auth.uid() in (m.sender, m.recipient)) then
    raise exception 'That message isn''t in your chats.';
  end if;
  select r.emoji into cur from public.message_reactions r where r.message_id = msg and r.user_id = auth.uid();
  if emoji is null or cur = emoji then
    delete from public.message_reactions r where r.message_id = msg and r.user_id = auth.uid();
  else
    insert into public.message_reactions (message_id, user_id, emoji) values (msg, auth.uid(), emoji)
    on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end $$;

revoke all on function public.chat_messages(uuid, bigint, integer), public.my_chats(), public.chat_mark_read(uuid),
                       public.chat_react(bigint, text), public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.chat_messages(uuid, bigint, integer), public.my_chats(), public.chat_mark_read(uuid),
                          public.chat_react(bigint, text) to authenticated;

-- Live updates: the app listens for new messages and reactions (only ones you're allowed to read reach you).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'message_reactions') then
      alter publication supabase_realtime add table public.message_reactions;
    end if;
  end if;
end $$;

-- =====================================================================
-- Stage 5 · Feed
-- What you and your friends have been up to: bets logged, bets won or
-- lost, and money banked. Only you and your friends appear. Friends can
-- react to each other's activity with one emoji each.
-- =====================================================================
create index if not exists bets_user_created_idx on public.bets (user_id, created_at);
create index if not exists actions_user_at_idx on public.tracker_actions (user_id, at);

create table if not exists public.feed_reactions (
  kind       text not null check (kind in ('bet', 'result', 'bank')),
  ref_id     text not null check (length(ref_id) between 1 and 40),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji      text not null check (emoji in ('🔥', '💪', '😂', '😬', '👏', '❤️')),
  created_at timestamptz not null default now(),
  primary key (kind, ref_id, user_id)
);
-- Only reachable through the functions below.
alter table public.feed_reactions enable row level security;

-- Whose activity a feed item belongs to (null if it doesn't exist).
create or replace function public.feed_owner(kind text, ref text) returns uuid
language sql stable security definer set search_path = public as $$
  select case kind
    when 'bet' then (select b.user_id from public.bets b where b.id = ref)
    when 'result' then (select b.user_id from public.bets b where b.id = ref and b.result <> 'pending')
    when 'bank' then (select a.user_id from public.tracker_actions a where a.id = ref and a.type = 'bank')
  end;
$$;

-- Your feed, newest first. Page back with the `at` and `key` of the last item you have.
create or replace function public.feed(before_at bigint default null, before_key text default null, lim integer default 30)
returns table (kind text, ref_id text, key text, at bigint, user_id uuid, display_name text, avatar_url text, streak integer,
               tier_idx integer, bet jsonb, tracker text, amount double precision, reactions jsonb, my_reaction text, reactors jsonb)
language sql stable security definer set search_path = public as $$
  with people as (
    select auth.uid() as id where auth.uid() is not null
    union
    select case when f.requester = auth.uid() then f.addressee else f.requester end
      from public.friendships f where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee)
  ), seen as (
    -- Your own trackers, and the ones your friends show to others.
    select t.id from public.trackers t where t.user_id in (select id from people) and (t.shared or t.user_id = auth.uid())
  ), ev as (
    select 'bet'::text as kind, b.id as ref_id, b.created_at as at, b.user_id, b.id as bet_id, b.tracker_id, null::double precision as amount
      from public.bets b where b.tracker_id in (select id from seen)
    union all
    select 'result', b.id, b.settled_at, b.user_id, b.id, b.tracker_id, null
      from public.bets b where b.tracker_id in (select id from seen) and b.result <> 'pending' and b.settled_at is not null
    union all
    select 'bank', a.id, a.at, a.user_id, null, a.tracker_id,
           case when jsonb_typeof(a.payload -> 'amount') = 'number' then (a.payload ->> 'amount')::double precision else 0 end
      from public.tracker_actions a where a.tracker_id in (select id from seen) and a.type = 'bank'
  ), page as (
    select ev.*, ev.kind || ':' || ev.ref_id as key from ev
     where before_at is null or (ev.at, ev.kind || ':' || ev.ref_id) < (before_at, coalesce(before_key, ''))
     order by ev.at desc, key desc
     limit least(greatest(lim, 1), 100)
  )
  select pg.kind, pg.ref_id, pg.key, pg.at, p.id, p.display_name, p.avatar_url, p.streak, p.tier_idx,
         case when b.id is null then null else jsonb_build_object('id', b.id, 'text', b.text, 'sport', b.sport, 'odds', b.odds,
           'result', b.result, 'created_at', b.created_at, 'settled_at', b.settled_at) end,
         t.name, pg.amount,
         coalesce((select jsonb_object_agg(x.emoji, x.n) from (select r.emoji, count(*) as n from public.feed_reactions r
                    where r.kind = pg.kind and r.ref_id = pg.ref_id group by r.emoji) x), '{}'::jsonb),
         (select r.emoji from public.feed_reactions r where r.kind = pg.kind and r.ref_id = pg.ref_id and r.user_id = auth.uid()),
         -- On your own activity you see who reacted.
         case when pg.user_id = auth.uid() then coalesce((select jsonb_agg(jsonb_build_object('name', rp.display_name, 'emoji', r.emoji) order by r.created_at)
                    from public.feed_reactions r join public.profiles rp on rp.id = r.user_id
                   where r.kind = pg.kind and r.ref_id = pg.ref_id), '[]'::jsonb) end
    from page pg
    join public.profiles p on p.id = pg.user_id
    left join public.bets b on b.id = pg.bet_id
    left join public.trackers t on t.id = pg.tracker_id
   order by pg.at desc, pg.key desc;
$$;

-- React to a friend's activity (the same emoji again, or null, removes it).
create or replace function public.feed_react(kind text, ref text, emoji text) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid := public.feed_owner(kind, ref); cur text;
begin
  if auth.uid() is null or owner is null or not public.are_friends(auth.uid(), owner) then
    raise exception 'You can only react to your friends'' activity.';
  end if;
  select r.emoji into cur from public.feed_reactions r where r.kind = feed_react.kind and r.ref_id = ref and r.user_id = auth.uid();
  if emoji is null or cur = emoji then
    delete from public.feed_reactions r where r.kind = feed_react.kind and r.ref_id = ref and r.user_id = auth.uid();
  else
    insert into public.feed_reactions (kind, ref_id, user_id, emoji) values (kind, ref, auth.uid(), emoji)
    on conflict on constraint feed_reactions_pkey do update set emoji = excluded.emoji, created_at = now();
  end if;
end $$;

revoke all on function public.feed(bigint, text, integer), public.feed_react(text, text, text), public.feed_owner(text, text) from public, anon;
revoke all on function public.feed_owner(text, text) from authenticated;
grant execute on function public.feed(bigint, text, integer), public.feed_react(text, text, text) to authenticated;

-- =====================================================================
-- Stage 6 · Group chats
-- Chats with up to 20 people. You start a group with your friends, and
-- any member can add their own friends to it. Only members can read a
-- group or send to it. Messages can't be edited or deleted. Leaving a
-- group removes you from it; a group with nobody left is deleted.
-- =====================================================================
create table if not exists public.chat_groups (
  id         bigint generated always as identity primary key,
  name       text not null check (length(trim(name)) between 1 and 40),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id     bigint not null references public.chat_groups (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  added_by     uuid references public.profiles (id) on delete set null,
  joined_at    timestamptz not null default now(),
  last_read_id bigint not null default 0,
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);
create table if not exists public.group_messages (
  id         bigint generated always as identity primary key,
  group_id   bigint not null references public.chat_groups (id) on delete cascade,
  sender     uuid references public.profiles (id) on delete set null,
  body       text not null default '' check (length(body) <= 1000),
  bet_id     text references public.bets (id) on delete set null,
  kind       text not null default 'text' check (kind in ('text', 'event')),
  created_at timestamptz not null default now(),
  check (length(trim(body)) > 0 or bet_id is not null)
);
create index if not exists group_messages_group_idx on public.group_messages (group_id, id desc);
alter table public.group_messages add column if not exists media_path text, add column if not exists media_kind text, add column if not exists media_meta jsonb;
create index if not exists group_messages_media_idx on public.group_messages (media_path) where media_path is not null;
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.group_messages'::regclass and contype = 'c'
             and conname <> 'group_messages_has_content' and pg_get_constraintdef(oid) ilike '%bet_id IS NOT NULL%' loop
    execute format('alter table public.group_messages drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.group_messages drop constraint if exists group_messages_has_content;
alter table public.group_messages add constraint group_messages_has_content check (length(trim(body)) > 0 or bet_id is not null or media_path is not null);
alter table public.group_messages drop constraint if exists group_messages_media_ok;
alter table public.group_messages add constraint group_messages_media_ok check ((media_path is null) = (media_kind is null) and (media_kind is null or media_kind in ('photo', 'voice')));
create table if not exists public.group_reactions (
  message_id bigint not null references public.group_messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  group_id   bigint not null references public.chat_groups (id) on delete cascade,
  emoji      text not null check (emoji in ('🔥', '💪', '😂', '😬', '👏', '❤️')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create or replace function public.is_group_member(g bigint, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members m where m.group_id = g and m.user_id = u);
$$;

-- Notes like "Sky added Mia" appear in the chat itself.
create or replace function public.group_note(g bigint, note text) returns void
language sql security definer set search_path = public as $$
  insert into public.group_messages (group_id, sender, body, kind) values (g, null, note, 'event');
$$;

-- Sending: always as yourself, only to groups you're in, only your own bets, and not too fast.
create or replace function public.guard_group_message_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  new.created_at := now();
  -- Notes written by the functions in this file run as the table owner, not as a signed-in user.
  if current_user in ('authenticated', 'anon') then
    new.sender := auth.uid(); new.kind := 'text';
    if new.sender is null then raise exception 'Log in first.'; end if;
    if not public.is_group_member(new.group_id, new.sender) then raise exception 'You''re not in that group.'; end if;
    if new.bet_id is not null and not exists (select 1 from public.bets b where b.id = new.bet_id and b.user_id = new.sender) then
      raise exception 'You can only share your own bets.';
    end if;
    if new.media_path is not null or new.media_kind is not null then
      new.media_meta := public.check_chat_media(new.media_path, new.media_kind, new.media_meta, new.sender);
    else new.media_meta := null; end if;
    if (select count(*) from public.group_messages m where m.sender = new.sender and m.created_at > now() - interval '1 minute') >= 30 then
      raise exception 'Slow down a little. Try again in a minute.';
    end if;
  end if;
  new.body := trim(new.body);
  return new;
end $$;
drop trigger if exists group_messages_guard_insert on public.group_messages;
create trigger group_messages_guard_insert before insert on public.group_messages for each row execute function public.guard_group_message_insert();

alter table public.chat_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_reactions enable row level security;
-- Members can read their groups. Everything else goes through the functions below.
drop policy if exists "read your groups" on public.chat_groups;
create policy "read your groups" on public.chat_groups for select to authenticated using (public.is_group_member(id, auth.uid()));
drop policy if exists "see members of your groups" on public.group_members;
create policy "see members of your groups" on public.group_members for select to authenticated using (public.is_group_member(group_id, auth.uid()));
drop policy if exists "read your group messages" on public.group_messages;
create policy "read your group messages" on public.group_messages for select to authenticated using (public.is_group_member(group_id, auth.uid()));
drop policy if exists "send to your groups" on public.group_messages;
create policy "send to your groups" on public.group_messages for insert to authenticated with check (sender = auth.uid() and public.is_group_member(group_id, auth.uid()));
drop policy if exists "see reactions in your groups" on public.group_reactions;
create policy "see reactions in your groups" on public.group_reactions for select to authenticated using (public.is_group_member(group_id, auth.uid()));

-- Start a group with some of your friends (at least two, up to 19).
create or replace function public.group_create(name text, members uuid[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare g bigint; u uuid; me text; added text[] := '{}';
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  members := array(select distinct x from unnest(coalesce(members, '{}')) x where x <> auth.uid());
  if cardinality(members) < 2 then raise exception 'Pick at least two friends for a group.'; end if;
  if cardinality(members) > 19 then raise exception 'A group can have up to 20 people.'; end if;
  if length(trim(coalesce(name, ''))) not between 1 and 40 then raise exception 'Give the group a name of up to 40 characters.'; end if;
  if (select count(*) from public.chat_groups c where c.created_by = auth.uid() and c.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Slow down a little. Try again later.';
  end if;
  foreach u in array members loop
    if not public.are_friends(auth.uid(), u) then raise exception 'You can only add your friends to a group.'; end if;
  end loop;
  insert into public.chat_groups (name, created_by) values (trim(name), auth.uid()) returning id into g;
  insert into public.group_members (group_id, user_id, added_by) values (g, auth.uid(), auth.uid());
  insert into public.group_members (group_id, user_id, added_by) select g, x, auth.uid() from unnest(members) x;
  select display_name into me from public.profiles where id = auth.uid();
  perform public.group_note(g, me || ' started the group');
  return g;
end $$;

-- Add one of your friends to a group you're in.
create or replace function public.group_add(g bigint, target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_member(g, auth.uid()) then raise exception 'You''re not in that group.'; end if;
  if public.is_group_member(g, target) then return; end if;
  if not public.are_friends(auth.uid(), target) then raise exception 'You can only add your friends to a group.'; end if;
  if (select count(*) from public.group_members m where m.group_id = g) >= 20 then raise exception 'A group can have up to 20 people.'; end if;
  insert into public.group_members (group_id, user_id, added_by, last_read_id)
    values (g, target, auth.uid(), 0);
  perform public.group_note(g, (select display_name from public.profiles where id = auth.uid()) || ' added ' || (select display_name from public.profiles where id = target));
end $$;

create or replace function public.group_rename(g bigint, name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_member(g, auth.uid()) then raise exception 'You''re not in that group.'; end if;
  if length(trim(coalesce(group_rename.name, ''))) not between 1 and 40 then raise exception 'Give the group a name of up to 40 characters.'; end if;
  if (select c.name from public.chat_groups c where c.id = g) = trim(group_rename.name) then return; end if;
  update public.chat_groups c set name = trim(group_rename.name) where c.id = g;
  perform public.group_note(g, (select p.display_name from public.profiles p where p.id = auth.uid()) || ' renamed the group to ' || trim(group_rename.name));
end $$;

create or replace function public.group_leave(g bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_member(g, auth.uid()) then return; end if;
  delete from public.group_members where group_id = g and user_id = auth.uid();
  if not exists (select 1 from public.group_members where group_id = g) then
    delete from public.chat_groups where id = g;
  else
    perform public.group_note(g, (select display_name from public.profiles where id = auth.uid()) || ' left the group');
  end if;
end $$;

-- The people in a group you're in.
create or replace function public.group_people(g bigint)
returns table (id uuid, display_name text, avatar_url text, streak integer, tier_idx integer, best_streak integer,
               streak_tracker text, banked double precision, joined_at timestamptz, is_friend boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, p.streak, p.tier_idx, p.best_streak, p.streak_tracker, p.banked, m.joined_at,
         public.are_friends(auth.uid(), p.id)
    from public.group_members m join public.profiles p on p.id = m.user_id
   where m.group_id = g and public.is_group_member(g, auth.uid())
   order by m.joined_at, p.display_name;
$$;

-- Messages in a group, oldest first, paged back by id.
drop function if exists public.group_chat_messages(bigint, bigint, integer);
create or replace function public.group_chat_messages(g bigint, before_id bigint default null, lim integer default 60)
returns table (id bigint, sender uuid, sender_name text, sender_avatar text, sender_streak integer, sender_tier integer,
               body text, kind text, created_at timestamptz, bet jsonb, reactions jsonb, media_path text, media_kind text, media_meta jsonb)
language sql stable security definer set search_path = public as $$
  select * from (
    select m.id, m.sender, p.display_name, p.avatar_url, p.streak, p.tier_idx, m.body, m.kind, m.created_at,
           case when b.id is null then null else jsonb_build_object('id', b.id, 'text', b.text, 'sport', b.sport, 'odds', b.odds,
             'result', b.result, 'created_at', b.created_at, 'tracker', t.name) end,
           coalesce((select jsonb_object_agg(r.user_id, r.emoji) from public.group_reactions r where r.message_id = m.id), '{}'::jsonb),
           m.media_path, m.media_kind, m.media_meta
      from public.group_messages m
      left join public.profiles p on p.id = m.sender
      left join public.bets b on b.id = m.bet_id
      left join public.trackers t on t.id = b.tracker_id
     where m.group_id = g and public.is_group_member(g, auth.uid())
       and (before_id is null or m.id < before_id)
     order by m.id desc
     limit least(greatest(lim, 1), 200)
  ) x order by x.id;
$$;

-- Your groups: the latest message in each, how many you haven't read, and who's in it.
drop function if exists public.my_groups();
create or replace function public.my_groups()
returns table (id bigint, name text, member_count bigint, members jsonb, last_id bigint, last_body text, last_has_bet boolean,
               last_kind text, last_sender_name text, last_from_me boolean, last_at timestamptz, unread bigint, last_media text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name,
         (select count(*) from public.group_members x where x.group_id = c.id),
         (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar_url', p.avatar_url, 'tier_idx', p.tier_idx, 'streak', p.streak) order by x.joined_at), '[]'::jsonb)
            from public.group_members x join public.profiles p on p.id = x.user_id where x.group_id = c.id),
         l.id, l.body, l.bet_id is not null, l.kind, lp.display_name, l.sender = auth.uid(), coalesce(l.created_at, c.created_at),
         (select count(*) from public.group_messages u where u.group_id = c.id and u.id > me.last_read_id and u.sender is distinct from auth.uid() and u.kind = 'text'),
         l.media_kind
    from public.group_members me
    join public.chat_groups c on c.id = me.group_id
    left join lateral (select * from public.group_messages m where m.group_id = c.id order by m.id desc limit 1) l on true
    left join public.profiles lp on lp.id = l.sender
   where me.user_id = auth.uid()
   order by coalesce(l.created_at, c.created_at) desc;
$$;

create or replace function public.group_mark_read(g bigint) returns void
language sql security definer set search_path = public as $$
  update public.group_members set last_read_id = coalesce((select max(id) from public.group_messages where group_id = g), 0)
   where group_id = g and user_id = auth.uid();
$$;

-- React to a message in one of your groups (the same emoji again, or null, removes it).
create or replace function public.group_react(msg bigint, emoji text) returns void
language plpgsql security definer set search_path = public as $$
declare g bigint; cur text;
begin
  select m.group_id into g from public.group_messages m where m.id = msg and m.kind = 'text';
  if g is null or not public.is_group_member(g, auth.uid()) then raise exception 'That message isn''t in your groups.'; end if;
  select r.emoji into cur from public.group_reactions r where r.message_id = msg and r.user_id = auth.uid();
  if emoji is null or cur = emoji then
    delete from public.group_reactions r where r.message_id = msg and r.user_id = auth.uid();
  else
    insert into public.group_reactions (message_id, user_id, group_id, emoji) values (msg, auth.uid(), g, emoji)
    on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end $$;

revoke all on function public.is_group_member(bigint, uuid), public.group_note(bigint, text), public.group_create(text, uuid[]),
  public.group_add(bigint, uuid), public.group_rename(bigint, text), public.group_leave(bigint), public.group_people(bigint),
  public.group_chat_messages(bigint, bigint, integer), public.my_groups(), public.group_mark_read(bigint), public.group_react(bigint, text) from public, anon;
revoke all on function public.group_note(bigint, text) from authenticated;
grant execute on function public.is_group_member(bigint, uuid), public.group_create(text, uuid[]), public.group_add(bigint, uuid),
  public.group_rename(bigint, text), public.group_leave(bigint), public.group_people(bigint), public.group_chat_messages(bigint, bigint, integer),
  public.my_groups(), public.group_mark_read(bigint), public.group_react(bigint, text) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'group_messages') then
      alter publication supabase_realtime add table public.group_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'group_reactions') then
      alter publication supabase_realtime add table public.group_reactions;
    end if;
  end if;
end $$;

-- =====================================================================
-- Stage 7 · Challenges
-- Challenge one or more friends to see who gets the longest run of wins
-- in a set time (3 days, a week or two weeks). Only bets logged during
-- the challenge, and settled before it ends, count. Your best run
-- across all your trackers is your score. The highest score wins, and a
-- tie means a shared win.
-- =====================================================================
-- When the server first saw each bet, so bets typed in afterwards with an earlier date can't count.
alter table public.bets add column if not exists logged_at timestamptz not null default now();
create or replace function public.stamp_bet_logged() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.logged_at := now(); else new.logged_at := old.logged_at; end if;
  return new;
end $$;
drop trigger if exists bets_stamp_logged on public.bets;
create trigger bets_stamp_logged before insert or update on public.bets for each row execute function public.stamp_bet_logged();

create table if not exists public.challenges (
  id         bigint generated always as identity primary key,
  title      text not null check (length(trim(title)) between 1 and 40),
  created_by uuid references public.profiles (id) on delete set null,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.challenge_members (
  challenge_id bigint not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  responded_at timestamptz,
  primary key (challenge_id, user_id)
);
create index if not exists challenge_members_user_idx on public.challenge_members (user_id);
-- Only reachable through the functions below.
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;

-- Someone's best run of wins between two times: bets logged in the window and settled by its end,
-- in the order they were placed, across all their trackers. A loss ends a run.
create or replace function public.challenge_score(uid uuid, s timestamptz, e timestamptz) returns integer
language plpgsql stable security definer set search_path = public as $$
declare b record; run integer := 0; best integer := 0;
  s_ms bigint := (extract(epoch from s) * 1000)::bigint; e_ms bigint := (extract(epoch from e) * 1000)::bigint;
begin
  for b in select x.result from public.bets x
            where x.user_id = uid and x.logged_at >= s and x.logged_at <= e
              and exists (select 1 from public.trackers t where t.id = x.tracker_id and t.shared)
              and x.created_at >= s_ms - 300000 and x.result <> 'pending' and x.settled_at <= e_ms
            order by x.created_at, x.id loop
    if b.result = 'win' then run := run + 1; best := greatest(best, run); else run := 0; end if;
  end loop;
  return best;
end $$;

-- Challenge your friends (one to nine of them) for 3, 7 or 14 days, starting now.
create or replace function public.challenge_create(title text, members uuid[], days integer) returns bigint
language plpgsql security definer set search_path = public as $$
declare c bigint; u uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  members := array(select distinct x from unnest(coalesce(members, '{}')) x where x <> auth.uid());
  if cardinality(members) < 1 then raise exception 'Pick at least one friend to challenge.'; end if;
  if cardinality(members) > 9 then raise exception 'A challenge can have up to 10 people.'; end if;
  if days not in (3, 7, 14) then raise exception 'A challenge lasts 3 days, a week or two weeks.'; end if;
  if length(trim(coalesce(challenge_create.title, ''))) not between 1 and 40 then raise exception 'Give the challenge a name of up to 40 characters.'; end if;
  if (select count(*) from public.challenges x where x.created_by = auth.uid() and x.created_at > now() - interval '1 day') >= 10 then
    raise exception 'That''s a lot of challenges for one day. Try again tomorrow.';
  end if;
  foreach u in array members loop
    if not public.are_friends(auth.uid(), u) then raise exception 'You can only challenge your friends.'; end if;
  end loop;
  insert into public.challenges (title, created_by, ends_at) values (trim(challenge_create.title), auth.uid(), now() + make_interval(days => days)) returning id into c;
  insert into public.challenge_members (challenge_id, user_id, status, responded_at) values (c, auth.uid(), 'accepted', now());
  insert into public.challenge_members (challenge_id, user_id) select c, x from unnest(members) x;
  return c;
end $$;

-- Accept or decline an invite while the challenge is still running.
create or replace function public.challenge_respond(c bigint, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.challenge_members m where m.challenge_id = c and m.user_id = auth.uid() and m.status = 'invited') then
    raise exception 'That invite isn''t there any more.';
  end if;
  if (select ends_at from public.challenges where id = c) <= now() then raise exception 'That challenge has already finished.'; end if;
  update public.challenge_members set status = case when accept then 'accepted' else 'declined' end, responded_at = now()
   where challenge_id = c and user_id = auth.uid();
  return case when accept then 'accepted' else 'declined' end;
end $$;

-- Your challenges: running ones and ones that finished in the last 30 days, with everyone's live score.
create or replace function public.my_challenges()
returns table (id bigint, title text, created_by uuid, starts_at timestamptz, ends_at timestamptz, finished boolean,
               my_status text, members jsonb)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.created_by, c.starts_at, c.ends_at, c.ends_at <= now(), me.status,
         (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar_url', p.avatar_url, 'tier_idx', p.tier_idx,
                   'streak', p.streak, 'status', m.status,
                   'score', case when m.status = 'accepted' then public.challenge_score(p.id, c.starts_at, c.ends_at) else 0 end)
                 order by m.status <> 'accepted', p.display_name)
            from public.challenge_members m join public.profiles p on p.id = m.user_id where m.challenge_id = c.id)
    from public.challenge_members me join public.challenges c on c.id = me.challenge_id
   where me.user_id = auth.uid() and me.status <> 'declined' and c.ends_at > now() - interval '30 days'
   order by c.ends_at <= now(), c.ends_at;
$$;

-- How many challenges someone has won outright or shared (you can see your own and your friends').
create or replace function public.challenge_wins(uid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from (
    select c.id,
           public.challenge_score(uid, c.starts_at, c.ends_at) as mine,
           (select max(public.challenge_score(m2.user_id, c.starts_at, c.ends_at)) from public.challenge_members m2
             where m2.challenge_id = c.id and m2.status = 'accepted') as top,
           (select count(*) from public.challenge_members m3 where m3.challenge_id = c.id and m3.status = 'accepted') as players
      from public.challenge_members m join public.challenges c on c.id = m.challenge_id
     where m.user_id = uid and m.status = 'accepted' and c.ends_at <= now()
       and (uid = auth.uid() or public.are_friends(auth.uid(), uid))
  ) x where x.players > 1 and x.mine > 0 and x.mine = x.top;
$$;

revoke all on function public.challenge_score(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.challenge_create(text, uuid[], integer), public.challenge_respond(bigint, boolean),
  public.my_challenges(), public.challenge_wins(uuid) from public, anon;
grant execute on function public.challenge_create(text, uuid[], integer), public.challenge_respond(bigint, boolean),
  public.my_challenges(), public.challenge_wins(uuid) to authenticated;

-- =========================================================
-- Stage 8: photos and voice notes in chat
-- =========================================================
-- A private bucket. You upload into your own folder; a file can be opened by you and by
-- whoever can read a message that points at it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 8388608, array['image/jpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'video/mp4'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_see_chat_media(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    (storage.foldername(path))[1] = auth.uid()::text
    or exists (select 1 from public.messages m where m.media_path = path and auth.uid() in (m.sender, m.recipient))
    or exists (select 1 from public.group_messages g where g.media_path = path and public.is_group_member(g.group_id, auth.uid())));
$$;
revoke all on function public.can_see_chat_media(text) from public, anon;
grant execute on function public.can_see_chat_media(text) to authenticated;
revoke all on function public.check_chat_media(text, text, jsonb, uuid) from public, anon;
grant execute on function public.check_chat_media(text, text, jsonb, uuid) to authenticated;

drop policy if exists "chat media read" on storage.objects;
create policy "chat media read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.can_see_chat_media(name));
drop policy if exists "chat media upload own folder" on storage.objects;
create policy "chat media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- Stage 9: bet slip photos on logged bets
-- =========================================================
-- The screenshot used to log a bet is kept in your own folder of the private "chat-media"
-- bucket, and the bet points at it. Only you can open it. Once attached it can't be swapped.
alter table public.bets add column if not exists slip text not null default '' check (length(slip) <= 200);

create or replace function public.guard_bet_slip() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.slip <> '' and new.slip is distinct from old.slip then
    raise exception 'A bet slip photo can''t be changed once it''s attached.';
  end if;
  if new.slip <> '' and (split_part(new.slip, '/', 1) <> auth.uid()::text or new.slip !~ '^[0-9a-f-]+/slip-[0-9a-f]+\.jpg$') then
    raise exception 'That slip photo isn''t yours.';
  end if;
  return new;
end $$;
drop trigger if exists bets_guard_slip on public.bets;
create trigger bets_guard_slip before insert or update of slip on public.bets for each row execute function public.guard_bet_slip();

-- =========================================================
-- Stage 11: "typing…" in chats
-- =========================================================
-- Typing pings go over private Realtime broadcast channels and are never stored. A channel is
-- "typing:dm:<id>:<id>" for two friends (ids sorted) or "typing:g:<group id>" for a group.
-- Only the two friends, or the group's members, may join or send on it.
create or replace function public.can_use_typing(topic text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and case
    when topic ~ '^typing:dm:[0-9a-f-]{36}:[0-9a-f-]{36}$' then
      auth.uid()::text in (split_part(topic, ':', 3), split_part(topic, ':', 4))
      and public.are_friends(split_part(topic, ':', 3)::uuid, split_part(topic, ':', 4)::uuid)
    when topic ~ '^typing:g:[0-9]{1,18}$' then public.is_group_member(split_part(topic, ':', 3)::bigint, auth.uid())
    else false end;
$$;
revoke all on function public.can_use_typing(text) from public, anon;
grant execute on function public.can_use_typing(text) to authenticated;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "typing listen" on realtime.messages';
    execute 'create policy "typing listen" on realtime.messages for select to authenticated using (realtime.messages.extension = ''broadcast'' and public.can_use_typing((select realtime.topic())))';
    execute 'drop policy if exists "typing send" on realtime.messages';
    execute 'create policy "typing send" on realtime.messages for insert to authenticated with check (realtime.messages.extension = ''broadcast'' and public.can_use_typing((select realtime.topic())))';
  end if;
end $$;

-- =========================================================
-- Stage 12: friends' progress bars and bets
-- =========================================================
-- A friend's bets on the trackers they show to others, newest first, with their live progress.
-- Only you and your friends can read these.
create or replace function public.friend_bets(other uuid, lim integer default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or not (other = auth.uid() or public.are_friends(auth.uid(), other)) then null else
    jsonb_build_object(
      'live', (select to_jsonb(l) - 'user_id' - 'updated_at' from public.profile_live l where l.user_id = other),
      'bets', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc) from (
          select b.id, b.text, b.sport, b.odds, b.result, b.created_at, b.settled_at, b.link, nullif(b.slip, '') as slip,
                 t.name as tracker, t.accent
            from public.bets b join public.trackers t on t.id = b.tracker_id
           where b.user_id = other and t.shared
           order by b.created_at desc, b.id desc
           limit least(greatest(lim, 1), 200)) x), '[]'::jsonb))
  end;
$$;
revoke all on function public.friend_bets(uuid, integer) from public, anon;
grant execute on function public.friend_bets(uuid, integer) to authenticated;

-- Friends can open the slip photo on a bet from a tracker that's shown to others.
create index if not exists bets_slip_idx on public.bets (slip) where slip <> '';
create or replace function public.can_see_chat_media(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    (storage.foldername(path))[1] = auth.uid()::text
    or exists (select 1 from public.messages m where m.media_path = path and auth.uid() in (m.sender, m.recipient))
    or exists (select 1 from public.group_messages g where g.media_path = path and public.is_group_member(g.group_id, auth.uid()))
    or exists (select 1 from public.bets b join public.trackers t on t.id = b.tracker_id
                where b.slip = path and t.shared and public.are_friends(auth.uid(), b.user_id)));
$$;

-- Work out everyone's progress once, so it shows straight away.
select public.recompute_profile_stats(id) from public.profiles;

-- =========================================================
-- Stage 13: deleting pending bets and whole trackers
-- =========================================================
-- A pending bet can be deleted. A settled bet stays for good, unless you delete the whole tracker it's on.
create or replace function public.guard_bet_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from auth.users u where u.id = old.user_id)
     and exists (select 1 from public.trackers t where t.id = old.tracker_id)
     and old.result <> 'pending' then
    raise exception 'Only a pending bet can be deleted. Settled bets stay on your record.';
  end if;
  -- A chat message that was only this bet keeps a note instead of going blank.
  update public.messages set body = '🎟️ Bet deleted' where bet_id = old.id and length(trim(body)) = 0 and media_path is null;
  update public.group_messages set body = '🎟️ Bet deleted' where bet_id = old.id and length(trim(body)) = 0 and media_path is null;
  return old;
end $$;

drop policy if exists "delete own pending bets" on public.bets;
create policy "delete own pending bets" on public.bets for delete to authenticated using (user_id = auth.uid());
drop policy if exists "delete own trackers" on public.trackers;
create policy "delete own trackers" on public.trackers for delete to authenticated using (user_id = auth.uid());

-- Streaks, leaderboards and progress bars are worked out again after anything is deleted.
drop trigger if exists bets_stats_delete on public.bets;
create trigger bets_stats_delete after delete on public.bets referencing old table as changed for each statement execute function public.after_activity_change();
drop trigger if exists trackers_stats_delete on public.trackers;
create trigger trackers_stats_delete after delete on public.trackers referencing old table as changed for each statement execute function public.after_activity_change();

-- =========================================================
-- Stage 14: verified wins and flagged slips
-- =========================================================
-- A win can be verified with a screenshot of the settled slip. The app reads it on the phone and,
-- if it shows a win at the same odds, calls verify_bet. The proof photo stays on the bet for good and
-- friends can open it. Only verify_bet can set the proof and the verified time.
alter table public.bets add column if not exists proof text not null default '' check (length(proof) <= 200);
alter table public.bets add column if not exists proof_hash text not null default '' check (proof_hash = '' or proof_hash ~ '^[0-9a-f]{64}$');
alter table public.bets add column if not exists verified_at bigint;
-- The exact same screenshot can't verify two bets.
create unique index if not exists bets_proof_hash_uniq on public.bets (proof_hash) where proof_hash <> '';
create index if not exists bets_proof_idx on public.bets (proof) where proof <> '';

create or replace function public.guard_bet_proof() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('pd.verifying', true), '') <> '1' then
    if tg_op = 'INSERT' then
      new.proof := ''; new.proof_hash := ''; new.verified_at := null;
    else
      new.proof := old.proof; new.proof_hash := old.proof_hash; new.verified_at := old.verified_at;
    end if;
  end if;
  -- A verified win that gets changed to a loss or pending isn't verified any more. The photo stays.
  if new.result <> 'win' then new.verified_at := null; end if;
  return new;
end $$;
drop trigger if exists bets_guard_proof on public.bets;
create trigger bets_guard_proof before insert or update on public.bets for each row execute function public.guard_bet_proof();

create or replace function public.verify_bet(bet text, proof_path text, hash text) returns bigint
language plpgsql security definer set search_path = public as $$
declare b public.bets; at bigint := public.now_ms();
begin
  select * into b from public.bets where id = bet and user_id = auth.uid();
  if not found then raise exception 'That bet isn''t yours.'; end if;
  if b.result <> 'win' then raise exception 'Only a winning bet can be verified.'; end if;
  if b.verified_at is not null then return b.verified_at; end if;
  if b.proof <> '' then raise exception 'This bet already has a proof screenshot.'; end if;
  if split_part(proof_path, '/', 1) <> auth.uid()::text or proof_path !~ '^[0-9a-f-]+/proof-[0-9a-f]+\.jpg$' then
    raise exception 'That proof photo isn''t yours.';
  end if;
  if hash !~ '^[0-9a-f]{64}$' then raise exception 'That screenshot couldn''t be checked.'; end if;
  if exists (select 1 from public.bets x where x.proof_hash = hash) then
    raise exception 'That screenshot has already been used to verify a bet.';
  end if;
  perform set_config('pd.verifying', '1', true);
  update public.bets set proof = proof_path, proof_hash = hash, verified_at = at where id = bet;
  perform set_config('pd.verifying', '', true);
  return at;
end $$;
revoke all on function public.verify_bet(text, text, text) from public, anon;
grant execute on function public.verify_bet(text, text, text) to authenticated;

-- Friends can flag a slip that looks edited or fake. Everyone who can see the bet sees how many flags it has.
create table if not exists public.bet_flags (
  bet_id     text not null references public.bets (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bet_id, user_id)
);
alter table public.bet_flags enable row level security;
-- No direct access: flags go through flag_bet and are read through friend_bets and my_bet_flags.

create or replace function public.flag_bet(bet text, flag boolean) returns integer
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select b.user_id into owner from public.bets b join public.trackers t on t.id = b.tracker_id
   where b.id = bet and t.shared and (b.slip <> '' or b.proof <> '');
  if owner is null or auth.uid() is null or not public.are_friends(auth.uid(), owner) then
    raise exception 'You can only flag a friend''s bet slip.';
  end if;
  if flag then insert into public.bet_flags (bet_id, user_id) values (bet, auth.uid()) on conflict do nothing;
  else delete from public.bet_flags where bet_id = bet and user_id = auth.uid(); end if;
  return (select count(*) from public.bet_flags where bet_id = bet);
end $$;
revoke all on function public.flag_bet(text, boolean) from public, anon;
grant execute on function public.flag_bet(text, boolean) to authenticated;

-- How many friends flagged each of your own bets.
create or replace function public.my_bet_flags() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(f.bet_id, f.n), '{}'::jsonb) from (
    select fl.bet_id, count(*) as n from public.bet_flags fl join public.bets b on b.id = fl.bet_id
     where b.user_id = auth.uid() group by fl.bet_id) f;
$$;
revoke all on function public.my_bet_flags() from public, anon;
grant execute on function public.my_bet_flags() to authenticated;

-- A friend's bets now carry the proof photo, when it was verified, and its flags.
create or replace function public.friend_bets(other uuid, lim integer default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or not (other = auth.uid() or public.are_friends(auth.uid(), other)) then null else
    jsonb_build_object(
      'live', (select to_jsonb(l) - 'user_id' - 'updated_at' from public.profile_live l where l.user_id = other),
      'bets', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc) from (
          select b.id, b.text, b.sport, b.odds, b.result, b.created_at, b.settled_at, b.link, nullif(b.slip, '') as slip,
                 nullif(b.proof, '') as proof, b.verified_at,
                 (select count(*) from public.bet_flags f where f.bet_id = b.id) as flags,
                 exists (select 1 from public.bet_flags f where f.bet_id = b.id and f.user_id = auth.uid()) as my_flag,
                 t.name as tracker, t.accent
            from public.bets b join public.trackers t on t.id = b.tracker_id
           where b.user_id = other and t.shared
           order by b.created_at desc, b.id desc
           limit least(greatest(lim, 1), 200)) x), '[]'::jsonb))
  end;
$$;
revoke all on function public.friend_bets(uuid, integer) from public, anon;
grant execute on function public.friend_bets(uuid, integer) to authenticated;

-- Friends can open the proof photo the same way as the slip.
create or replace function public.can_see_chat_media(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    (storage.foldername(path))[1] = auth.uid()::text
    or exists (select 1 from public.messages m where m.media_path = path and auth.uid() in (m.sender, m.recipient))
    or exists (select 1 from public.group_messages g where g.media_path = path and public.is_group_member(g.group_id, auth.uid()))
    or exists (select 1 from public.bets b join public.trackers t on t.id = b.tracker_id
                where (b.slip = path or b.proof = path) and t.shared and public.are_friends(auth.uid(), b.user_id)));
$$;

-- =====================================================================
-- Stage 15: new joiners in Friends, and risky bets on the leaderboard
-- The latest people to sign up, newest first, so you can add them.
-- (profile_live.odds, near the top, carries a running bet's odds.)
-- =====================================================================
create or replace function public.new_joiners(lim integer default 30)
returns table (id uuid, display_name text, avatar_url text, streak integer, tier_idx integer, joined_at timestamptz)
language sql stable set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, p.streak, p.tier_idx, p.created_at
    from public.profiles p
   where auth.uid() is not null and p.id <> auth.uid()
   order by p.created_at desc, p.id
   limit least(greatest(lim, 1), 50);
$$;
revoke all on function public.new_joiners(integer) from public, anon;
grant execute on function public.new_joiners(integer) to authenticated;

-- Fill in the odds for bets already running when this stage is added.
do $$ declare u uuid; begin
  for u in select user_id from public.profile_live where pending and odds is null loop perform public.recompute_profile_stats(u); end loop;
end $$;
