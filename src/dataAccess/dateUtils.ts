import { default as dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
dayjs.extend(utc);
dayjs.extend(customParseFormat);
dayjs.extend(duration);

export function parseDate(date: string | undefined, format = 'YYYYMMDDTHHmmssZ') {
  if (date) {
    return dayjs.utc(date, format).toDate();
  }
  return undefined;
}

export function parseLocalDate(date: string | undefined, format?: string) {
  if (date) {
    return dayjs(date, format).toDate();
  }
  return undefined;
}

export function formatDate(date: Date, format = 'YYYYMMDDTHHmmss[Z]') {
  return dayjs.utc(date).format(format);
}

export function isToday(date: Date) {
  return equalsDay(date, new Date());
}

export function equalsDay(date1: Date, date2: Date) {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
  return date1.toDateString() === date2.toDateString();
}

export function formatDuration(time: number) {
  const duration = dayjs.duration(time);
  if (time < 60000) {
    return `${duration.format('s')}s`;
  }
  return duration.format('HH:mm');
}



export const DateTimeMinValue = new Date(0);
