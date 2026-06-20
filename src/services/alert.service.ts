import * as alertRepository from '../repositories/alert.repository';
import * as alertRuleRepository from '../repositories/alertRule.repository';
import * as vehicleRepository from '../repositories/vehicle.repository';
import * as notificationRepository from '../repositories/notification.repository';
import { AlertEvent, AlertLevel, AlertType, PaginatedResult, AlertRuleConfig, GoodsSensitivity, VehicleAlertGroup, AlertSummary, TimelineEvent, NotificationStatus } from '../types';
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

function buildAlertSummary(alert: AlertEvent): AlertSummary {
  const notifications = notificationRepository.getNotificationsByAlertId(alert.id);
  const confirmedCount = notifications.filter(n => n.status === NotificationStatus.CONFIRMED).length;
  return {
    id: alert.id,
    alertType: alert.alertType,
    alertLevel: alert.alertLevel,
    status: alert.status,
    powerOffDurationMinutes: alert.powerOffDurationMinutes,
    currentTemperature: alert.currentTemperature,
    currentBatteryVoltage: alert.currentBatteryVoltage,
    description: alert.description,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
    notificationTotal: notifications.length,
    notificationConfirmed: confirmedCount
  };
}

function getHighestAlertLevel(alerts: AlertEvent[]): AlertLevel {
  const levels = [AlertLevel.REMINDER, AlertLevel.URGENT, AlertLevel.CRITICAL];
  let highest = AlertLevel.REMINDER;
  for (const alert of alerts) {
    if (levels.indexOf(alert.alertLevel) > levels.indexOf(highest)) {
      highest = alert.alertLevel;
    }
  }
  return highest;
}

export function getAlertsGroupedByVehicle(
  page: number,
  pageSize: number,
  options?: {
    status?: 'active' | 'resolved';
    alertType?: AlertType;
    startDate?: string;
    endDate?: string;
  }
): PaginatedResult<VehicleAlertGroup> {
  const allAlerts = alertRepository.listAlertEvents(1, 9999, options).data;
  const vehicleMap = new Map<string, AlertEvent[]>();

  for (const alert of allAlerts) {
    if (!vehicleMap.has(alert.vehicleId)) {
      vehicleMap.set(alert.vehicleId, []);
    }
    vehicleMap.get(alert.vehicleId)!.push(alert);
  }

  const groups: VehicleAlertGroup[] = [];
  for (const [vehicleId, alerts] of vehicleMap) {
    const vehicle = vehicleRepository.getVehicleById(vehicleId);
    if (!vehicle) continue;

    const sortedAlerts = alerts.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const alertSummaries = sortedAlerts.map(a => buildAlertSummary(a));
    const activeCount = sortedAlerts.filter(a => a.status === 'active').length;

    groups.push({
      vehicleId,
      plateNumber: vehicle.plateNumber,
      driverName: vehicle.driverName,
      driverPhone: vehicle.driverPhone,
      route: vehicle.route,
      goodsSensitivity: vehicle.goodsSensitivity,
      totalAlerts: alerts.length,
      activeAlerts: activeCount,
      highestLevel: getHighestAlertLevel(alerts),
      alerts: alertSummaries,
      lastAlertTime: sortedAlerts[0].createdAt
    });
  }

  groups.sort((a, b) => new Date(b.lastAlertTime).getTime() - new Date(a.lastAlertTime).getTime());

  const total = groups.length;
  const offset = (page - 1) * pageSize;
  const data = groups.slice(offset, offset + pageSize);

  return { data, total, page, pageSize };
}

export function getAlertTimeline(alertId: string): TimelineEvent[] {
  const alert = alertRepository.getAlertEventById(alertId);
  if (!alert) {
    throw new NotFoundError('告警事件不存在');
  }

  const events: TimelineEvent[] = [];

  events.push({
    id: `start-${alert.id}`,
    eventType: 'alert_start',
    timestamp: alert.createdAt,
    alertType: alert.alertType,
    alertLevel: alert.alertLevel,
    description: `告警首次触发，初始等级：${alert.alertLevel}`,
    details: {
      description: alert.description,
      initialTemperature: alert.currentTemperature,
      initialVoltage: alert.currentBatteryVoltage
    }
  });

  const notifications = notificationRepository.getNotificationsByAlertId(alert.id);
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let lastLevel = alert.alertLevel;
  const levelOrder = [AlertLevel.REMINDER, AlertLevel.URGENT, AlertLevel.CRITICAL];

  for (const notif of sortedNotifications) {
    if (levelOrder.indexOf(notif.alertLevel) > levelOrder.indexOf(lastLevel)) {
      events.push({
        id: `upgrade-${notif.id}`,
        eventType: 'level_upgrade',
        timestamp: notif.createdAt,
        alertType: alert.alertType,
        alertLevel: notif.alertLevel,
        previousLevel: lastLevel,
        description: `告警等级升级：${lastLevel} → ${notif.alertLevel}`,
        details: {
          notificationId: notif.id,
          recipientType: notif.recipientType
        }
      });
      lastLevel = notif.alertLevel;
    }

    events.push({
      id: `notif-${notif.id}`,
      eventType: 'notification_sent',
      timestamp: notif.sentAt || notif.createdAt,
      alertType: alert.alertType,
      alertLevel: notif.alertLevel,
      description: `向 ${notif.recipientName}（${notif.recipientType}）发送${notif.alertLevel}通知`,
      details: {
        notificationId: notif.id,
        recipientType: notif.recipientType,
        recipientName: notif.recipientName,
        recipientPhone: notif.recipientPhone,
        escalationLevel: notif.escalationLevel
      }
    });

    if (notif.status === NotificationStatus.CONFIRMED && notif.confirmedAt) {
      events.push({
        id: `confirm-${notif.id}`,
        eventType: 'notification_confirmed',
        timestamp: notif.confirmedAt,
        alertType: alert.alertType,
        alertLevel: notif.alertLevel,
        description: `${notif.recipientName} 确认收到通知（${notif.confirmedBy || '用户'}）`,
        details: {
          notificationId: notif.id,
          confirmedBy: notif.confirmedBy,
          recipientType: notif.recipientType
        }
      });
    }

    if (notif.status === NotificationStatus.ESCALATED && notif.escalatedTo) {
      events.push({
        id: `escalate-${notif.id}`,
        eventType: 'notification_escalated',
        timestamp: notif.createdAt,
        alertType: alert.alertType,
        alertLevel: notif.alertLevel,
        description: `通知未确认，升级给 ${notif.escalatedTo}`,
        details: {
          notificationId: notif.id,
          escalatedTo: notif.escalatedTo
        }
      });
    }
  }

  if (alert.status === 'resolved' && alert.resolvedAt) {
    events.push({
      id: `resolve-${alert.id}`,
      eventType: 'alert_resolved',
      timestamp: alert.resolvedAt,
      alertType: alert.alertType,
      alertLevel: alert.alertLevel,
      description: '告警已解除',
      details: {
        totalDurationMinutes: alert.powerOffDurationMinutes
      }
    });
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let seq = 1;
  return events.map(e => ({ ...e, id: `${alertId}-event-${seq++}` }));
}
