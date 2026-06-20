export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    path: process.env.DB_PATH || './data/cold-chain-alarm.db'
  },
  alarm: {
    nightStartHour: parseInt(process.env.NIGHT_START_HOUR || '22', 10),
    nightEndHour: parseInt(process.env.NIGHT_END_HOUR || '6', 10),
    nearDeliveryHours: parseInt(process.env.NEAR_DELIVERY_HOURS || '2', 10),
    lowBatteryVoltage: parseFloat(process.env.LOW_BATTERY_VOLTAGE || '21.0'),
    refrigerationReportIntervalMinutes: parseInt(process.env.REFRIGERATION_REPORT_INTERVAL || '5', 10)
  },
  notification: {
    confirmationTimeoutMinutes: parseInt(process.env.CONFIRMATION_TIMEOUT || '10', 10),
    maxEscalationLevels: parseInt(process.env.MAX_ESCALATION_LEVELS || '3', 10),
    checkIntervalSeconds: parseInt(process.env.CHECK_INTERVAL || '30', 10)
  }
};
