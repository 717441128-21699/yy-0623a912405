import { getDatabase } from '../database';
import { Notification, NotificationStatus, AlertLevel, PaginatedResult } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentTimestamp } from '../utils/time';

const db = getDatabase();

export interface CreateNotificationInput {
  alertId: string;
  vehicleId: string;
  recipientType: 'driver' | 'dispatcher' | 'quality_controller' | 'shipper';
  recipientName?: string;
  recipientPhone?: string;
  alertLevel: AlertLevel;
  content: string;
  escalationLevel?: number;
}

export function createNotification(input: CreateNotificationInput): Notification {
  const id = uuidv4();
  const now = getCurrentTimestamp();

  const notification: Notification = {
    id,
    alertId: input.alertId,
    vehicleId: input.vehicleId,
    recipientType: input.recipientType,
    recipientName: input.recipientName || '',
    recipientPhone: input.recipientPhone || '',
    alertLevel: input.alertLevel,
    content: input.content,
    status: NotificationStatus.PENDING,
    escalationLevel: input.escalationLevel || 0,
    createdAt: now
  };

  db.insert('notifications', notification);
  return notification;
}

export function getNotificationById(id: string): Notification | null {
  return db.findById('notifications', id) as Notification | null;
}

export function getNotificationsByAlertId(alertId: string): Notification[] {
  const notifications = db.findAll(
    'notifications',
    (n: Notification) => n.alertId === alertId
  ) as Notification[];
  return notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
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
): PaginatedResult<Notification> {
  let notifications = db.getTable<Notification>('notifications');

  if (options?.alertId) {
    notifications = notifications.filter(n => n.alertId === options.alertId);
  }
  if (options?.vehicleId) {
    notifications = notifications.filter(n => n.vehicleId === options.vehicleId);
  }
  if (options?.status) {
    notifications = notifications.filter(n => n.status === options.status);
  }
  if (options?.alertLevel) {
    notifications = notifications.filter(n => n.alertLevel === options.alertLevel);
  }
  if (options?.recipientType) {
    notifications = notifications.filter(n => n.recipientType === options.recipientType);
  }

  notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const total = notifications.length;
  const offset = (page - 1) * pageSize;
  const data = notifications.slice(offset, offset + pageSize);

  return { data, total, page, pageSize };
}

export function markNotificationSent(id: string): Notification | null {
  const now = getCurrentTimestamp();
  return db.update('notifications', id, {
    status: NotificationStatus.SENT,
    sentAt: now
  }) as Notification | null;
}

export function confirmNotification(id: string, confirmedBy?: string): Notification | null {
  const now = getCurrentTimestamp();
  return db.update('notifications', id, {
    status: NotificationStatus.CONFIRMED,
    confirmedAt: now,
    confirmedBy: confirmedBy || null
  }) as Notification | null;
}

export function markNotificationEscalated(id: string, escalatedTo: string): Notification | null {
  return db.update('notifications', id, {
    status: NotificationStatus.ESCALATED,
    escalatedTo
  }) as Notification | null;
}

export function getPendingNotifications(): Notification[] {
  const notifications = db.findAll(
    'notifications',
    (n: Notification) => n.status === NotificationStatus.PENDING || n.status === NotificationStatus.SENT
  ) as Notification[];
  return notifications.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function getUnconfirmedNotifications(olderThanMinutes: number): Notification[] {
  const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();
  const notifications = db.findAll(
    'notifications',
    (n: Notification) =>
      n.status === NotificationStatus.SENT &&
      !!n.sentAt &&
      n.sentAt <= threshold
  ) as Notification[];
  return notifications.sort(
    (a, b) => new Date(a.sentAt || a.createdAt).getTime() - new Date(b.sentAt || b.createdAt).getTime()
  );
}

export function getLatestNotificationByAlertAndType(
  alertId: string,
  recipientType: string
): Notification | null {
  const notifications = db.findAll(
    'notifications',
    (n: Notification) => n.alertId === alertId && n.recipientType === recipientType
  ) as Notification[];
  if (notifications.length === 0) return null;
  notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return notifications[0];
}
