import * as vehicleRepository from '../repositories/vehicle.repository';
import { Vehicle, GoodsSensitivity, PaginatedResult } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';

export interface CreateVehicleInput {
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  route?: string;
  temperatureZone?: string;
  minTemperature?: number;
  maxTemperature?: number;
  goodsSensitivity: GoodsSensitivity;
  deliveryEstimateTime?: string;
  nightContactName?: string;
  nightContactPhone?: string;
  dispatcherName?: string;
  dispatcherPhone?: string;
  qualityControllerName?: string;
  qualityControllerPhone?: string;
  shipperName?: string;
  shipperPhone?: string;
  nightStartHour: number;
  nightEndHour: number;
}

export function createVehicle(input: CreateVehicleInput): Vehicle {
  const existing = vehicleRepository.getVehicleByPlateNumber(input.plateNumber);
  if (existing) {
    throw new BadRequestError('该车牌号已存在');
  }
  return vehicleRepository.createVehicle(input as Vehicle);
}

export function getVehicleById(id: string): Vehicle {
  const vehicle = vehicleRepository.getVehicleById(id);
  if (!vehicle) {
    throw new NotFoundError('车辆不存在');
  }
  return vehicle;
}

export function listVehicles(page: number, pageSize: number, keyword?: string, goodsSensitivity?: GoodsSensitivity): PaginatedResult<Vehicle> {
  return vehicleRepository.listVehicles(page, pageSize, keyword, goodsSensitivity);
}

export function updateVehicle(id: string, input: Partial<CreateVehicleInput>): Vehicle {
  if (input.plateNumber) {
    const existing = vehicleRepository.getVehicleByPlateNumber(input.plateNumber);
    if (existing && existing.id !== id) {
      throw new BadRequestError('该车牌号已被其他车辆使用');
    }
  }
  return vehicleRepository.updateVehicle(id, input as Partial<Vehicle>);
}

export function deleteVehicle(id: string): void {
  vehicleRepository.deleteVehicle(id);
}
