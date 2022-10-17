import * as vscode from 'vscode';
import { DataFile, DisposeProvider, Interval } from '../dataAccess';
import { DateIntervals, DateIntervalsTreeItem, IntervalTreeItem, DataFileTreeItem } from './treeItem';

export class DataFileTreeProvider
  extends DisposeProvider
  implements vscode.TreeDataProvider<DataFile | Interval | DateIntervals>
{
  public onDidChangeTreeData: vscode.Event<void>;
  #onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>()

  private dataFiles: Array<DataFile> | undefined;
  constructor(private readonly dataFileEvent: vscode.Event<Array<DataFile>>) {
    super();

    this.#onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this.#onDidChangeTreeDataEmitter.event;

    this.subscriptions = [
      dataFileEvent(dataFiles => {
        this.dataFiles = dataFiles;
        this.#onDidChangeTreeDataEmitter.fire();
      }),
      this.#onDidChangeTreeDataEmitter,
      vscode.commands.registerCommand('timewarrior.refreshHistory', this.refresh, this),
      vscode.window.registerTreeDataProvider('timewarrior_history', this),
    ];
  }

  public refresh() {
    this.#onDidChangeTreeDataEmitter.fire();
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
        const key = curr.start.toLocaleDateString();
        const element = prev.find(group => group.key === key);
        if (element) {
          element.intervals.push(curr);
        } else {
          prev.splice(0, 0, {
            key,
            start: curr.start,
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
