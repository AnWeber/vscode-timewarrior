import * as vscode from 'vscode';

export function getConfig(): TimewarriorConfiguration {
  return vscode.workspace.getConfiguration('timewarrior');
}


export type StringTypes = 'basePath'

interface TimewarriorConfiguration {

  get(section: 'tagStatusBarItem'): {
    errorOnEmptyTag: boolean,
    color: string
  } | undefined;
  get(section: 'checkIn'): {
    tags: Array<string>,
  } | undefined;

  get(section: StringTypes): string | undefined;
  get(section: StringTypes, defaultValue: string): string;
}
