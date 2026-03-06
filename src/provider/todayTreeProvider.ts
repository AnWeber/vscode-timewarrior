import * as vscode from 'vscode';
import { DataFile, DisposeProvider, Interval, isToday } from '../dataAccess';
import { DateIntervals, IntervalTreeItem } from './treeItem';

export class TodayTreeProvider extends DisposeProvider implements vscode.TreeDataProvider<Interval> {
  public onDidChangeTreeData: vscode.Event<void>;
  #onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  private todayDataFile: DataFile | undefined;
  private todayIntervals: Array<Interval> = [];

  constructor(private readonly dataFileEvent: vscode.Event<Array<DataFile>>) {
    super();
    this.#onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this.#onDidChangeTreeDataEmitter.event;

    this.subscriptions = [
      dataFileEvent(async dataFiles => {
        this.todayDataFile = dataFiles.find(obj => obj.isActive);
        await this.loadTodayIntervals();
      }),
      this.#onDidChangeTreeDataEmitter,
      vscode.commands.registerCommand('timewarrior.editToday', this.editToday, this),
      vscode.commands.registerCommand('timewarrior.refreshToday', this.refreshToday, this),
      vscode.window.registerTreeDataProvider('timewarrior_today', this),
    ];
  }

  private async refreshToday() {
    this.todayDataFile?.invalidateIntervals();
    await this.loadTodayIntervals();
  }

  private async loadTodayIntervals() {
    if (this.todayDataFile) {
      const allIntervals = await this.todayDataFile.getIntervals();
      this.todayIntervals = allIntervals
        .filter(interval => isToday(interval.start))
        .sort((a, b) => a.start.getTime() - b.start.getTime());
    } else {
      this.todayIntervals = [];
    }
    this.#onDidChangeTreeDataEmitter.fire();
  }

  private async editToday() {
    if (!this.todayDataFile) {
      vscode.window.showInformationMessage('No active time tracking file found for today.');
      return;
    }
    const today = new Date();
    const dateIntervals: DateIntervals = {
      key: today.toLocaleDateString(),
      start: today,
      intervals: this.todayIntervals,
      dataFile: this.todayDataFile,
    };
    await vscode.commands.executeCommand('timewarrior.dayEditor', dateIntervals);
  }

  getTreeItem(element: Interval): vscode.TreeItem {
    return new IntervalTreeItem(element);
  }

  getChildren(element?: Interval): Array<Interval> | undefined {
    if (element) {
      return undefined;
    }
    return this.todayIntervals;
  }
}
