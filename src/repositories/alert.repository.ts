import { getDatabase } from '../database';
import { AlertEvent, AlertLevel, AlertType, GoodsSensitivity, PaginatedResult } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentTimestamp } from '../utils/time';

const db = getDatabase();

export interface CreateAlertEventInput {
  vehicleId: string;
  signalId: string;
  alertType: AlertType;
  alertLevel: AlertLevel;
  powerOffDurationMinutes: number;
  currentTemperature?: number;
  goodsSensitivity?: GoodsSensitivity;
  nearDelivery?: boolean;
  description?: string;
}

export function createAlertEvent(input: CreateAlertEventInput): AlertEvent {
  const id = uuidv4();
  const now = getCurrentTimestamp();

  const alert: AlertEvent = {
    id,
    vehicleId: input.vehicleId,
    signalId: input.signalId,
    alertType: input.alertType,
    alertLevel: input.alertLevel,
    powerOffDurationMinutes: input.powerOffDurationMinutes,
    currentTemperature: input.currentTemperature,
    goodsSensitivity: input.goodsSensitivity || GoodsSensitivity.MEDIUM,
    nearDelivery: input.nearDelivery || false,
    description: input.description || '',
    status: 'active',
    createdAt: now,
    updatedAt: now
  };

  db.insert('alertEvents', alert);
  return alert;
}

export function getAlertEventById(id: string): AlertEvent | null {
  return db.findById('alertEvents', id) as AlertEvent | null;
}

export function getActiveAlertByVehicle(vehicleId: string): AlertEvent | null {
  const alerts = db.findAll(
    'alertEvents',
    (a: AlertEvent) => a.vehicleId === vehicleId && a.status === 'active'
  ) as AlertEvent[];
  if (alerts.length === 0) return null;
  alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return alerts[0];
}

export function listAlertEvents(
  page: number,
  pageSize: number,
  options?: {
    vehicleId?: string;
    alertLevel?: AlertLevel;
    status?: 'active' | 'resolved';
    alertType?: AlertType;
    startDate?: string;
    endDate?: string;
  }
): PaginatedResult<AlertEvent> {
  let alerts = db.getTable<AlertEvent>('alertEvents');

  if (options?.vehicleId) {
    alerts = alerts.filter(a => a.vehicleId === options.vehicleId);
  }
  if (options?.alertLevel) {
    alerts = alerts.filter(a => a.alertLevel === options.alertLevel);
  }
  if (options?.status) {
    alerts = alerts.filter(a => a.status === options.status);
  }
  if (options?.alertType) {
    alerts = alerts.filter(a => a.alertType === options.alertType);
  }
  if (options?.startDate) {
    alerts = alerts.filter(a => a.createdAt >= options.startDate!);
  }
  if (options?.endDate) {
    alerts = alerts.filter(a => a.createdAt <= options.endDate!);
  }

  alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = alerts.length;
  const offset = (page - 1) * pageSize;
  const data = alerts.slice(offset, offset + pageSize);

  return { data, total, page, pageSize };
}

export function resolveAlertEvent(id: string): AlertEvent | null {
  const now = getCurrentTimestamp();
  return db.update('alertEvents', id, {
    status: 'resolved',
    resolvedAt: now
  }) as AlertEvent | null;
}

export function updateAlertEventLevel(id: string, newLevel: AlertLevel): AlertEvent | null {
  return db.update('alertEvents', id, {
    alertLevel: newLevel
  }) as AlertEvent | null;
}
