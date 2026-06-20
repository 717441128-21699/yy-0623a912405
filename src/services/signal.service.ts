import * as powerSignalRepository from '../repositories/powerSignal.repository';
import * as vehicleRepository from '../repositories/vehicle.repository';
import * as alertRepository from '../repositories/alert.repository';
import * as alertClassificationService from './alertClassification.service';
import * as notificationService from './notification.service';
import { PowerSignal, AlertType, Vehicle, AlertEvent, AlertLevel } from '../types';
import { config } from '../config';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler';
import { isNightTime, calculateDurationMinutes, getCurrentTimestamp } from '../utils/time';
import { isNearDelivery } from '../utils/time';
import dayjs from 'dayjs';

export interface ReportSignalInput {
  vehicleId?: string;
  plateNumber?: string;
  deviceId?: string;
  externalPowerConnected?: boolean;
  batteryVoltage?: number;
  refrigerationRunning?: boolean;
  temperature?: number;
  location?: string;
  timestamp?: string;
}

export interface SignalProcessingResult {
  signal: PowerSignal;
  alertCreated: boolean;
  alert?: AlertEvent;
  notificationsSent: number;
  isNightTime: boolean;
}

export function reportSignal(input: ReportSignalInput): SignalProcessingResult {
  let vehicle: Vehicle | null = null;

  if (input.vehicleId) {
    vehicle = vehicleRepository.getVehicleById(input.vehicleId);
  } else if (input.plateNumber) {
    vehicle = vehicleRepository.getVehicleByPlateNumber(input.plateNumber);
  }

  if (!vehicle) {
    throw new NotFoundError('车辆不存在，请先创建车辆档案');
  }

  const alertType = determineAlertType(input);
  if (!alertType && input.externalPowerConnected !== false) {
    return handleNormalSignal(vehicle, input);
  }

  const signal = powerSignalRepository.createPowerSignal({
    vehicleId: vehicle.id,
    deviceId: input.deviceId,
    alertType: alertType || AlertType.EXTERNAL_POWER_DISCONNECT,
    externalPowerConnected: input.externalPowerConnected ?? true,
    batteryVoltage: input.batteryVoltage,
    refrigerationRunning: input.refrigerationRunning ?? true,
    temperature: input.temperature,
    location: input.location,
    timestamp: input.timestamp
  });

  const isNight = isNightTime(
    dayjs(signal.timestamp),
    vehicle.nightStartHour,
    vehicle.nightEndHour
  );

  if (!isNight) {
    return {
      signal,
      alertCreated: false,
      notificationsSent: 0,
      isNightTime: false
    };
  }

  return processNightAlert(vehicle, signal, alertType!);
}

function handleNormalSignal(vehicle: Vehicle, input: ReportSignalInput): SignalProcessingResult {
  const signal = powerSignalRepository.createPowerSignal({
    vehicleId: vehicle.id,
    deviceId: input.deviceId,
    alertType: AlertType.EXTERNAL_POWER_DISCONNECT,
    externalPowerConnected: input.externalPowerConnected ?? true,
    batteryVoltage: input.batteryVoltage,
    refrigerationRunning: input.refrigerationRunning ?? true,
    temperature: input.temperature,
    location: input.location,
    timestamp: input.timestamp
  });

  const activeAlert = alertRepository.getActiveAlertByVehicle(vehicle.id);
  if (activeAlert) {
    alertRepository.resolveAlertEvent(activeAlert.id);
  }

  return {
    signal,
    alertCreated: false,
    notificationsSent: 0,
    isNightTime: isNightTime(
      dayjs(signal.timestamp),
      vehicle.nightStartHour,
      vehicle.nightEndHour
    )
  };
}

function determineAlertType(input: ReportSignalInput): AlertType | null {
  if (input.externalPowerConnected === false) {
    return AlertType.EXTERNAL_POWER_DISCONNECT;
  }

  if (input.batteryVoltage !== undefined && input.batteryVoltage < config.alarm.lowBatteryVoltage) {
    return AlertType.BATTERY_VOLTAGE_ABNORMAL;
  }

  if (input.refrigerationRunning === false) {
    return AlertType.REFRIGERATION_STOP_REPORTING;
  }

  return null;
}

