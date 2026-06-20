import { z } from 'zod';
import { AlertLevel, AlertType, GoodsSensitivity } from '../types';

export const alertQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  vehicleId: z.string().optional(),
  alertLevel: z.nativeEnum(AlertLevel).optional(),
  status: z.enum(['active', 'resolved']).optional(),
  alertType: z.nativeEnum(AlertType).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export const alertIdSchema = z.object({
  id: z.string().min(1, '告警ID不能为空')
});

export const alertRuleSchema = z.object({
  name: z.string().min(1, '规则名称不能为空').max(100, '规则名称长度不能超过100'),
  alertType: z.nativeEnum(AlertType),
  minPowerOffMinutes: z.number().min(0, '最短断电时长不能小于0'),
  goodsSensitivityRequired: z.nativeEnum(GoodsSensitivity).optional(),
  nearDeliveryRequired: z.boolean().default(false),
  targetLevel: z.nativeEnum(AlertLevel),
  enabled: z.boolean().optional()
});

export const alertRuleUpdateSchema = alertRuleSchema.partial();

export const alertRuleIdSchema = z.object({
  ruleId: z.string().min(1, '规则ID不能为空')
});

export const alertRuleQuerySchema = z.object({
  alertType: z.nativeEnum(AlertType).optional()
});
