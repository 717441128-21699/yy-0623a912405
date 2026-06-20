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

export interface BatchSignalProcessingResult {
  signals: PowerSignal[];
  results: SignalProcessingResult[];
  totalAlertsCreated: number;
  totalAlertsUpdated: number;
  totalAlertsResolved: number;
  totalNotificationsSent: number;
}

export function reportSignal(input: ReportSignalInput): BatchSignalProcessingResult {
  let vehicle: Vehicle | null = null;

  if (input.vehicleId) {
    vehicle = vehicleRepository.getVehicleById(input.vehicleId);
  } else if (input.plateNumber) {
    vehicle = vehicleRepository.getVehicleByPlateNumber(input.plateNumber);
  }

  if (!vehicle) {
    throw new NotFoundError('车辆不存在，请先创建车辆档案');
  }

  const alertTypes = determineAlertType(input);
  const recoveryTypes = determineRecoveryType(input);

  const results: SignalProcessingResult[] = [];
  const signals: PowerSignal[] = [];

  if (recoveryTypes.length > 0) {
    for (const recoveryType of recoveryTypes) {
      if (!alertTypes.includes(recoveryType)) {
        const result = handleRecoverySignal(vehicle, input, recoveryType);
        results.push(result);
        signals.push(result.signal);
      }
    }
  }

  if (alertTypes.length > 0) {
    for (const alertType of alertTypes) {
      const signal = powerSignalRepository.createPowerSignal({
        vehicleId: vehicle.id,
        deviceId: input.deviceId,
        alertType: alertType,
        externalPowerConnected: input.externalPowerConnected ?? true,
        batteryVoltage: input.batteryVoltage,
        refrigerationRunning: input.refrigerationRunning ?? true,
        temperature: input.temperature,
        location: input.location,
        timestamp: input.timestamp
      });
      signals.push(signal);

      const isNight = isNightTime(
        dayjs(signal.timestamp),
        vehicle.nightStartHour,
        vehicle.nightEndHour
      );

      if (!isNight) {
        results.push({
          signal,
          alertCreated: false,
          alertUpdated: false,
          alertResolved: false,
          notificationsSent: 0,
          isNightTime: false
        });
      } else {
        const result = processNightAlert(vehicle, signal, alertType);
        results.push(result);
      }
    }
  }

  if (alertTypes.length === 0 && recoveryTypes.length === 0) {
    const result = handleNormalSignal(vehicle, input);
    results.push(result);
    signals.push(result.signal);
  }

  return {
    signals,
    results,
    totalAlertsCreated: results.filter(r => r.alertCreated).length,
    totalAlertsUpdated: results.filter(r => r.alertUpdated).length,
    totalAlertsResolved: results.filter(r => r.alertResolved).length,
    totalNotificationsSent: results.reduce((sum, r) => sum + r.notificationsSent, 0)
  };
}

function determineRecoveryType(input: ReportSignalInput): AlertType[] {
  const types: AlertType[] = [];
  const vehicleId = input.vehicleId || (input.plateNumber ? vehicleRepository.getVehicleByPlateNumber(input.plateNumber)?.id : undefined);

  if (!vehicleId) return types;

  if (input.externalPowerConnected === true) {
    const activeAlert = alertRepository.getActiveAlertByVehicleAndType(
      vehicleId,
      AlertType.EXTERNAL_POWER_DISCONNECT
    );
    if (activeAlert) {
      types.push(AlertType.EXTERNAL_POWER_DISCONNECT);
    }
  }

  if (input.batteryVoltage !== undefined && input.batteryVoltage >= config.alarm.lowBatteryVoltage) {
    const activeAlert = alertRepository.getActiveAlertByVehicleAndType(
      vehicleId,
      AlertType.BATTERY_VOLTAGE_ABNORMAL
    );
    if (activeAlert) {
      types.push(AlertType.BATTERY_VOLTAGE_ABNORMAL);
    }
  }

  if (input.refrigerationRunning === true) {
    const activeAlert = alertRepository.getActiveAlertByVehicleAndType(
      vehicleId,
      AlertType.REFRIGERATION_STOP_REPORTING
    );
    if (activeAlert) {
      types.push(AlertType.REFRIGERATION_STOP_REPORTING);
    }
  }

  return types;
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

  return {
    signal,
    alertCreated: false,
    alertUpdated: false,
    alertResolved: false,
    notificationsSent: 0,
    isNightTime: isNightTime(
      dayjs(signal.timestamp),
      vehicle.nightStartHour,
      vehicle.nightEndHour
    )
  };
}

function determineAlertType(input: ReportSignalInput): AlertType[] {
  const types: AlertType[] = [];

  if (input.externalPowerConnected === false) {
    types.push(AlertType.EXTERNAL_POWER_DISCONNECT);
  }

  if (input.batteryVoltage !== undefined && input.batteryVoltage < config.alarm.lowBatteryVoltage) {
    types.push(AlertType.BATTERY_VOLTAGE_ABNORMAL);
  }

  if (input.refrigerationRunning === false) {
    types.push(AlertType.REFRIGERATION_STOP_REPORTING);
  }

  return types;
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
      description: classification.description,
      signalTimestamp: signal.timestamp
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
      isUpgrade ? previousLevel : undefined,
      signal.timestamp
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
