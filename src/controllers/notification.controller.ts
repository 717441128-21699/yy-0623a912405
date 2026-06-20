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
    const result = notificationService.confirmNotification(req.params.id, confirmedBy, '接口确认');
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

export async function confirmNotificationWeb(req: Request, res: Response, next: NextFunction) {
  try {
    const result = notificationService.confirmNotification(req.params.id, '网页确认', '短信链接');

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>通知确认</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }
    .icon.success { background: #d4edda; color: #28a745; }
    .icon.info { background: #d1ecf1; color: #17a2b8; }
    .title {
      font-size: 24px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
    }
    .message {
      font-size: 16px;
      color: #666;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .info-box {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: left;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .info-item:last-child { margin-bottom: 0; }
    .info-label { color: #999; }
    .info-value { color: #333; font-weight: 500; }
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
    .status.confirmed { background: #d4edda; color: #28a745; }
    .footer {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${result.isFirstConfirm ? 'success' : 'info'}">
      ${result.isFirstConfirm ? '✓' : 'ℹ'}
    </div>
    <h1 class="title">${result.isFirstConfirm ? '确认成功' : '已确认过'}</h1>
    <p class="message">${result.message}</p>
    <div class="info-box">
      <div class="info-item">
        <span class="info-label">通知编号</span>
        <span class="info-value">${result.notification.id}</span>
      </div>
      <div class="info-item">
        <span class="info-label">告警编号</span>
        <span class="info-value">${result.notification.alertId}</span>
      </div>
      <div class="info-item">
        <span class="info-label">接收人</span>
        <span class="info-value">${result.notification.recipientName}</span>
      </div>
      <div class="info-item">
        <span class="info-label">当前状态</span>
        <span class="status confirmed">已确认</span>
      </div>
      ${result.notification.confirmedAt ? `
      <div class="info-item">
        <span class="info-label">确认时间</span>
        <span class="info-value">${new Date(result.notification.confirmedAt).toLocaleString('zh-CN')}</span>
      </div>
      ` : ''}
      ${result.notification.confirmedBy ? `
      <div class="info-item">
        <span class="info-label">确认人</span>
        <span class="info-value">${result.notification.confirmedBy}</span>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      冷藏车夜间断电告警系统 · ${new Date().getFullYear()}
    </div>
  </div>
</body>
</html>`;

    res.type('text/html; charset=utf-8');
    res.send(html);
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

export async function getConfirmationRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, ...query } = req.query as any;
    const result = notificationService.getConfirmationRecords(
      Number(page) || 1,
      Number(pageSize) || 20,
      query
    );
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

export async function exportConfirmationRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const { ...query } = req.query as any;
    const csvContent = notificationService.exportConfirmationRecordsCsv(query);

    const today = new Date().toISOString().split('T')[0];
    const filename = `通知确认明细_${today}.csv`;
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
}

export async function getNotificationStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = notificationService.getNotificationStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
}
