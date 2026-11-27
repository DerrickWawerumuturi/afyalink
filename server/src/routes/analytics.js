import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { asyncHandler, parse } from '../http.js';
import { toProviderEvent } from '../serializers.js';
import { paginationSchema } from '../validation.js';
import { buildForecast } from '../services/inventory.js';

const router = Router();

const auditLogQuerySchema = paginationSchema.extend({
  action: z.string().trim().max(80).optional(),
  record_type: z.string().trim().max(40).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

router.get(
  '/analytics/inventory',
  asyncHandler(async (request, response) => {
    const providerId = request.provider.id;
    const [fastMoving, slowMoving, stockoutFrequency, expiryLosses, monthlyConsumption, movementTrends, forecastRows] =
      await Promise.all([
        query(
          `SELECT i.name AS item_name, i.unit, l.id AS listing_id,
                  sum(abs(m.quantity))::integer AS consumed_quantity
             FROM public.inventory_movements m
             JOIN public.inventory_batches b ON b.id = m.batch_id
             JOIN public.listings l ON l.id = b.listing_id
             JOIN public.catalog_items i ON i.id = l.item_id
            WHERE m.provider_id = $1 AND m.movement_type = 'dispensed'
              AND m.occurred_at >= now() - interval '90 days'
            GROUP BY i.name, i.unit, l.id
            ORDER BY consumed_quantity DESC
            LIMIT 10`,
          [providerId],
        ),
        query(
          `SELECT i.name AS item_name, i.unit, l.id AS listing_id,
                  coalesce(sum(b.current_quantity), 0)::integer AS current_stock
             FROM public.listings l
             JOIN public.catalog_items i ON i.id = l.item_id
             LEFT JOIN public.inventory_batches b ON b.listing_id = l.id
            WHERE l.provider_id = $1 AND i.type = 'medication'
            GROUP BY i.name, i.unit, l.id
            HAVING coalesce(sum(b.current_quantity), 0) > 0
               AND NOT exists (
                 select 1
                   from public.inventory_movements m
                   join public.inventory_batches mb on mb.id = m.batch_id
                  where mb.listing_id = l.id and m.movement_type = 'dispensed'
                    and m.occurred_at >= now() - interval '90 days'
               )
            ORDER BY current_stock DESC
            LIMIT 10`,
          [providerId],
        ),
        query(
          `SELECT i.name AS item_name, i.unit, count(*)::integer AS stockout_events
             FROM public.inventory_movements m
             JOIN public.inventory_batches b ON b.id = m.batch_id
             JOIN public.listings l ON l.id = b.listing_id
             JOIN public.catalog_items i ON i.id = l.item_id
            WHERE m.provider_id = $1
              AND m.new_balance = 0
              AND m.quantity < 0
              AND m.occurred_at >= now() - interval '365 days'
            GROUP BY i.name, i.unit
            ORDER BY stockout_events DESC
            LIMIT 10`,
          [providerId],
        ),
        query(
          `SELECT i.name AS item_name, i.unit,
                  sum(abs(m.quantity))::integer AS lost_quantity
             FROM public.inventory_movements m
             JOIN public.inventory_batches b ON b.id = m.batch_id
             JOIN public.listings l ON l.id = b.listing_id
             JOIN public.catalog_items i ON i.id = l.item_id
            WHERE m.provider_id = $1
              AND m.movement_type in ('expired', 'damaged')
              AND m.occurred_at >= now() - interval '365 days'
            GROUP BY i.name, i.unit
            ORDER BY lost_quantity DESC
            LIMIT 10`,
          [providerId],
        ),
        query(
          `SELECT to_char(date_trunc('month', m.occurred_at), 'YYYY-MM') AS month,
                  sum(abs(m.quantity))::integer AS consumed_quantity
             FROM public.inventory_movements m
            WHERE m.provider_id = $1 AND m.movement_type = 'dispensed'
              AND m.occurred_at >= now() - interval '12 months'
            GROUP BY 1
            ORDER BY 1 ASC`,
          [providerId],
        ),
        query(
          `SELECT to_char(date_trunc('month', m.occurred_at), 'YYYY-MM') AS month,
                  m.movement_type,
                  sum(abs(m.quantity))::integer AS quantity,
                  count(*)::integer AS movement_count
             FROM public.inventory_movements m
            WHERE m.provider_id = $1 AND m.occurred_at >= now() - interval '12 months'
            GROUP BY 1, 2
            ORDER BY 1 ASC, 2 ASC`,
          [providerId],
        ),
        query(
          `SELECT i.name AS item_name,
                  coalesce(sum(b.current_quantity), 0)::integer AS current_stock
             FROM public.listings l
             JOIN public.catalog_items i ON i.id = l.item_id
             LEFT JOIN public.inventory_batches b ON b.listing_id = l.id
            WHERE l.provider_id = $1 AND i.type = 'medication'
            GROUP BY i.name`,
          [providerId],
        ),
      ]);

    const usageResult = await query(
      `SELECT i.name AS item_name,
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
         FROM public.catalog_items i
         JOIN public.listings l ON l.item_id = i.id
         LEFT JOIN public.inventory_batches b ON b.listing_id = l.id
         LEFT JOIN public.inventory_movements m ON m.batch_id = b.id AND m.movement_type = 'dispensed'
        WHERE l.provider_id = $1 AND i.type = 'medication'
        GROUP BY i.name`,
      [providerId],
    );
    const usageByName = new Map(usageResult.rows.map((row) => [row.item_name, row]));
    const now = new Date();
    const recommendations = forecastRows.rows
      .map((row) => {
        const usage = usageByName.get(row.item_name) || {};
        const forecast = buildForecast(
          {
            currentStock: row.current_stock,
            dispensedLast30: usage.dispensed_last_30 ?? 0,
            dispensedLast14: usage.dispensed_last_14 ?? 0,
            dispensedPrevious14: usage.dispensed_previous_14 ?? 0,
          },
          now,
        );
        if (forecast.data_status !== 'sufficient' || !forecast.reorder_warning) return null;
        return `${row.item_name} has approximately ${forecast.days_remaining} days of stock remaining based on recent consumption.`;
      })
      .filter(Boolean);

    if (expiryLosses.rows.length > 0) {
      recommendations.push(
        `${expiryLosses.rows.length} medicine lines recorded expiry or damage losses in the last year.`,
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('Insufficient inventory history to generate a recommendation.');
    }

    response.json({
      data: {
        fast_moving: fastMoving.rows,
        slow_moving: slowMoving.rows,
        stockout_frequency: stockoutFrequency.rows,
        expiry_losses: expiryLosses.rows,
        monthly_consumption: monthlyConsumption.rows,
        movement_trends: movementTrends.rows,
        recommendations,
      },
    });
  }),
);

router.get(
  '/analytics/operations',
  asyncHandler(async (request, response) => {
    const providerId = request.provider.id;
    const [summary, services, unavailable, requestTrend] = await Promise.all([
      query(
        `SELECT count(*)::integer AS incoming_enquiries,
                count(*) filter (where r.status = 'confirmed')::integer AS confirmed,
                count(*) filter (where r.status = 'declined')::integer AS declined,
                count(*) filter (where r.status = 'pending' and r.expires_at > now())::integer AS unanswered,
                count(*) filter (where r.status in ('pending', 'confirmed') and r.expires_at < now())::integer AS expired,
                coalesce(avg(extract(epoch from (r.updated_at - r.created_at)) / 60)
                  filter (where r.status <> 'pending'), 0)::numeric AS average_response_minutes
           FROM public.requests r
           JOIN public.listings l ON l.id = r.listing_id
          WHERE l.provider_id = $1
            AND r.created_at >= now() - interval '30 days'`,
        [providerId],
      ),
      query(
        `SELECT i.name AS service_name, count(*)::integer AS request_count
           FROM public.requests r
           JOIN public.listings l ON l.id = r.listing_id
           JOIN public.catalog_items i ON i.id = l.item_id
          WHERE l.provider_id = $1 AND i.type = 'service'
            AND r.created_at >= now() - interval '90 days'
          GROUP BY i.name
          ORDER BY request_count DESC
          LIMIT 10`,
        [providerId],
      ),
      query(
        `SELECT i.name AS service_name, count(*)::integer AS unavailable_changes
           FROM public.listing_availability_events e
           JOIN public.listings l ON l.id = e.listing_id
           JOIN public.catalog_items i ON i.id = l.item_id
          WHERE e.provider_id = $1 AND e.available = false
            AND e.changed_at >= now() - interval '90 days'
          GROUP BY i.name
          ORDER BY unavailable_changes DESC
          LIMIT 10`,
        [providerId],
      ),
      query(
        `SELECT to_char(date_trunc('month', r.created_at), 'YYYY-MM') AS month,
                  count(*)::integer AS request_count
             FROM public.requests r
             JOIN public.listings l ON l.id = r.listing_id
            WHERE l.provider_id = $1 AND r.created_at >= now() - interval '6 months'
            GROUP BY 1
            ORDER BY 1 ASC`,
        [providerId],
      ),
    ]);

    const row = summary.rows[0];
    const recommendations = [];
    if (services.rows.length > 0) {
      recommendations.push(
        `${services.rows[0].service_name} is the most requested service in the last 90 days.`,
      );
    }
    if (unavailable.rows.length > 0) {
      recommendations.push(
        `${unavailable.rows[0].service_name} was marked unavailable ${unavailable.rows[0].unavailable_changes} time(s) recently.`,
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('Insufficient enquiry history to generate a recommendation.');
    }

    response.json({
      data: {
        summary: {
          incoming_enquiries: row.incoming_enquiries,
          confirmed: row.confirmed,
          declined: row.declined,
          unanswered: row.unanswered,
          expired: row.expired,
          average_response_minutes: Number(row.average_response_minutes),
        },
        frequently_requested_services: services.rows,
        frequently_unavailable_services: unavailable.rows,
        request_trend: requestTrend.rows,
        recommendations,
      },
    });
  }),
);

router.get(
  '/audit-log',
  asyncHandler(async (request, response) => {
    const { page, limit, action, record_type, from, to } = parse(
      auditLogQuerySchema,
      request.query,
    );
    const conditions = ['provider_id = $1'];
    const values = [request.provider.id];
    if (action) {
      values.push(action);
      conditions.push(`action = $${values.length}`);
    }
    if (record_type) {
      values.push(record_type);
      conditions.push(`record_type = $${values.length}`);
    }
    if (from) {
      values.push(from);
      conditions.push(`occurred_at >= $${values.length}::timestamptz`);
    }
    if (to) {
      values.push(to);
      conditions.push(`occurred_at <= $${values.length}::timestamptz`);
    }
    const where = conditions.join(' AND ');

    const countResult = await query(
      `SELECT count(*)::integer AS total FROM public.provider_events WHERE ${where}`,
      values,
    );
    values.push(limit, (page - 1) * limit);
    const result = await query(
      `SELECT *, count(*) over() AS total
         FROM public.provider_events
        WHERE ${where}
        ORDER BY occurred_at DESC, id DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    response.json({
      data: result.rows.map(toProviderEvent),
      meta: { page, limit, total: countResult.rows[0].total },
    });
  }),
);

export default router;
