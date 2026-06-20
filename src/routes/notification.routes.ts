import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { validateQuery, validateParams, validateBody } from '../middleware/validate';
import {
  notificationQuerySchema,
  notificationIdSchema,
  confirmNotificationSchema,
  dispatchNotificationSchema
} from '../schemas/notification.schema';

const router = Router();

router.post(
  '/dispatch',
  validateBody(dispatchNotificationSchema),
  notificationController.dispatchNotifications
);

router.get(
  '/',
  validateQuery(notificationQuerySchema),
  notificationController.listNotifications
);

router.get(
  '/:id',
  validateParams(notificationIdSchema),
  notificationController.getNotificationById
);

router.post(
  '/:id/confirm',
  validateParams(notificationIdSchema),
  validateBody(confirmNotificationSchema),
  notificationController.confirmNotification
);

router.post(
  '/:id/escalate',
  validateParams(notificationIdSchema),
  notificationController.escalateNotification
);

export default router;
