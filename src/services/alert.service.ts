import * as alertRepository from '../repositories/alert.repository';
import * as alertRuleRepository from '../repositories/alertRule.repository';
import { AlertEvent, AlertLevel, AlertType, PaginatedResult, AlertRuleConfig, GoodsSensitivity } from '../types';
import { NotFoundError } from '../middleware/errorHandler';

export function getAlertById(id: string): AlertEvent {
  const alert = alertRepository.getAlertEventById(id);
  if (!alert) {
    throw new NotFoundError('告警事件不存在');
  }
  return alert;
}

export function listAlerts(
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
  return alertRepository.listAlertEvents(page, pageSize, options);
}

export function resolveAlert(id: string): AlertEvent {
  const alert = alertRepository.resolveAlertEvent(id);
  if (!alert) {
    throw new NotFoundError('告警事件不存在');
  }
  return alert;
}

export function getAlertStats(): {
  total: number;
  active: number;
  critical: number;
  urgent: number;
  reminder: number;
  resolved: number;
} {
  const { getDatabase } = require('../database');
  const db = getDatabase();

  const alerts = db.getTable('alertEvents') as AlertEvent[];

  const total = alerts.length;
  const active = alerts.filter(a => a.status === 'active').length;
  const critical = alerts.filter(a => a.alertLevel === AlertLevel.CRITICAL && a.status === 'active').length;
  const urgent = alerts.filter(a => a.alertLevel === AlertLevel.URGENT && a.status === 'active').length;
  const reminder = alerts.filter(a => a.alertLevel === AlertLevel.REMINDER && a.status === 'active').length;
  const resolved = alerts.filter(a => a.status === 'resolved').length;

  return { total, active, critical, urgent, reminder, resolved };
}

export function listAlertRules(alertType?: AlertType): AlertRuleConfig[] {
  return alertRuleRepository.listAlertRules(alertType);
}

export function getAlertRule(id: string): AlertRuleConfig {
  const rule = alertRuleRepository.getRuleById(id);
  if (!rule) {
    throw new NotFoundError('告警规则不存在');
  }
  return rule;
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
  return alertRuleRepository.createAlertRule(input);
}

export function updateAlertRule(id: string, input: Partial<CreateAlertRuleInput>): AlertRuleConfig {
  const rule = alertRuleRepository.updateAlertRule(id, input);
  if (!rule) {
    throw new NotFoundError('告警规则不存在');
  }
  return rule;
}

export function deleteAlertRule(id: string): void {
  const rule = alertRuleRepository.getRuleById(id);
  if (!rule) {
    throw new NotFoundError('告警规则不存在');
  }
  alertRuleRepository.deleteAlertRule(id);
}
