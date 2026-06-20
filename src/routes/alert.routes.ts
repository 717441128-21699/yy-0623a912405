import { Router } from 'express';
import * as alertController from '../controllers/alert.controller';
import { validateQuery, validateParams, validateBody } from '../middleware/validate';
import {
  alertQuerySchema,
  alertIdSchema,
  alertRuleSchema,
  alertRuleUpdateSchema,
  alertRuleIdSchema,
  alertRuleQuerySchema
} from '../schemas/alert.schema';

const router = Router();

router.get('/stats', alertController.getAlertStats);

router.get(
  '/rules',
  validateQuery(alertRuleQuerySchema),
  alertController.listAlertRules
);

router.post(
  '/rules',
  validateBody(alertRuleSchema),
  alertController.createAlertRule
);

router.get(
  '/rules/:ruleId',
  validateParams(alertRuleIdSchema),
  alertController.getAlertRule
);

router.put(
  '/rules/:ruleId',
  validateParams(alertRuleIdSchema),
  validateBody(alertRuleUpdateSchema),
  alertController.updateAlertRule
);

router.delete(
  '/rules/:ruleId',
  validateParams(alertRuleIdSchema),
  alertController.deleteAlertRule
);

router.get(
  '/',
  validateQuery(alertQuerySchema),
  alertController.listAlerts
);

router.get(
  '/:id',
  validateParams(alertIdSchema),
  alertController.getAlertById
);

router.put(
  '/:id/resolve',
  validateParams(alertIdSchema),
  alertController.resolveAlert
);

export default router;
