import * as vscode from 'vscode';

export function getConfig(): TimewarriorConfiguration {
  return vscode.workspace.getConfiguration('timewarrior');
}

export type StringTypes = 'basePath';

interface TimewarriorConfiguration {
  get(section: 'reminders'): {
    intervalTimeSpan: number | undefined;
    preventNewReminderTimeSpan: number | undefined;
    ranges: Array<ReminderRange>;
  } | undefined;
  get(section: 'tagStatusBarItem'):
    | {
        errorOnEmptyTag: boolean;
        color: string;
      }
    | undefined;
  get(section: 'checkIn'):
    | {
        tags?: Array<string>;
        countRecentlyUsedTags?: number;
        gitTagRegex?: Array<string>;
      }
    | undefined;

  get(section: StringTypes): string | undefined;
  get(section: StringTypes, defaultValue: string): string;
}

export interface ReminderRange {
  startTime?: string;
  endTime?: string;
  daysToRepeatDate?: string;
  daysToRepeat?: number;
  showStatusBarDuration?: number;
  message?: string;
  force?: boolean;
  tags?: Array<string>;
}