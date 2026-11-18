-- Noctis online: Abyss leaderboard, cloud saves and transfer codes.
-- Already applied to the Supabase project; kept here as reference.
-- Every player is an anonymous Supabase user (Authentication -> anonymous sign-ins on).

-- ---- leaderboard -------------------------------------------------------------
create table public.abyss_scores (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 20),
  floor integer not null check (floor between 1 and 100000),
  level integer not null check (level between 1 and 1000),
  mastery integer not null default 0 check (mastery between 0 and 10000000),
  rank text not null default 'E' check (char_length(rank) between 1 and 3),
  difficulty text not null default 'normal' check (difficulty in ('easy', 'normal', 'hard', 'extreme')),
  updated_at timestamptz not null default now()
);
create index abyss_scores_floor_idx on public.abyss_scores (floor desc, updated_at asc);

alter table public.abyss_scores enable row level security;
create policy "scores are public" on public.abyss_scores for select to anon, authenticated using (true);
create policy "own score insert" on public.abyss_scores for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own score update" on public.abyss_scores for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- plausibility: a record never goes down, never jumps too far at once and
-- cannot be sent more often than every few seconds
create function public.abyss_scores_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.name := btrim(new.name);
  if current_user <> 'authenticated' then
    return new; -- transfer code merge (runs as owner)
  end if;
  if tg_op = 'INSERT' then
    if new.floor > 500 then raise exception 'floor not plausible'; end if;
    new.updated_at := now();
    return new;
  end if;
  if new.user_id <> old.user_id then raise exception 'user cannot change'; end if;
  if now() - old.updated_at < interval '5 seconds' then raise exception 'too fast'; end if;
  if new.floor < old.floor then
    new.floor := old.floor; new.level := old.level; new.mastery := old.mastery;
    new.rank := old.rank; new.difficulty := old.difficulty;
  elsif new.floor > old.floor + 200 then
    raise exception 'floor jump not plausible';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger abyss_scores_check before insert or update on public.abyss_scores
  for each row execute function public.abyss_scores_check();

-- ---- cloud saves -------------------------------------------------------------
create table public.cloud_saves (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 0 and 9),
  data jsonb not null check (octet_length(data::text) < 3000000),
  summary jsonb not null default '{}'::jsonb check (octet_length(summary::text) < 2000),
  saved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.cloud_saves enable row level security;
create policy "own saves read" on public.cloud_saves for select to authenticated using (user_id = (select auth.uid()));
create policy "own saves insert" on public.cloud_saves for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own saves update" on public.cloud_saves for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own saves delete" on public.cloud_saves for delete to authenticated using (user_id = (select auth.uid()));

-- ---- transfer codes ----------------------------------------------------------
-- only reachable through the two functions below
create table public.transfer_codes (
  code text primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.transfer_codes enable row level security;

-- the player's code, made on first use (12 characters, about 60 random bits)
create function public.get_transfer_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
begin
  if me is null then raise exception 'not signed in'; end if;
  select code into c from public.transfer_codes where user_id = me;
  if found then return c; end if;
  loop
    b := uuid_send(gen_random_uuid());
    c := '';
    for i in 0..11 loop
      c := c || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    begin
      insert into public.transfer_codes (code, user_id) values (c, me);
      return c;
    exception when unique_violation then
      -- taken: try another one
    end;
  end loop;
end $$;

-- takes over the saves and the leaderboard entry of another device;
-- the code then belongs to this player. Returns the number of saves moved.
create function public.claim_transfer_code(p_code text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  old uuid;
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  moved integer := 0;
  a public.abyss_scores;
  b public.abyss_scores;
begin
  if me is null then raise exception 'not signed in'; end if;
  if char_length(clean) <> 12 then raise exception 'invalid code'; end if;
  perform pg_sleep(0.3); -- slows down guessing
  select user_id into old from public.transfer_codes where code = clean;
  if not found then raise exception 'invalid code'; end if;
  if old = me then return 0; end if;

  delete from public.cloud_saves where user_id = me
    and slot in (select slot from public.cloud_saves where user_id = old);
  update public.cloud_saves set user_id = me where user_id = old;
  get diagnostics moved = row_count;

  select * into a from public.abyss_scores where user_id = old;
  if found then
    select * into b from public.abyss_scores where user_id = me;
    if found then
      if a.floor > b.floor then
        update public.abyss_scores set floor = a.floor, level = a.level, mastery = a.mastery,
          rank = a.rank, difficulty = a.difficulty, name = a.name where user_id = me;
      end if;
      delete from public.abyss_scores where user_id = old;
    else
      update public.abyss_scores set user_id = me where user_id = old;
    end if;
  end if;

  delete from public.transfer_codes where user_id = me;
  update public.transfer_codes set user_id = me where code = clean;
  return moved;
end $$;

revoke all on function public.get_transfer_code() from public, anon;
revoke all on function public.claim_transfer_code(text) from public, anon;
grant execute on function public.get_transfer_code() to authenticated;
grant execute on function public.claim_transfer_code(text) to authenticated;
revoke all on function public.abyss_scores_check() from public, anon, authenticated;

-- ---- table grants (second migration) -------------------------------------------
grant select on public.abyss_scores to anon, authenticated;
grant insert (name, floor, level, mastery, rank, difficulty) on public.abyss_scores to authenticated;
grant update (name, floor, level, mastery, rank, difficulty) on public.abyss_scores to authenticated;
grant select, insert, update, delete on public.cloud_saves to authenticated;

-- ---- level leaderboard (third migration) ---------------------------------------
-- Every hunter with a name is on the level board, also before the Abyss:
-- floor 0 = no Abyss record yet (the Abyss board only lists floor > 0).
-- Floor and level are separate records; each only goes up (trigger), and a
-- transfer code merge keeps the better of each. See the migrations
-- "level_leaderboard" and "claim_merges_level" in the Supabase project.
alter table public.abyss_scores drop constraint if exists abyss_scores_floor_check;
alter table public.abyss_scores add constraint abyss_scores_floor_check check (floor between 0 and 100000);
create index if not exists abyss_scores_level_idx on public.abyss_scores (level desc, mastery desc, updated_at asc);

-- ---- connected devices (fourth migration) ----------------------------------------
-- Replaces the 12-character transfer codes. Applied as the migrations
-- "device_pairing", "pairing_checks_free_slots" and "account_of_only_self":
-- - account_links (member -> owner): a device that joined another one
-- - account_of(uid): the shared account of the calling device; the policies of
--   cloud_saves and abyss_scores use it instead of auth.uid()
-- - pair_codes: 5 characters, valid 10 minutes, used once
-- - pair_attempts: wrong codes are limited (5 per device, 300 in total, per 10 min)
-- - my_account(), create_pair_code(), claim_pair_code(code, need),
--   unlink_device(), unlink_devices()
-- A deleted world on a connected device is kept as a marker row
-- (data = { deleted, seed, updated }) so the other devices remove it too.
