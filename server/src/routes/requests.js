import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { conflict, notFound } from '../errors.js';
import { asyncHandler, parse } from '../http.js';
import { toRequest } from '../serializers.js';

const router = Router();

const createSchema = z
  .object({
    listing_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    request_group_id: z.string().uuid().nullable().optional(),
  })
  .strict();

const idSchema = z.object({ id: z.string().uuid() });

const REQUEST_COLUMNS = `
  r.id, r.listing_id, r.quantity, r.request_group_id,
  CASE
    WHEN r.status IN ('pending', 'confirmed') AND r.expires_at < now() THEN 'expired'
    ELSE r.status
  END AS effective_status,
  r.confirmed_price, r.expires_at, r.created_at,
  l.currency
`;

router.post(
  '/requests',
  asyncHandler(async (request, response) => {
    const body = parse(createSchema, request.body);
    const listing = await query('SELECT id, available, currency FROM listings WHERE id = $1', [
      body.listing_id,
    ]);

    if (listing.rowCount === 0) throw notFound('Listing not found');
    if (!listing.rows[0].available) {
      throw conflict('LISTING_UNAVAILABLE', 'Listing is not available');
    }

    const result = await query(
      `INSERT INTO requests (listing_id, patient_user_id, request_group_id, quantity, status, expires_at)
       VALUES ($1, $2, $3, $4, 'pending', now() + interval '30 minutes')
       RETURNING id, listing_id, quantity, request_group_id, status, confirmed_price, expires_at, created_at`,
      [body.listing_id, request.user.id, body.request_group_id ?? null, body.quantity],
    );

    const row = { ...result.rows[0], currency: listing.rows[0].currency };
    response.status(201).json({ data: toRequest(row) });
  }),
);

router.get(
  '/requests/:id',
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    const result = await query(
      `SELECT ${REQUEST_COLUMNS}
         FROM requests r
         JOIN listings l ON l.id = r.listing_id
        WHERE r.id = $1 AND r.patient_user_id = $2`,
      [id, request.user.id],
    );

    if (result.rowCount === 0) throw notFound('Request not found');
    response.json({ data: toRequest(result.rows[0]) });
  }),
);

export default router;
