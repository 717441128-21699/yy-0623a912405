import { Request, Response, NextFunction } from 'express';
import * as vehicleService from '../services/vehicle.service';

export async function createVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const vehicle = vehicleService.createVehicle(req.body);
    res.status(201).json({
      success: true,
      data: vehicle,
      message: '车辆创建成功'
    });
  } catch (err) {
    next(err);
  }
}

export async function getVehicleById(req: Request, res: Response, next: NextFunction) {
  try {
    const vehicle = vehicleService.getVehicleById(req.params.id);
    res.json({
      success: true,
      data: vehicle
    });
  } catch (err) {
    next(err);
  }
}

export async function listVehicles(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, keyword, goodsSensitivity } = req.query as any;
    const result = vehicleService.listVehicles(
      Number(page),
      Number(pageSize),
      keyword,
      goodsSensitivity
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

export async function updateVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const vehicle = vehicleService.updateVehicle(req.params.id, req.body);
    res.json({
      success: true,
      data: vehicle,
      message: '车辆更新成功'
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    vehicleService.deleteVehicle(req.params.id);
    res.json({
      success: true,
      message: '车辆删除成功'
    });
  } catch (err) {
    next(err);
  }
}
