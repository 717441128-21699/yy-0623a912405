import { Request, Response, NextFunction } from 'express';
import * as signalService from '../services/signal.service';

export async function reportSignal(req: Request, res: Response, next: NextFunction) {
  try {
    const result = signalService.reportSignal(req.body);
    res.status(201).json({
      success: true,
      data: result,
      message: result.alertCreated ? '信号已接收并生成告警' : '信号已接收'
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
