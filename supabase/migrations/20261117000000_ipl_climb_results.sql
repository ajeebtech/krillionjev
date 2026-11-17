create table public.ipl_climb_results (
  id bigint generated always as identity primary key,
  climb_date date not null,
  player_id uuid not null,
  total integer not null check (total between 0 and 7000),
  points integer[] not null check (cardinality(points) = 7),
  created_at timestamptz not null default now(),
  unique (climb_date, player_id)
);

create index ipl_climb_results_date_total on public.ipl_climb_results (climb_date, total);

alter table public.ipl_climb_results enable row level security;
revoke all on public.ipl_climb_results from anon, authenticated;

create function public.ipl_climb_stats(p_date date, p_player uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with day as (
    select player_id, total from ipl_climb_results where climb_date = p_date
  ),
  me as (
    select total from day where player_id = p_player
  ),
  buckets as (
    select least(width_bucket(total, 0, 7000, 14), 14) as bucket, count(*) as n from day group by 1
  )
  select json_build_object(
    'players', (select count(*) from day),
    'total', (select total from me),
    'higher', (select count(*) from day, me where day.total > me.total),
    'average', (select round(avg(total)) from day),
    'buckets', (select json_agg(coalesce(buckets.n, 0) order by i) from generate_series(1, 14) i left join buckets on buckets.bucket = i)
  );
$$;

create function public.ipl_climb_submit(p_date date, p_player uuid, p_points integer[])
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if p_date not between today - 1 and today then
    raise exception 'climb date is not open';
  end if;
  if cardinality(p_points) <> 7 or exists (select 1 from unnest(p_points) x where x is null or x < 0 or x > 1000) then
    raise exception 'invalid points';
  end if;
  insert into ipl_climb_results (climb_date, player_id, total, points)
  values (p_date, p_player, (select sum(x) from unnest(p_points) x), p_points)
  on conflict (climb_date, player_id) do nothing;
  return ipl_climb_stats(p_date, p_player);
end;
$$;

revoke execute on function public.ipl_climb_stats(date, uuid) from public;
revoke execute on function public.ipl_climb_submit(date, uuid, integer[]) from public;
grant execute on function public.ipl_climb_stats(date, uuid) to anon, authenticated;
grant execute on function public.ipl_climb_submit(date, uuid, integer[]) to anon, authenticated;
