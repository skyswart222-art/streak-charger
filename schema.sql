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
