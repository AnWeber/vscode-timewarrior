import * as vscode from 'vscode';
import { DataFile } from '../../dataAccess';

export class YearGroup {
  constructor(public readonly year: number, public readonly dataFiles: Array<DataFile>) {}
}

export class YearTreeItem extends vscode.TreeItem {
  constructor(element: YearGroup) {
    super(`${element.year}`);
    this.contextValue = 'year';
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.iconPath = new vscode.ThemeIcon('calendar');
  }
}
