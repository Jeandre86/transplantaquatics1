-- Update the 2026 South African National Transplant Games dates.
update public.meet_catalog
set meet_date = '2026-09-24',
    end_date = '2026-09-27',
    status = 'completed',
    source_metadata = (source_metadata - 'notes') || jsonb_build_object(
      'dates', jsonb_build_object('start', '2026-09-24', 'end', '2026-09-27'),
      'status', 'completed'
    ),
    updated_at = now()
where catalog_key = 'south-african-national-transplant-games:edition:2026';
