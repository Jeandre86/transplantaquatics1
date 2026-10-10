create or replace function public.admin_bulk_verify_results(
  p_result_ids uuid[] default '{}'::uuid[],
  p_all_pending boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_count integer := 0;
begin
  if not public.has_admin_permission('publish_results') then
    raise exception 'Result review permission required.' using errcode = '42501';
  end if;

  if p_all_pending then
    update public.swimmer_results
    set status = 'verified', updated_at = now()
    where status in ('swimmer_submitted', 'imported_unverified')
      and not (id = any(coalesce(p_result_ids, '{}'::uuid[])));
  else
    if coalesce(cardinality(p_result_ids), 0) = 0 then
      raise exception 'Select at least one pending result to verify.';
    end if;

    update public.swimmer_results
    set status = 'verified', updated_at = now()
    where id = any(p_result_ids)
      and status in ('swimmer_submitted', 'imported_unverified');
  end if;

  get diagnostics verified_count = row_count;

  if verified_count > 0 then
    insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data, after_data, details)
    values (
      auth.uid(),
      'bulk_results_verified',
      'swimmer_results',
      null,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object('status', 'verified'),
      jsonb_build_object(
        'count', verified_count,
        'all_pending', p_all_pending,
        'excluded_result_ids', case when p_all_pending then to_jsonb(coalesce(p_result_ids, '{}'::uuid[])) else '[]'::jsonb end,
        'selected_result_ids', case when p_all_pending then '[]'::jsonb else to_jsonb(coalesce(p_result_ids, '{}'::uuid[])) end
      )
    );
  end if;

  return verified_count;
end;
$$;

revoke all on function public.admin_bulk_verify_results(uuid[], boolean) from public, anon;
grant execute on function public.admin_bulk_verify_results(uuid[], boolean) to authenticated;

notify pgrst, 'reload schema';
