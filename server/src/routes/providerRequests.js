import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { asyncHandler, parse } from '../http.js';
import { toProviderRequest } from '../serializers.js';
import { moneySchema, paginationSchema } from '../validation.js';

const router = Router();

const MAX_CONFIRMATION_HOURS = 24;

const listSchema = paginationSchema.extend({
  status: z.enum(['pending', 'confirmed', 'declined', 'expired']).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

const respondSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('confirmed'),
    confirmed_price: moneySchema,
    expires_at: z.string().datetime({ offset: true }),
  }),
  z.strictObject({ status: z.literal('declined') }),
]);

const PROVIDER_REQUEST_COLUMNS = `
  r.id, r.listing_id, r.quantity, r.request_group_id,
  CASE
    WHEN r.status IN ('pending', 'confirmed') AND r.expires_at < now() THEN 'expired'
    ELSE r.status
  END AS effective_status,
  r.confirmed_price, r.expires_at, r.created_at,
  l.price AS listing_price, l.currency, l.pricing_unit,
  i.id AS item_id, i.name AS item_name, i.type AS item_type,
  i.strength AS item_strength, i.dosage_form AS item_dosage_form, i.unit AS item_unit
`;

const PROVIDER_REQUEST_FROM = `
  FROM requests r
  JOIN listings l ON l.id = r.listing_id
  JOIN catalog_items i ON i.id = l.item_id
`;

router.get(
  '/requests',
  asyncHandler(async (request, response) => {
    const filters = parse(listSchema, request.query);
    const scoped = `WITH scoped AS (
         SELECT ${PROVIDER_REQUEST_COLUMNS}
         ${PROVIDER_REQUEST_FROM}
         WHERE l.provider_id = $1
       )`;
    const countResult = await query(
      `${scoped}
       SELECT COUNT(*)::int AS total
         FROM scoped
        WHERE ($2::text IS NULL OR effective_status = $2)`,
      [request.provider.id, filters.status ?? null],
    );
    const result = await query(
      `${scoped},
       filtered AS (
         SELECT * FROM scoped WHERE ($2::text IS NULL OR effective_status = $2)
       )
       SELECT *
         FROM filtered
        ORDER BY created_at DESC, id ASC
        LIMIT $3 OFFSET $4`,
      [request.provider.id, filters.status ?? null, filters.limit, (filters.page - 1) * filters.limit],
    );

    response.json({
      data: result.rows.map(toProviderRequest),
      meta: { page: filters.page, limit: filters.limit, total: countResult.rows[0].total },
    });
  }),
);

router.patch(
  '/requests/:id',
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    const body = parse(respondSchema, request.body);

    if (body.status === 'confirmed') {
      const expiresAt = new Date(body.expires_at);
      const now = Date.now();
      if (expiresAt.getTime() <= now) {
        throw badRequest('Confirmation expiry must be in the future', {
          expires_at: 'Must be in the future',
        });
      }
      if (expiresAt.getTime() > now + MAX_CONFIRMATION_HOURS * 60 * 60 * 1000) {
        throw badRequest(`Confirmation expiry cannot exceed ${MAX_CONFIRMATION_HOURS} hours`, {
          expires_at: `Must be within ${MAX_CONFIRMATION_HOURS} hours`,
        });
      }
    }

    const updated = await withTransaction(async (client) => {
      const scoped = await client.query(
        `SELECT r.id
           FROM requests r
           JOIN listings l ON l.id = r.listing_id
          WHERE r.id = $1 AND l.provider_id = $2
          FOR UPDATE`,
        [id, request.provider.id],
      );
      if (scoped.rowCount === 0) throw notFound('Request not found');

      let transition;
      if (body.status === 'confirmed') {
        transition = await client.query(
          `UPDATE requests
              SET status = 'confirmed', confirmed_price = $2, expires_at = $3, updated_at = now()
            WHERE id = $1 AND status = 'pending' AND expires_at > now()
            RETURNING id`,
          [id, body.confirmed_price, body.expires_at],
        );
      } else {
        transition = await client.query(
          `UPDATE requests
              SET status = 'declined', updated_at = now()
            WHERE id = $1 AND status = 'pending' AND expires_at > now()
            RETURNING id`,
          [id],
        );
      }
      if (transition.rowCount === 0) {
        throw conflict('INVALID_TRANSITION', 'Request can no longer be updated');
      }

      const full = await client.query(
        `SELECT ${PROVIDER_REQUEST_COLUMNS} ${PROVIDER_REQUEST_FROM} WHERE r.id = $1`,
        [id],
      );
      return full.rows[0];
    });

    response.json({ data: toProviderRequest(updated) });
  }),
);

export default router;
