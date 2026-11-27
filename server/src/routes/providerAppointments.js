import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { conflict, notFound } from '../errors.js';
import { asyncHandler, parse } from '../http.js';
import { APPOINTMENT_COLUMNS, APPOINTMENT_FROM, toAppointment } from '../serializers.js';
import { paginationSchema } from '../validation.js';

const router = Router();

const listSchema = paginationSchema.extend({
  status: z.enum(['requested', 'confirmed', 'declined', 'cancelled']).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

const respondSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('confirmed') }),
  z.strictObject({ status: z.literal('declined') }),
]);

router.get(
  '/appointments',
  asyncHandler(async (request, response) => {
    const filters = parse(listSchema, request.query);
    const status = filters.status ?? null;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
         ${APPOINTMENT_FROM}
        WHERE l.provider_id = $1 AND ($2::text IS NULL OR a.status = $2)`,
      [request.provider.id, status],
    );

    const result = await query(
      `SELECT ${APPOINTMENT_COLUMNS}
         ${APPOINTMENT_FROM}
        WHERE l.provider_id = $1 AND ($2::text IS NULL OR a.status = $2)
        ORDER BY a.requested_for ASC, a.created_at ASC
        LIMIT $3 OFFSET $4`,
      [request.provider.id, status, filters.limit, (filters.page - 1) * filters.limit],
    );

    response.json({
      data: result.rows.map(toAppointment),
      meta: { page: filters.page, limit: filters.limit, total: countResult.rows[0].total },
    });
  }),
);

router.patch(
  '/appointments/:id',
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    const body = parse(respondSchema, request.body);

    const updated = await withTransaction(async (client) => {
      const scoped = await client.query(
        `SELECT a.id
           FROM appointments a
           JOIN listings l ON l.id = a.listing_id
          WHERE a.id = $1 AND l.provider_id = $2
          FOR UPDATE`,
        [id, request.provider.id],
      );
      if (scoped.rowCount === 0) throw notFound('Appointment not found');

      const transition = await client.query(
        `UPDATE appointments
            SET status = $2, updated_at = now()
          WHERE id = $1 AND status = 'requested'
          RETURNING id`,
        [id, body.status],
      );
      if (transition.rowCount === 0) {
        throw conflict('INVALID_TRANSITION', 'Appointment can no longer be updated');
      }

      const full = await client.query(
        `SELECT ${APPOINTMENT_COLUMNS} ${APPOINTMENT_FROM} WHERE a.id = $1`,
        [id],
      );
      return full.rows[0];
    });

    response.json({ data: toAppointment(updated) });
  }),
);

export default router;
