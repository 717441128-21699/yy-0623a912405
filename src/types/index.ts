export enum AlertLevel {
  REMINDER = 'reminder',
  URGENT = 'urgent',
  CRITICAL = 'critical'
}

export enum AlertType {
  EXTERNAL_POWER_DISCONNECT = 'external_power_disconnect',
  BATTERY_VOLTAGE_ABNORMAL = 'battery_voltage_abnormal',
  REFRIGERATION_STOP_REPORTING = 'refrigeration_stop_reporting'
}

export enum GoodsSensitivity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  ESCALATED = 'escalated'
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  route: string;
  temperatureZone: string;
  minTemperature: number;
  maxTemperature: number;
  goodsSensitivity: GoodsSensitivity;
  deliveryEstimateTime: string;
  nightContactName: string;
  nightContactPhone: string;
  dispatcherName: string;
  dispatcherPhone: string;
  qualityControllerName: string;
  qualityControllerPhone: string;
  shipperName: string;
  shipperPhone: string;
  nightStartHour: number;
  nightEndHour: number;
  createdAt: string;
  updatedAt: string;
}

export interface PowerSignal {
  id: string;
  vehicleId: string;
  deviceId: string;
  alertType: AlertType;
  externalPowerConnected: boolean;
  batteryVoltage?: number;
  refrigerationRunning: boolean;
  temperature?: number;
  location?: string;
  timestamp: string;
  receivedAt: string;
}

export interface AlertEvent {
  id: string;
  vehicleId: string;
  signalId: string;
  alertType: AlertType;
  alertLevel: AlertLevel;
  powerOffDurationMinutes: number;
  currentTemperature?: number;
  currentBatteryVoltage?: number;
  goodsSensitivity: GoodsSensitivity;
  nearDelivery: boolean;
  description: string;
  status: 'active' | 'resolved';
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  alertId: string;
  vehicleId: string;
  recipientType: 'driver' | 'dispatcher' | 'quality_controller' | 'shipper';
  recipientName: string;
  recipientPhone: string;
  alertLevel: AlertLevel;
  content: string;
  status: NotificationStatus;
  confirmedAt?: string;
  confirmedBy?: string;
  escalatedTo?: string;
  escalationLevel: number;
  createdAt: string;
  sentAt?: string;
}

export interface AlertRuleConfig {
  id: string;
  name: string;
  alertType: AlertType;
  minPowerOffMinutes: number;
  goodsSensitivityRequired?: GoodsSensitivity;
  nearDeliveryRequired: boolean;
  targetLevel: AlertLevel;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AlertSummary {
  id: string;
  alertType: AlertType;
  alertLevel: AlertLevel;
  status: 'active' | 'resolved';
  powerOffDurationMinutes: number;
  currentTemperature?: number;
  currentBatteryVoltage?: number;
  description: string;
  createdAt: string;
  updatedAt: string;
  notificationTotal: number;
  notificationConfirmed: number;
}

export interface VehicleAlertGroup {
  vehicleId: string;
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  route: string;
  goodsSensitivity: GoodsSensitivity;
  totalAlerts: number;
  activeAlerts: number;
  highestLevel: AlertLevel;
  alerts: AlertSummary[];
  lastAlertTime: string;
}

export interface TimelineEvent {
  id: string;
  eventType: 'alert_start' | 'level_upgrade' | 'notification_sent' | 'notification_confirmed' | 'notification_escalated' | 'alert_resolved' | 'signal_update';
  timestamp: string;
  alertType?: AlertType;
  alertLevel?: AlertLevel;
  previousLevel?: AlertLevel;
  description: string;
  details?: Record<string, any>;
}

export interface ConfirmationRecord {
  notificationId: string;
  alertId: string;
  alertType: AlertType;
  alertLevel: AlertLevel;
  vehicleId: string;
  plateNumber: string;
  recipientType: string;
  recipientName: string;
  recipientPhone: string;
  status: NotificationStatus;
  sentAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  escalationLevel: number;
}
