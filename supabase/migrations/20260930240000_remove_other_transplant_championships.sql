-- Keep only World and National Transplant Games in the meet catalogue.
delete from public.meet_catalog
where category = 'Other Transplant Championships';

alter table public.meet_catalog
  drop constraint if exists meet_catalog_category_check,
  drop constraint if exists meet_catalog_category_order_check;

alter table public.meet_catalog
  add constraint meet_catalog_category_check
    check (category in ('World Transplant Games', 'National Transplant Games')),
  add constraint meet_catalog_category_order_check
    check (category_order between 1 and 2);