function processNightAlert(
  vehicle: Vehicle,
  signal: PowerSignal,
  alertType: AlertType
): SignalProcessingResult {
  const powerOffDuration = calculatePowerOffDuration(vehicle.id, signal, alertType);
  const nearDelivery = isNearDelivery(vehicle.deliveryEstimateTime);

  const classification = alertClassificationService.classifyAlert({
    alertType,
    powerOffDurationMinutes: powerOffDuration,
    goodsSensitivity: vehicle.goodsSensitivity,
    nearDelivery,
    currentTemperature: signal.temperature,
    batteryVoltage: signal.batteryVoltage
  });

  const existingAlert = alertRepository.getActiveAlertByVehicle(vehicle.id);
  let alert: AlertEvent;
  let isNewAlert = false;

  if (existingAlert) {
    alert = updateExistingAlert(existingAlert, classification, powerOffDuration, signal);
  } else {
    alert = alertRepository.createAlertEvent({
      vehicleId: vehicle.id,
      signalId: signal.id,
      alertType,
      alertLevel: classification.level,
      powerOffDurationMinutes: powerOffDuration,
      currentTemperature: signal.temperature,
      goodsSensitivity: vehicle.goodsSensitivity,
      nearDelivery,
      description: classification.description
    });
    isNewAlert = true;
  }

  let notificationsSent = 0;
  if (isNewAlert || shouldSendUpdateNotification(existingAlert, classification.level)) {
    const notifications = notificationService.dispatchAlertNotifications(alert.id);
    notificationsSent = notifications.length;
  }

  return {
    signal,
    alertCreated: isNewAlert,
    alert,
    notificationsSent,
    isNightTime: true
  };
}

function calculatePowerOffDuration(
  vehicleId: string,
  currentSignal: PowerSignal,
  alertType: AlertType
): number {
  const latestPowerOff = powerSignalRepository.getFirstPowerOffSignalSince(
    vehicleId,
    dayjs(currentSignal.timestamp).subtract(24, 'hour').toISOString()
  );

  if (latestPowerOff) {
    return calculateDurationMinutes(latestPowerOff.timestamp, currentSignal.timestamp);
  }

  return 0;
}

function updateExistingAlert(
  existingAlert: AlertEvent,
  classification: alertClassificationService.AlertClassificationResult,
  powerOffDuration: number,
  signal: PowerSignal
): AlertEvent {
  if (classification.level !== existingAlert.alertLevel) {
    const updated = alertRepository.updateAlertEventLevel(existingAlert.id, classification.level);
    if (updated) {
      return updated;
    }
  }

  return existingAlert;
}

function shouldSendUpdateNotification(
  existingAlert: AlertEvent | null,
  newLevel: AlertLevel
): boolean {
  if (!existingAlert) return false;

  const levelPriority: Record<AlertLevel, number> = {
    [AlertLevel.REMINDER]: 1,
    [AlertLevel.URGENT]: 2,
    [AlertLevel.CRITICAL]: 3
  };

  return levelPriority[newLevel] > levelPriority[existingAlert.alertLevel];
}

export function getSignalById(id: string): PowerSignal {
  const signal = powerSignalRepository.getPowerSignalById(id);
  if (!signal) {
    throw new NotFoundError('信号记录不存在');
  }
  return signal;
}

export function listSignals(
  page: number,
  pageSize: number,
  options?: {
    vehicleId?: string;
    alertType?: AlertType;
    startDate?: string;
    endDate?: string;
  }
) {
  return powerSignalRepository.listPowerSignals(page, pageSize, options);
}

export function getLatestSignalByVehicle(vehicleId: string): PowerSignal {
  const signal = powerSignalRepository.getLatestSignalByVehicle(vehicleId);
  if (!signal) {
    throw new NotFoundError('该车辆暂无信号记录');
  }
  return signal;
}
