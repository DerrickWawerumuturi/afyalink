# AfyaLink API contract v0.1

Base URL: `/api`. All routes below are implemented; authorization, validation and examples are the implementation contract.

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

## Patient appointments

`POST /appointments` authenticated patient: `{"listing_id":"...UUID...","requested_for":"2026-11-28T09:00:00Z","notes":"Optional note"}`. Services only; the listing must be available, and the requested time must be in the future and within 90 days. Creates status `requested` and returns 201 with provider, item and listing details. An appointment is a request, not a guaranteed booking.

`GET /appointments`: the authenticated patient's own appointments (maximum 100), ordered by requested time. `GET /appointments/:id`: own appointment only, 404 for another patient.

`PATCH /appointments/:id`: `{"status":"cancelled"}` only. Requested or confirmed appointments can be cancelled; terminal states return 409. Another patient's appointment returns 404.

## Provider profile

`GET /provider/profile`: authenticated provider member. Returns the trusted provider record:

```json
{"data":{"id":"10000000-0000-4000-8000-000000000001","name":"Demo Afya Hospital","type":"hospital","location":"Nairobi","verified":false}}
```

Type and verification are controlled by trusted setup, not user-editable metadata. Profile editing is outside the MVP.

## Provider listings

`GET /provider/listings?page=1&limit=20`: paginated listing shape above, scoped to authenticated provider membership.

`POST /provider/listings`: `{"item_id":"...UUID...","price":1200,"pricing_unit":"scan","available":true,"stock_quantity":null}`. Provider is derived from trusted membership; for multiple memberships require an authorized selected provider. Return 201 with listing. Existing provider/item/unit returns 409. Validate provider/item type compatibility.

`PATCH /provider/listings/:id`: allow only price, availability and stock quantity. The client may echo `item_id` and `pricing_unit` from the edit form, but they must equal the current values; any change is rejected with 400. Same validations as creation; server sets updated_at. Never permit changing owner. Return updated listing. Monetary values non-negative, at most two decimal places; stock null or non-negative integer. Medication unit must match catalog unit.

`DELETE /provider/listings/:id`: provider-scoped. Return `{"data":{"id":"..."}}`; 404 for another owner's listing; 409 `LISTING_HAS_REQUESTS` when a request references the listing, preserving enquiry history.

## Provider requests

`GET /provider/requests?status=pending&page=1&limit=20`: scoped paginated request records with listing/item and quantity; do not expose patient contact details.

`PATCH /provider/requests/:id`: confirm body `{"status":"confirmed","confirmed_price":1200,"expires_at":"2026-11-27T11:00:00Z"}` or decline `{"status":"declined"}`. Confirmed price is a unit price. Validate future expiry (maximum 24 hours), finite non-negative price and pending/unexpired starting state. A decline cannot contain confirmation fields. Respond with updated request.

Use a transaction/conditional update for pending → confirmed/declined. Expired, declined or already confirmed transitions return 409. Snapshot confirmed price; changes to listing price must not change existing quotes. No reservation or payment is performed.

## Provider appointments

`GET /provider/appointments?status=requested&page=1&limit=20`: scoped paginated appointment records with provider/item/listing details. Do not expose patient contact details beyond the authenticated user identity.

`PATCH /provider/appointments/:id`: `{"status":"confirmed"}` or `{"status":"declined"}`. Only `requested` appointments can transition; terminal states and other providers' appointments return 409/404. Confirmation is not a payment or stock reservation.

## Integration checks

Dev 1 and Dev 3 build mocks against these shapes. Dev 2 coordinates any contract changes before consumers change. Verify cross-provider and cross-patient denial, expired requests, partial prescription matching, quantity/price validation and stable pagination before the demo.
