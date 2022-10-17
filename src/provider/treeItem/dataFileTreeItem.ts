import { DataFile, formatDate } from '../../dataAccess';
import * as vscode from 'vscode';

export class DataFileTreeItem extends vscode.TreeItem {
  constructor(element: DataFile) {
    super(getName(element));
    this.contextValue = 'dataFile';
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.iconPath = new vscode.ThemeIcon('checklist');
  }
}

function getName(dataFile: DataFile) {
  if (dataFile.date.getFullYear() === (new Date()).getFullYear()) {
    return formatDate(dataFile.date, 'MMMM');
  }
  return formatDate(dataFile.date, 'MMMM (YYYYY)')
}