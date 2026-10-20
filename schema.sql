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
begin
  for t in select * from public.trackers where user_id = uid order by position, created_at loop
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
  end loop;
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
create or replace function public.leaderboard(scope text default 'friends', metric text default 'streak', lim integer default 50)
returns table (rank bigint, id uuid, display_name text, avatar_url text, streak integer, tier_idx integer,
               best_streak integer, banked double precision, streak_tracker text, score double precision, is_me boolean)
language sql stable set search_path = public as $$
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
  select r.rank, r.id, r.display_name, r.avatar_url, r.streak, r.tier_idx, r.best_streak, r.banked, r.streak_tracker, r.score, r.id = auth.uid()
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

-- Messages in one chat, newest last, with any shared bet's live details and the reactions.
create or replace function public.chat_messages(other uuid, before_id bigint default null, lim integer default 60)
returns table (id bigint, sender uuid, body text, created_at timestamptz, read_at timestamptz, bet jsonb, reactions jsonb)
language sql stable security definer set search_path = public as $$
  select * from (
    select m.id, m.sender, m.body, m.created_at, m.read_at,
           case when b.id is null then null else jsonb_build_object('id', b.id, 'text', b.text, 'sport', b.sport, 'odds', b.odds,
             'result', b.result, 'created_at', b.created_at, 'tracker', t.name) end,
           coalesce((select jsonb_object_agg(r.user_id, r.emoji) from public.message_reactions r where r.message_id = m.id), '{}'::jsonb)
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
               last_from_me boolean, last_at timestamptz, unread bigint)
language sql stable security definer set search_path = public as $$
  with mine as (
    select m.*, case when m.sender = auth.uid() then m.recipient else m.sender end as other_id
      from public.messages m where auth.uid() is not null and auth.uid() in (m.sender, m.recipient)
  ), latest as (
    select distinct on (other_id) * from mine order by other_id, id desc
  )
  select p.id, p.display_name, p.avatar_url, p.streak, p.tier_idx, p.best_streak, p.streak_tracker, p.banked,
         l.id, l.body, l.bet_id is not null, l.sender = auth.uid(), l.created_at,
         (select count(*) from mine u where u.other_id = l.other_id and u.recipient = auth.uid() and u.read_at is null)
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
