-- AfyaLink synthetic seed data.
-- All providers, items and prices are fictional. Never add real patient data.
-- Safe to re-run: rows use deterministic UUIDs and `on conflict do nothing`.

insert into public.providers (id, name, type, location, latitude, longitude, verified)
values
  ('10000000-0000-4000-8000-000000000001', 'Demo Afya Hospital', 'hospital', 'Nairobi', null, null, false),
  ('10000000-0000-4000-8000-000000000002', 'Demo Medi Pharmacy', 'pharmacy', 'Nairobi', null, null, false),
  ('10000000-0000-4000-8000-000000000003', 'Demo Uzima Hospital', 'hospital', 'Mombasa', null, null, false),
  ('10000000-0000-4000-8000-000000000004', 'Demo Baraka Pharmacy', 'pharmacy', 'Mombasa', null, null, false)
on conflict do nothing;

insert into public.catalog_items (id, name, type, strength, dosage_form, unit)
values
  ('20000000-0000-4000-8000-000000000001', 'Ultrasound', 'service', null, null, 'scan'),
  ('20000000-0000-4000-8000-000000000002', 'Paracetamol', 'medication', '500 mg', 'tablet', 'tablet'),
  ('20000000-0000-4000-8000-000000000003', 'Chest X-ray', 'service', null, null, 'scan'),
  ('20000000-0000-4000-8000-000000000004', 'Amoxicillin', 'medication', '500 mg', 'capsule', 'capsule')
on conflict do nothing;

insert into public.listings (id, provider_id, item_id, price, pricing_unit, available, stock_quantity)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1200.00, 'scan', true, null),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 5.00, 'tablet', true, 200),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 1100.00, 'scan', true, null),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 1800.00, 'scan', true, null),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 6.00, 'tablet', true, 150),
  ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 12.00, 'capsule', true, 90),
  ('30000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 14.00, 'capsule', true, 60)
on conflict do nothing;

-- Provider memberships must reference real Supabase Auth demo users, so they
-- are intentionally not seeded. After creating demo accounts, assign trusted
-- membership with (replace the user UUIDs):
--
-- insert into public.provider_memberships (user_id, provider_id) values
--   ('<hospital-demo-user-uuid>', '10000000-0000-4000-8000-000000000001'),
--   ('<pharmacy-demo-user-uuid>', '10000000-0000-4000-8000-000000000002')
-- on conflict do nothing;
