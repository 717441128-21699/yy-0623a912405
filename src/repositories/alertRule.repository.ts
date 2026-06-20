import { getDatabase } from '../database';
import { AlertRuleConfig, AlertType, AlertLevel, GoodsSensitivity } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentTimestamp } from '../utils/time';

const db = getDatabase();

const levelPriority: Record<string, number> = {
  critical: 1,
  urgent: 2,
  reminder: 3
};

export function listAlertRules(alertType?: AlertType): AlertRuleConfig[] {
  let rules = db.getTable<AlertRuleConfig>('alertRules');

  if (alertType) {
    rules = rules.filter(r => r.alertType === alertType);
  }

  rules.sort((a, b) => {
    if (a.minPowerOffMinutes !== b.minPowerOffMinutes) {
      return a.minPowerOffMinutes - b.minPowerOffMinutes;
    }
    return levelPriority[b.targetLevel] - levelPriority[a.targetLevel];
  });

  return rules;
}

export function getEnabledRules(alertType?: AlertType): AlertRuleConfig[] {
  let rules = db.getTable<AlertRuleConfig>('alertRules').filter(r => r.enabled);

  if (alertType) {
    rules = rules.filter(r => r.alertType === alertType);
  }

  rules.sort((a, b) => {
    const levelDiff = levelPriority[a.targetLevel] - levelPriority[b.targetLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.minPowerOffMinutes - a.minPowerOffMinutes;
  });

  return rules;
}

export function getRuleById(id: string): AlertRuleConfig | null {
  return db.findById('alertRules', id) as AlertRuleConfig | null;
}

export interface CreateAlertRuleInput {
  name: string;
  alertType: AlertType;
  minPowerOffMinutes: number;
  goodsSensitivityRequired?: GoodsSensitivity;
  nearDeliveryRequired: boolean;
  targetLevel: AlertLevel;
  enabled?: boolean;
}

export function createAlertRule(input: CreateAlertRuleInput): AlertRuleConfig {
  const id = uuidv4();
  const now = getCurrentTimestamp();

  const rule: AlertRuleConfig = {
    id,
    name: input.name,
    alertType: input.alertType,
    minPowerOffMinutes: input.minPowerOffMinutes,
    goodsSensitivityRequired: input.goodsSensitivityRequired,
    nearDeliveryRequired: input.nearDeliveryRequired,
    targetLevel: input.targetLevel,
    enabled: input.enabled !== false,
    createdAt: now,
    updatedAt: now
  };

  db.insert('alertRules', rule);
  return rule;
}

export function updateAlertRule(id: string, input: Partial<CreateAlertRuleInput>): AlertRuleConfig | null {
  return db.update('alertRules', id, input) as AlertRuleConfig | null;
}

export function deleteAlertRule(id: string): void {
  db.remove('alertRules', id);
}
