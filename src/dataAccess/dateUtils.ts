import { default as dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(utc)
dayjs.extend(customParseFormat);

export function parseDate(date: string | undefined) {
    if (date) {
      const obj = dayjs;
      return obj.utc(date, 'YYYYMMDDTHHmmssZ').toDate();
    }
    return undefined;
  }

  export function formatDate(date: Date, format = 'YYYYMMDDTHHmmss[Z]') {
    return dayjs.utc(date).format(format)
  }