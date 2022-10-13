import { formatDate, parseDate } from './dateUtils';



export class Interval{

  constructor(private readonly line: string) {
    this.tags = [];
      const match = /inc\s+(?<start>[^\s]*)(\s+-\s+(?<end>[^\s]*))?(\s+#\s+(?<tags>.*))?\s*/ui.exec(line);

      if (match?.groups?.start) {
        this.start = parseDate(match.groups.start);
        if (match.groups.end) {
          this.end =parseDate(match.groups.end);
        }
        if (match.groups.tags) {
          this.tags.push(...match.groups.tags.trim().split(' '));
        }
      }
  }

  public get name() {
    const result: Array<string> = [];
    if (this.start) {
      result.push(formatDate(this.start, 'YYYY.MM.DD HH:mm'))
    }
    if (this.end) {
      result.push(formatDate(this.end, 'YYYY.MM.DD HH:mm'))
    }
    return result.join(' - ');
  }


  public get fileFormat() {
    const result: Array<string> = [];

    if (this.start) {
      result.push(formatDate(this.start));
    }
    if (this.end) {
      result.push(' - ');
      result.push(formatDate(this.end));
    }
    if (this.tags.length > 0) {
      result.push(' # ');
      result.push(this.tags.join(' '));
    }
    return result.join('');
  }

  public readonly start: Date | undefined;
  public readonly end: Date | undefined;
  public readonly tags: Array<string>;
}