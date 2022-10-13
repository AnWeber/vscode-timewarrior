import * as vscode from 'vscode';
import { DisposeProvider } from './disposeProvider';
import { DataFile } from './dataFile';

export class DataFileWatcher extends DisposeProvider {
  private dataFiles: Array<DataFile>;
  constructor(
    basePath: string | undefined,
    private readonly dataFileEvent: vscode.EventEmitter<Array<DataFile>>
  ) {
    super();
    this.dataFiles = [];
    if (basePath) {
      const relativePattern = new vscode.RelativePattern(basePath, 'data/*-*.data');
      this.searchFiles(relativePattern);
      this.subscriptions.push(...[this.initFilesystemWatcher(relativePattern)]);
    }
  }

  private async searchFiles(relativePattern: vscode.RelativePattern) {
    const dataFiles = await vscode.workspace.findFiles(relativePattern);
    for (const file of dataFiles) {
      this.dataFiles.push(new DataFile(file));
    }
    this.dataFileEvent.fire(this.dataFiles);
  }

  private initFilesystemWatcher(relativePattern: vscode.RelativePattern) {
    const fsWatcher = vscode.workspace.createFileSystemWatcher(relativePattern);
    const refreshFile = (uri: vscode.Uri) => this.refreshDataFile(uri) && this.dataFileEvent.fire([...this.dataFiles]);
    fsWatcher.onDidCreate(refreshFile);
    fsWatcher.onDidChange(refreshFile);
    fsWatcher.onDidDelete(
      (uri: vscode.Uri) => this.removeDataFile(uri) && this.dataFileEvent.fire([...this.dataFiles])
    );
    return fsWatcher;
  }

  private refreshDataFile(uri: vscode.Uri) {
    this.removeDataFile(uri);
    this.dataFiles.push(new DataFile(uri));
    return true;
  }

  private removeDataFile(uri: vscode.Uri) {
    const index = this.dataFiles.findIndex(obj => obj.uri.toString() === uri.toString());
    if (index >= 0) {
      this.dataFiles.splice(index, 1);
      return true;
    }
    return false;
  }
}
