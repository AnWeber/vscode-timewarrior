import { formatDuration, Interval } from '../../dataAccess';
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
    result.push(interval.start.toLocaleTimeString());
    if (interval.end) {
      result.push(interval.end.toLocaleTimeString());
    } else {
      result.push('now');
    }
    return result.join(' - ');
  }
}


