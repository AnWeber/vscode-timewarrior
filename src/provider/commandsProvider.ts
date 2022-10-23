import * as vscode from 'vscode';
import { DataFile, DisposeProvider, timew } from '../dataAccess';
import * as actions from './actions';

export class CommandsProvider extends DisposeProvider {
  #activeDataFile: DataFile | undefined;
  constructor(private readonly dataFileEvent: vscode.Event<Array<DataFile>>) {
    super();


    this.subscriptions = [
      dataFileEvent(dataFiles => {
        this.#activeDataFile = dataFiles.find(obj => obj.isActive);
      }),
      vscode.commands.registerCommand('timewarrior.start', this.start, this),
      vscode.commands.registerCommand('timewarrior.startNoTags', this.startNoTags, this),
      vscode.commands.registerCommand('timewarrior.startPrevTag', this.startPrevTag, this),
      vscode.commands.registerCommand('timewarrior.tag', this.tag, this),
      vscode.commands.registerCommand('timewarrior.stop', this.stop, this),
      vscode.commands.registerCommand('timewarrior.checkIn', this.checkIn, this),
    ];
  }

  private async startNoTags(...args: string[]) {
    await timew('start', args);
  }
  private async start() {
    const tags = await actions.getInputArgs(this.#activeDataFile);
    if (tags) {
      await timew('start', tags);
    }
  }
  private async startPrevTag() {
    if (this.#activeDataFile) {
      const intervals = await this.#activeDataFile.getIntervals();
      if (intervals.length > 1) {
        intervals.pop();
        const prevTag = intervals.pop();
        if (prevTag?.tags) {
          await timew('start', prevTag.tags);
        }
      }
    }
  }

  private async tag() {
    const tags = await actions.getInputArgs(this.#activeDataFile);
    if (tags) {
      await timew('tag', tags);
    }
  }

  private async stop() {
    await timew('stop');
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
      await await timew(result.command, result.args);
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
    return result.sort((obj1, obj2) => obj1.label.localeCompare(obj2.label));
  }
}
