import { spawnSync } from 'child_process';
import * as vscode from 'vscode';
import { DataFile, DisposeProvider } from '../dataAccess';
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
    this.spawn('start', args);
  }
  private async start() {
    const tags = await actions.getInputArgs(this.#activeDataFile);
    if (tags) {
      this.spawn('start', tags);
    }
  }

  private async tag() {
    const tags = await actions.getInputArgs(this.#activeDataFile);
    if (tags) {
      this.spawn('tag', tags);
    }
  }

  private async stop() {
    this.spawn('stop');
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
      await this.spawn(result.command, result.args);
    }
  }

  private async getActions() {
    const result: Array<actions.CheckInAction> = [];

    const actionProviders = [
      actions.startCheckInProvider,
      actions.tagsCheckInProvider,
      actions.configTagsCheckInProvider,
      actions.stopCheckInProvider
    ];
    for (const actionProvider of actionProviders) {
      result.push(...await actionProvider(this.#activeDataFile));
    }
    return result;
  }



  private spawn(command: string, args: string[] = []): { stdout: string; stderr: string } {
    const result = spawnSync('timew', [command, ...args], {
      encoding: 'utf-8',
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status === null) {
      throw new Error(`Terminated by signal ${result.signal}`);
    }
    if (result.status > 0) {
      throw new Error(result.stderr);
    }

    return { stdout: result.stdout, stderr: result.stderr };
  }
}
