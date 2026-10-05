import { containerSchema, locationSchema } from '@ovelo/validation';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createCategory,
  createContainer,
  createLocation,
  deleteLocation,
  listCategories,
  listContainers,
  listLocations,
} from '../services/location.service.js';
import { z } from 'zod';
import { expandMapsUrl } from '../services/maps.service.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
export const parseMapsController = asyncHandler(async (req, res) => {
  const { url } = z.object({ url: z.string().max(2048) }).strict().parse(req.body);
  res.json({ data: await expandMapsUrl(url) });
});
export const searchLocationController = asyncHandler(async (req, res) => {
  const q = z.string().trim().min(2).max(200).parse(req.query.q);
  const saved = (await listLocations(req.auth!.userId)).filter(l => `${l.name} ${l.address || ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
  if (!env.GOOGLE_MAPS_API_KEY) return res.json({ data: { saved, places: [], manualAddress: q, geocodingAvailable: false } });
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY, 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.googleMapsUri' }, body: JSON.stringify({ textQuery: q, pageSize: 10 }) });
  if (!response.ok) throw new AppError(503, 'LOCATION_SEARCH_UNAVAILABLE', 'Place search is unavailable. Use a manual address or Google Maps link.');
  const body = await response.json() as { places?: { displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number }; googleMapsUri?: string }[] };
  res.json({ data: { saved, geocodingAvailable: true, places: (body.places || []).map(p => ({ name: p.displayName?.text?.slice(0, 100) || q.slice(0, 100), address: p.formattedAddress, latitude: p.location?.latitude, longitude: p.location?.longitude, mapsUrl: p.googleMapsUri })) } });
});
export const locationsController = asyncHandler(async (req, res) =>
  res.json({ data: await listLocations(req.auth!.userId) }),
);
export const createLocationController = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({ data: await createLocation(req.auth!.userId, locationSchema.parse(req.body)) }),
);
export const deleteLocationController = asyncHandler(async (req, res) => {
  await deleteLocation(req.auth!.userId, String(req.params.id));
  res.status(204).send();
});
export const categoriesController = asyncHandler(async (req, res) =>
  res.json({ data: await listCategories(req.auth!.userId) }),
);
export const createCategoryController = asyncHandler(async (req, res) => {
  const body = req.body as { name?: unknown; icon?: unknown };
  const name = String(body.name ?? '').trim();
  if (!name || name.length > 100) throw new Error('Invalid category');
  res.status(201).json({
    data: await createCategory(req.auth!.userId, name, String(body.icon ?? 'box').slice(0, 30)),
  });
});
export const containersController = asyncHandler(async (req, res) =>
  res.json({ data: await listContainers(req.auth!.userId) }),
);
export const createContainerController = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({ data: await createContainer(req.auth!.userId, containerSchema.parse(req.body)) }),
);
