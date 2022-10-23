import * as vscode from 'vscode';
import { getConfig, ReminderRange } from '../config';
import { DataFile, DateTimeMinValue, DisposeProvider, parseLocalDate, timew } from '../dataAccess';

interface PreparedReminderRange extends ReminderRange {
  startTimeAsDate?: Date;
  endtimeAsDate?: Date;
  daysToRepeatDateAsDate?: Date;
}

const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

export class ReminderProvider extends DisposeProvider {
  readonly #statusBarItem: vscode.StatusBarItem;
  readonly #ignoreStatusBarItem: vscode.StatusBarItem;

  #activeDataFile: DataFile | undefined;
  #tagsLastChanged: Date;
  #timer: NodeJS.Timer | undefined;
  #currentInterval: PreparedReminderRange | undefined;
  constructor(dataFileEvent: vscode.Event<Array<DataFile>>) {
    super();
    this.#tagsLastChanged = DateTimeMinValue;

    this.#statusBarItem = vscode.window.createStatusBarItem('timewarrior_time', vscode.StatusBarAlignment.Left);
    this.#statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    this.#statusBarItem.hide();
    this.#ignoreStatusBarItem = vscode.window.createStatusBarItem('timewarrior_time', vscode.StatusBarAlignment.Left);
    this.#ignoreStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.#ignoreStatusBarItem.text = '$(check)';
    this.#ignoreStatusBarItem.command = 'timewarrior.ignoreTimeBasedInterval';
    this.#ignoreStatusBarItem.tooltip = 'ignore current interval';
    this.#ignoreStatusBarItem.hide();

    this.subscriptions.push(
      ...[
        {
          dispose: () => clearInterval(this.#timer),
        },
        this.#statusBarItem,
        this.#ignoreStatusBarItem,
        vscode.workspace.onDidChangeConfiguration(e => {
          if (e.affectsConfiguration('timewarrior')) {
            this.refreshInterval();
          }
        }),
        dataFileEvent(async dataFiles => {
          this.#activeDataFile = dataFiles.find(obj => obj.isActive);
          if (this.#activeDataFile) {
            const intervals = await this.#activeDataFile.getIntervals();
            this.#tagsLastChanged = intervals.reduce((prev, curr) => {
              if (curr.start > prev) {
                return curr.start;
              }
              return prev;
            }, this.#tagsLastChanged);
            this.resetCurrentInterval();
          }
        }),
        vscode.commands.registerCommand('timewarrior.ignoreTimeBasedInterval', () => {
          this.#statusBarItem.hide();
          this.#ignoreStatusBarItem.hide();
        }),
      ]
    );
  }

  private resetCurrentInterval() {
    if (this.#currentInterval) {
      this.#currentInterval = undefined;
      this.#statusBarItem.hide();
      this.#ignoreStatusBarItem.hide();
    }
  }

  private refreshInterval() {
    this.resetCurrentInterval();
    clearInterval(this.#timer);

    const config = getConfig().get('reminders');
    if (config?.ranges && config.ranges.length > 0) {
      const ranges = this.getIntervals(config.ranges);
      this.#timer = setInterval(async () => {
        if (this.#currentInterval) {
          if (
            this.isValidTime(
              this.#currentInterval.startTimeAsDate,
              new Date(),
              this.#currentInterval.showStatusBarDuration
            )
          ) {
            return;
          }
          this.resetCurrentInterval();
        }
        if (this.ignoreTimeSpanAfterLastCheckIn()) {
          return;
        }
        await this.checkRangesForCheckIn(ranges);
      }, (config.intervalTimeSpan || 30) * 1000);
    }
  }

  private async checkRangesForCheckIn(ranges: Array<PreparedReminderRange>) {
    const now = new Date();
    for (const range of ranges) {
      if (!this.isDayInPeriod(range, now)) {
        continue;
      }
      if (
        this.isValidTime(range.startTimeAsDate, now, range.showStatusBarDuration) &&
        !(await this.areTagsAlreadySet(range.tags))
      ) {
        if (range.force) {
          await timew('start', range.tags);
        } else {
          this.showStatusBarItems(range);
        }
        return;
      }
      if (
        this.isValidTime(range.endtimeAsDate, now, range.showStatusBarDuration) &&
        (await this.areTagsAlreadySet(range.tags))
      ) {
        await vscode.commands.executeCommand('timewarrior.startPrevTag');
      }
    }
  }

  private async areTagsAlreadySet(tags: Array<string> | undefined) {
    if (this.#activeDataFile) {
      const intervals = await this.#activeDataFile.getIntervals();

      const lastItem = intervals.slice().pop();
      if (lastItem) {
        return lastItem.tags.join('') === (tags || [])?.join('');
      }
    }
    return false;
  }

  private showStatusBarItems(interval: PreparedReminderRange) {
    this.#currentInterval = interval;
    this.#statusBarItem.text = interval.message || `$(pinned) ${interval.tags?.join(' ')}`;
    if (interval.tags) {
      this.#statusBarItem.tooltip = `check in tags: ${interval.tags.join(' ')}`;
    }
    this.#statusBarItem.command = {
      command: 'timewarrior.startNoTags',
      arguments: interval.tags,
      title: this.#statusBarItem.text,
    };
    this.#statusBarItem.show();
    this.#ignoreStatusBarItem.show();
  }

  private isValidTime(time: Date | undefined, now: Date, showStatusBarDuration: number | undefined) {
    if (time) {
      const timeSince = time.getTime() - now.getTime();
      const duration = (showStatusBarDuration || 2) * 1000 * 60;
      return Math.abs(timeSince) < duration;
    }
    return false;
  }

  private isDayInPeriod(range: PreparedReminderRange, now: Date): boolean {
    if (range.daysToRepeatDateAsDate && range.daysToRepeat) {
      const dateSince = now.getTime() - range.daysToRepeatDateAsDate.getTime();
      const days = dateSince / MILLISECONDS_IN_DAY;
      return days % range.daysToRepeat === 0;
    }
    return true;
  }

  private ignoreTimeSpanAfterLastCheckIn(): boolean {
    const now = new Date();
    const config = getConfig().get('reminders');
    const minTimeSpanWithouthChange = (config?.preventNewReminderTimeSpan || 120) * 1000;
    if (now.getTime() - this.#tagsLastChanged.getTime() > minTimeSpanWithouthChange) {
      return false;
    }
    return true;
  }

  private getIntervals(intervals: Array<ReminderRange>) {
    return intervals.map(obj => {
      const result: PreparedReminderRange = {
        ...obj,
      };
      if (result.startTime) {
        result.startTimeAsDate = parseLocalDate(result.startTime, 'HH:mm');
      }
      if (result.endTime) {
        result.endtimeAsDate = parseLocalDate(result.endTime, 'HH:mm');
      }
      if (result.daysToRepeatDate) {
        result.daysToRepeatDateAsDate = parseLocalDate(result.daysToRepeatDate);
      }
      return result;
    });
  }
}
