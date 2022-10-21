import * as vscode from 'vscode';
import { DataFile, DisposeProvider, spawn } from '../dataAccess';
import * as actions from './actions';

export class CommandsProvider extends DisposeProvider {
  #activeDataFile: DataFile | undefined;
  constructor(private readonly dataFileEvent: vscode.Event<Array<DataFile>>) {
    super();

    dataFileEvent(dataFiles => {
      this.#activeDataFile = dataFiles.find(obj => obj.isActive);
    });
    this.subscriptions = [
      vscode.commands.registerCommand('timewarrior.start', this.start, this),
      vscode.commands.registerCommand('timewarrior.startNoTags', this.startNoTags, this),
      vscode.commands.registerCommand('timewarrior.tag', this.tag, this),
      vscode.commands.registerCommand('timewarrior.stop', this.stop, this),
      vscode.commands.registerCommand('timewarrior.checkIn', this.checkIn, this),
    ];
  }

  private async startNoTags(...args: string[]) {
    await spawn('start', args);
  }
  private async start() {
    const tags = await actions.getInputArgs(this.#activeDataFile);
    if (tags) {
      await spawn('start', tags);
    }
  }

  private async tag() {
    const tags = await actions.getInputArgs(this.#activeDataFile);
    if (tags) {
      await spawn('tag', tags);
    }
  }

  private async stop() {
    await spawn('stop');
  }

  private async checkIn() {
    const actions = await this.getActions();
    const result =
      actions.length > 0
        ? await vscode.window.showQuickPick(actions, {
            placeHolder: 'Please select action',
          })
        : actions.pop();
    if (result) {
      if (result.args && !Array.isArray(result.args)) {
        result.args = await result.args();
      }
      await await spawn(result.command, result.args);
    }
  }

  private async getActions() {
    const result: Array<actions.CheckInAction> = [];

    const actionProviders = [
      actions.startCheckInProvider,
      actions.tagsCheckInProvider,
      actions.configTagsCheckInProvider,
      actions.gitCheckInProvider,
      actions.stopCheckInProvider,
    ];
    for (const actionProvider of actionProviders) {
      result.push(...(await actionProvider(this.#activeDataFile)));
    }
    return result;
  }
}
