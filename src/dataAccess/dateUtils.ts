import { default as dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
dayjs.extend(utc)
dayjs.extend(customParseFormat);
dayjs.extend(duration)

export function parseDate(date: string | undefined, format = 'YYYYMMDDTHHmmssZ') {
    if (date) {
      const obj = dayjs;
      return obj.utc(date, format).toDate();
    }
    return undefined;
  }

  export function formatDate(date: Date, format = 'YYYYMMDDTHHmmss[Z]') {
    return dayjs.utc(date).format(format)
  }

  export function formatLocalDate(date: Date, format = 'YYYYMMDDTHHmmss[Z]') {
    return dayjs(date).format(format)
  }

export function isSameDay(date1: Date, date2: Date) {
  return date1.toDateString() === date2.toDateString();
}

export function formatDuration(time: number) {
  return dayjs.duration(time).format('HH:mm');
}

export function isToday(date: Date) {
    const today = new Date()
  return date.getDate() === today.getDate() &&
  date.getMonth() === today.getMonth() &&
  date.getFullYear() === today.getFullYear();
}

export const DateTimeMinValue = new Date(0);