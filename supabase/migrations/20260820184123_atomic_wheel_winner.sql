-- Personal wheel draw: the attendee presents an unguessable check-in UUID and
-- the database chooses the prize. The browser cannot select a preferred prize.
create or replace function public.draw_personal_wheel(
  p_event_id uuid,
  p_check_in_id uuid
)
returns public.luck_winners
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.luck_events%rowtype;
  v_prize public.luck_prizes%rowtype;
  v_check_in public.luck_check_ins%rowtype;
  v_winner public.luck_winners%rowtype;
begin
  select * into v_event from public.luck_events where id = p_event_id;
  if not found or v_event.mode <> 'wheel' then
    raise exception using errcode = '22023', message = 'WHEEL_EVENT_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text, 0));

  select * into v_check_in
  from public.luck_check_ins
  where id = p_check_in_id and event_id = p_event_id;
  if not found then
    raise exception using errcode = '42501', message = 'VALID_CHECK_IN_TOKEN_REQUIRED';
  end if;

  select * into v_winner
  from public.luck_winners
  where event_id = p_event_id and employee_id = v_check_in.employee_id;
  if found then
    return v_winner;
  end if;

  select * into v_prize
  from public.luck_prizes
  where event_id = p_event_id and is_active and remaining > 0
  order by power(random(), 1.0 / remaining) desc
  limit 1
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'PRIZE_UNAVAILABLE';
  end if;

  insert into public.luck_winners (
    event_id, prize_id, participant_id, employee_id, name, department, avatar
  ) values (
    p_event_id, v_prize.id, v_check_in.participant_id, v_check_in.employee_id,
    v_check_in.name, v_check_in.department, v_check_in.avatar
  ) returning * into v_winner;

  update public.luck_prizes
  set remaining = remaining - 1,
      updated_at = now()
  where id = v_prize.id;

  return v_winner;
end
$$;

revoke all on function public.draw_personal_wheel(uuid, uuid) from public;
grant execute on function public.draw_personal_wheel(uuid, uuid) to anon, authenticated;
