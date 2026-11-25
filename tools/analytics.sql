-- Queries for the play data (table public.events, filled by src/core/track.js).
-- Run them in the Supabase SQL editor (or ask Claude). The table cannot be read by the app, only by the project owner.
-- Every query uses the clean set below: own test devices (ctx.dev) are left out and events that were sent twice
-- (a retried batch) are counted once (same cid).

-- 0. the clean set (paste it in front of the queries, or create it as a temporary view)
with ev as (
  select distinct on (cid) *
  from public.events
  where coalesce(ctx->>'dev', '0') <> '1'
  order by cid, id
)

-- 1. players per day and how many came back (retention by days since first seen: ctx.dy)
select (ctx->>'dy')::int as day_since_first, count(distinct user_id) as players
from ev where name = 'session'
group by 1 order by 1;

-- 2. the funnel: who got how far (players that reached each step)
-- select count(distinct user_id) filter (where name = 'session')                          as opened,
--        count(distinct user_id) filter (where name = 'world')                            as started_world,
--        count(distinct user_id) filter (where name = 'tut_step' and props->>'id' = 'kill') as tutorial_kill,
--        count(distinct user_id) filter (where name = 'tut_end')                          as tutorial_end,
--        count(distinct user_id) filter (where name = 'gate_enter')                       as first_gate,
--        count(distinct user_id) filter (where name = 'gate_clear')                       as gate_cleared,
--        count(distinct user_id) filter (where name = 'class')                            as chose_class,
--        count(distinct user_id) filter (where name = 'rank_up' and props->>'rank' = 'D') as rank_d,
--        count(distinct user_id) filter (where name = 'rank_up' and props->>'rank' = 'C') as rank_c
-- from ev;

-- 3. where the tutorial loses people (the last step seen per player)
-- select last_step, count(*) from (
--   select distinct on (user_id) user_id, props->>'id' as last_step
--   from ev where name = 'tut_step' order by user_id, cts desc) x
-- group by 1 order by 2 desc;

-- 4. time per rank in hours of play (pt = seconds of play in that world when the rank was reached)
-- select props->>'rank' as rank, count(*) as n, round(avg((props->>'pt')::numeric) / 3600, 1) as avg_hours,
--        round((percentile_cont(0.5) within group (order by (props->>'pt')::numeric)) / 3600, 1) as median_hours
-- from ev where name = 'rank_up' group by 1 order by 3;

-- 5. deaths per hour by rank (from the 5-minute progress snapshots: deaths and time are totals of the world)
-- select ctx->>'rk' as rank, round(sum((props->>'deaths')::numeric) / nullif(sum((props->>'time')::numeric) / 3600, 0), 1) as deaths_per_h
-- from ev where name = 'progress' group by 1 order by 1;

-- 6. which class do people pick, and how do they fare (level reached per class)
-- select props->>'id' as class, count(*) as picks from ev where name = 'class' group by 1 order by 2 desc;

-- 7. gates: wins, deaths and how long they take, by difficulty
-- select props->>'d' as difficulty, count(*) filter (where name = 'gate_clear') as cleared,
--        count(*) filter (where name = 'gate_leave' and props->>'died' = '1') as died,
--        round(avg((props->>'sec')::numeric) filter (where name = 'gate_clear')) as avg_sec_clear
-- from ev where name in ('gate_clear', 'gate_leave') group by 1 order by 1;

-- 8. what people press (sum of the 'usage' events): feeds the button layout and the menu order
-- select k as button, sum(v::int) as presses
-- from ev, jsonb_each_text(props->'n') as j(k, v) where name = 'usage' group by 1 order by 2 desc;

-- 9. errors by version
-- select ctx->>'v' as version, props->>'s' as where_, props->>'m' as message, count(*) as n
-- from ev where name = 'error' group by 1, 2, 3 order by n desc limit 30;

-- 10. performance: average fps per graphics preset and input type
-- select props->>'gfx' as gfx, ctx->>'in' as input, round(avg((props->>'fps')::numeric)) as fps, count(*) as n
-- from ev where name = 'perf' group by 1, 2 order by 1, 2;

-- 11. new worlds: does anyone start over, and at what level did they leave the old one (the restart question)
-- select props->>'worlds' as worlds_before, props->>'best' as best_level, count(*) as n
-- from ev where name = 'world' and props->>'new' = '1' group by 1, 2 order by n desc;

-- 10. rank trials: passes, failed tries and how long they take (events 'trial' and 'gate_leave' with tr = 1, from 25.11.)
-- select coalesce(t.rank, l.ctx->>'rk') as rank,
--        count(*) filter (where t.name = 'trial') as passed,
--        count(*) filter (where l.name = 'gate_leave' and l.props->>'died' = '1') as died,
--        round(avg((t.props->>'sec')::numeric)) as avg_sec_pass
-- from (select *, props->>'rank' as rank from ev where name = 'trial') t
-- full join (select * from ev where name = 'gate_leave' and props->>'tr' = '1') l on false
-- group by 1 order by 1;
