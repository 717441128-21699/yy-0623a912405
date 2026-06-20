import { AlertLevel, AlertType, GoodsSensitivity, Vehicle } from '../types';
import * as alertRuleRepository from '../repositories/alertRule.repository';

export interface AlertClassificationInput {
  alertType: AlertType;
  powerOffDurationMinutes: number;
  goodsSensitivity: GoodsSensitivity;
  nearDelivery: boolean;
  currentTemperature?: number;
  batteryVoltage?: number;
}

export interface AlertClassificationResult {
  level: AlertLevel;
  matchedRuleId?: string;
  matchedRuleName?: string;
  description: string;
}

const levelPriority: Record<AlertLevel, number> = {
  [AlertLevel.REMINDER]: 1,
  [AlertLevel.URGENT]: 2,
  [AlertLevel.CRITICAL]: 3
};

export function classifyAlert(input: AlertClassificationInput): AlertClassificationResult {
  const rules = alertRuleRepository.getEnabledRules(input.alertType);

  let highestLevel: AlertLevel = AlertLevel.REMINDER;
  let matchedRule: typeof rules[0] | undefined;

  for (const rule of rules) {
    if (matchesRule(rule, input)) {
      if (levelPriority[rule.targetLevel] > levelPriority[highestLevel]) {
        highestLevel = rule.targetLevel;
        matchedRule = rule;
      }
    }
  }

  const description = generateAlertDescription(input, highestLevel);

  return {
    level: highestLevel,
    matchedRuleId: matchedRule?.id,
    matchedRuleName: matchedRule?.name,
    description
  };
}

function matchesRule(
  rule: ReturnType<typeof alertRuleRepository.listAlertRules>[0],
  input: AlertClassificationInput
): boolean {
  if (input.powerOffDurationMinutes < rule.minPowerOffMinutes) {
    return false;
  }

  if (rule.goodsSensitivityRequired && rule.goodsSensitivityRequired !== input.goodsSensitivity) {
    return false;
  }

  if (rule.nearDeliveryRequired && !input.nearDelivery) {
    return false;
  }

  return true;
}

function generateAlertDescription(
  input: AlertClassificationInput,
  level: AlertLevel
): string {
  const levelText: Record<AlertLevel, string> = {
    [AlertLevel.REMINDER]: '提醒',
    [AlertLevel.URGENT]: '紧急',
    [AlertLevel.CRITICAL]: '重大'
  };

  const typeText: Record<AlertType, string> = {
    [AlertType.EXTERNAL_POWER_DISCONNECT]: '外接电源断开',
    [AlertType.BATTERY_VOLTAGE_ABNORMAL]: '车载电压异常',
    [AlertType.REFRIGERATION_STOP_REPORTING]: '冷机停止上报'
  };

  let desc = `【${levelText[level]}】${typeText[input.alertType]}`;
  desc += `，已持续 ${Math.floor(input.powerOffDurationMinutes)} 分钟`;

  if (input.currentTemperature !== undefined) {
    desc += `，当前温度 ${input.currentTemperature.toFixed(1)}°C`;
  }

  if (input.batteryVoltage !== undefined) {
    desc += `，电压 ${input.batteryVoltage.toFixed(1)}V`;
  }

  if (input.nearDelivery) {
    desc += '，临近交付时间';
  }

  return desc;
}

export function isNightTimeAlert(vehicle: Vehicle, timestamp: Date = new Date()): boolean {
  const hour = timestamp.getHours();
  const startHour = vehicle.nightStartHour;
  const endHour = vehicle.nightEndHour;

  if (startHour > endHour) {
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

export function calculateSensitivityWeight(sensitivity: GoodsSensitivity): number {
  switch (sensitivity) {
    case GoodsSensitivity.HIGH:
      return 1.5;
    case GoodsSensitivity.MEDIUM:
      return 1.0;
    case GoodsSensitivity.LOW:
      return 0.5;
    default:
      return 1.0;
  }
}
