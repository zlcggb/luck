-- Normalize participant identifiers before enforcing event-scoped uniqueness.
update public.luck_participants
set employee_id = upper(btrim(employee_id)),
    name = btrim(name),
    updated_at = now();

update public.luck_check_ins
set employee_id = upper(btrim(employee_id)),
    name = btrim(name);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'luck_participants_event_employee_key'
      and conrelid = 'public.luck_participants'::regclass
  ) then
    alter table public.luck_participants
      add constraint luck_participants_event_employee_key unique (event_id, employee_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'luck_check_ins_event_employee_key'
      and conrelid = 'public.luck_check_ins'::regclass
  ) then
    alter table public.luck_check_ins
      add constraint luck_check_ins_event_employee_key unique (event_id, employee_id);
  end if;
end
$$;

create unique index if not exists luck_winners_event_participant_key
  on public.luck_winners (event_id, participant_id)
  where participant_id is not null;

create unique index if not exists luck_winners_event_employee_key
  on public.luck_winners (event_id, employee_id);

create index if not exists luck_participants_checked_in_pool_idx
  on public.luck_participants (event_id, status, created_at)
  where status = 'checked_in';

-- Public attendee entry point. This is deliberately narrow and idempotent:
-- one transaction both checks the event and moves the attendee into the pool.
create or replace function public.participant_check_in(
  p_event_id uuid,
  p_employee_id text,
  p_name text,
  p_department text default null,
  p_avatar text default null,
  p_location_lat numeric default null,
  p_location_lng numeric default null,
  p_location_accuracy numeric default null,
  p_check_in_method text default 'qrcode'
)
returns public.luck_check_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.luck_events%rowtype;
  v_participant public.luck_participants%rowtype;
  v_check_in public.luck_check_ins%rowtype;
  v_employee_id text := upper(btrim(coalesce(p_employee_id, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_avatar text;
  v_distance_meters numeric;
  v_location_valid boolean := null;
begin
  if v_employee_id = '' or length(v_employee_id) > 64 then
    raise exception using errcode = '22023', message = 'INVALID_EMPLOYEE_ID';
  end if;

  if v_name = '' or length(v_name) > 80 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;

  if p_check_in_method not in ('qrcode', 'manual') then
    raise exception using errcode = '22023', message = 'INVALID_CHECK_IN_METHOD';
  end if;

  select * into v_event
  from public.luck_events
  where id = p_event_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'EVENT_NOT_FOUND';
  end if;

  if not coalesce(v_event.checkin_open, false)
     or (v_event.checkin_start_time is not null and now() < v_event.checkin_start_time)
     or (v_event.checkin_end_time is not null and now() > v_event.checkin_end_time) then
    raise exception using errcode = 'P0001', message = 'CHECK_IN_CLOSED';
  end if;

  if coalesce(v_event.require_location, false) then
    if p_location_lat is null or p_location_lng is null
       or v_event.location_lat is null or v_event.location_lng is null then
      raise exception using errcode = '22023', message = 'LOCATION_REQUIRED';
    end if;

    v_distance_meters := 6371000 * acos(least(1, greatest(-1,
      sin(radians(v_event.location_lat::double precision)) * sin(radians(p_location_lat::double precision)) +
      cos(radians(v_event.location_lat::double precision)) * cos(radians(p_location_lat::double precision)) *
      cos(radians(p_location_lng::double precision - v_event.location_lng::double precision))
    )));
    v_location_valid := v_distance_meters <= coalesce(v_event.location_radius, 500);

    if not v_location_valid then
      raise exception using errcode = '22023', message = 'OUTSIDE_CHECK_IN_RANGE';
    end if;
  end if;

  v_avatar := coalesce(nullif(btrim(p_avatar), ''),
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' ||
    pg_catalog.encode(pg_catalog.convert_to(v_employee_id, 'UTF8'), 'hex'));

  insert into public.luck_participants (
    event_id, employee_id, name, department, avatar, status, updated_at
  ) values (
    p_event_id, v_employee_id, v_name, nullif(btrim(p_department), ''),
    v_avatar, 'checked_in', now()
  )
  on conflict (event_id, employee_id) do update
  set name = excluded.name,
      department = coalesce(excluded.department, public.luck_participants.department),
      avatar = excluded.avatar,
      status = 'checked_in',
      updated_at = now()
  returning * into v_participant;

  insert into public.luck_check_ins (
    event_id, participant_id, employee_id, name, department, avatar,
    location_lat, location_lng, location_accuracy, location_valid,
    check_in_method
  ) values (
    p_event_id, v_participant.id, v_employee_id, v_name,
    nullif(btrim(p_department), ''), v_avatar,
    p_location_lat, p_location_lng, p_location_accuracy, v_location_valid,
    p_check_in_method
  )
  on conflict (event_id, employee_id) do update
  set participant_id = excluded.participant_id,
      name = excluded.name,
      department = coalesce(excluded.department, public.luck_check_ins.department),
      avatar = excluded.avatar
  returning * into v_check_in;

  return v_check_in;
end
$$;

revoke all on function public.participant_check_in(uuid, text, text, text, text, numeric, numeric, numeric, text) from public;
grant execute on function public.participant_check_in(uuid, text, text, text, text, numeric, numeric, numeric, text) to anon, authenticated;

-- Admin rolling draw. Event-level advisory locking prevents two prize tiers from
-- selecting the same attendee concurrently; prize and winner updates are atomic.
create or replace function public.draw_rolling_winners(
  p_event_id uuid,
  p_prize_id uuid,
  p_count integer default 1
)
returns setof public.luck_winners
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_auth_id uuid;
  v_mode text;
  v_prize public.luck_prizes%rowtype;
  v_participant public.luck_participants%rowtype;
  v_winner public.luck_winners%rowtype;
  v_available integer;
begin
  if p_count < 1 or p_count > 50 then
    raise exception using errcode = '22023', message = 'INVALID_DRAW_COUNT';
  end if;

  select u.auth_id, e.mode into v_owner_auth_id, v_mode
  from public.luck_events e
  join public.luck_users u on u.id = e.owner_id
  where e.id = p_event_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'EVENT_NOT_FOUND';
  end if;

  if v_owner_auth_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'EVENT_OWNER_REQUIRED';
  end if;

  if v_mode <> 'rolling' then
    raise exception using errcode = '22023', message = 'ROLLING_EVENT_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text, 0));

  select * into v_prize
  from public.luck_prizes
  where id = p_prize_id and event_id = p_event_id and is_active
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PRIZE_NOT_FOUND';
  end if;

  if v_prize.remaining < p_count then
    raise exception using errcode = '22023', message = 'INSUFFICIENT_PRIZE_REMAINING';
  end if;

  select count(*) into v_available
  from public.luck_participants p
  where p.event_id = p_event_id
    and p.status = 'checked_in'
    and not exists (
      select 1 from public.luck_winners w
      where w.event_id = p_event_id
        and (w.participant_id = p.id or w.employee_id = p.employee_id)
    );

  if v_available < p_count then
    raise exception using errcode = '22023', message = 'INSUFFICIENT_ELIGIBLE_PARTICIPANTS';
  end if;

  for v_participant in
    select p.*
    from public.luck_participants p
    where p.event_id = p_event_id
      and p.status = 'checked_in'
      and not exists (
        select 1 from public.luck_winners w
        where w.event_id = p_event_id
          and (w.participant_id = p.id or w.employee_id = p.employee_id)
      )
    order by random()
    limit p_count
  loop
    insert into public.luck_winners (
      event_id, prize_id, participant_id, employee_id, name, department, avatar
    ) values (
      p_event_id, p_prize_id, v_participant.id, v_participant.employee_id,
      v_participant.name, v_participant.department, v_participant.avatar
    ) returning * into v_winner;

    return next v_winner;
  end loop;

  update public.luck_prizes
  set remaining = remaining - p_count,
      updated_at = now()
  where id = p_prize_id;

  return;
end
$$;

revoke all on function public.draw_rolling_winners(uuid, uuid, integer) from public;
grant execute on function public.draw_rolling_winners(uuid, uuid, integer) to authenticated;

-- Prevent bypassing the atomic rolling draw through the old helper.
revoke all on function public.decrement_prize_remaining(uuid) from public, anon, authenticated;
