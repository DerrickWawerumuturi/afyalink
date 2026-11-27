const uuid = (prefix, n) =>
  prefix + "0000000-0000-4000-8000-" + String(n).padStart(12, "0");
const names = [
  "Ultrasound",
  "Blood test",
  "X-ray",
  "Paracetamol",
  "Amoxicillin",
];
export const catalog = names.map((name, i) => ({
  id: uuid(2, i + 1),
  name,
  type: i < 3 ? "service" : "medication",
  strength: i < 3 ? null : "500 mg",
  dosage_form: i === 3 ? "tablet" : i === 4 ? "capsule" : null,
  unit: ["scan", "test", "scan", "tablet", "capsule"][i],
}));
const providers = [
  "Acacia Medical Centre",
  "Maua Community Clinic",
  "Kijani Health Centre",
  "Acacia Pharmacy",
  "Maua Pharmacy",
  "Kijani Pharmacy",
].map((name, i) => ({
  id: uuid(1, i + 1),
  name,
  location: ["Westlands", "Kilimani", "Parklands"][i % 3] + ", Nairobi",
  type: i < 3 ? "hospital" : "pharmacy",
  verified: false,
}));
const rows = providers.flatMap((provider, i) =>
  catalog
    .filter((item) => item.type === (i < 3 ? "service" : "medication"))
    .map((item, j) => ({
      id: uuid(3, i * 5 + j + 1),
      provider,
      item,
      price:
        (i < 3 ? [1200, 450, 950] : [5, 12])[j] + (i % 3) * (i < 3 ? 250 : 2),
      currency: "KES",
      pricing_unit: item.unit,
      available: !(i === 2 && j === 0),
      stock_quantity: i < 3 ? null : i === 5 && j === 1 ? 0 : 100,
      updated_at: "2026-11-27T07:00:00Z",
    })),
);
export const search = async (type, q, area) =>
  rows
    .filter(
      (r) =>
        r.item.type === type &&
        r.item.name.toLowerCase().includes(q.toLowerCase()) &&
        r.provider.location.includes(area),
    )
    .sort((a, b) => a.price - b.price);
export const detail = (id) => rows.filter((r) => r.provider.id === id);
export const compare = async (items, area) =>
  providers
    .slice(3)
    .filter((p) => p.location.includes(area))
    .map((p) => {
      const lines = [],
        missing_item_ids = [];
      for (const { item_id, quantity } of items) {
        const r = rows.find((r) => r.provider === p && r.item.id === item_id);
        if (!r?.available || r.stock_quantity < quantity) {
          missing_item_ids.push(item_id);
          continue;
        }
        lines.push({
          item_id,
          listing_id: r.id,
          quantity,
          unit_price: r.price,
          subtotal: quantity * r.price,
        });
      }
      const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
      return {
        provider_id: p.id,
        lines,
        missing_item_ids,
        complete: !missing_item_ids.length,
        total: missing_item_ids.length ? null : subtotal,
        available_subtotal: subtotal,
        currency: "KES",
      };
    })
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        (a.total ?? 0) - (b.total ?? 0),
    );
const key = "afyalink.synthetic.requests.v1";
export function requests() {
  return JSON.parse(localStorage.getItem(key) || "[]").map((r) => ({
    ...r,
    status:
      ["pending", "confirmed"].includes(r.status) &&
      Date.parse(r.expires_at) <= Date.now()
        ? "expired"
        : r.status,
  }));
}
export function enquire(lines) {
  const group = crypto.randomUUID(),
    now = Date.now();
  const added = lines.map(({ listing_id, quantity }) => ({
    id: crypto.randomUUID(),
    listing_id,
    quantity,
    request_group_id: group,
    status: "pending",
    confirmed_price: null,
    currency: "KES",
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + 1800000).toISOString(),
    listing: rows.find((r) => r.id === listing_id),
  }));
  localStorage.setItem(key, JSON.stringify([...added, ...requests()]));
}

export function simulateReply(id) {
  const updated = requests().map((request) =>
    request.id === id && request.status === "pending"
      ? {
          ...request,
          status: "confirmed",
          confirmed_price: request.listing.price,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }
      : request,
  );
  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
}
