import { getDatabase } from '../database';
import { Vehicle, GoodsSensitivity, PaginatedResult } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentTimestamp } from '../utils/time';
import { NotFoundError } from '../middleware/errorHandler';

const db = getDatabase();

export function createVehicle(data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Vehicle {
  const id = uuidv4();
  const now = getCurrentTimestamp();

  const vehicle: Vehicle = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now
  };

  db.insert('vehicles', vehicle);
  return vehicle;
}

export function getVehicleById(id: string): Vehicle | null {
  return db.findById('vehicles', id) as Vehicle | null;
}

export function getVehicleByPlateNumber(plateNumber: string): Vehicle | null {
  return db.findOne('vehicles', (v: Vehicle) => v.plateNumber === plateNumber) as Vehicle | null;
}

export function listVehicles(
  page: number,
  pageSize: number,
  keyword?: string,
  goodsSensitivity?: GoodsSensitivity
): PaginatedResult<Vehicle> {
  let vehicles = db.getTable<Vehicle>('vehicles');

  if (keyword) {
    const lowerKeyword = keyword.toLowerCase();
    vehicles = vehicles.filter(v =>
      v.plateNumber.toLowerCase().includes(lowerKeyword) ||
      v.driverName.toLowerCase().includes(lowerKeyword) ||
      (v.route && v.route.toLowerCase().includes(lowerKeyword))
    );
  }

  if (goodsSensitivity) {
    vehicles = vehicles.filter(v => v.goodsSensitivity === goodsSensitivity);
  }

  vehicles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = vehicles.length;
  const offset = (page - 1) * pageSize;
  const data = vehicles.slice(offset, offset + pageSize);

  return { data, total, page, pageSize };
}

export function updateVehicle(id: string, data: Partial<Vehicle>): Vehicle {
  const existing = getVehicleById(id);
  if (!existing) {
    throw new NotFoundError('车辆不存在');
  }

  const updated = db.update('vehicles', id, data) as Vehicle;
  return updated;
}

export function deleteVehicle(id: string): void {
  const existing = getVehicleById(id);
  if (!existing) {
    throw new NotFoundError('车辆不存在');
  }
  db.remove('vehicles', id);
}
