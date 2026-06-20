import dayjs from 'dayjs';
import { config } from '../config';

export function isNightTime(time: dayjs.Dayjs, nightStartHour: number = config.alarm.nightStartHour, nightEndHour: number = config.alarm.nightEndHour): boolean {
  const hour = time.hour();
  if (nightStartHour > nightEndHour) {
    return hour >= nightStartHour || hour < nightEndHour;
  }
  return hour >= nightStartHour && hour < nightEndHour;
}

export function isNearDelivery(deliveryTime: string | undefined, hours: number = config.alarm.nearDeliveryHours): boolean {
  if (!deliveryTime) return false;
  const delivery = dayjs(deliveryTime);
  const now = dayjs();
  const diffHours = delivery.diff(now, 'hour');
  return diffHours > 0 && diffHours <= hours;
}

export function calculateDurationMinutes(startTime: string, endTime: string = dayjs().toISOString()): number {
  const start = dayjs(startTime);
  const end = dayjs(endTime);
  return end.diff(start, 'minute', true);
}

export function getCurrentTimestamp(): string {
  return dayjs().toISOString();
}

export function formatTimestamp(ts: string): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm:ss');
}
