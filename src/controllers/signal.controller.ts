import { Request, Response, NextFunction } from 'express';
import * as signalService from '../services/signal.service';

export async function reportSignal(req: Request, res: Response, next: NextFunction) {
  try {
    const result = signalService.reportSignal(req.body);
    let message = '信号已接收';
    if (result.totalAlertsCreated > 0 && result.totalAlertsResolved > 0) {
      message = `信号已接收，生成 ${result.totalAlertsCreated} 条告警，解除 ${result.totalAlertsResolved} 条告警`;
    } else if (result.totalAlertsCreated > 0) {
      message = `信号已接收并生成 ${result.totalAlertsCreated} 条告警`;
    } else if (result.totalAlertsResolved > 0) {
      message = `信号已接收，解除 ${result.totalAlertsResolved} 条告警`;
    } else if (result.totalAlertsUpdated > 0) {
      message = `信号已接收，更新 ${result.totalAlertsUpdated} 条告警`;
    }
    res.status(201).json({
      success: true,
      data: result,
      message
    });
  } catch (err) {
    next(err);
  }
}

export async function getSignalById(req: Request, res: Response, next: NextFunction) {
  try {
    const signal = signalService.getSignalById(req.params.id);
    res.json({
      success: true,
      data: signal
    });
  } catch (err) {
    next(err);
  }
}

export async function listSignals(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, ...options } = req.query as any;
    const result = signalService.listSignals(Number(page), Number(pageSize), options);
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

export async function getLatestSignalByVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const signal = signalService.getLatestSignalByVehicle(req.params.vehicleId);
    res.json({
      success: true,
      data: signal
    });
  } catch (err) {
    next(err);
  }
}
