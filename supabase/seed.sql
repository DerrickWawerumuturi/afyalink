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
  ('20000000-0000-4000-8000-000000000003', 'Complete blood count', 'service', null, null, 'test'),
  ('20000000-0000-4000-8000-000000000004', 'Amoxicillin', 'medication', '500 mg', 'capsule', 'capsule'),
  ('20000000-0000-4000-8000-000000000005', 'Ibuprofen', 'medication', '200 mg', 'tablet', 'tablet')
on conflict do nothing;

insert into public.listings (id, provider_id, item_id, price, pricing_unit, available, stock_quantity)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1200.00, 'scan', true, null),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 5.00, 'tablet', true, 200),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 1100.00, 'scan', true, null),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 950.00, 'test', true, null),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 6.00, 'tablet', true, 150),
  ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 12.00, 'capsule', true, 90),
  ('30000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 14.00, 'capsule', true, 60),
  ('30000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 800.00, 'test', false, null)
on conflict do nothing;

insert into public.listings (id, provider_id, item_id, price, pricing_unit, available, stock_quantity)
values
  ('30000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 10.00, 'tablet', true, 60)
on conflict do nothing;

insert into public.inventory_batches
  (id, provider_id, listing_id, batch_number, manufacturer, supplier, date_received,
   expiry_date, initial_quantity, current_quantity, unit, storage_info, status,
   created_by_label)
values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'PCM-2026-11-A', 'Synthetic Pharma Ltd', 'Demo Medical Supplies', '2026-10-01', '2026-12-20', 500, 0, 'tablet', 'Room temperature, below 30C', 'active', 'Synthetic seed'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'PCM-2026-09-B', 'Synthetic Pharma Ltd', 'Demo Medical Supplies', '2026-09-10', '2027-09-30', 400, 0, 'tablet', 'Room temperature, below 30C', 'active', 'Synthetic seed'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000007', 'AMX-2026-10-A', 'Demo Generics', 'Demo Medical Supplies', '2026-10-02', '2027-03-15', 200, 0, 'capsule', 'Dry storage, protected from light', 'active', 'Synthetic seed'),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000009', 'IBU-2026-11-A', 'Demo Generics', 'Nairobi Pharma Distributors', '2026-11-03', '2026-12-05', 300, 0, 'tablet', 'Room temperature', 'active', 'Synthetic seed')
on conflict do nothing;

insert into public.inventory_movements
  (id, batch_id, provider_id, movement_type, quantity, previous_balance, new_balance,
   reason, reference, actor_label, occurred_at)
values
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'received', 500, 0, 500, 'Synthetic batch receipt', 'PO-DEMO-001', 'Synthetic seed', '2026-10-01T08:00:00Z'),
  ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'dispensed', -60, 500, 440, 'Synthetic dispensing', 'RX-DEMO-001', 'Synthetic seed', '2026-10-05T10:30:00Z'),
  ('51000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'dispensed', -80, 440, 360, 'Synthetic dispensing', 'RX-DEMO-002', 'Synthetic seed', '2026-10-12T14:15:00Z'),
  ('51000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'adjustment', 20, 360, 380, 'Synthetic documented correction', 'ADJ-DEMO-001', 'Synthetic seed', '2026-10-20T09:00:00Z'),
  ('51000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'dispensed', -50, 380, 330, 'Synthetic dispensing', 'RX-DEMO-003', 'Synthetic seed', '2026-11-20T16:45:00Z'),
  ('51000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'received', 400, 0, 400, 'Synthetic batch receipt', 'PO-DEMO-002', 'Synthetic seed', '2026-09-10T08:00:00Z'),
  ('51000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'dispensed', -20, 400, 380, 'Synthetic dispensing', 'RX-DEMO-004', 'Synthetic seed', '2026-11-02T11:00:00Z'),
  ('51000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'received', 200, 0, 200, 'Synthetic batch receipt', 'PO-DEMO-003', 'Synthetic seed', '2026-10-02T08:00:00Z'),
  ('51000000-0000-4000-8000-000000000009', '50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'dispensed', -70, 200, 130, 'Synthetic dispensing', 'RX-DEMO-005', 'Synthetic seed', '2026-10-08T12:00:00Z'),
  ('51000000-0000-4000-8000-000000000010', '50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'adjustment', -20, 130, 110, 'Synthetic documented correction', 'ADJ-DEMO-002', 'Synthetic seed', '2026-10-15T09:30:00Z'),
  ('51000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'adjustment', -30, 110, 80, 'Synthetic documented correction', 'ADJ-DEMO-003', 'Synthetic seed', '2026-10-22T09:30:00Z'),
  ('51000000-0000-4000-8000-000000000012', '50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'adjustment', 10, 80, 90, 'Synthetic documented correction', 'ADJ-DEMO-004', 'Synthetic seed', '2026-11-01T09:30:00Z'),
  ('51000000-0000-4000-8000-000000000013', '50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'dispensed', -30, 90, 60, 'Synthetic dispensing', 'RX-DEMO-006', 'Synthetic seed', '2026-11-21T13:00:00Z'),
  ('51000000-0000-4000-8000-000000000014', '50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'received', 300, 0, 300, 'Synthetic batch receipt', 'PO-DEMO-004', 'Synthetic seed', '2026-11-03T08:00:00Z'),
  ('51000000-0000-4000-8000-000000000015', '50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'dispensed', -240, 300, 60, 'Synthetic dispensing', 'RX-DEMO-007', 'Synthetic seed', '2026-11-24T15:00:00Z')
on conflict do nothing;

insert into public.inventory_audits
  (id, provider_id, notes, counted_by_label, counted_at)
values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Synthetic weekly physical count', 'Synthetic pharmacist', '2026-11-26T09:00:00Z')
on conflict do nothing;

insert into public.inventory_audit_lines
  (id, audit_id, batch_id, expected_quantity, counted_quantity)
values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 330, 280),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 380, 380),
  ('61000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 60, 58),
  ('61000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', 60, 60)
on conflict do nothing;

-- Provider memberships must reference real Supabase Auth demo users, so they
-- are intentionally not seeded. After creating demo accounts, assign trusted
-- membership with (replace the user UUIDs):
--
-- insert into public.provider_memberships (user_id, provider_id) values
--   ('<hospital-demo-user-uuid>', '10000000-0000-4000-8000-000000000001'),
--   ('<pharmacy-demo-user-uuid>', '10000000-0000-4000-8000-000000000002')
-- on conflict do nothing;
