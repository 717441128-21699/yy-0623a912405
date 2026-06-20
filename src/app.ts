import express from 'express';
import cors from 'cors';
import vehicleRoutes from './routes/vehicle.routes';
import alertRoutes from './routes/alert.routes';
import notificationRoutes from './routes/notification.routes';
import signalRoutes from './routes/signal.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getDatabase } from './database';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: '冷藏车夜间断电告警服务运行中',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/vehicles', vehicleRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/signals', signalRoutes);

app.get('/api', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: '冷藏车夜间断电告警后端服务',
      description: '面向车联网平台、冷机设备商和中小冷链企业的告警中枢',
      modules: {
        vehicles: {
          path: '/api/vehicles',
          description: '车辆档案管理'
        },
        alerts: {
          path: '/api/alerts',
          description: '告警事件与规则管理'
        },
        notifications: {
          path: '/api/notifications',
          description: '通知分派与确认'
        },
        signals: {
          path: '/api/signals',
          description: '设备信号接入'
        }
      }
    }
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

getDatabase();

export default app;
