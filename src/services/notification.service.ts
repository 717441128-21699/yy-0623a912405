import * as notificationRepository from '../repositories/notification.repository';
import * as vehicleRepository from '../repositories/vehicle.repository';
import * as alertRepository from '../repositories/alert.repository';
import { Notification, AlertLevel, Vehicle, AlertEvent, NotificationStatus } from '../types';
import { config } from '../config';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler';
import { getCurrentTimestamp, calculateDurationMinutes } from '../utils/time';

type RecipientType = 'driver' | 'dispatcher' | 'quality_controller' | 'shipper';

const escalationChain: RecipientType[] = ['driver', 'dispatcher', 'quality_controller', 'shipper'];

export interface DispatchNotificationInput {
  alertId: string;
}

export function dispatchAlertNotifications(alertId: string): Notification[] {
  const alert = alertRepository.getAlertEventById(alertId);
  if (!alert) {
    throw new NotFoundError('告警事件不存在');
  }

  const vehicle = vehicleRepository.getVehicleById(alert.vehicleId);
  if (!vehicle) {
    throw new NotFoundError('车辆不存在');
  }

  const recipients = getRecipientsForLevel(alert.alertLevel, vehicle);
  const notifications: Notification[] = [];

  for (const recipientType of recipients) {
    const recipientInfo = getRecipientInfo(recipientType, vehicle);
    const content = generateNotificationContent(alert, vehicle, recipientType);

    const notification = notificationRepository.createNotification({
      alertId: alert.id,
      vehicleId: vehicle.id,
      recipientType,
      recipientName: recipientInfo.name,
      recipientPhone: recipientInfo.phone,
      alertLevel: alert.alertLevel,
      content,
      escalationLevel: 0
    });

    sendNotification(notification);
    notifications.push(notification);
  }

  return notifications;
}

function getRecipientsForLevel(level: AlertLevel, _vehicle: Vehicle): RecipientType[] {
  switch (level) {
    case AlertLevel.REMINDER:
      return ['driver'];
    case AlertLevel.URGENT:
      return ['driver', 'dispatcher'];
    case AlertLevel.CRITICAL:
      return ['driver', 'dispatcher', 'quality_controller'];
    default:
      return ['driver'];
  }
}

function getRecipientInfo(
  type: RecipientType,
  vehicle: Vehicle
): { name: string; phone: string } {
  switch (type) {
    case 'driver':
      return { name: vehicle.driverName, phone: vehicle.driverPhone };
    case 'dispatcher':
      return { name: vehicle.dispatcherName, phone: vehicle.dispatcherPhone };
    case 'quality_controller':
      return { name: vehicle.qualityControllerName, phone: vehicle.qualityControllerPhone };
    case 'shipper':
      return { name: vehicle.shipperName, phone: vehicle.shipperPhone };
    default:
      return { name: '', phone: '' };
  }
}

function generateNotificationContent(
  alert: AlertEvent,
  vehicle: Vehicle,
  recipientType: RecipientType
): string {
  const levelText: Record<AlertLevel, string> = {
    [AlertLevel.REMINDER]: '提醒',
    [AlertLevel.URGENT]: '紧急',
    [AlertLevel.CRITICAL]: '【重大告警】'
  };

  const greeting = getRecipientGreeting(recipientType, vehicle);

  let content = `${levelText[alert.alertLevel]}${greeting}\n`;
  content += `车牌号：${vehicle.plateNumber}\n`;
  content += `司机：${vehicle.driverName}\n`;
  content += alert.description + '\n';
  content += `当前温度：${alert.currentTemperature?.toFixed(1) || '--'}°C\n`;
  content += `货品温区：${vehicle.temperatureZone || '--'}\n`;
  content += `已断电时长：${Math.floor(alert.powerOffDurationMinutes)} 分钟\n`;
  content += `\n请点击确认收到：/api/notifications/{id}/confirm`;

  return content;
}

function getRecipientGreeting(type: RecipientType, vehicle: Vehicle): string {
  switch (type) {
    case 'driver':
      return `${vehicle.driverName}师傅`;
    case 'dispatcher':
      return vehicle.dispatcherName ? `${vehicle.dispatcherName}调度` : '调度员';
    case 'quality_controller':
      return vehicle.qualityControllerName ? `${vehicle.qualityControllerName}质控` : '质控员';
    case 'shipper':
      return vehicle.shipperName ? `${vehicle.shipperName}货主` : '货主';
    default:
      return '';
  }
}

