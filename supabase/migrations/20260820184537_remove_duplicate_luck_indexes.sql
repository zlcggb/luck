alter table public.luck_check_ins
  drop constraint if exists luck_check_ins_event_employee_key;

alter table public.luck_participants
  drop constraint if exists luck_participants_event_employee_key;
