import { Interval } from './interval';
import * as vscode from 'vscode';
import { formatDate } from './dateUtils';
import { basename } from 'path';

export class DataFile {

  private _intervals: Array<Interval> | undefined;
  constructor(public readonly uri: vscode.Uri) {
  }

  public get name() {
    return basename(this.uri.toString());
  }

  public get isActive() {
    return this.name === `${formatDate(new Date(), 'YYYY-MM')}.data`;
  }

  public async getIntervals() {
    if (this._intervals) {
      return this._intervals;
    }
    const content = Buffer.from(await vscode.workspace.fs.readFile(this.uri)).toString('utf-8');

    const intervals: Array<Interval> = [];

    for (const line of content.split(/\r?\n/gu)) {
      if (line.trim()) {
        const interval = new Interval(line);
        if (interval.start) {
          intervals.push(interval);
        }
      }
    }
    this._intervals = intervals;
    return intervals;
  }

}
