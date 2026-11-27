# AfyaLink API contract v0.1

Base URL: `/api`. The search, compare, request, provider listing, provider request, inventory traceability and analytics endpoints below are implemented by the Express server. All data is synthetic in this prototype.

## Conventions

JSON request/response bodies; UUID identifiers; UTC ISO-8601 timestamps; KES currency. Price fields are unit prices as JSON numbers. Successful item response: `{"data":{...}}`; list response: `{"data":[],"meta":{"page":1,"limit":20,"total":0}}`. Errors: `{"error":{"code":"VALIDATION_ERROR","message":"Invalid request","fields":{"quantity":"Must be positive"}}}`. Never return raw database errors.

Statuses: 200 read/update, 201 create, 400 invalid input, 401 missing/invalid authentication, 403 role denied, 404 missing or inaccessible resource, 409 invalid transition/duplicate, 429 throttled, 500 unexpected failure. Return 404 for another owner's resource to avoid leaking its existence. Limit JSON bodies and page sizes.

Private routes use `Authorization: Bearer <Supabase access token>`. Express verifies the token and derives the user ID. Provider routes additionally look up provider membership. Clients cannot assign their own membership. All write fields not explicitly allowed are rejected.

## Search

`GET /listings?type=service&q=ultrasound&location=Nairobi&available=true&max_price=2000&sort=price_asc&page=1&limit=20`

`type`: service or medication, required. `q`: trimmed 1–100 chars. `location`: optional area text. `available`: optional boolean. `max_price`: optional non-negative KES amount. `sort`: price_asc (default), price_desc or updated_desc. `page` >=1; `limit` 1–100. Stable tie-break by listing ID. Invalid filters return 400. No distance sorting without explicit coordinates and a defined distance calculation.

```json
{
  "data": [{
    "id": "30000000-0000-4000-8000-000000000001",
    "provider": {"id":"10000000-0000-4000-8000-000000000001","name":"Demo Afya Hospital","type":"hospital","location":"Nairobi","verified":false},
    "item": {"id":"20000000-0000-4000-8000-000000000001","name":"Ultrasound","type":"service","strength":null,"dosage_form":null,"unit":"scan"},
    "price":1200,"currency":"KES","pricing_unit":"scan","available":true,"stock_quantity":null,
    "updated_at":"2026-11-27T10:00:00Z"
  }],
  "meta":{"page":1,"limit":20,"total":1}
}
```

This is fictional fixture data. Stock is provider-reported and the timestamp must be shown.

## Compare

`POST /compare` public; body `{"items":[{"item_id":"20000000-0000-4000-8000-000000000002","quantity":10}],"location":"Nairobi"}`. Accept 1–20 distinct catalog IDs and positive integer quantities. Medicines must match exact strength, form and pricing unit. Return one option per provider:

```json
{"data":[{"provider_id":"10000000-0000-4000-8000-000000000002","complete":true,"lines":[{"item_id":"20000000-0000-4000-8000-000000000002","listing_id":"30000000-0000-4000-8000-000000000002","quantity":10,"unit_price":5,"subtotal":50}],"missing_item_ids":[],"total":50,"currency":"KES"}]}
```

Insufficient stock or unavailable items are missing. For partial options, `complete=false`, `total=null`, and include `available_subtotal` plus missing IDs. Rank complete options first by total; display partial options separately. Comparison does not confirm or reserve stock.

## Patient requests

`POST /requests` authenticated patient: `{"listing_id":"30000000-0000-4000-8000-000000000001","quantity":1,"request_group_id":null}`. Server supplies patient identity, pending status and default pending expiry (30 minutes). A group UUID may link related enquiries but grants no additional read access. Validate listing availability and pricing unit. Response 201:

```json
{"data":{"id":"40000000-0000-4000-8000-000000000001","listing_id":"30000000-0000-4000-8000-000000000001","quantity":1,"request_group_id":null,"status":"pending","confirmed_price":null,"currency":"KES","expires_at":"2026-11-27T10:30:00Z","created_at":"2026-11-27T10:00:00Z"}}
```

`GET /requests/:id`: only the creating patient; same data shape. Compute effective expired state on read if expiry has passed. Repeated submission creates a separate enquiry; client disables double-submit while in flight. Add idempotency before real deployment.

## Provider listings

`GET /provider/listings?page=1&limit=20`: paginated listing shape above, scoped to authenticated provider membership.

`POST /provider/listings`: `{"item_id":"...UUID...","price":1200,"pricing_unit":"scan","available":true,"stock_quantity":null}`. Provider is derived from trusted membership; for multiple memberships require an authorized selected provider. Return 201 with listing. Existing provider/item/unit returns 409. Validate provider/item type compatibility.

`PATCH /provider/listings/:id`: allow only price, availability and stock quantity. The client may echo `item_id` and `pricing_unit` from the edit form, but they must equal the current values; any change is rejected with 400. Same validations as creation; server sets updated_at. Never permit changing owner. Return updated listing. Monetary values non-negative, at most two decimal places; stock null or non-negative integer. Medication unit must match catalog unit.

