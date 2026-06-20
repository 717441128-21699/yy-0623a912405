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

export function dispatchAlertNotifications(
  alertId: string,
  isUpgrade: boolean = false,
  previousLevel?: AlertLevel
): Notification[] {
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

    let notification = notificationRepository.createNotification({
      alertId: alert.id,
      vehicleId: vehicle.id,
      recipientType,
      recipientName: recipientInfo.name,
      recipientPhone: recipientInfo.phone,
      alertLevel: alert.alertLevel,
      content: '',
      escalationLevel: 0
    });

    const content = generateNotificationContent(
      alert,
      vehicle,
      recipientType,
      notification.id,
      isUpgrade,
      previousLevel
    );

    notification = notificationRepository.updateNotificationContent(notification.id, content) || notification;

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
  recipientType: RecipientType,
  notificationId: string,
  isUpgrade: boolean = false,
  previousLevel?: AlertLevel
): string {
  const levelText: Record<AlertLevel, string> = {
    [AlertLevel.REMINDER]: '提醒',
    [AlertLevel.URGENT]: '紧急',
    [AlertLevel.CRITICAL]: '【重大告警】'
  };

  const greeting = getRecipientGreeting(recipientType, vehicle);

  let content = '';

  if (isUpgrade && previousLevel) {
    const previousLevelText = levelText[previousLevel];
    content += `⚠️ 告警已升级 ⚠️\n`;
    content += `等级变更: ${previousLevelText} → ${levelText[alert.alertLevel]}\n\n`;
  }

  content += `${levelText[alert.alertLevel]}${greeting}\n`;
  content += `车牌号：${vehicle.plateNumber}\n`;
  content += `司机：${vehicle.driverName}\n`;
  content += `告警编号：${alert.id}\n`;
  content += `${alert.description}\n`;
  if (alert.currentBatteryVoltage !== undefined) {
    content += `当前电压：${alert.currentBatteryVoltage.toFixed(1)}V\n`;
  }
  content += `当前温度：${alert.currentTemperature?.toFixed(1) || '--'}°C\n`;
  content += `货品温区：${vehicle.temperatureZone || '--'}\n`;
  content += `已持续时长：${Math.floor(alert.powerOffDurationMinutes)} 分钟\n`;
  content += `告警时间：${new Date(alert.createdAt).toLocaleString('zh-CN')}\n`;
  content += `\n请点击确认收到：${config.baseUrl}/api/notifications/${notificationId}/confirm\n`;
  content += `通知编号：${notificationId}\n`;

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

export interface ConfirmResult {
  notification: Notification;
  isFirstConfirm: boolean;
  message: string;
}

export function confirmNotification(id: string, confirmedBy?: string): ConfirmResult {
  const notification = notificationRepository.getNotificationById(id);
  if (!notification) {
    throw new NotFoundError('通知不存在，请检查通知编号是否正确');
  }

  if (notification.status === NotificationStatus.CONFIRMED) {
    const confirmTime = notification.confirmedAt
      ? new Date(notification.confirmedAt).toLocaleString('zh-CN')
      : '之前';
    return {
      notification,
      isFirstConfirm: false,
      message: `该通知已于 ${confirmTime} 由 ${notification.confirmedBy || '用户'} 确认，无需重复操作`
    };
  }

  if (notification.status === NotificationStatus.ESCALATED) {
    throw new BadRequestError('该通知已升级，无法再确认，请查看最新通知');
  }

  const result = notificationRepository.confirmNotification(id, confirmedBy);
  if (!result) {
    throw new NotFoundError('通知不存在');
  }

  checkAlertAllConfirmed(notification.alertId);

  return {
    notification: result,
    isFirstConfirm: true,
    message: '通知确认成功，感谢您的及时处理'
  };
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

  let newNotification = notificationRepository.createNotification({
    alertId: notification.alertId,
    vehicleId: notification.vehicleId,
    recipientType: nextRecipientType,
    recipientName: recipientInfo.name,
    recipientPhone: recipientInfo.phone,
    alertLevel: notification.alertLevel,
    content: '',
    escalationLevel: notification.escalationLevel + 1
  });

  const content = generateNotificationContent(
    alert,
    vehicle,
    nextRecipientType,
    newNotification.id,
    true,
    notification.alertLevel
  ) + `\n\n【升级通知】原通知发给 ${notification.recipientName} 未及时确认，已升级至您`;

  newNotification = notificationRepository.updateNotificationContent(newNotification.id, content) || newNotification;

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

export interface ConfirmationRecordQuery {
  vehicleId?: string;
  alertId?: string;
  alertType?: string;
  status?: NotificationStatus;
  startDate?: string;
  endDate?: string;
  confirmedBy?: string;
}

export function getConfirmationRecords(
  page: number,
  pageSize: number,
  query: ConfirmationRecordQuery
) {
  const allNotifications = notificationRepository.listNotifications(1, 9999, {
    vehicleId: query.vehicleId,
    alertId: query.alertId,
    status: query.status
  } as any).data;

  let filtered = allNotifications;

  if (query.alertType) {
    filtered = filtered.filter(n => {
      const alert = alertRepository.getAlertEventById(n.alertId);
      return alert && alert.alertType === query.alertType;
    });
  }

  if (query.startDate) {
    filtered = filtered.filter(n => n.createdAt >= query.startDate!);
  }
  if (query.endDate) {
    const endOfDay = new Date(query.endDate);
    endOfDay.setHours(23, 59, 59, 999);
    filtered = filtered.filter(n => n.createdAt <= endOfDay.toISOString());
  }

  if (query.confirmedBy) {
    filtered = filtered.filter(n =>
      n.confirmedBy && n.confirmedBy.toLowerCase().includes(query.confirmedBy!.toLowerCase())
    );
  }

  const records = filtered.map(n => {
    const alert = alertRepository.getAlertEventById(n.alertId);
    const vehicle = vehicleRepository.getVehicleById(n.vehicleId);
    return {
      notificationId: n.id,
      alertId: n.alertId,
      alertType: alert?.alertType,
      alertLevel: n.alertLevel,
      vehicleId: n.vehicleId,
      plateNumber: vehicle?.plateNumber || '',
      recipientType: n.recipientType,
      recipientName: n.recipientName,
      recipientPhone: n.recipientPhone,
      status: n.status,
      sentAt: n.sentAt,
      confirmedAt: n.confirmedAt,
      confirmedBy: n.confirmedBy,
      escalationLevel: n.escalationLevel
    };
  });

  records.sort((a, b) =>
    new Date(b.sentAt || b.notificationId).getTime() - new Date(a.sentAt || a.notificationId).getTime()
  );

  const total = records.length;
  const offset = (page - 1) * pageSize;
  const data = records.slice(offset, offset + pageSize);

  return { data, total, page, pageSize };
}

export function exportConfirmationRecordsCsv(query: ConfirmationRecordQuery): string {
  const result = getConfirmationRecords(1, 9999, query);

  const headers = [
    '通知编号',
    '告警编号',
    '告警类型',
    '告警等级',
    '车牌号',
    '接收角色',
    '接收人',
    '接收电话',
    '状态',
    '发送时间',
    '确认时间',
    '确认人',
    '升级级别'
  ];

  const alertTypeMap: Record<string, string> = {
    'external_power_disconnect': '外接电断开',
    'battery_voltage_abnormal': '车载电压异常',
    'refrigeration_stop_reporting': '冷机停止上报'
  };

  const alertLevelMap: Record<string, string> = {
    'reminder': '提醒',
    'urgent': '紧急',
    'critical': '重大'
  };

  const recipientTypeMap: Record<string, string> = {
    'driver': '司机',
    'dispatcher': '调度',
    'quality_controller': '质控',
    'shipper': '货主'
  };

  const statusMap: Record<string, string> = {
    'pending': '待发送',
    'sent': '已发送',
    'confirmed': '已确认',
    'failed': '发送失败',
    'escalated': '已升级'
  };

  const rows = result.data.map(r => [
    r.notificationId,
    r.alertId,
    alertTypeMap[r.alertType || ''] || r.alertType || '',
    alertLevelMap[r.alertLevel] || r.alertLevel,
    r.plateNumber,
    recipientTypeMap[r.recipientType] || r.recipientType,
    r.recipientName,
    r.recipientPhone,
    statusMap[r.status] || r.status,
    r.sentAt ? new Date(r.sentAt).toLocaleString('zh-CN') : '',
    r.confirmedAt ? new Date(r.confirmedAt).toLocaleString('zh-CN') : '',
    r.confirmedBy || '',
    r.escalationLevel
  ]);

  const csvContent = [headers.join(','), ...rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  )].join('\n');

  return '\uFEFF' + csvContent;
}

export function getNotificationStats(): {
  total: number;
  pending: number;
  sent: number;
  confirmed: number;
  failed: number;
  escalated: number;
  confirmationRate: number;
} {
  const { getDatabase } = require('../database');
  const db = getDatabase();
  const notifications = db.getTable('notifications') as Notification[];

  const total = notifications.length;
  const pending = notifications.filter(n => n.status === NotificationStatus.PENDING).length;
  const sent = notifications.filter(n => n.status === NotificationStatus.SENT).length;
  const confirmed = notifications.filter(n => n.status === NotificationStatus.CONFIRMED).length;
  const failed = notifications.filter(n => n.status === NotificationStatus.FAILED).length;
  const escalated = notifications.filter(n => n.status === NotificationStatus.ESCALATED).length;

  const sentAndConfirmed = sent + confirmed + escalated;
  const confirmationRate = sentAndConfirmed > 0 ? Math.round((confirmed / sentAndConfirmed) * 100) / 100 : 0;

  return { total, pending, sent, confirmed, failed, escalated, confirmationRate };
}
