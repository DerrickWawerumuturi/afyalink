import { z } from 'zod';

export const moneySchema = z
  .number()
  .finite()
  .nonnegative()
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, {
    message: 'Must have at most two decimal places',
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function toMinor(value) {
  return Math.round(Number(value) * 100);
}

export function fromMinor(minor) {
  return minor / 100;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: 'Must be a valid calendar date',
  });

const optionalText = (max) => z.string().trim().max(max).nullable().optional();

export const inventoryBatchCreateSchema = z
  .object({
    listing_id: z.string().uuid(),
    batch_number: z.string().trim().min(1).max(80),
    manufacturer: optionalText(120),
    supplier: optionalText(120),
    date_received: isoDate,
    expiry_date: isoDate,
    initial_quantity: z.number().int().positive().max(10_000_000),
    unit: z.string().trim().min(1).max(40),
    storage_info: optionalText(240),
  })
  .strict()
  .refine((body) => body.expiry_date > body.date_received, {
    message: 'Expiry date must be after date received',
    path: ['expiry_date'],
  });

export const inventoryMovementSchema = z
  .object({
    movement_type: z.enum([
      'received',
      'dispensed',
      'adjustment',
      'damaged',
      'expired',
      'quarantined',
      'returned',
    ]),
    quantity: z.number().int().refine((value) => value !== 0, {
      message: 'Quantity must be non-zero',
    }),
    reason: optionalText(500),
    reference: optionalText(120),
  })
  .strict();

export const inventoryAuditSchema = z
  .object({
    notes: optionalText(500),
    counted_at: z.string().datetime({ offset: true }).optional(),
    lines: z
      .array(
        z
          .object({
            batch_id: z.string().uuid(),
            counted_quantity: z.number().int().nonnegative().max(10_000_000),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
