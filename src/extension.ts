import * as vscode from 'vscode';
import { getConfig } from './config';
import { DataFile, DataFileWatcher } from './dataAccess';
import * as provider from './provider';

export function activate(context: vscode.ExtensionContext) {
  const dataFileEventEmitter = new vscode.EventEmitter<Array<DataFile>>();

  let dataFileWatcher = new DataFileWatcher(getConfig().get('basePath'), dataFileEventEmitter);

  const monthSummaryProvider = new provider.MonthSummaryProvider(dataFileEventEmitter.event);
  context.subscriptions.push(
    ...[
      new provider.CommandsProvider(),
      monthSummaryProvider,
      new provider.DayEditorProvider(monthSummaryProvider),
      new provider.DataFileTreeProvider(dataFileEventEmitter.event),
      new provider.StatusBarItemProvider(dataFileEventEmitter.event),
      new provider.ReminderProvider(dataFileEventEmitter.event),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('timewarrior')) {
          dataFileWatcher.dispose();
          dataFileWatcher = new DataFileWatcher(getConfig().get('basePath'), dataFileEventEmitter);
        }
      }),
    ]
  );
}
