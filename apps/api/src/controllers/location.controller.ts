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
