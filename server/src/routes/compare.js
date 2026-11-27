import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { asyncHandler, parse } from '../http.js';
import { LISTING_COLUMNS } from '../serializers.js';
import { buildComparison } from '../services/compare.js';

const router = Router();

const compareSchema = z
  .object({
    items: z
      .array(
        z.object({
          item_id: z.string().uuid(),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1)
      .max(20)
      .refine((items) => new Set(items.map((item) => item.item_id)).size === items.length, {
        message: 'item_id values must be distinct',
      }),
    location: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

router.post(
  '/compare',
  asyncHandler(async (request, response) => {
    const body = parse(compareSchema, request.body);

    const values = [body.items.map((item) => item.item_id)];
    let locationClause = '';
    if (body.location) {
      values.push(`%${body.location}%`);
      locationClause = ` AND p.location ILIKE $${values.length}`;
    }

    const result = await query(
      `SELECT ${LISTING_COLUMNS}
         FROM listings l
         JOIN providers p ON p.id = l.provider_id
         JOIN catalog_items i ON i.id = l.item_id
        WHERE l.item_id = ANY($1::uuid[])${locationClause}`,
      values,
    );

    response.json({ data: buildComparison(result.rows, body.items) });
  }),
);

export default router;
