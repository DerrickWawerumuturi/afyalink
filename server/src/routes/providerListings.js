import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { asyncHandler, parse } from '../http.js';
import { LISTING_COLUMNS, toListing } from '../serializers.js';
import { moneySchema, paginationSchema } from '../validation.js';

const router = Router();

const idSchema = z.object({ id: z.string().uuid() });

const createSchema = z
  .object({
    item_id: z.string().uuid(),
    price: moneySchema,
    pricing_unit: z.string().trim().min(1).max(40),
    available: z.boolean().default(true),
    stock_quantity: z.number().int().nonnegative().nullable().default(null),
  })
  .strict();

const updateSchema = z
  .object({
    price: moneySchema.optional(),
    available: z.boolean().optional(),
    stock_quantity: z.number().int().nonnegative().nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one of price, available or stock_quantity is required',
  });

const LISTING_QUERY = `SELECT ${LISTING_COLUMNS}
  FROM listings l
  JOIN providers p ON p.id = l.provider_id
  JOIN catalog_items i ON i.id = l.item_id
 WHERE l.id = $1 AND l.provider_id = $2`;

async function loadListing(id, providerId) {
  const result = await query(LISTING_QUERY, [id, providerId]);
  if (result.rowCount === 0) throw notFound('Listing not found');
  return toListing(result.rows[0]);
}

function providerTypeForItem(itemType) {
  return itemType === 'service' ? 'hospital' : 'pharmacy';
}

router.get(
  '/listings',
  asyncHandler(async (request, response) => {
    const { page, limit } = parse(paginationSchema, request.query);
    const result = await query(
      `SELECT ${LISTING_COLUMNS}, COUNT(*) OVER() AS total
         FROM listings l
         JOIN providers p ON p.id = l.provider_id
         JOIN catalog_items i ON i.id = l.item_id
        WHERE l.provider_id = $1
        ORDER BY l.updated_at DESC, l.id ASC
        LIMIT $2 OFFSET $3`,
      [request.provider.id, limit, (page - 1) * limit],
    );

    const total = result.rows.length ? Number(result.rows[0].total) : 0;
    response.json({
      data: result.rows.map(toListing),
      meta: { page, limit, total },
    });
  }),
);

router.post(
  '/listings',
  asyncHandler(async (request, response) => {
    const body = parse(createSchema, request.body);
    const itemResult = await query('SELECT id, type, unit FROM catalog_items WHERE id = $1', [
      body.item_id,
    ]);
    if (itemResult.rowCount === 0) throw notFound('Catalog item not found');

    const item = itemResult.rows[0];
    if (providerTypeForItem(item.type) !== request.provider.type) {
      throw badRequest('Provider type cannot list this catalog item', {
        item_id: `A ${request.provider.type} cannot list ${item.type} items`,
      });
    }
    if (item.type === 'medication' && item.unit && body.pricing_unit !== item.unit) {
      throw badRequest('Pricing unit must match the catalog unit', {
        pricing_unit: `Must match catalog unit '${item.unit}'`,
      });
    }

    let inserted;
    try {
      inserted = await query(
        `INSERT INTO listings (provider_id, item_id, price, pricing_unit, available, stock_quantity)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          request.provider.id,
          body.item_id,
          body.price,
          body.pricing_unit,
          body.available,
          body.stock_quantity,
        ],
      );
    } catch (error) {
      if (error.code === '23505') {
        throw conflict('LISTING_EXISTS', 'A listing already exists for this item and pricing unit');
      }
      if (error.code === '23514') {
        throw badRequest('Listing violates catalog or provider rules');
      }
      throw error;
    }

    response.status(201).json({
      data: await loadListing(inserted.rows[0].id, request.provider.id),
    });
  }),
);

router.patch(
  '/listings/:id',
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    const body = parse(updateSchema, request.body);

    const assignments = [];
    const values = [];
    for (const [field, value] of Object.entries(body)) {
      values.push(value);
      assignments.push(`${field} = $${values.length}`);
    }
    values.push(id, request.provider.id);

    const result = await query(
      `UPDATE listings
          SET ${assignments.join(', ')}, updated_at = now()
        WHERE id = $${values.length - 1} AND provider_id = $${values.length}
        RETURNING id`,
      values,
    );
    if (result.rowCount === 0) throw notFound('Listing not found');

    response.json({ data: await loadListing(id, request.provider.id) });
  }),
);

export default router;
