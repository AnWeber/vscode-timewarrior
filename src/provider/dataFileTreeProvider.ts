import * as vscode from 'vscode';
import { DataFile, DisposeProvider, Interval } from '../dataAccess';

export class DataFileTreeProvider
  extends DisposeProvider
  implements vscode.TreeDataProvider<DataFile | Interval>
{

  private dataFiles: Array<DataFile> | undefined;
  constructor(public readonly onDidChangeTreeData: vscode.Event<Array<DataFile>>) {
    super();

    this.subscriptions = [
      onDidChangeTreeData(dataFiles => (this.dataFiles = dataFiles)),
      vscode.window.registerTreeDataProvider('timewarrior_history', this),
    ];
  }


  getTreeItem(element: DataFile | Interval): vscode.TreeItem {
    if (element instanceof DataFile) {
      return new DataFileTreeItem(element);
    }
    return new IntervalTreeItem(element);
  }

  async getChildren(
    element?: DataFile | Interval
  ): Promise<Array<DataFile> | Array<Interval> | undefined> {
    if (element instanceof DataFile) {
      return await element.getIntervals();
    }
    if (element instanceof Interval) {
      return undefined;
    }
    return this.dataFiles;
  }
}

export class DataFileTreeItem extends vscode.TreeItem {
  constructor(element: DataFile) {
    super(element.name);
    this.contextValue = 'dataFile';
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.iconPath = new vscode.ThemeIcon('checklist');
  }
}

export class IntervalTreeItem extends vscode.TreeItem {
  constructor(element: Interval) {
    super(element.name);
    this.description = element.tags.join(', ');
    this.contextValue = 'interval';
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.iconPath = new vscode.ThemeIcon('watch');
  }
}