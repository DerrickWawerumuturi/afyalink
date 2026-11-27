import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { asyncHandler, parse } from '../http.js';
import { LISTING_COLUMNS, toListing } from '../serializers.js';
import { moneySchema, paginationSchema } from '../validation.js';
import { actorLabel, logProviderEvent } from '../services/inventory.js';

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
    item_id: z.string().uuid().optional(),
    pricing_unit: z.string().trim().min(1).max(40).optional(),
    price: moneySchema.optional(),
    available: z.boolean().optional(),
    stock_quantity: z.number().int().nonnegative().nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  });

const LISTING_QUERY = `SELECT ${LISTING_COLUMNS}
  FROM listings l
  JOIN providers p ON p.id = l.provider_id
  JOIN catalog_items i ON i.id = l.item_id
 WHERE l.id = $1 AND l.provider_id = $2`;

function run(executor, text, params) {
  if (typeof executor === 'function') return executor(text, params);
  return executor.query(text, params);
}

function actor(request) {
  return { id: request.user.id, label: actorLabel(request.user) };
}

async function loadListing(id, providerId, executor = query) {
  const result = await run(executor, LISTING_QUERY, [id, providerId]);
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
    const providerId = request.provider.id;
    const user = actor(request);
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

    const listing = await withTransaction(async (client) => {
      let inserted;
      try {
        inserted = await client.query(
          `INSERT INTO listings (provider_id, item_id, price, pricing_unit, available, stock_quantity)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            providerId,
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

      const listingId = inserted.rows[0].id;
      await client.query(
        `insert into public.listing_availability_events
           (listing_id, provider_id, available, previous_available, actor_user_id, actor_label)
         values ($1, $2, $3, null, $4, $5)`,
        [listingId, providerId, body.available, user.id, user.label],
      );
      await logProviderEvent(client, {
        providerId,
        userId: user.id,
        actorLabel: user.label,
        action: 'listing.created',
        recordType: 'listing',
        recordId: listingId,
        previousValue: null,
        newValue: {
          item_id: body.item_id,
          price: body.price,
          available: body.available,
          stock_quantity: body.stock_quantity,
        },
      });
      return loadListing(listingId, providerId, client);
    });

    response.status(201).json({ data: listing });
  }),
);

router.patch(
  '/listings/:id',
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    const body = parse(updateSchema, request.body);
    const providerId = request.provider.id;
    const user = actor(request);

    const listing = await withTransaction(async (client) => {
      const currentResult = await client.query(
        'SELECT item_id, pricing_unit, price, available, stock_quantity FROM listings WHERE id = $1 AND provider_id = $2 FOR UPDATE',
        [id, providerId],
      );
      if (currentResult.rowCount === 0) throw notFound('Listing not found');
      const current = currentResult.rows[0];

      if (body.item_id !== undefined && body.item_id !== current.item_id) {
        throw badRequest('Listing item cannot be changed', { item_id: 'Item is immutable' });
      }
      if (body.pricing_unit !== undefined && body.pricing_unit !== current.pricing_unit) {
        throw badRequest('Pricing unit cannot be changed', {
          pricing_unit: 'Pricing unit is immutable',
        });
      }

      const assignments = [];
      const values = [];
      const previousValue = {};
      const newValue = {};
      for (const field of ['price', 'available', 'stock_quantity']) {
        if (body[field] === undefined) continue;
        previousValue[field] = field === 'price' ? Number(current[field]) : current[field];
        newValue[field] = body[field];
        values.push(body[field]);
        assignments.push(`${field} = $${values.length}`);
      }

      if (assignments.length > 0) {
        values.push(id, providerId);
        await client.query(
          `UPDATE listings
              SET ${assignments.join(', ')}, updated_at = now()
            WHERE id = $${values.length - 1} AND provider_id = $${values.length}`,
          values,
        );
      }

      if (body.available !== undefined && body.available !== current.available) {
        await client.query(
          `insert into public.listing_availability_events
             (listing_id, provider_id, available, previous_available, actor_user_id, actor_label)
           values ($1, $2, $3, $4, $5, $6)`,
          [id, providerId, body.available, current.available, user.id, user.label],
        );
      }
      if (Object.keys(newValue).length > 0) {
        await logProviderEvent(client, {
          providerId,
          userId: user.id,
          actorLabel: user.label,
          action: 'listing.updated',
          recordType: 'listing',
          recordId: id,
          previousValue,
          newValue,
        });
      }

      return loadListing(id, providerId, client);
    });

    response.json({ data: listing });
  }),
);

router.delete(
  '/listings/:id',
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    const providerId = request.provider.id;
    const user = actor(request);

    try {
      await withTransaction(async (client) => {
        const current = await client.query(
          'SELECT item_id, price, available, stock_quantity FROM listings WHERE id = $1 AND provider_id = $2 FOR UPDATE',
          [id, providerId],
        );
        if (current.rowCount === 0) throw notFound('Listing not found');
        await client.query('DELETE FROM listings WHERE id = $1 AND provider_id = $2', [id, providerId]);
        await logProviderEvent(client, {
          providerId,
          userId: user.id,
          actorLabel: user.label,
          action: 'listing.deleted',
          recordType: 'listing',
          recordId: id,
          previousValue: {
            item_id: current.rows[0].item_id,
            price: Number(current.rows[0].price),
            available: current.rows[0].available,
            stock_quantity: current.rows[0].stock_quantity,
          },
          newValue: null,
        });
      });
      response.json({ data: { id } });
    } catch (error) {
      if (error.code === '23503') {
        throw conflict('LISTING_HAS_REQUESTS', 'Listing has request history and cannot be removed');
      }
      throw error;
    }
  }),
);

export default router;
