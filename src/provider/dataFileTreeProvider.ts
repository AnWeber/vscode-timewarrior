import * as vscode from 'vscode';
import { DataFile, DisposeProvider, Interval } from '../dataAccess';
import { DateIntervals, DateIntervalsTreeItem, IntervalTreeItem, DataFileTreeItem, YearGroup, YearTreeItem } from './treeItem';

export class DataFileTreeProvider
  extends DisposeProvider
  implements vscode.TreeDataProvider<DataFile | Interval | DateIntervals | YearGroup>
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

  getTreeItem(element: DataFile | Interval | DateIntervals | YearGroup): vscode.TreeItem {
    if (element instanceof DataFile) {
      return new DataFileTreeItem(element);
    }
    if (element instanceof Interval) {
      return new IntervalTreeItem(element);
    }
    if (element instanceof YearGroup) {
      return new YearTreeItem(element);
    }
    return new DateIntervalsTreeItem(element);
  }

  async getChildren(
    element?: DataFile | Interval | DateIntervals | YearGroup
  ): Promise<Array<DataFile | Interval | DateIntervals | YearGroup> | undefined> {
    if (!element) {
      const dataFiles = (this.dataFiles || []).slice().sort((obj1, obj2) => obj2.date.getTime() - obj1.date.getTime());
      const currentYear = new Date().getFullYear();
      const topLevelDataFiles = dataFiles.filter(obj => obj.date.getFullYear() >= currentYear);
      const previousYears = dataFiles.filter(obj => obj.date.getFullYear() < currentYear);

      const grouped = previousYears.reduce((prev, curr) => {
        const year = curr.date.getFullYear();
        if (!prev[year]) {
          prev[year] = [];
        }
        prev[year].push(curr);
        return prev;
      }, {} as Record<number, Array<DataFile>>);

      const yearGroups = Object.entries(grouped)
        .sort(([year1], [year2]) => Number(year2) - Number(year1))
        .map(([year, files]) => new YearGroup(Number(year), files));

      return [...topLevelDataFiles, ...yearGroups];
    }
    if (element instanceof YearGroup) {
      return element.dataFiles
        .slice()
        .sort((obj1, obj2) => obj2.date.getTime() - obj1.date.getTime());
    }
    if (element instanceof DataFile) {
      const dataFile = element;
      const intervals = (await element.getIntervals())
        .slice()
        .sort((obj1, obj2) => obj2.start.getTime() - obj1.start.getTime());

      return intervals.reduce((prev, curr) => {
        const key = curr.start.toLocaleDateString();
        const group = prev.find(obj => obj.key === key);
        if (group) {
          group.intervals.push(curr);
        } else {
          prev.push({
            key,
            start: curr.start,
            intervals: [curr],
            dataFile,
          });
        }
        return prev;
      }, [] as Array<DateIntervals>).sort((obj1, obj2) => obj2.start.getTime() - obj1.start.getTime());
    }
    if (element instanceof Interval) {
      return undefined;
    }
    return element.intervals
      .slice()
      .sort((obj1, obj2) => obj2.start.getTime() - obj1.start.getTime());
  }
}
