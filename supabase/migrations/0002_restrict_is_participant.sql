revoke execute on function public.is_participant(uuid) from public, anon;
grant execute on function public.is_participant(uuid) to authenticated;
