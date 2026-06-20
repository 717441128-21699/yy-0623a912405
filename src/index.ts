import app from './app';
import { config } from './config';
import { getDatabase, closeDatabase } from './database';
import * as notificationService from './services/notification.service';

const PORT = config.port;

getDatabase();

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  冷藏车夜间断电告警后端服务                                   ║
║  Cold-Chain Power Alarm Service                             ║
║                                                              ║
║  服务已启动，监听端口: ${PORT}                                  ║
║  健康检查: http://localhost:${PORT}/api/health                 ║
║  API 文档: http://localhost:${PORT}/api                        ║
║                                                              ║
║  模块:                                                       ║
║    - /api/vehicles      车辆档案管理                          ║
║    - /api/alerts        告警事件与规则                        ║
║    - /api/notifications 通知分派                              ║
║    - /api/signals       设备信号接入                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

let escalationInterval: NodeJS.Timeout | null = null;

function startEscalationChecker() {
  const intervalMs = config.notification.checkIntervalSeconds * 1000;
  escalationInterval = setInterval(() => {
    try {
      notificationService.processEscalationCheck();
    } catch (error) {
      console.error('通知升级检查失败:', error);
    }
  }, intervalMs);
  console.log(`通知升级检查已启动，间隔 ${config.notification.checkIntervalSeconds} 秒`);
}

function shutdown(signal: string) {
  console.log(`\n收到 ${signal} 信号，正在关闭服务...`);

  if (escalationInterval) {
    clearInterval(escalationInterval);
    console.log('通知升级检查已停止');
  }

  server.close(() => {
    console.log('HTTP 服务器已关闭');
  });

  closeDatabase();
  console.log('数据库连接已关闭');

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startEscalationChecker();

export { server };
