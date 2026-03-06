import { DataFile } from '../../dataAccess';
import * as vscode from 'vscode';

export class DataFileTreeItem extends vscode.TreeItem {
  constructor(element: DataFile) {
    super(getName(element));
    this.contextValue = 'dataFile';
    if (element.isActive) {
      this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    }else{
      this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
    this.iconPath = new vscode.ThemeIcon('checklist');
  }
}

function getName(dataFile: DataFile) {
  return dataFile.date.toLocaleString('default', { month: 'long' });
}