import * as vscode from 'vscode';
import { getConfig } from './config';
import { DataFile, DataFileWatcher } from './dataAccess';
import { DataFileTreeProvider, StatusBarItemProvider, CommandsProvider } from './provider';

export function activate(context: vscode.ExtensionContext) {
	const dataFileEventEmitter = new vscode.EventEmitter<Array<DataFile>>();

	let dataFileWatcher = new DataFileWatcher(getConfig().get('basePath'), dataFileEventEmitter);
	context.subscriptions.push(...[
		new CommandsProvider(dataFileEventEmitter.event),
		new DataFileTreeProvider(dataFileEventEmitter.event),
		new StatusBarItemProvider(dataFileEventEmitter.event),
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('timewarrior')) {
				dataFileWatcher.dispose();
				dataFileWatcher = new DataFileWatcher(getConfig().get('basePath'), dataFileEventEmitter)
			}
		})
	])
}

