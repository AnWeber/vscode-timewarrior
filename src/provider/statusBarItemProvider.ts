import * as vscode from 'vscode';
import { getConfig } from '../config';
import { DataFile, DisposeProvider, Interval } from '../dataAccess';

export class StatusBarItemProvider extends DisposeProvider {
  constructor(dataFileEvent: vscode.Event<Array<DataFile>>) {
    super();

    this.subscriptions.push(...[this.createCurrentTagStatusBarItem(dataFileEvent)]);
  }

  private createCurrentTagStatusBarItem(dataFileEvent: vscode.Event<Array<DataFile>>) {
    const statusBarItem = vscode.window.createStatusBarItem('timewarrior_tag', vscode.StatusBarAlignment.Right);
    statusBarItem.hide();

    dataFileEvent(async dataFiles => {
      const config = getConfig().get('tagStatusBarItem');
      statusBarItem.hide();
      delete statusBarItem.backgroundColor;
      statusBarItem.command = 'timewarrior.checkIn';
      if (config?.color) {
        if (config.color.startsWith('#')) {
          statusBarItem.color = config.color;
        } else {
          statusBarItem.color = new vscode.ThemeColor(config.color);
        }
      }
      const dataFile = dataFiles.find(obj => obj.isActive);
      if (dataFile) {
        const intervals = await dataFile.getIntervals();
        const interval = intervals.reduce((prev, curr) => {
          if (!prev?.start) {
            return curr;
          }
          return prev.start < curr.start ? curr : prev;
        }, undefined as Interval | undefined);
        if (interval && interval.tags.length > 0) {
          if (!intervals.slice().pop()?.end) {
            statusBarItem.text = statusBarItem.tooltip = interval.tags.join(', ');
            statusBarItem.show();
          }
        } else if (config?.errorOnEmptyTag) {
          statusBarItem.text = 'no tag';
          statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
          statusBarItem.show();
        }
      }
    });

    return statusBarItem;
  }
}
