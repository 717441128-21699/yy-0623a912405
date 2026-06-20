import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = '资源未找到') {
    super(message, 404);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = '请求参数错误') {
    super(message, 400);
  }
}

export class ValidationError extends AppError {
  public errors: Record<string, string>;

  constructor(errors: Record<string, string>, message: string = '数据校验失败') {
    super(message, 422);
    this.errors = errors;
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err instanceof ValidationError ? { errors: err.errors } : undefined
    });
  }

  console.error('Unexpected error:', err);
  return res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `路由 ${req.method} ${req.path} 不存在`
  });
}
