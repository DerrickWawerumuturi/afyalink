import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { asyncHandler, parse } from '../http.js';
import { LISTING_COLUMNS, toListing } from '../serializers.js';

const router = Router();

const optionalMoney = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().nonnegative().optional(),
);

const searchSchema = z.object({
  type: z.enum(['service', 'medication']),
  q: z.string().trim().min(1).max(100).optional(),
  location: z.string().trim().min(1).max(120).optional(),
  available: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  max_price: optionalMoney,
  sort: z.enum(['price_asc', 'price_desc', 'updated_desc']).default('price_asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const ORDER_BY = {
  price_asc: 'l.price ASC, l.id ASC',
  price_desc: 'l.price DESC, l.id ASC',
  updated_desc: 'l.updated_at DESC, l.id ASC',
};

router.get(
  '/listings',
  asyncHandler(async (request, response) => {
    const filters = parse(searchSchema, request.query);
    const values = [filters.type];
    const conditions = ['i.type = $1'];

    if (filters.q) {
      values.push(`%${filters.q}%`);
      conditions.push(`(i.name ILIKE $${values.length} OR p.name ILIKE $${values.length})`);
    }
    if (filters.location) {
      values.push(`%${filters.location}%`);
      conditions.push(`p.location ILIKE $${values.length}`);
    }
    if (filters.available !== undefined) {
      values.push(filters.available);
      conditions.push(`l.available = $${values.length}`);
    }
    if (filters.max_price !== undefined) {
      values.push(filters.max_price);
      conditions.push(`l.price <= $${values.length}`);
    }

    const from = `FROM listings l
         JOIN providers p ON p.id = l.provider_id
         JOIN catalog_items i ON i.id = l.item_id
        WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(`SELECT COUNT(*)::int AS total ${from}`, values);
    const result = await query(
      `SELECT ${LISTING_COLUMNS}
         ${from}
        ORDER BY ${ORDER_BY[filters.sort]}
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filters.limit, (filters.page - 1) * filters.limit],
    );

    response.json({
      data: result.rows.map(toListing),
      meta: { page: filters.page, limit: filters.limit, total: countResult.rows[0].total },
    });
  }),
);

export default router;
