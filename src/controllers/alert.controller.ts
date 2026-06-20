import { Request, Response, NextFunction } from 'express';
import * as alertService from '../services/alert.service';

export async function getAlertById(req: Request, res: Response, next: NextFunction) {
  try {
    const alert = alertService.getAlertById(req.params.id);
    res.json({
      success: true,
      data: alert
    });
  } catch (err) {
    next(err);
  }
}

export async function listAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, ...options } = req.query as any;
    const result = alertService.listAlerts(Number(page), Number(pageSize), options);
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

export async function resolveAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const alert = alertService.resolveAlert(req.params.id);
    res.json({
      success: true,
      data: alert,
      message: '告警已解除'
    });
  } catch (err) {
    next(err);
  }
}

export async function getAlertStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = alertService.getAlertStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
}

export async function listAlertRules(req: Request, res: Response, next: NextFunction) {
  try {
    const { alertType } = req.query as any;
    const rules = alertService.listAlertRules(alertType);
    res.json({
      success: true,
      data: rules
    });
  } catch (err) {
    next(err);
  }
}

export async function getAlertRule(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = alertService.getAlertRule(req.params.ruleId);
    res.json({
      success: true,
      data: rule
    });
  } catch (err) {
    next(err);
  }
}

export async function createAlertRule(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = alertService.createAlertRule(req.body);
    res.status(201).json({
      success: true,
      data: rule,
      message: '告警规则创建成功'
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAlertRule(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = alertService.updateAlertRule(req.params.ruleId, req.body);
    res.json({
      success: true,
      data: rule,
      message: '告警规则更新成功'
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAlertRule(req: Request, res: Response, next: NextFunction) {
  try {
    alertService.deleteAlertRule(req.params.ruleId);
    res.json({
      success: true,
      message: '告警规则删除成功'
    });
  } catch (err) {
    next(err);
  }
}
