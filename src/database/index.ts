import fs from 'fs';
import path from 'path';

interface DatabaseData {
  vehicles: any[];
  powerSignals: any[];
  alertEvents: any[];
  notifications: any[];
  alertRules: any[];
}

const defaultData: DatabaseData = {
  vehicles: [],
  powerSignals: [],
  alertEvents: [],
  notifications: [],
  alertRules: []
};

class JsonDatabase {
  private filePath: string;
  private data: DatabaseData;
  private writeTimer: NodeJS.Timeout | null = null;
  private pendingWrite = false;

  constructor(dbPath: string) {
    this.filePath = dbPath;
    this.data = this.loadData();
    if (this.data.alertRules.length === 0) {
      this.initializeDefaultRules();
    }
  }

  private loadData(): DatabaseData {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.warn('数据库文件读取失败，使用空数据库:', err);
    }
    return { ...defaultData, alertRules: [] };
  }

  private scheduleWrite() {
    if (this.writeTimer) {
      this.pendingWrite = true;
      return;
    }
    this.writeTimer = setTimeout(() => {
      this.writeData();
      this.writeTimer = null;
      if (this.pendingWrite) {
        this.pendingWrite = false;
        this.scheduleWrite();
      }
    }, 100);
  }

  private writeData() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('数据库写入失败:', err);
    }
  }

  private initializeDefaultRules() {
    const now = new Date().toISOString();
    this.data.alertRules = [
      { id: 'rule-reminder-power', name: '断电提醒（短时）', alertType: 'external_power_disconnect', minPowerOffMinutes: 5, goodsSensitivityRequired: null, nearDeliveryRequired: false, targetLevel: 'reminder', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-urgent-power-medium', name: '断电紧急（中等敏感）', alertType: 'external_power_disconnect', minPowerOffMinutes: 15, goodsSensitivityRequired: 'medium', nearDeliveryRequired: false, targetLevel: 'urgent', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-urgent-power-delivery', name: '断电紧急（临近交付）', alertType: 'external_power_disconnect', minPowerOffMinutes: 10, goodsSensitivityRequired: null, nearDeliveryRequired: true, targetLevel: 'urgent', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-urgent-power-high', name: '断电紧急（高敏感）', alertType: 'external_power_disconnect', minPowerOffMinutes: 10, goodsSensitivityRequired: 'high', nearDeliveryRequired: false, targetLevel: 'urgent', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-critical-power-high', name: '断电重大（高敏感）', alertType: 'external_power_disconnect', minPowerOffMinutes: 30, goodsSensitivityRequired: 'high', nearDeliveryRequired: false, targetLevel: 'critical', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-critical-power-long', name: '断电重大（长时间）', alertType: 'external_power_disconnect', minPowerOffMinutes: 60, goodsSensitivityRequired: null, nearDeliveryRequired: false, targetLevel: 'critical', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-reminder-battery', name: '电压异常提醒', alertType: 'battery_voltage_abnormal', minPowerOffMinutes: 0, goodsSensitivityRequired: null, nearDeliveryRequired: false, targetLevel: 'reminder', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-urgent-battery', name: '电压异常紧急（高敏感）', alertType: 'battery_voltage_abnormal', minPowerOffMinutes: 10, goodsSensitivityRequired: 'high', nearDeliveryRequired: false, targetLevel: 'urgent', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-critical-battery', name: '电压异常重大（高敏感）', alertType: 'battery_voltage_abnormal', minPowerOffMinutes: 30, goodsSensitivityRequired: 'high', nearDeliveryRequired: false, targetLevel: 'critical', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-reminder-refrigeration', name: '冷机停报提醒', alertType: 'refrigeration_stop_reporting', minPowerOffMinutes: 5, goodsSensitivityRequired: null, nearDeliveryRequired: false, targetLevel: 'reminder', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-urgent-refrigeration-medium', name: '冷机停报紧急（中等敏感）', alertType: 'refrigeration_stop_reporting', minPowerOffMinutes: 15, goodsSensitivityRequired: 'medium', nearDeliveryRequired: false, targetLevel: 'urgent', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-urgent-refrigeration-high', name: '冷机停报紧急（高敏感）', alertType: 'refrigeration_stop_reporting', minPowerOffMinutes: 10, goodsSensitivityRequired: 'high', nearDeliveryRequired: false, targetLevel: 'urgent', enabled: true, createdAt: now, updatedAt: now },
      { id: 'rule-critical-refrigeration', name: '冷机停报重大（高敏感）', alertType: 'refrigeration_stop_reporting', minPowerOffMinutes: 30, goodsSensitivityRequired: 'high', nearDeliveryRequired: false, targetLevel: 'critical', enabled: true, createdAt: now, updatedAt: now }
    ];
    this.scheduleWrite();
  }

  getTable<T>(tableName: keyof DatabaseData): T[] {
    return [...this.data[tableName]] as T[];
  }

  setTable(tableName: keyof DatabaseData, data: any[]) {
    (this.data[tableName] as any[]) = data;
    this.scheduleWrite();
  }

  insert(tableName: keyof DatabaseData, record: any): void {
    (this.data[tableName] as any[]).push(record);
    this.scheduleWrite();
  }

  update(tableName: keyof DatabaseData, id: string, updates: any): any | null {
    const table = this.data[tableName] as any[];
    const index = table.findIndex(r => r.id === id);
    if (index === -1) return null;
    table[index] = { ...table[index], ...updates, updatedAt: new Date().toISOString() };
    this.scheduleWrite();
    return table[index];
  }

  remove(tableName: keyof DatabaseData, id: string): boolean {
    const table = this.data[tableName] as any[];
    const index = table.findIndex(r => r.id === id);
    if (index === -1) return false;
    table.splice(index, 1);
    this.scheduleWrite();
    return true;
  }

  findById(tableName: keyof DatabaseData, id: string): any | null {
    const table = this.data[tableName] as any[];
    return table.find(r => r.id === id) || null;
  }

  findOne(tableName: keyof DatabaseData, predicate: (r: any) => boolean): any | null {
    const table = this.data[tableName] as any[];
    return table.find(predicate) || null;
  }

  findAll(tableName: keyof DatabaseData, predicate?: (r: any) => boolean): any[] {
    const table = this.data[tableName] as any[];
    if (predicate) {
      return table.filter(predicate);
    }
    return [...table];
  }

  count(tableName: keyof DatabaseData, predicate?: (r: any) => boolean): number {
    const table = this.data[tableName] as any[];
    if (predicate) {
      return table.filter(predicate).length;
    }
    return table.length;
  }

  close() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.writeData();
  }
}

let db: JsonDatabase | null = null;

export function getDatabase(): JsonDatabase {
  if (!db) {
    const dbPath = path.resolve(process.cwd(), 'data', 'cold-chain-alarm.json');
    db = new JsonDatabase(dbPath);
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export { JsonDatabase };
