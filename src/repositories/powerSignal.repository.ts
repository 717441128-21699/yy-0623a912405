import { getDatabase } from '../database';
import { PowerSignal, AlertType, PaginatedResult } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentTimestamp } from '../utils/time';

const db = getDatabase();

export interface CreatePowerSignalInput {
  vehicleId: string;
  deviceId?: string;
  alertType: AlertType;
  externalPowerConnected: boolean;
  batteryVoltage?: number;
  refrigerationRunning: boolean;
  temperature?: number;
  location?: string;
  timestamp?: string;
}

export function createPowerSignal(input: CreatePowerSignalInput): PowerSignal {
  const id = uuidv4();
  const now = getCurrentTimestamp();
  const signalTime = input.timestamp || now;

  const signal: PowerSignal = {
    id,
    vehicleId: input.vehicleId,
    deviceId: input.deviceId || '',
    alertType: input.alertType,
    externalPowerConnected: input.externalPowerConnected,
    batteryVoltage: input.batteryVoltage,
    refrigerationRunning: input.refrigerationRunning,
    temperature: input.temperature,
    location: input.location,
    timestamp: signalTime,
    receivedAt: now
  };

  db.insert('powerSignals', signal);
  return signal;
}

export function getPowerSignalById(id: string): PowerSignal | null {
  return db.findById('powerSignals', id) as PowerSignal | null;
}

export function getLatestSignalByVehicle(vehicleId: string): PowerSignal | null {
  const signals = db.findAll(
    'powerSignals',
    (s: PowerSignal) => s.vehicleId === vehicleId
  ) as PowerSignal[];
  if (signals.length === 0) return null;
  signals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return signals[0];
}

export function getLatestPowerOffSignal(vehicleId: string): PowerSignal | null {
  const signals = db.findAll(
    'powerSignals',
    (s: PowerSignal) => s.vehicleId === vehicleId && !s.externalPowerConnected
  ) as PowerSignal[];
  if (signals.length === 0) return null;
  signals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return signals[0];
}

export function getFirstPowerOffSignalSince(vehicleId: string, sinceTime: string): PowerSignal | null {
  const signals = db.findAll(
    'powerSignals',
    (s: PowerSignal) =>
      s.vehicleId === vehicleId &&
      !s.externalPowerConnected &&
      s.timestamp >= sinceTime
  ) as PowerSignal[];
  if (signals.length === 0) return null;
  signals.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return signals[0];
}

export function listPowerSignals(
  page: number,
  pageSize: number,
  options?: {
    vehicleId?: string;
    alertType?: AlertType;
    startDate?: string;
    endDate?: string;
  }
): PaginatedResult<PowerSignal> {
  let signals = db.getTable<PowerSignal>('powerSignals');

  if (options?.vehicleId) {
    signals = signals.filter(s => s.vehicleId === options.vehicleId);
  }
  if (options?.alertType) {
    signals = signals.filter(s => s.alertType === options.alertType);
  }
  if (options?.startDate) {
    signals = signals.filter(s => s.timestamp >= options.startDate!);
  }
  if (options?.endDate) {
    signals = signals.filter(s => s.timestamp <= options.endDate!);
  }

  signals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = signals.length;
  const offset = (page - 1) * pageSize;
  const data = signals.slice(offset, offset + pageSize);

  return { data, total, page, pageSize };
}

export function hasPowerDisconnectedRecently(vehicleId: string, minutes: number): boolean {
  const sinceTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const count = db.count(
    'powerSignals',
    (s: PowerSignal) =>
      s.vehicleId === vehicleId &&
      !s.externalPowerConnected &&
      s.timestamp >= sinceTime
  );
  return count > 0;
}
