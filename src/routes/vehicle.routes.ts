import { Router } from 'express';
import * as vehicleController from '../controllers/vehicle.controller';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import { vehicleSchema, vehicleUpdateSchema, vehicleQuerySchema, vehicleIdSchema } from '../schemas/vehicle.schema';

const router = Router();

router.post(
  '/',
  validateBody(vehicleSchema),
  vehicleController.createVehicle
);

router.get(
  '/:id',
  validateParams(vehicleIdSchema),
  vehicleController.getVehicleById
);

router.get(
  '/',
  validateQuery(vehicleQuerySchema),
  vehicleController.listVehicles
);

router.put(
  '/:id',
  validateParams(vehicleIdSchema),
  validateBody(vehicleUpdateSchema),
  vehicleController.updateVehicle
);

router.delete(
  '/:id',
  validateParams(vehicleIdSchema),
  vehicleController.deleteVehicle
);

export default router;