async function sendNotification(notification: Notification): Promise<void> {
  try {
    console.log(`[通知推送] 向 ${notification.recipientName} (${notification.recipientPhone}) 发送 ${notification.alertLevel} 告警通知`);
    console.log(`[通知内容] ${notification.content.substring(0, 100)}...`);

    notificationRepository.markNotificationSent(notification.id);
  } catch (error) {
    console.error('发送通知失败:', error);
  }
}

export function confirmNotification(id: string, confirmedBy?: string): Notification {
  const notification = notificationRepository.getNotificationById(id);
  if (!notification) {
    throw new NotFoundError('通知不存在');
  }

  if (notification.status === NotificationStatus.CONFIRMED) {
    throw new BadRequestError('该通知已确认');
  }

  const result = notificationRepository.confirmNotification(id, confirmedBy);
  if (!result) {
    throw new NotFoundError('通知不存在');
  }

  checkAlertAllConfirmed(notification.alertId);

  return result;
}

function checkAlertAllConfirmed(alertId: string): void {
  const notifications = notificationRepository.getNotificationsByAlertId(alertId);
  const allConfirmed = notifications.every(n => n.status === NotificationStatus.CONFIRMED);

  if (allConfirmed && notifications.length > 0) {
    console.log(`告警 ${alertId} 的所有通知已确认`);
  }
}

export function escalateNotification(id: string): Notification {
  const notification = notificationRepository.getNotificationById(id);
  if (!notification) {
    throw new NotFoundError('通知不存在');
  }

  const vehicle = vehicleRepository.getVehicleById(notification.vehicleId);
  if (!vehicle) {
    throw new NotFoundError('车辆不存在');
  }

  const nextRecipientIndex = escalationChain.indexOf(notification.recipientType as RecipientType) + 1;
  if (nextRecipientIndex >= escalationChain.length) {
    throw new BadRequestError('已到达最高升级级别，无法继续升级');
  }

  const nextRecipientType = escalationChain[nextRecipientIndex];
  const recipientInfo = getRecipientInfo(nextRecipientType, vehicle);

  const alert = alertRepository.getAlertEventById(notification.alertId);
  if (!alert) {
    throw new NotFoundError('告警事件不存在');
  }

  const content = generateNotificationContent(alert, vehicle, nextRecipientType)
    + `\n\n【升级通知】原通知发给 ${notification.recipientName} 未及时确认，已升级至您`;

  const newNotification = notificationRepository.createNotification({
    alertId: notification.alertId,
    vehicleId: notification.vehicleId,
    recipientType: nextRecipientType,
    recipientName: recipientInfo.name,
    recipientPhone: recipientInfo.phone,
    alertLevel: notification.alertLevel,
    content,
    escalationLevel: notification.escalationLevel + 1
  });

  notificationRepository.markNotificationEscalated(notification.id, nextRecipientType);

  sendNotification(newNotification);

  return newNotification;
}

export function processEscalationCheck(): void {
  const timeoutMinutes = config.notification.confirmationTimeoutMinutes;
  const unconfirmed = notificationRepository.getUnconfirmedNotifications(timeoutMinutes);

  for (const notification of unconfirmed) {
    try {
      const duration = calculateDurationMinutes(notification.sentAt || notification.createdAt);
      if (duration >= timeoutMinutes) {
        console.log(`通知 ${notification.id} 超过 ${timeoutMinutes} 分钟未确认，执行升级`);
        escalateNotification(notification.id);
      }
    } catch (error) {
      console.error('处理通知升级失败:', error);
    }
  }
}

export function getNotificationById(id: string): Notification {
  const notification = notificationRepository.getNotificationById(id);
  if (!notification) {
    throw new NotFoundError('通知不存在');
  }
  return notification;
}

export function listNotifications(
  page: number,
  pageSize: number,
  options?: {
    alertId?: string;
    vehicleId?: string;
    status?: NotificationStatus;
    alertLevel?: AlertLevel;
    recipientType?: string;
  }
) {
  return notificationRepository.listNotifications(page, pageSize, options);
}

export function getNotificationsByAlertId(alertId: string): Notification[] {
  return notificationRepository.getNotificationsByAlertId(alertId);
}
