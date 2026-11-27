import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { asyncHandler, parse } from '../http.js';
import {
  INVENTORY_BATCH_COLUMNS,
  INVENTORY_MOVEMENT_COLUMNS,
  toInventoryAudit,
  toInventoryAuditLine,
  toInventoryBatch,
  toInventoryMovement,
} from '../serializers.js';
import {
  inventoryAuditSchema,
  inventoryBatchCreateSchema,
  inventoryMovementSchema,
  paginationSchema,
} from '../validation.js';
import {
  actorLabel,
  buildForecast,
  isMovementQuantityValid,
  logProviderEvent,
  nextBalance,
} from '../services/inventory.js';

const router = Router();

const idSchema = z.object({ id: z.string().uuid() });

const batchQuerySchema = paginationSchema.extend({
  listing_id: z.string().uuid().optional(),
  status: z
    .enum(['active', 'quarantined', 'depleted', 'expired', 'damaged', 'returned'])
    .optional(),
  expiring_within_days: z.coerce.number().int().min(0).max(3650).optional(),
});

const movementQuerySchema = paginationSchema.extend({
  batch_id: z.string().uuid().optional(),
  movement_type: z
    .enum(['received', 'dispensed', 'adjustment', 'damaged', 'expired', 'quarantined', 'returned'])
    .optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

const auditQuerySchema = paginationSchema.extend({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

function run(executor, text, params) {
  if (typeof executor === 'function') return executor(text, params);
  return executor.query(text, params);
}

function actor(request) {
  return { id: request.user.id, label: actorLabel(request.user) };
}

async function loadBatch(executor, id, providerId, now = new Date()) {
  const result = await run(
    executor,
    `SELECT ${INVENTORY_BATCH_COLUMNS}
       FROM public.inventory_batches b
       JOIN public.listings l ON l.id = b.listing_id
       JOIN public.catalog_items i ON i.id = l.item_id
      WHERE b.id = $1 AND b.provider_id = $2`,
    [id, providerId],
  );
  if (result.rowCount === 0) throw notFound('Batch not found');
  return toInventoryBatch(result.rows[0], now);
}

async function loadMovement(executor, id, providerId) {
  const result = await run(
    executor,
    `SELECT ${INVENTORY_MOVEMENT_COLUMNS}
       FROM public.inventory_movements m
       JOIN public.inventory_batches b ON b.id = m.batch_id
       JOIN public.listings l ON l.id = b.listing_id
       JOIN public.catalog_items i ON i.id = l.item_id
      WHERE m.id = $1 AND m.provider_id = $2`,
    [id, providerId],
  );
  if (result.rowCount === 0) throw notFound('Movement not found');
  return toInventoryMovement(result.rows[0]);
}

async function loadAudit(executor, id, providerId) {
  const result = await run(
    executor,
    `SELECT a.*,
            coalesce(t.total_expected, 0) AS total_expected,
            coalesce(t.total_counted, 0) AS total_counted,
            coalesce(t.total_discrepancy, 0) AS total_discrepancy
       FROM public.inventory_audits a
       LEFT JOIN (
         SELECT audit_id,
                sum(expected_quantity) AS total_expected,
                sum(counted_quantity) AS total_counted,
                sum(counted_quantity - expected_quantity) AS total_discrepancy
           FROM public.inventory_audit_lines
          GROUP BY audit_id
       ) t ON t.audit_id = a.id
      WHERE a.id = $1 AND a.provider_id = $2`,
    [id, providerId],
  );
  if (result.rowCount === 0) throw notFound('Inventory audit not found');
  return toInventoryAudit(result.rows[0]);
}

async function loadAuditLines(executor, auditId, providerId) {
  const result = await run(
    executor,
    `SELECT al.*, b.batch_number, b.unit, i.name AS item_name
       FROM public.inventory_audit_lines al
       JOIN public.inventory_audits a ON a.id = al.audit_id
       JOIN public.inventory_batches b ON b.id = al.batch_id
       JOIN public.listings l ON l.id = b.listing_id
       JOIN public.catalog_items i ON i.id = l.item_id
      WHERE al.audit_id = $1 AND a.provider_id = $2
      ORDER BY al.id ASC`,
    [auditId, providerId],
  );
  return result.rows.map(toInventoryAuditLine);
}

router.post(
  '/inventory/batches',
  asyncHandler(async (request, response) => {
    const body = parse(inventoryBatchCreateSchema, request.body);
    const providerId = request.provider.id;
    const user = actor(request);

    const listingResult = await query(
      `SELECT l.id, l.provider_id, l.pricing_unit, i.type
         FROM public.listings l
         JOIN public.catalog_items i ON i.id = l.item_id
        WHERE l.id = $1`,
      [body.listing_id],
    );
    if (listingResult.rowCount === 0) throw notFound('Listing not found');
    const listing = listingResult.rows[0];
    if (listing.provider_id !== providerId) throw notFound('Listing not found');
    if (listing.type !== 'medication') {
      throw badRequest('Batches can only be created for medication listings');
    }
    if (listing.pricing_unit && listing.pricing_unit !== body.unit) {
      throw badRequest('Batch unit must match the listing unit', {
        unit: `Must match '${listing.pricing_unit}'`,
      });
    }

    const batch = await withTransaction(async (client) => {
      let inserted;
      try {
        inserted = await client.query(
          `insert into public.inventory_batches
             (provider_id, listing_id, batch_number, manufacturer, supplier, date_received,
              expiry_date, initial_quantity, current_quantity, unit, storage_info, status,
              created_by, created_by_label)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, 'active', $11, $12)
           returning id`,
          [
            providerId,
            body.listing_id,
            body.batch_number,
            body.manufacturer ?? null,
            body.supplier ?? null,
            body.date_received,
            body.expiry_date,
            body.initial_quantity,
            body.unit,
            body.storage_info ?? null,
            user.id,
            user.label,
          ],
        );
      } catch (error) {
        if (error.code === '23505') {
          throw conflict('BATCH_EXISTS', 'A batch with this number already exists for this provider');
        }
        throw error;
      }

      const batchId = inserted.rows[0].id;
      await client.query(
        `insert into public.inventory_movements
           (batch_id, provider_id, movement_type, quantity, previous_balance, new_balance,
            reason, reference, actor_user_id, actor_label)
         values ($1, $2, 'received', $3, 0, $3, $4, $5, $6, $7)`,
        [
          batchId,
          providerId,
          body.initial_quantity,
          'Initial batch receipt',
          `batch:${batchId}`,
          user.id,
          user.label,
        ],
      );
      await logProviderEvent(client, {
        providerId,
        userId: user.id,
        actorLabel: user.label,
        action: 'inventory.batch_received',
        recordType: 'inventory_batch',
        recordId: batchId,
        previousValue: null,
        newValue: {
          batch_number: body.batch_number,
          initial_quantity: body.initial_quantity,
          expiry_date: body.expiry_date,
        },
      });
      return loadBatch(client, batchId, providerId);
    });

    response.status(201).json({ data: batch });
  }),
);

router.get(
  '/inventory/batches',
  asyncHandler(async (request, response) => {
    const { page, limit, listing_id, status, expiring_within_days } = parse(
      batchQuerySchema,
      request.query,
    );
    const conditions = ['b.provider_id = $1'];
    const values = [request.provider.id];
    if (listing_id) {
      values.push(listing_id);
      conditions.push(`b.listing_id = $${values.length}`);
    }
    if (status) {
      values.push(status);
      conditions.push(`b.status = $${values.length}`);
    }
    if (expiring_within_days !== undefined) {
      values.push(expiring_within_days);
      conditions.push(`b.expiry_date <= (now() + ($${values.length}::integer * interval '1 day'))::date`);
      conditions.push('b.expiry_date >= current_date');
    }
    const where = conditions.join(' AND ');

    const countResult = await query(
      `SELECT count(*)::integer AS total FROM public.inventory_batches b WHERE ${where}`,
      values,
    );
    values.push(limit, (page - 1) * limit);
    const result = await query(
      `SELECT ${INVENTORY_BATCH_COLUMNS}, count(*) over() AS total
         FROM public.inventory_batches b
         JOIN public.listings l ON l.id = b.listing_id
         JOIN public.catalog_items i ON i.id = l.item_id
        WHERE ${where}
        ORDER BY b.expiry_date ASC, b.id ASC
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    response.json({
      data: result.rows.map((row) => toInventoryBatch(row)),
      meta: { page, limit, total: countResult.rows[0].total },
    });
  }),
);

router.get(
  '/inventory/batches/:id',
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    response.json({ data: await loadBatch(query, id, request.provider.id) });
  }),
);

router.get(
  '/inventory/batches/:id/history',
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    const { page, limit } = parse(paginationSchema, request.query);
    await loadBatch(query, id, request.provider.id);

    const countResult = await query(
      'SELECT count(*)::integer AS total FROM public.inventory_movements WHERE batch_id = $1 AND provider_id = $2',
      [id, request.provider.id],
    );
    const result = await query(
      `SELECT ${INVENTORY_MOVEMENT_COLUMNS}, count(*) over() AS total
         FROM public.inventory_movements m
         JOIN public.inventory_batches b ON b.id = m.batch_id
         JOIN public.listings l ON l.id = b.listing_id
         JOIN public.catalog_items i ON i.id = l.item_id
        WHERE m.batch_id = $1 AND m.provider_id = $2
        ORDER BY m.occurred_at DESC, m.id DESC
        LIMIT $3 OFFSET $4`,
      [id, request.provider.id, limit, (page - 1) * limit],
    );
    response.json({
      data: result.rows.map(toInventoryMovement),
      meta: { page, limit, total: countResult.rows[0].total },
    });
  }),
);

router.post(
  '/inventory/batches/:id/movements',
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    const body = parse(inventoryMovementSchema, request.body);
    if (!isMovementQuantityValid(body.movement_type, body.quantity)) {
      throw badRequest('Movement quantity is invalid for this movement type', {
        quantity: 'Use positive quantities for receipts/returns and negative quantities for deductions',
      });
    }
    const providerId = request.provider.id;
    const user = actor(request);

    const movement = await withTransaction(async (client) => {
      const current = await client.query(
        `SELECT current_quantity, status
           FROM public.inventory_batches
          WHERE id = $1 AND provider_id = $2
          FOR UPDATE`,
        [id, providerId],
      );
      if (current.rowCount === 0) throw notFound('Batch not found');

      const previousBalance = current.rows[0].current_quantity;
      const newBalance = nextBalance(previousBalance, body.quantity);
      if (newBalance < 0) {
        throw conflict('INSUFFICIENT_STOCK', 'Movement would make batch balance negative');
      }

      const inserted = await client.query(
        `insert into public.inventory_movements
           (batch_id, provider_id, movement_type, quantity, previous_balance, new_balance,
            reason, reference, actor_user_id, actor_label)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         returning id`,
        [
          id,
          providerId,
          body.movement_type,
          body.quantity,
          previousBalance,
          newBalance,
          body.reason ?? null,
          body.reference ?? null,
          user.id,
          user.label,
        ],
      );

      await logProviderEvent(client, {
        providerId,
        userId: user.id,
        actorLabel: user.label,
        action: `inventory.${body.movement_type}`,
        recordType: 'inventory_movement',
        recordId: inserted.rows[0].id,
        previousValue: { current_quantity: previousBalance, status: current.rows[0].status },
        newValue: {
          current_quantity: newBalance,
          movement_type: body.movement_type,
          quantity: body.quantity,
          reason: body.reason ?? null,
        },
      });

      return loadMovement(client, inserted.rows[0].id, providerId);
    });

    response.status(201).json({ data: movement });
  }),
);

router.get(
  '/inventory/movements',
  asyncHandler(async (request, response) => {
    const { page, limit, batch_id, movement_type, from, to } = parse(
      movementQuerySchema,
      request.query,
    );
    const conditions = ['m.provider_id = $1'];
    const values = [request.provider.id];
    if (batch_id) {
      values.push(batch_id);
      conditions.push(`m.batch_id = $${values.length}`);
    }
    if (movement_type) {
      values.push(movement_type);
      conditions.push(`m.movement_type = $${values.length}`);
    }
    if (from) {
      values.push(from);
      conditions.push(`m.occurred_at >= $${values.length}::timestamptz`);
    }
    if (to) {
      values.push(to);
      conditions.push(`m.occurred_at <= $${values.length}::timestamptz`);
    }
    const where = conditions.join(' AND ');

    const countResult = await query(
      `SELECT count(*)::integer AS total
         FROM public.inventory_movements m
        WHERE ${where}`,
      values,
    );
    values.push(limit, (page - 1) * limit);
    const result = await query(
      `SELECT ${INVENTORY_MOVEMENT_COLUMNS}, count(*) over() AS total
         FROM public.inventory_movements m
         JOIN public.inventory_batches b ON b.id = m.batch_id
         JOIN public.listings l ON l.id = b.listing_id
         JOIN public.catalog_items i ON i.id = l.item_id
        WHERE ${where}
        ORDER BY m.occurred_at DESC, m.id DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    response.json({
      data: result.rows.map(toInventoryMovement),
      meta: { page, limit, total: countResult.rows[0].total },
    });
  }),
);

router.post(
  '/inventory/audits',
  asyncHandler(async (request, response) => {
    const body = parse(inventoryAuditSchema, request.body);
    const providerId = request.provider.id;
    const user = actor(request);
    const batchIds = body.lines.map((line) => line.batch_id);
    if (new Set(batchIds).size !== batchIds.length) {
      throw badRequest('Each batch may appear only once in an audit', {
        lines: 'Duplicate batch identifiers',
      });
    }

    const audit = await withTransaction(async (client) => {
      const batchesResult = await client.query(
        `SELECT id, current_quantity
           FROM public.inventory_batches
          WHERE provider_id = $1 AND id = ANY($2::uuid[])
          FOR UPDATE`,
        [providerId, batchIds],
      );
      if (batchesResult.rows.length !== batchIds.length) throw notFound('Batch not found');
      const expected = new Map(
        batchesResult.rows.map((row) => [row.id, row.current_quantity]),
      );

      const inserted = await client.query(
        `insert into public.inventory_audits
           (provider_id, notes, counted_by, counted_by_label, counted_at)
         values ($1, $2, $3, $4, coalesce($5::timestamptz, now()))
         returning id`,
        [
          providerId,
          body.notes ?? null,
          user.id,
          user.label,
          body.counted_at ?? null,
        ],
      );
      const auditId = inserted.rows[0].id;

      for (const line of body.lines) {
        await client.query(
          `insert into public.inventory_audit_lines
             (audit_id, batch_id, expected_quantity, counted_quantity)
           values ($1, $2, $3, $4)`,
          [auditId, line.batch_id, expected.get(line.batch_id), line.counted_quantity],
        );
      }

      await logProviderEvent(client, {
        providerId,
        userId: user.id,
        actorLabel: user.label,
        action: 'inventory.audit_recorded',
        recordType: 'inventory_audit',
        recordId: auditId,
        previousValue: null,
        newValue: { line_count: body.lines.length, notes: body.notes ?? null },
      });

      return {
        ...(await loadAudit(client, auditId, providerId)),
        lines: await loadAuditLines(client, auditId, providerId),
      };
    });

    response.status(201).json({ data: audit });
  }),
);

router.get(
  '/inventory/audits',
  asyncHandler(async (request, response) => {
    const { page, limit, from, to } = parse(auditQuerySchema, request.query);
    const conditions = ['a.provider_id = $1'];
    const values = [request.provider.id];
    if (from) {
      values.push(from);
      conditions.push(`a.counted_at >= $${values.length}::timestamptz`);
    }
    if (to) {
      values.push(to);
      conditions.push(`a.counted_at <= $${values.length}::timestamptz`);
    }
    const where = conditions.join(' AND ');
    const summaryJoin = `left join (
        select audit_id,
               sum(expected_quantity) as total_expected,
               sum(counted_quantity) as total_counted,
               sum(counted_quantity - expected_quantity) as total_discrepancy
          from public.inventory_audit_lines
         group by audit_id
      ) t on t.audit_id = a.id`;

    const countResult = await query(
      `SELECT count(*)::integer AS total FROM public.inventory_audits a WHERE ${where}`,
      values,
    );
    values.push(limit, (page - 1) * limit);
    const result = await query(
      `SELECT a.*, coalesce(t.total_expected, 0) AS total_expected,
              coalesce(t.total_counted, 0) AS total_counted,
              coalesce(t.total_discrepancy, 0) AS total_discrepancy
         FROM public.inventory_audits a
         ${summaryJoin}
        WHERE ${where}
        ORDER BY a.counted_at DESC, a.id DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    response.json({
      data: result.rows.map(toInventoryAudit),
      meta: { page, limit, total: countResult.rows[0].total },
    });
  }),
);

router.get(
  '/inventory/audits/:id',
  asyncHandler(async (request, response) => {
    const { id } = parse(idSchema, request.params);
    response.json({
      data: {
        ...(await loadAudit(query, id, request.provider.id)),
        lines: await loadAuditLines(query, id, request.provider.id),
      },
    });
  }),
);

router.get(
  '/inventory/monitoring',
  asyncHandler(async (request, response) => {
    const providerId = request.provider.id;
    const statsResult = await query(
      `SELECT count(distinct b.listing_id)::integer AS total_items,
              count(*)::integer AS total_batches,
              coalesce(sum(b.current_quantity), 0)::integer AS total_available_stock,
              count(*) filter (where b.current_quantity = 0)::integer AS out_of_stock_batches,
              count(*) filter (where b.current_quantity between 1 and 20)::integer AS low_stock_batches,
              count(*) filter (where b.expiry_date < current_date and b.current_quantity > 0)::integer AS expired_batches,
              count(*) filter (where b.expiry_date between current_date and current_date + 30 and b.current_quantity > 0)::integer AS expiring_30,
              count(*) filter (where b.expiry_date between current_date and current_date + 60 and b.current_quantity > 0)::integer AS expiring_60,
              count(*) filter (where b.expiry_date between current_date and current_date + 90 and b.current_quantity > 0)::integer AS expiring_90,
              coalesce(sum(b.current_quantity * l.price), 0)::numeric AS inventory_value
         FROM public.inventory_batches b
         JOIN public.listings l ON l.id = b.listing_id
        WHERE b.provider_id = $1`,
      [providerId],
    );
    const stats = statsResult.rows[0];

    const [lowStock, expiring, expired, unusual, incomplete] = await Promise.all([
      query(
        `SELECT ${INVENTORY_BATCH_COLUMNS}
           FROM public.inventory_batches b
           JOIN public.listings l ON l.id = b.listing_id
           JOIN public.catalog_items i ON i.id = l.item_id
          WHERE b.provider_id = $1 AND b.current_quantity between 1 and 20
          ORDER BY b.current_quantity ASC, b.expiry_date ASC
          LIMIT 10`,
        [providerId],
      ),
      query(
        `SELECT ${INVENTORY_BATCH_COLUMNS}
           FROM public.inventory_batches b
           JOIN public.listings l ON l.id = b.listing_id
           JOIN public.catalog_items i ON i.id = l.item_id
          WHERE b.provider_id = $1
            AND b.current_quantity > 0
            AND b.expiry_date between current_date and current_date + 90
          ORDER BY b.expiry_date ASC
          LIMIT 20`,
        [providerId],
      ),
      query(
        `SELECT ${INVENTORY_BATCH_COLUMNS}
           FROM public.inventory_batches b
           JOIN public.listings l ON l.id = b.listing_id
           JOIN public.catalog_items i ON i.id = l.item_id
          WHERE b.provider_id = $1 AND b.current_quantity > 0 AND b.expiry_date < current_date
          ORDER BY b.expiry_date ASC
          LIMIT 20`,
        [providerId],
      ),
      query(
        `SELECT b.id, b.batch_number, count(*)::integer AS adjustment_count,
                max(abs(m.quantity))::integer AS largest_adjustment
           FROM public.inventory_movements m
           JOIN public.inventory_batches b ON b.id = m.batch_id
          WHERE m.provider_id = $1
            AND m.movement_type = 'adjustment'
            AND m.occurred_at >= now() - interval '30 days'
          GROUP BY b.id, b.batch_number
          HAVING count(*) >= 3 OR max(abs(m.quantity)) >= 50
          ORDER BY largest_adjustment DESC
          LIMIT 20`,
        [providerId],
      ),
      query(
        `SELECT ${INVENTORY_BATCH_COLUMNS}
           FROM public.inventory_batches b
           JOIN public.listings l ON l.id = b.listing_id
           JOIN public.catalog_items i ON i.id = l.item_id
          WHERE b.provider_id = $1
            AND (b.manufacturer is null or b.supplier is null or b.storage_info is null)
          ORDER BY b.created_at DESC
          LIMIT 20`,
        [providerId],
      ),
    ]);

    response.json({
      data: {
        totals: {
          total_items: stats.total_items,
          total_batches: stats.total_batches,
          total_available_stock: stats.total_available_stock,
          out_of_stock_batches: stats.out_of_stock_batches,
          low_stock_batches: stats.low_stock_batches,
          inventory_value: Number(stats.inventory_value),
          currency: 'KES',
        },
        expiry_categories: {
          expired: stats.expired_batches,
          within_30_days: stats.expiring_30,
          within_60_days: stats.expiring_60,
          within_90_days: stats.expiring_90,
        },
        alerts: [
          ...lowStock.rows.map((row) => ({
            type: 'low_stock',
            severity: 'warning',
            batch: toInventoryBatch(row),
            message: `${row.batch_number} has ${row.current_quantity} ${row.unit} remaining.`,
          })),
          ...expiring.rows.map((row) => ({
            type: 'expiring_batch',
            severity: 'warning',
            batch: toInventoryBatch(row),
            message: `${row.batch_number} expires on ${row.expiry_date}.`,
          })),
          ...expired.rows.map((row) => ({
            type: 'expired_batch',
            severity: 'critical',
            batch: toInventoryBatch(row),
            message: `${row.batch_number} expired on ${row.expiry_date} and still has stock.`,
          })),
          ...unusual.rows.map((row) => ({
            type: 'unusual_adjustment',
            severity: 'warning',
            batch_id: row.id,
            batch_number: row.batch_number,
            message: `${row.adjustment_count} adjustments in 30 days; largest change ${row.largest_adjustment}.`,
          })),
          ...incomplete.rows.map((row) => ({
            type: 'incomplete_batch_information',
            severity: 'info',
            batch: toInventoryBatch(row),
            message: `${row.batch_number} is missing manufacturer, supplier or storage information.`,
          })),
        ],
      },
    });
  }),
);

router.get(
  '/inventory/expiry',
  asyncHandler(async (request, response) => {
    const result = await query(
      `SELECT ${INVENTORY_BATCH_COLUMNS}
         FROM public.inventory_batches b
         JOIN public.listings l ON l.id = b.listing_id
         JOIN public.catalog_items i ON i.id = l.item_id
        WHERE b.provider_id = $1 AND b.current_quantity > 0 AND b.status <> 'depleted'
        ORDER BY b.expiry_date ASC`,
      [request.provider.id],
    );
    const now = new Date();
    const batches = result.rows.map((row) => toInventoryBatch(row, now));
    const grouped = {
      expired: batches.filter((batch) => batch.expiry_bucket === 'expired'),
      within_30_days: batches.filter((batch) => batch.expiry_bucket === 'within_30_days'),
      within_60_days: batches.filter((batch) => batch.expiry_bucket === 'within_60_days'),
      within_90_days: batches.filter((batch) => batch.expiry_bucket === 'within_90_days'),
      safe: batches.filter((batch) => batch.expiry_bucket === 'safe'),
    };
    response.json({
      data: {
        batches: grouped,
        counts: Object.fromEntries(
          Object.entries(grouped).map(([key, value]) => [key, value.length]),
        ),
      },
    });
  }),
);

router.get(
  '/inventory/forecast',
  asyncHandler(async (request, response) => {
    const providerId = request.provider.id;
    const [stockResult, consumptionResult] = await Promise.all([
      query(
        `SELECT l.id AS listing_id, i.name AS item_name, i.unit,
                coalesce(sum(b.current_quantity), 0)::integer AS current_stock,
                l.currency
           FROM public.listings l
           JOIN public.catalog_items i ON i.id = l.item_id
           LEFT JOIN public.inventory_batches b ON b.listing_id = l.id
          WHERE l.provider_id = $1 AND i.type = 'medication'
          GROUP BY l.id, i.name, i.unit, l.currency
          ORDER BY i.name ASC`,
        [providerId],
      ),
      query(
        `SELECT b.listing_id,
                coalesce(sum(abs(m.quantity)) filter (
                  where m.occurred_at >= now() - interval '30 days'
                ), 0)::integer AS dispensed_last_30,
                coalesce(sum(abs(m.quantity)) filter (
                  where m.occurred_at >= now() - interval '14 days'
                ), 0)::integer AS dispensed_last_14,
                coalesce(sum(abs(m.quantity)) filter (
                  where m.occurred_at >= now() - interval '28 days'
                    and m.occurred_at < now() - interval '14 days'
                ), 0)::integer AS dispensed_previous_14
           FROM public.inventory_movements m
           JOIN public.inventory_batches b ON b.id = m.batch_id
          WHERE m.provider_id = $1 AND m.movement_type = 'dispensed'
          GROUP BY b.listing_id`,
        [providerId],
      ),
    ]);

    const consumption = new Map(
      consumptionResult.rows.map((row) => [row.listing_id, row]),
    );
    const now = new Date();
    const data = stockResult.rows.map((row) => {
      const usage = consumption.get(row.listing_id) || {};
      const forecast = buildForecast(
        {
          currentStock: row.current_stock,
          dispensedLast30: usage.dispensed_last_30 ?? 0,
          dispensedLast14: usage.dispensed_last_14 ?? 0,
          dispensedPrevious14: usage.dispensed_previous_14 ?? 0,
        },
        now,
      );
      return {
        listing_id: row.listing_id,
        item_name: row.item_name,
        unit: row.unit,
        currency: row.currency,
        ...forecast,
      };
    });
    response.json({ data });
  }),
);

export default router;
