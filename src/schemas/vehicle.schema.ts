import { z } from 'zod';
import { GoodsSensitivity } from '../types';

export const vehicleSchema = z.object({
  plateNumber: z.string().min(1, '车牌号不能为空').max(20, '车牌号长度不能超过20'),
  driverName: z.string().min(1, '司机姓名不能为空').max(50, '司机姓名长度不能超过50'),
  driverPhone: z.string().min(1, '司机电话不能为空').max(20, '司机电话长度不能超过20'),
  route: z.string().max(200, '路线长度不能超过200').optional(),
  temperatureZone: z.string().max(50, '温区名称长度不能超过50').optional(),
  minTemperature: z.number().optional(),
  maxTemperature: z.number().optional(),
  goodsSensitivity: z.nativeEnum(GoodsSensitivity).default(GoodsSensitivity.MEDIUM),
  deliveryEstimateTime: z.string().optional(),
  nightContactName: z.string().max(50, '夜间联系人姓名长度不能超过50').optional(),
  nightContactPhone: z.string().max(20, '夜间联系人电话长度不能超过20').optional(),
  dispatcherName: z.string().max(50, '调度员姓名长度不能超过50').optional(),
  dispatcherPhone: z.string().max(20, '调度员电话长度不能超过20').optional(),
  qualityControllerName: z.string().max(50, '质控员姓名长度不能超过50').optional(),
  qualityControllerPhone: z.string().max(20, '质控员电话长度不能超过20').optional(),
  shipperName: z.string().max(50, '货主姓名长度不能超过50').optional(),
  shipperPhone: z.string().max(20, '货主电话长度不能超过20').optional(),
  nightStartHour: z.number().int().min(0).max(23).default(22),
  nightEndHour: z.number().int().min(0).max(23).default(6)
});

export const vehicleUpdateSchema = vehicleSchema.partial();

export const vehicleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().optional(),
  goodsSensitivity: z.nativeEnum(GoodsSensitivity).optional()
});

export const vehicleIdSchema = z.object({
  id: z.string().min(1, '车辆ID不能为空')
});
