import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service';

export async function getNotificationById(req: Request, res: Response, next: NextFunction) {
  try {
    const notification = notificationService.getNotificationById(req.params.id);
    res.json({
      success: true,
      data: notification
    });
  } catch (err) {
    next(err);
  }
}

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, ...options } = req.query as any;
    const result = notificationService.listNotifications(Number(page), Number(pageSize), options);
    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const { confirmedBy } = req.body;
    const result = notificationService.confirmNotification(req.params.id, confirmedBy);
    res.json({
      success: true,
      data: result.notification,
      message: result.message,
      isFirstConfirm: result.isFirstConfirm
    });
  } catch (err) {
    next(err);
  }
}

export async function dispatchNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const { alertId } = req.body;
    const notifications = notificationService.dispatchAlertNotifications(alertId);
    res.status(201).json({
      success: true,
      data: notifications,
      message: '通知分派成功',
      count: notifications.length
    });
  } catch (err) {
    next(err);
  }
}

export async function escalateNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const notification = notificationService.escalateNotification(req.params.id);
    res.json({
      success: true,
      data: notification,
      message: '通知已升级'
    });
  } catch (err) {
    next(err);
  }
}

export async function getNotificationsByAlertId(req: Request, res: Response, next: NextFunction) {
  try {
    const notifications = notificationService.getNotificationsByAlertId(req.params.alertId);
    res.json({
      success: true,
      data: notifications
    });
  } catch (err) {
    next(err);
  }
}
