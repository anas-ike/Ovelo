import { z } from 'zod';

export const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) => text(max).nullish();
export const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const password = z.string().min(12, 'Use at least 12 characters').max(128);
export const registerSchema = z.object({ name: text(100).min(1), email, password }).strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const emailChangeSchema = z.object({ email }).strict();
export const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const resetSchema = tokenSchema.extend({ password });
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
export const statusSchema = z.enum([
  'OWNED',
  'LISTED',
  'SOLD',
  'LOST',
  'STOLEN',
  'DISPOSED',
  'ARCHIVED',
]);
const money = z.coerce.number().min(0).max(999999999.999).nullable().optional();
const date = z.string().datetime({ offset: true }).nullable().optional();
export const itemSchema = z
  .object({
    name: text(200).min(1),
    description: nullableText(4000),
    categoryId: uuid.nullish(),
    locationId: uuid.nullish(),
    containerId: uuid.nullish(),
    status: statusSchema.default('OWNED'),
    purchaseDate: date,
    purchasePrice: money,
    estimatedValue: money,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default('USD'),
    store: nullableText(200),
    serialNumber: nullableText(200),
    modelNumber: nullableText(200),
    manufacturer: nullableText(200),
    notes: nullableText(10000),
    barcode: nullableText(100),
  })
  .strict();
export const itemUpdateSchema = itemSchema.partial();
export const itemSearchSchema = pagination.extend({
  q: text(100).optional(),
  status: statusSchema.optional(),
  categoryId: uuid.optional(),
  locationId: uuid.optional(),
  sort: z.enum(['newest', 'updated', 'name', 'price']).default('newest'),
  warranty: z.enum(['active', 'expiring', 'expired']).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});
export const locationSchema = z
  .object({
    name: text(100).min(1),
    parentId: uuid.nullish(),
    type: z.enum(['HOME', 'OFFICE', 'CAR', 'STORAGE', 'OTHER']).default('HOME'),
  })
  .strict();
export const containerSchema = z
  .object({
    name: text(100).min(1),
    locationId: uuid.nullish(),
    parentId: uuid.nullish(),
    description: nullableText(1000),
  })
  .strict();
export const warrantySchema = z
  .object({
    startDate: z.string().datetime({ offset: true }),
    endDate: z.string().datetime({ offset: true }),
    provider: nullableText(200),
    warrantyNumber: nullableText(200),
    notificationDays: z.array(z.number().int().min(1).max(365)).max(10).default([90, 30, 7, 1]),
  })
  .strict()
  .refine((v) => v.endDate >= v.startDate, {
    message: 'Warranty end must follow start',
    path: ['endDate'],
  });
export const repairSchema = z
  .object({
    date: z.string().datetime({ offset: true }),
    problem: text(1000).min(1),
    repairShop: nullableText(200),
    cost: z.coerce.number().min(0).max(999999999),
    currency: z.string().regex(/^[A-Z]{3}$/),
    description: nullableText(4000),
  })
  .strict();
export const saleSchema = z
  .object({
    saleDate: z.string().datetime({ offset: true }),
    salePrice: z.coerce.number().min(0).max(999999999),
    buyerNote: nullableText(500),
  })
  .strict();
export const domainSchema = z
  .object({
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/)
      .max(253),
    providerType: z.enum(['GOOGLE', 'BUSINESS', 'CUSTOM']).default('BUSINESS'),
    enabled: z.boolean().default(true),
  })
  .strict();
export type ItemInput = z.infer<typeof itemSchema>;
export type ItemSearch = z.infer<typeof itemSearchSchema>;
