import * as vscode from 'vscode';
import { DataFile, isToday } from '../../dataAccess';

export async function getInputArgs(dataFile: DataFile | undefined) {
  const result = await vscode.window.showInputBox({
    placeHolder: 'tags',
    value: (await getLastTags(dataFile))?.join(', '),
    prompt: 'Please provide tags separated with comma.',
  });
  if (result !== undefined) {
    return result.split(',').map(tag => tag.trim()).filter(Boolean);
  }
  return undefined;
}

async function getLastTags(dataFile: DataFile | undefined) {
  if (dataFile) {
    const intervals = (await dataFile.getIntervals()).slice();
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
