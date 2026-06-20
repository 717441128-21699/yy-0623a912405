import { z } from 'zod';
import { NotificationStatus, AlertLevel } from '../types';

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  alertId: z.string().optional(),
  vehicleId: z.string().optional(),
  status: z.nativeEnum(NotificationStatus).optional(),
  alertLevel: z.nativeEnum(AlertLevel).optional(),
  recipientType: z.enum(['driver', 'dispatcher', 'quality_controller', 'shipper']).optional()
});

export const notificationIdSchema = z.object({
  id: z.string().min(1, '通知ID不能为空')
});

export const confirmNotificationSchema = z.object({
  confirmedBy: z.string().optional()
});

export const dispatchNotificationSchema = z.object({
  alertId: z.string().min(1, '告警ID不能为空')
});
