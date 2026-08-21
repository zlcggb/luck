revoke all on function public.draw_rolling_winners(uuid, uuid, integer) from public, anon;
grant execute on function public.draw_rolling_winners(uuid, uuid, integer) to authenticated;

revoke all on function public.decrement_prize_remaining(uuid) from public, anon, authenticated;
