import { Router } from 'express';
import * as signalController from '../controllers/signal.controller';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import {
  reportSignalSchema,
  signalQuerySchema,
  signalIdSchema,
  vehicleIdParamSchema
} from '../schemas/signal.schema';

const router = Router();

router.post(
  '/report',
  validateBody(reportSignalSchema),
  signalController.reportSignal
);

router.get(
  '/',
  validateQuery(signalQuerySchema),
  signalController.listSignals
);

router.get(
  '/:id',
  validateParams(signalIdSchema),
  signalController.getSignalById
);

router.get(
  '/vehicle/:vehicleId/latest',
  validateParams(vehicleIdParamSchema),
  signalController.getLatestSignalByVehicle
);

export default router;
