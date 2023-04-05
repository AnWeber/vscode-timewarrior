import { DateTimeMinValue, formatDate, parseDate } from './dateUtils';

export class Interval {
  constructor(private readonly line: string) {
    this.tags = [];
    const match = /inc\s+(?<start>[^\s]*)(\s+-\s+(?<end>[^\s]*))?(\s+#\s+(?<tags>.*))?\s*/iu.exec(line);

    if (match?.groups?.start) {
      this.start = parseDate(match.groups.start) || DateTimeMinValue;
      if (match.groups.end) {
        this.end = parseDate(match.groups.end);
      }
      if (match.groups.tags) {
        const regex = /(?:[^\s"]+|"[^"]*")+/giu;
        let tagMatch: RegExpExecArray | null;
        while ((tagMatch = regex.exec(match.groups.tags)) !== null) {
          this.tags.push(tagMatch[0].replace(/"/gu, ''));
        }
      }
    }
  }

  public get fileFormat() {
    const result: Array<string> = [];

    result.push(formatDate(this.start));

    if (this.end) {
      result.push(' - ');
      result.push(formatDate(this.end));
    }
    if (this.tags.length > 0) {
      result.push(' # ');
      result.push(
        this.tags
          .map(obj => {
            if (obj.indexOf(' ') > 0) {
              return `"${obj}"`;
            }
            return obj;
          })
          .join(' ')
      );
    }
    return result.join('');
  }

  public get duration(): number {
    return (this.end || new Date()).getTime() - this.start.getTime();
  }

  public readonly start: Date = DateTimeMinValue;
  public readonly end: Date | undefined;
  public readonly tags: Array<string>;
}
