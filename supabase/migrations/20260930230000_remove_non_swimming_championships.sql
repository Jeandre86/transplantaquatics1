-- Remove non-swimming championships from the public meet catalogue.
delete from public.meet_catalog
where series_id = 'transplant-football-world-cup'
   or catalog_key = 'international-austrian-ski-championships:edition:2026';
