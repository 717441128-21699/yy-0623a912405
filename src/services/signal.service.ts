import * as powerSignalRepository from '../repositories/powerSignal.repository';
import * as vehicleRepository from '../repositories/vehicle.repository';
import * as alertRepository from '../repositories/alert.repository';
import * as alertClassificationService from './alertClassification.service';
import * as notificationService from './notification.service';
import { PowerSignal, AlertType, Vehicle, AlertEvent, AlertLevel } from '../types';
import { config } from '../config';
import { NotFoundError } from '../middleware/errorHandler';
import { isNightTime, calculateDurationMinutes } from '../utils/time';
import { isNearDelivery } from '../utils/time';
import { getDatabase } from '../database';
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
  alertUpdated: boolean;
  alertResolved: boolean;
  alert?: AlertEvent;
  notificationsSent: number;
  isNightTime: boolean;
  previousAlertLevel?: AlertLevel;
  newAlertLevel?: AlertLevel;
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
  const recoveryType = determineRecoveryType(input);

  if (!alertType && recoveryType) {
    return handleRecoverySignal(vehicle, input, recoveryType);
  }

  if (!alertType && !recoveryType) {
    return handleNormalSignal(vehicle, input);
  }

  const signal = powerSignalRepository.createPowerSignal({
    vehicleId: vehicle.id,
    deviceId: input.deviceId,
    alertType: alertType!,
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
      alertUpdated: false,
      alertResolved: false,
      notificationsSent: 0,
      isNightTime: false
    };
  }

  return processNightAlert(vehicle, signal, alertType!);
}

function determineRecoveryType(input: ReportSignalInput): AlertType | null {
  if (input.externalPowerConnected === true) {
    const prevPowerOff = powerSignalRepository.hasPowerDisconnectedRecently(
      input.vehicleId || '',
      60
    );
    if (prevPowerOff) {
      return AlertType.EXTERNAL_POWER_DISCONNECT;
    }
  }

  if (input.batteryVoltage !== undefined && input.batteryVoltage >= config.alarm.lowBatteryVoltage) {
    const vehicleId = input.vehicleId;
    if (vehicleId) {
      const activeAlert = alertRepository.getActiveAlertByVehicleAndType(
        vehicleId,
        AlertType.BATTERY_VOLTAGE_ABNORMAL
      );
      if (activeAlert) {
        return AlertType.BATTERY_VOLTAGE_ABNORMAL;
      }
    }
  }

  if (input.refrigerationRunning === true) {
    const vehicleId = input.vehicleId;
    if (vehicleId) {
      const activeAlert = alertRepository.getActiveAlertByVehicleAndType(
        vehicleId,
        AlertType.REFRIGERATION_STOP_REPORTING
      );
      if (activeAlert) {
        return AlertType.REFRIGERATION_STOP_REPORTING;
      }
    }
  }

  return null;
}

