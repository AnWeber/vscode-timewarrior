import { spawnSync } from 'child_process';
import * as vscode from 'vscode';
import { DataFile, DisposeProvider, isToday } from '../dataAccess';

export class CommandsProvider extends DisposeProvider {
  #activeDataFile: DataFile | undefined;
  constructor(private readonly dataFileEvent: vscode.Event<Array<DataFile>>) {
    super();

    dataFileEvent(dataFiles => {
      this.#activeDataFile = dataFiles.find(obj => obj.isActive);
    });
    this.subscriptions = [
      vscode.commands.registerCommand('timewarrior.start', this.start, this),
      vscode.commands.registerCommand('timewarrior.stop', this.stop, this),
    ];
  }

  private async start(...args: string[]) {
    let cmdArgs = args;
    if (!args || args.length === 0) {
      const result = await vscode.window.showInputBox({
        placeHolder: 'tags',
        value: (await this.getLastTags())?.join(', '),
        prompt: 'Please provide tags separated with whitespace.',
      });
      if (result) {
        cmdArgs = result.split(' ').map(tag => tag.trim());
      }
    }
    this.spawn('start', cmdArgs);
  }

  private async stop() {
    this.spawn('stop');
  }

  private async getLastTags() {
    if (this.#activeDataFile) {
      const intervals = (await this.#activeDataFile.getIntervals()).slice();
      const lastInterval = intervals.pop();
      if (lastInterval && isToday(lastInterval.start)) {
        const prevInterval = intervals.pop();
        if (prevInterval && isToday(prevInterval.start)) {
          return prevInterval.tags;
        }
      }
      return lastInterval?.tags;
    }
    return [];
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
