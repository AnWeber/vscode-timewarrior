import { formatDate, formatDuration, Interval } from '../../dataAccess';
import * as vscode from 'vscode';

export class IntervalTreeItem extends vscode.TreeItem {
  constructor(interval: Interval) {
    const duration = formatDuration(interval.duration);
    super( `${duration} - ${interval.tags.join(', ')}`);
    this.tooltip = duration;
    this.description = this.formatInterval(interval);
    this.contextValue = 'interval';
    this.iconPath = new vscode.ThemeIcon('circle-small');
  }

  private formatInterval(interval: Interval) {
    const result: Array<string> = [];
    result.push(formatDate(interval.start, 'HH:mm'));
    if (interval.end) {
      result.push(formatDate(interval.end, 'HH:mm'));
    }
    return result.join(' - ');
  }
}