function handleRecoverySignal(
  vehicle: Vehicle,
  input: ReportSignalInput,
  recoveryType: AlertType
): SignalProcessingResult {
  const signal = powerSignalRepository.createPowerSignal({
    vehicleId: vehicle.id,
    deviceId: input.deviceId,
    alertType: recoveryType,
    externalPowerConnected: input.externalPowerConnected ?? true,
    batteryVoltage: input.batteryVoltage,
    refrigerationRunning: input.refrigerationRunning ?? true,
    temperature: input.temperature,
    location: input.location,
    timestamp: input.timestamp
  });

  const activeAlert = alertRepository.getActiveAlertByVehicleAndType(vehicle.id, recoveryType);
  let resolvedAlert: AlertEvent | null = null;

  if (activeAlert) {
    resolvedAlert = alertRepository.resolveAlertEvent(activeAlert.id);
    console.log(`[告警恢复] 车辆 ${vehicle.plateNumber} 的 ${recoveryType} 告警已解除，持续 ${Math.floor(activeAlert.powerOffDurationMinutes)} 分钟`);
  }

  return {
    signal,
    alertCreated: false,
    alertUpdated: false,
    alertResolved: !!resolvedAlert,
    alert: resolvedAlert || undefined,
    notificationsSent: 0,
    isNightTime: isNightTime(
      dayjs(signal.timestamp),
      vehicle.nightStartHour,
      vehicle.nightEndHour
    )
  };
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

  const db = getDatabase();
  const allActiveAlerts = db.findAll(
    'alertEvents',
    (a: AlertEvent) => a.vehicleId === vehicle.id && a.status === 'active'
  ) as AlertEvent[];

  for (const alert of allActiveAlerts) {
    alertRepository.resolveAlertEvent(alert.id);
  }

  return {
    signal,
    alertCreated: false,
    alertUpdated: false,
    alertResolved: allActiveAlerts.length > 0,
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

  const existingAlert = alertRepository.getActiveAlertByVehicleAndType(vehicle.id, alertType);
  let alert: AlertEvent;
  let isNewAlert = false;
  let isUpdated = false;
  let previousLevel: AlertLevel | undefined;
  let newLevel: AlertLevel | undefined;

  if (existingAlert) {
    previousLevel = existingAlert.alertLevel;
    newLevel = classification.level;

    const updateResult = updateExistingAlert(
      existingAlert,
      classification,
      powerOffDuration,
      signal
    );
    alert = updateResult.alert;
    isUpdated = updateResult.updated;
  } else {
    alert = alertRepository.createAlertEvent({
      vehicleId: vehicle.id,
      signalId: signal.id,
      alertType,
      alertLevel: classification.level,
      powerOffDurationMinutes: powerOffDuration,
      currentTemperature: signal.temperature,
      currentBatteryVoltage: signal.batteryVoltage,
      goodsSensitivity: vehicle.goodsSensitivity,
      nearDelivery,
      description: classification.description
    });
    isNewAlert = true;
    newLevel = classification.level;
  }

  let notificationsSent = 0;
  const shouldSend = isNewAlert || (isUpdated && previousLevel && newLevel && previousLevel !== newLevel);

  if (shouldSend) {
    const isUpgrade = !isNewAlert && previousLevel !== newLevel;
    const notifications = notificationService.dispatchAlertNotifications(
      alert.id,
      isUpgrade,
      isUpgrade ? previousLevel : undefined
    );
    notificationsSent = notifications.length;
  }

  return {
    signal,
    alertCreated: isNewAlert,
    alertUpdated: isUpdated,
    alertResolved: false,
    alert,
    notificationsSent,
    isNightTime: true,
    previousAlertLevel: previousLevel,
    newAlertLevel: newLevel
  };
}

function calculatePowerOffDuration(
  vehicleId: string,
  currentSignal: PowerSignal,
  alertType: AlertType
): number {
  const activeAlert = alertRepository.getActiveAlertByVehicleAndType(vehicleId, alertType);

  if (activeAlert) {
    const lookupStartTime = dayjs(activeAlert.createdAt).subtract(5, 'second').toISOString();
    const firstSignal = getFirstAbnormalSignalSince(
      vehicleId,
      alertType,
      lookupStartTime
    );
    if (firstSignal) {
      return calculateDurationMinutes(firstSignal.timestamp, currentSignal.timestamp);
    }
  }

  return 0;
}

function getFirstAbnormalSignalSince(
  vehicleId: string,
  alertType: AlertType,
  sinceTime: string
): PowerSignal | null {
  const allSignals = powerSignalRepository.listPowerSignals(1, 1000, {
    vehicleId,
    alertType,
    startDate: sinceTime
  }).data;

  const abnormalSignals = allSignals.filter(s => {
    if (alertType === AlertType.EXTERNAL_POWER_DISCONNECT) {
      return !s.externalPowerConnected;
    }
    if (alertType === AlertType.BATTERY_VOLTAGE_ABNORMAL) {
      return s.batteryVoltage !== undefined && s.batteryVoltage < config.alarm.lowBatteryVoltage;
    }
    if (alertType === AlertType.REFRIGERATION_STOP_REPORTING) {
      return !s.refrigerationRunning;
    }
    return false;
  });

  if (abnormalSignals.length === 0) return null;
  return abnormalSignals[abnormalSignals.length - 1];
}

function updateExistingAlert(
  existingAlert: AlertEvent,
  classification: alertClassificationService.AlertClassificationResult,
  powerOffDuration: number,
  signal: PowerSignal
): { alert: AlertEvent; updated: boolean } {
  const hasLevelChange = classification.level !== existingAlert.alertLevel;
  const hasDurationChange = Math.abs(powerOffDuration - existingAlert.powerOffDurationMinutes) >= 1;
  const hasTempChange = signal.temperature !== undefined &&
    existingAlert.currentTemperature !== undefined &&
    Math.abs(signal.temperature - existingAlert.currentTemperature) >= 0.1;
  const hasVoltageChange = signal.batteryVoltage !== undefined &&
    existingAlert.currentBatteryVoltage !== undefined &&
    Math.abs(signal.batteryVoltage - existingAlert.currentBatteryVoltage) >= 0.1;

  const shouldUpdate = hasLevelChange || hasDurationChange || hasTempChange || hasVoltageChange ||
    (classification.description !== existingAlert.description);

  if (!shouldUpdate) {
    return { alert: existingAlert, updated: false };
  }

  const updated = alertRepository.updateAlertEventDetails(existingAlert.id, {
    alertLevel: classification.level,
    powerOffDurationMinutes: powerOffDuration,
    currentTemperature: signal.temperature,
    currentBatteryVoltage: signal.batteryVoltage,
    signalId: signal.id,
    nearDelivery: existingAlert.nearDelivery,
    description: classification.description
  });

  return {
    alert: updated || existingAlert,
    updated: true
  };
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
