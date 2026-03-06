import { DataFile, formatDuration, Interval, isToday } from '../../dataAccess';
import * as vscode from 'vscode';
import { EOL } from 'os';

export interface DateIntervals {
  intervals: Array<Interval>;
  key: string;
  start: Date;
  dataFile: DataFile;
}

export class DateIntervalsTreeItem extends vscode.TreeItem {
  constructor(obj: DateIntervals) {
    super(obj.key);
    this.description = sumDuration(obj.intervals);

    this.tooltip = [`Total: ${sumDuration(obj.intervals)}` , ...sumDurationTags(obj.intervals)].join(EOL);

    this.iconPath = new vscode.ThemeIcon('calendar');
    this.contextValue = 'date';
    if (isToday(obj.start)) {
      this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else {
      this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
  }
}

function sumDuration(array: Array<Interval>) {
  return formatDuration(array.reduce((sum, curr) => sum + curr.duration, 0));
}

function sumDurationTags(array: Array<Interval>) {
  return Object.entries(
    array.reduce((prev, curr) => {
      const tags = curr.tags.join(' ') || 'no tag';
      if (!prev[tags]) {
        prev[tags] = 0;
      }
      prev[tags] += curr.duration;
      return prev;
    }, {} as Record<string, number>)).map(([tags, duration]) => `${tags}: ${formatDuration(duration)}`);
}
