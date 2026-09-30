-- Remove the World Transplant Winter Games series from the public meet catalogue.
delete from public.meet_catalog
where series_id = 'world-transplant-games-winter';
