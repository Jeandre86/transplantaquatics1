-- SECURITY DEFINER functions are executable by PUBLIC by default in Postgres.
-- Admin endpoints must only be callable by authenticated users; each function
-- still checks the caller's role/permission internally.
revoke execute on function public.bootstrap_first_owner() from public, anon;
grant execute on function public.bootstrap_first_owner() to authenticated;

revoke execute on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated;

revoke execute on function public.admin_dashboard_counts() from public, anon;
grant execute on function public.admin_dashboard_counts() to authenticated;
revoke execute on function public.admin_review_profile_claim(uuid, text, text) from public, anon;
grant execute on function public.admin_review_profile_claim(uuid, text, text) to authenticated;
revoke execute on function public.admin_set_membership(uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_membership(uuid, text, boolean) to authenticated;
revoke execute on function public.admin_set_permission(uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_permission(uuid, text, boolean) to authenticated;
revoke execute on function public.admin_set_import_progress(uuid, text, text, text) from public, anon;
grant execute on function public.admin_set_import_progress(uuid, text, text, text) to authenticated;

revoke execute on function public.admin_start_meet_import(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_start_meet_import(uuid, text, text, text, text) to authenticated;
revoke execute on function public.admin_stage_import_rows(uuid, jsonb) from public, anon;
grant execute on function public.admin_stage_import_rows(uuid, jsonb) to authenticated;
revoke execute on function public.admin_review_import_result(uuid, text, uuid, text) from public, anon;
grant execute on function public.admin_review_import_result(uuid, text, uuid, text) to authenticated;
revoke execute on function public.admin_publish_import_batch(uuid) from public, anon;
grant execute on function public.admin_publish_import_batch(uuid) to authenticated;
revoke execute on function public.admin_rollback_import_batch(uuid) from public, anon;
grant execute on function public.admin_rollback_import_batch(uuid) to authenticated;
revoke execute on function public.admin_confirm_record_candidate(uuid, text, text) from public, anon;
grant execute on function public.admin_confirm_record_candidate(uuid, text, text) to authenticated;
revoke execute on function public.admin_find_swimmers(text, text) from public, anon;
grant execute on function public.admin_find_swimmers(text, text) to authenticated;
revoke execute on function public.admin_create_import_swimmer(uuid) from public, anon;
grant execute on function public.admin_create_import_swimmer(uuid) to authenticated;
revoke execute on function public.admin_link_import_swimmer(uuid, uuid, text) from public, anon;
grant execute on function public.admin_link_import_swimmer(uuid, uuid, text) to authenticated;
revoke execute on function public.admin_check_wtg_records(uuid) from public, anon;
grant execute on function public.admin_check_wtg_records(uuid) to authenticated;
revoke execute on function public.admin_list_members() from public, anon;
grant execute on function public.admin_list_members() to authenticated;
revoke execute on function public.admin_search_accounts(text) from public, anon;
grant execute on function public.admin_search_accounts(text) to authenticated;
revoke execute on function public.admin_time_to_ms(text) from public, anon;
grant execute on function public.admin_time_to_ms(text) to authenticated;

-- Index new administrative foreign-key columns used in batch and record views.
create index if not exists admin_import_batches_meet_catalog_fk_idx on public.admin_import_batches(meet_catalog_id);
create index if not exists admin_import_batches_submitted_meet_fk_idx on public.admin_import_batches(submitted_meet_id);
create index if not exists admin_import_results_linked_swimmer_fk_idx on public.admin_import_results(linked_swimmer_id);
create index if not exists admin_import_results_published_result_fk_idx on public.admin_import_results(published_result_id);
create index if not exists admin_import_swimmers_resolved_swimmer_fk_idx on public.admin_import_swimmers(resolved_swimmer_id);
create index if not exists admin_import_swimmers_reviewer_fk_idx on public.admin_import_swimmers(reviewer_id);
create index if not exists imported_official_performances_batch_fk_idx on public.imported_official_performances(batch_id);
create index if not exists admin_record_candidates_baseline_fk_idx on public.admin_record_candidates(baseline_record_id);
create index if not exists wtg_record_history_candidate_fk_idx on public.wtg_record_history(candidate_id);
create index if not exists wtg_record_history_swimmer_fk_idx on public.wtg_record_history(swimmer_id);
create index if not exists wtg_record_history_meet_fk_idx on public.wtg_record_history(meet_catalog_id);
