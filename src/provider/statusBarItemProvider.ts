import * as vscode from 'vscode';
import { DataFile, DisposeProvider, Interval } from '../dataAccess';

export class StatusBarItemProvider extends DisposeProvider {
  constructor(dataFileEvent: vscode.Event<Array<DataFile>>) {
    super();

    this.subscriptions.push(...[this.createCurrentTagStatusBarItem(dataFileEvent)]);
  }

  private createCurrentTagStatusBarItem(dataFileEvent: vscode.Event<Array<DataFile>>) {
    const statusBarItem = vscode.window.createStatusBarItem('timewarrior_tag', vscode.StatusBarAlignment.Right);
    statusBarItem.hide();

    dataFileEvent(async e => {
      statusBarItem.hide();
      const dataFile = e.find(obj => obj.isActive);
      if (dataFile) {
        const intervals = await dataFile.getIntervals();
        const interval = intervals.reduce((prev, curr) => {
          if (!prev?.start) {
            return curr;
          }
          if (!curr?.start) {
            return prev;
          }
          return prev.start < curr.start ? curr : prev;
        }, undefined as Interval | undefined);

        if (interval && interval.tags.length > 0) {
          statusBarItem.text = statusBarItem.tooltip = interval.tags.join(', ');
          statusBarItem.show();
        }
      }
    });

    return statusBarItem;
  }
}
