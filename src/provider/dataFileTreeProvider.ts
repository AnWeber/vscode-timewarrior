import * as vscode from 'vscode';
import { DataFile, DisposeProvider, Interval } from '../dataAccess';
import { DateIntervals, DateIntervalsTreeItem, IntervalTreeItem, DataFileTreeItem } from './treeItem';

export class DataFileTreeProvider
  extends DisposeProvider
  implements vscode.TreeDataProvider<DataFile | Interval | DateIntervals>
{
  public onDidChangeTreeData: vscode.Event<void>;

  private dataFiles: Array<DataFile> | undefined;
  constructor(public readonly dataFileEvent: vscode.Event<Array<DataFile>>) {
    super();

    const onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = onDidChangeTreeDataEmitter.event;

    this.subscriptions = [
      dataFileEvent(dataFiles => {
        this.dataFiles = dataFiles;
        onDidChangeTreeDataEmitter.fire();
      }),
      onDidChangeTreeDataEmitter,
      vscode.window.registerTreeDataProvider('timewarrior_history', this),
    ];
  }

  getTreeItem(element: DataFile | Interval | DateIntervals): vscode.TreeItem {
    if (element instanceof DataFile) {
      return new DataFileTreeItem(element);
    }
    if (element instanceof Interval) {
      return new IntervalTreeItem(element);
    }
    return new DateIntervalsTreeItem(element);
  }

  async getChildren(
    element?: DataFile | Interval | DateIntervals
  ): Promise<Array<DataFile> | Array<Interval> | Array<DateIntervals> | undefined> {
    if (!element) {
      return this.dataFiles;
    }
    if (element instanceof DataFile) {
      return (await element.getIntervals()).reduce((prev, curr) => {
        const start = curr.start.toLocaleDateString();
        const element = prev.find(group => group.start === start);
        if (element) {
          element.intervals.push(curr);
        } else {
          prev.push({
            start,
            intervals: [curr],
          });
        }
        return prev;
      }, [] as Array<DateIntervals>);
    }
    if (element instanceof Interval) {
      return undefined;
    }
    return element.intervals;
  }
}
