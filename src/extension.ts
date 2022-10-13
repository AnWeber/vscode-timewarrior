import * as vscode from 'vscode';
import { DataFile, DataFileWatcher } from './dataAccess';
import { DataFileTreeProvider, StatusBarItemProvider } from './provider';

export function activate(context: vscode.ExtensionContext) {
	const dataFileEventEmitter = new vscode.EventEmitter<Array<DataFile>>();

	let dataFileWatcher = new DataFileWatcher(vscode.workspace.getConfiguration('timewarrior').get('basePath'), dataFileEventEmitter);
	context.subscriptions.push(...[
		new DataFileTreeProvider(dataFileEventEmitter.event),
		new StatusBarItemProvider(dataFileEventEmitter.event),
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('timewarrior')) {
				dataFileWatcher.dispose();
				dataFileWatcher = new DataFileWatcher(vscode.workspace.getConfiguration('timewarrior').get('basePath'), dataFileEventEmitter)
			}
		})
	])
}

