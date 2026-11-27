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
