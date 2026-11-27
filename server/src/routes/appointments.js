import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { asyncHandler, parse } from '../http.js';
import { requireAuth } from '../middleware/auth.js';
import { APPOINTMENT_COLUMNS, APPOINTMENT_FROM, toAppointment } from '../serializers.js';

const router = Router();

const MAX_DAYS_AHEAD = 90;

const createSchema = z
  .object({
    listing_id: z.string().uuid(),
    requested_for: z.string().datetime({ offset: true }),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

const idSchema = z.object({ id: z.string().uuid() });
const cancelSchema = z.strictObject({ status: z.literal('cancelled') });

router.post(
  '/appointments',
  requireAuth,
  asyncHandler(async (request, response) => {
    const body = parse(createSchema, request.body);
    const requestedFor = new Date(body.requested_for);
    const now = Date.now();
    if (requestedFor.getTime() <= now) {
      throw badRequest('Appointment time must be in the future', {
        requested_for: 'Must be in the future',
      });
    }
    if (requestedFor.getTime() > now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
      throw badRequest(`Appointment time cannot exceed ${MAX_DAYS_AHEAD} days ahead`, {
        requested_for: `Must be within ${MAX_DAYS_AHEAD} days`,
      });
    }

    const listing = await query(
      `SELECT l.id, l.available, i.type AS item_type
         FROM listings l
         JOIN catalog_items i ON i.id = l.item_id
        WHERE l.id = $1`,
      [body.listing_id],
    );
    if (listing.rowCount === 0) throw notFound('Listing not found');
    if (listing.rows[0].item_type !== 'service') {
      throw badRequest('Appointments can only be booked for services', {
        listing_id: 'Choose a service listing',
      });
    }
    if (!listing.rows[0].available) {
      throw conflict('LISTING_UNAVAILABLE', 'Listing is not available');
    }

    const inserted = await query(
      `INSERT INTO appointments (listing_id, patient_user_id, requested_for, status, notes)
       VALUES ($1, $2, $3, 'requested', $4)
       RETURNING id`,
      [body.listing_id, request.user.id, body.requested_for, body.notes ?? null],
    );

    const result = await query(
      `SELECT ${APPOINTMENT_COLUMNS} ${APPOINTMENT_FROM} WHERE a.id = $1`,
      [inserted.rows[0].id],
    );
    response.status(201).json({ data: toAppointment(result.rows[0]) });
  }),
);

router.get(
  '/appointments',
  requireAuth,
  asyncHandler(async (request, response) => {
    const result = await query(
      `SELECT ${APPOINTMENT_COLUMNS}
         ${APPOINTMENT_FROM}
        WHERE a.patient_user_id = $1
        ORDER BY a.requested_for ASC, a.created_at DESC
        LIMIT 100`,
      [request.user.id],
    );
    response.json({ data: result.rows.map(toAppointment) });
  }),
);

router.get(
  '/appointments/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    const result = await query(
      `SELECT ${APPOINTMENT_COLUMNS}
         ${APPOINTMENT_FROM}
        WHERE a.id = $1 AND a.patient_user_id = $2`,
      [id, request.user.id],
    );
    if (result.rowCount === 0) throw notFound('Appointment not found');
    response.json({ data: toAppointment(result.rows[0]) });
  }),
);

router.patch(
  '/appointments/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    parse(cancelSchema, request.body);

    const current = await query(
      'SELECT id, status FROM appointments WHERE id = $1 AND patient_user_id = $2',
      [id, request.user.id],
    );
    if (current.rowCount === 0) throw notFound('Appointment not found');

    const transition = await query(
      `UPDATE appointments
          SET status = 'cancelled', updated_at = now()
        WHERE id = $1 AND patient_user_id = $2 AND status IN ('requested', 'confirmed')
        RETURNING id`,
      [id, request.user.id],
    );
    if (transition.rowCount === 0) {
      throw conflict('INVALID_TRANSITION', 'Appointment can no longer be cancelled');
    }

    const result = await query(
      `SELECT ${APPOINTMENT_COLUMNS} ${APPOINTMENT_FROM} WHERE a.id = $1`,
      [id],
    );
    response.json({ data: toAppointment(result.rows[0]) });
  }),
);

export default router;
