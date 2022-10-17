import { formatDuration, Interval } from '../../dataAccess';
import * as vscode from 'vscode';

export interface DateIntervals {
  intervals: Array<Interval>;
  start: string;
}

export class DateIntervalsTreeItem extends vscode.TreeItem {
  constructor(obj: DateIntervals) {
    super(obj.start);
    this.tooltip = formatDuration(obj.intervals.reduce((sum, curr) => sum + curr.duration, 0));
    this.description = this.tooltip;
    this.iconPath = new vscode.ThemeIcon('calendar');
    this.contextValue = 'date';
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  }
}
