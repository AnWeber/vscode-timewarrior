import { getConfig } from '../../config';
import { spawn } from '../../dataAccess';
import { CheckInAction } from './checkInAction';
import * as vscode from 'vscode';

export async function gitCheckInProvider(): Promise<Array<CheckInAction>> {
  const result: Array<string> = [];
  const config = getConfig().get('checkIn');
  if (config?.gitTagRegex && config?.gitTagRegex.length > 0 && vscode.workspace.workspaceFolders) {
    for (const workspace of vscode.workspace.workspaceFolders) {
      try {
        const spawnResult = await spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspace.uri.fsPath });
        const branch = spawnResult.stdout?.trim();
        if (branch) {
          for (const gitTagRegex of config.gitTagRegex) {
            const match = (new RegExp(gitTagRegex, 'u')).exec(branch);
            if (match?.groups?.tag) {
              result.push(match?.groups?.tag);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  }
  return result.map(label => ({
    label,
    command: 'start',
    args: [label],
  }));
}
