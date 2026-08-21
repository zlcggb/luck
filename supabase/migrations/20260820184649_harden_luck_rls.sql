create or replace function public.get_check_in_by_token(
  p_event_id uuid,
  p_check_in_id uuid
)
returns table (
  id uuid,
  event_id uuid,
  participant_id uuid,
  employee_id varchar,
  name varchar,
  department varchar,
  avatar varchar,
  check_in_time timestamptz,
  check_in_method varchar,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.event_id, c.participant_id, c.employee_id, c.name,
         c.department, c.avatar, c.check_in_time, c.check_in_method, c.created_at
  from public.luck_check_ins c
  where c.event_id = p_event_id and c.id = p_check_in_id
  limit 1
$$;

revoke all on function public.get_check_in_by_token(uuid, uuid) from public;
grant execute on function public.get_check_in_by_token(uuid, uuid) to anon, authenticated;

create or replace function public.get_personal_wheel_winner(
  p_event_id uuid,
  p_check_in_id uuid
)
returns table (
  id uuid,
  event_id uuid,
  prize_id uuid,
  participant_id uuid,
  employee_id text,
  name text,
  department text,
  avatar text,
  status text,
  won_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.event_id, w.prize_id, w.participant_id, w.employee_id,
         w.name, w.department, w.avatar, w.status, w.won_at, w.created_at
  from public.luck_check_ins c
  join public.luck_winners w
    on w.event_id = c.event_id and w.employee_id = c.employee_id
  where c.event_id = p_event_id and c.id = p_check_in_id
  limit 1
$$;

revoke all on function public.get_personal_wheel_winner(uuid, uuid) from public;
grant execute on function public.get_personal_wheel_winner(uuid, uuid) to anon, authenticated;

drop policy if exists luck_users_select_public on public.luck_users;

drop policy if exists luck_events_insert_all on public.luck_events;
drop policy if exists luck_events_update_all on public.luck_events;
drop policy if exists luck_events_delete_all on public.luck_events;

create policy luck_events_insert_owner on public.luck_events
  for insert to authenticated
  with check (
    owner_id in (select u.id from public.luck_users u where u.auth_id = auth.uid())
  );

create policy luck_events_update_owner on public.luck_events
  for update to authenticated
  using (owner_id in (select u.id from public.luck_users u where u.auth_id = auth.uid()))
  with check (owner_id in (select u.id from public.luck_users u where u.auth_id = auth.uid()));

create policy luck_events_delete_owner on public.luck_events
  for delete to authenticated
  using (owner_id in (select u.id from public.luck_users u where u.auth_id = auth.uid()));

drop policy if exists luck_prizes_insert_all on public.luck_prizes;
drop policy if exists luck_prizes_update_all on public.luck_prizes;
drop policy if exists luck_prizes_delete_all on public.luck_prizes;

create policy luck_prizes_insert_owner on public.luck_prizes
  for insert to authenticated
  with check (exists (
    select 1 from public.luck_events e
    join public.luck_users u on u.id = e.owner_id
    where e.id = event_id and u.auth_id = auth.uid()
  ));

create policy luck_prizes_update_owner on public.luck_prizes
  for update to authenticated
  using (exists (
    select 1 from public.luck_events e
    join public.luck_users u on u.id = e.owner_id
    where e.id = event_id and u.auth_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.luck_events e
    join public.luck_users u on u.id = e.owner_id
    where e.id = event_id and u.auth_id = auth.uid()
  ));

create policy luck_prizes_delete_owner on public.luck_prizes
  for delete to authenticated
  using (exists (
    select 1 from public.luck_events e
    join public.luck_users u on u.id = e.owner_id
    where e.id = event_id and u.auth_id = auth.uid()
  ));

drop policy if exists luck_participants_select_all on public.luck_participants;
drop policy if exists luck_participants_insert_anon on public.luck_participants;
drop policy if exists luck_participants_update_status on public.luck_participants;
drop policy if exists luck_participants_delete_anon on public.luck_participants;

create policy luck_participants_owner_all on public.luck_participants
  for all to authenticated
  using (exists (
    select 1 from public.luck_events e
    join public.luck_users u on u.id = e.owner_id
    where e.id = event_id and u.auth_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.luck_events e
    join public.luck_users u on u.id = e.owner_id
    where e.id = event_id and u.auth_id = auth.uid()
  ));

drop policy if exists luck_check_ins_select_all on public.luck_check_ins;
drop policy if exists luck_check_ins_insert_anon on public.luck_check_ins;
drop policy if exists luck_check_ins_delete_all on public.luck_check_ins;

create policy luck_check_ins_owner_select on public.luck_check_ins
  for select to authenticated
  using (exists (
    select 1 from public.luck_events e
    join public.luck_users u on u.id = e.owner_id
    where e.id = event_id and u.auth_id = auth.uid()
  ));

create policy luck_check_ins_owner_delete on public.luck_check_ins
  for delete to authenticated
  using (exists (
    select 1 from public.luck_events e
    join public.luck_users u on u.id = e.owner_id
    where e.id = event_id and u.auth_id = auth.uid()
  ));

drop policy if exists luck_winners_select_all on public.luck_winners;
drop policy if exists luck_winners_insert_all on public.luck_winners;
drop policy if exists luck_winners_update_all on public.luck_winners;
drop policy if exists luck_winners_delete_all on public.luck_winners;

create policy luck_winners_owner_all on public.luck_winners
  for all to authenticated
  using (exists (
    select 1 from public.luck_events e
    join public.luck_users u on u.id = e.owner_id
    where e.id = event_id and u.auth_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.luck_events e
    join public.luck_users u on u.id = e.owner_id
    where e.id = event_id and u.auth_id = auth.uid()
  ));
