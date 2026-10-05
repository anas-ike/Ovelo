import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { resolveIdentifier } from '../services/identifier.service.js';
export const resolveQr = asyncHandler(async (req, res) => res.json({ data: await resolveIdentifier(req.auth!.userId, String(req.params.code)) }));
export const resolveCode = asyncHandler(async (req, res) => res.json({ data: await resolveIdentifier(req.auth!.userId, z.object({ code: z.string().min(1).max(2048) }).strict().parse(req.body).code) }));