`DELETE /provider/listings/:id`: provider-scoped. Return `{"data":{"id":"..."}}`; 404 for another owner's listing; 409 `LISTING_HAS_REQUESTS` when a request references the listing, preserving enquiry history.

## Provider requests

`GET /provider/requests?status=pending&page=1&limit=20`: scoped paginated request records with listing/item and quantity; do not expose patient contact details.

`PATCH /provider/requests/:id`: confirm body `{"status":"confirmed","confirmed_price":1200,"expires_at":"2026-11-27T11:00:00Z"}` or decline `{"status":"declined"}`. Confirmed price is a unit price. Validate future expiry (maximum 24 hours), finite non-negative price and pending/unexpired starting state. A decline cannot contain confirmation fields. Respond with updated request.

Use a transaction/conditional update for pending → confirmed/declined. Expired, declined or already confirmed transitions return 409. Snapshot confirmed price; changes to listing price must not change existing quotes. No reservation or payment is performed.

## Provider inventory traceability

All inventory routes require provider Bearer authentication and use `request.provider.id` from membership; client-supplied provider ownership is rejected. Quantities are signed integers: receipts and returns are positive, dispensing/damage/expiry/quarantine are negative, and adjustments may be either direction. Movements are append-only; corrections are new adjustment or reversal movements.

`POST /provider/inventory/batches` creates a medication batch and its initial `received` movement in one transaction:

```json
{"listing_id":"30000000-0000-4000-8000-000000000002","batch_number":"PCM-2026-11-A","manufacturer":"Synthetic Pharma","supplier":"Demo Medical Supplies","date_received":"2026-11-01","expiry_date":"2027-12-31","initial_quantity":500,"unit":"tablet","storage_info":"Room temperature, below 30C"}
```

`GET /provider/inventory/batches?listing_id=&status=&expiring_within_days=&page=1&limit=20` returns batches with `expiry_bucket`, `days_to_expiry`, `inventory_value`, item and listing snapshots. `GET /provider/inventory/batches/:id` returns one batch. `GET /provider/inventory/batches/:id/history` returns its complete chronological movement ledger.

`POST /provider/inventory/batches/:id/movements` records one movement:

```json
{"movement_type":"dispensed","quantity":-20,"reason":"Patient enquiry fulfilled","reference":"request:40000000-0000-4000-8000-000000000001"}
```

The server locks the batch row, checks the previous balance, calculates the new balance, inserts the immutable movement, and writes a server-generated provider event in the same transaction. A database trigger updates the batch balance and synchronises `listings.stock_quantity` from recorded batch balances. Invalid direction, ownership mismatch or a negative resulting balance returns 400/404/409 without writing history. `GET /provider/inventory/movements?batch_id=&movement_type=&from=&to=&page=1&limit=20` lists movements across the provider.

## Inventory monitoring and intelligence

`GET /provider/inventory/monitoring` returns totals, expiry categories and alerts derived from recorded batches, movements and stock counts: low stock, expiring batches, expired batches, unusual adjustments and incomplete batch information.

`GET /provider/inventory/expiry` groups active batches into `expired`, `within_30_days`, `within_60_days`, `within_90_days` and `safe`.

`GET /provider/inventory/forecast` returns explainable average-daily-consumption estimates using the last 30 days of dispensing movements: `days_remaining`, `stockout_date`, `trend`, `reorder_warning`, `data_status` and a plain-language explanation. It returns `insufficient_history` instead of inventing a forecast.

`POST /provider/inventory/audits` records a physical stock count. It snapshots expected balances, stores line discrepancies and does not alter stock automatically. Corrections are separate documented adjustment movements.

```json
{"notes":"Weekly synthetic count","lines":[{"batch_id":"50000000-0000-4000-8000-000000000001","counted_quantity":280}]}
```

`GET /provider/inventory/audits` and `GET /provider/inventory/audits/:id` return audit records and their discrepancy lines. Audit and movement records are immutable at the database level.

## Analytics and audit log

`GET /provider/analytics/inventory` returns fast-moving and slow-moving medicines, stockout frequency, expiry losses, monthly consumption, movement trends and data-backed recommendations. `GET /provider/analytics/operations` returns enquiry counts, response-time estimates, frequently requested services, unavailable-service history and request trends. `GET /provider/audit-log?action=&record_type=&from=&to=&page=1&limit=20` returns server-generated provider events with previous and new values where relevant.

Analytics are simple explainable calculations over recorded data. They are not machine learning and do not claim medicine authenticity.

## Integration checks

Dev 1 and Dev 3 build mocks against these shapes. Dev 2 coordinates any contract changes before consumers change. Verify cross-provider and cross-patient denial, expired requests, partial prescription matching, quantity/price validation and stable pagination before the demo.
