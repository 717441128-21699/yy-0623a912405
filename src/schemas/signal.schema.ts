import { z } from 'zod';
import { AlertType } from '../types';

export const reportSignalSchema = z.object({
  vehicleId: z.string().optional(),
  plateNumber: z.string().optional(),
  deviceId: z.string().optional(),
  externalPowerConnected: z.boolean().optional(),
  batteryVoltage: z.number().optional(),
  refrigerationRunning: z.boolean().optional(),
  temperature: z.number().optional(),
  location: z.string().optional(),
  timestamp: z.string().optional()
}).refine(data => data.vehicleId || data.plateNumber, {
  message: 'vehicleId 和 plateNumber 至少提供一个',
  path: ['vehicleId']
});

export const signalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  vehicleId: z.string().optional(),
  alertType: z.nativeEnum(AlertType).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export const signalIdSchema = z.object({
  id: z.string().min(1, '信号ID不能为空')
});

export const vehicleIdParamSchema = z.object({
  vehicleId: z.string().min(1, '车辆ID不能为空')
});
