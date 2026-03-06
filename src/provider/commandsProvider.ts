import * as vscode from 'vscode';
import { DataFile, DisposeProvider, formatDate, formatDuration, Interval, timew } from '../dataAccess';
import { DateIntervals } from './treeItem';
import * as actions from './actions';

interface DayEditorRow {
  start: string;
  end: string;
  tags: string;
}

interface TagSummary {
  tag: string;
  duration: number;
  estimatedDuration: number;
}

interface MonthSummary {
  title: string;
  dailyDurations: Array<number>;
  totalDuration: number;
  tags: Array<TagSummary>;
  individualTags: Array<TagSummary>;
  hasMultiTagIntervals: boolean;
  showEstimation: boolean;
  estimationLabel: string;
}

export class CommandsProvider extends DisposeProvider {
  #activeDataFile: DataFile | undefined;
  #monthSummaryPanels = new Map<string, vscode.WebviewPanel>();
  constructor() {
    super();

    this.subscriptions = [
      vscode.commands.registerCommand('timewarrior.start', this.start, this),
      vscode.commands.registerCommand('timewarrior.startNoTags', this.startNoTags, this),
      vscode.commands.registerCommand('timewarrior.startPrevTag', this.startPrevTag, this),
      vscode.commands.registerCommand('timewarrior.tag', this.tag, this),
      vscode.commands.registerCommand('timewarrior.stop', this.stop, this),
      vscode.commands.registerCommand('timewarrior.checkIn', this.checkIn, this),
      vscode.commands.registerCommand('timewarrior.edit', this.edit, this),
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
    if (tags?.length) {
      await timew('tag', tags);
    }
  }

  private async stop() {
    await timew('stop');
  }

  private async checkIn() {
    const actions = await this.getActions();
    const result =
      actions.length > 1
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

  private async edit(): Promise<void> {
    if (this.#activeDataFile) {
      const uri = this.#activeDataFile.uri;
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    }
  }

  private async monthSummary(dataFile?: DataFile): Promise<void> {
    const target = dataFile || this.#activeDataFile;
    if (!target) {
      vscode.window.showInformationMessage('No month selected for summary.');
      return;
    }

    const key = target.uri.toString();
    const existingPanel = this.#monthSummaryPanels.get(key);
    if (existingPanel) {
      existingPanel.reveal(vscode.ViewColumn.Active);
      await this.renderMonthSummaryPanel(existingPanel, target);
      return;
    }

    const panel = vscode.window.createWebviewPanel('timewarrior_month_summary', '', vscode.ViewColumn.Active, {
      enableFindWidget: true,
    });
    this.#monthSummaryPanels.set(key, panel);
    panel.onDidDispose(() => {
      this.#monthSummaryPanels.delete(key);
    });
    await this.renderMonthSummaryPanel(panel, target);
  }

  private async renderMonthSummaryPanel(panel: vscode.WebviewPanel, dataFile: DataFile) {
    const summary = await this.createMonthSummary(dataFile);
    panel.title = `Timewarrior ${summary.title}`;
    panel.webview.html = this.getMonthSummaryHtml(summary);
  }

  private refreshOpenMonthSummaries(dataFiles: Array<DataFile>) {
    for (const [uri, panel] of this.#monthSummaryPanels.entries()) {
      const dataFile = dataFiles.find(obj => obj.uri.toString() === uri);
      if (dataFile) {
        this.renderMonthSummaryPanel(panel, dataFile);
      }
    }
  }

  private async dayEditor(day?: DateIntervals): Promise<void> {
    if (!day?.dataFile) {
      vscode.window.showInformationMessage('No day selected for editing.');
      return;
    }

    const allIntervals = await day.dataFile.getIntervals();
    const tagOptions = Array.from(new Set(allIntervals.flatMap(interval => interval.tags))).sort((obj1, obj2) =>
      obj1.localeCompare(obj2)
    );
    const rows = day.intervals
      .slice()
      .sort((obj1, obj2) => obj1.start.getTime() - obj2.start.getTime())
      .map(interval => ({
        start: this.getTimeInputValue(interval.start),
        end: this.getTimeInputValue(interval.end || new Date()),
        tags: interval.tags.join(', '),
      }));

    const title = day.start.toLocaleDateString();
    const panel = vscode.window.createWebviewPanel(
      'timewarrior_day_editor',
      `Timewarrior day ${title}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        enableFindWidget: true,
      }
    );
    panel.webview.html = this.getDayEditorHtml(title, rows, tagOptions);

    panel.webview.onDidReceiveMessage(
      async message => {
        if (message?.type !== 'save') {
          return;
        }
        try {
          await this.saveDay(day, message.rows as Array<DayEditorRow>);
          await vscode.commands.executeCommand('timewarrior.refreshHistory');
          await vscode.commands.executeCommand('timewarrior.refreshToday');
          vscode.window.showInformationMessage(`Saved ${title}`);
        } catch (err) {
          const text = err instanceof Error ? err.message : `${err}`;
          vscode.window.showErrorMessage(`Could not save day: ${text}`);
        }
      },
      undefined,
      this.subscriptions
    );
  }

  private async saveDay(day: DateIntervals, rows: Array<DayEditorRow>) {
    const cleanedRows = rows
      .map(row => ({
        start: (row.start || '').trim(),
        end: (row.end || '').trim(),
        tags: (row.tags || '').trim(),
      }))
      .filter(row => row.start && row.end);

    const targetYear = day.start.getFullYear();
    const targetMonth = day.start.getMonth();
    const targetDate = day.start.getDate();

    const replacementIntervals = cleanedRows.map(row => {
      const [startHour, startMinute] = row.start.split(':').map(Number);
      const [endHour, endMinute] = row.end.split(':').map(Number);
      if (
        Number.isNaN(startHour) ||
        Number.isNaN(startMinute) ||
        Number.isNaN(endHour) ||
        Number.isNaN(endMinute)
      ) {
        throw new TypeError('Invalid time values.');
      }

      const start = new Date(targetYear, targetMonth, targetDate, startHour, startMinute, 0, 0);
      const end = new Date(targetYear, targetMonth, targetDate, endHour, endMinute, 0, 0);
      if (end <= start) {
        throw new Error(`End time must be after start time (${row.start} - ${row.end}).`);
      }

      const tags = row.tags
        ? row.tags
          .split(',')
          .map(obj => obj.trim())
          .filter(Boolean)
        : [];
      const tagList = tags.map(obj => (obj.includes(' ') ? `"${obj}"` : obj)).join(' ');
      const tagsText = tagList ? ` # ${tagList}` : '';
      return new Interval(`inc ${formatDate(start)} - ${formatDate(end)}${tagsText}`);
    });

    const intervals = await day.dataFile.getIntervals();
    const kept = intervals.filter(interval => !this.isSameDay(interval.start, day.start));
    const merged = [...kept, ...replacementIntervals].sort((obj1, obj2) => obj1.start.getTime() - obj2.start.getTime());
    const content = merged.map(interval => `inc ${interval.fileFormat}`).join('\n');
    await vscode.workspace.fs.writeFile(day.dataFile.uri, Buffer.from(content ? `${content}\n` : '', 'utf-8'));
    day.dataFile.invalidateIntervals();

    const monthPanel = this.#monthSummaryPanels.get(day.dataFile.uri.toString());
    if (monthPanel) {
      await this.renderMonthSummaryPanel(monthPanel, day.dataFile);
    }
  }

  private getTimeInputValue(date: Date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private isSameDay(date1: Date, date2: Date) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private getDayEditorHtml(title: string, rows: Array<DayEditorRow>, tagOptions: Array<string>) {
    const tagsDatalist = tagOptions.map(tag => `<option value="${this.escapeHtml(tag)}"></option>`).join('');
    const rowsHtml = rows
      .map(
        row => `<tr>
        <td><input class="time-input mono" type="time" value="${this.escapeHtml(row.start)}"></td>
        <td><input class="time-input mono" type="time" value="${this.escapeHtml(row.end)}"></td>
  <td><input class="tags-input" type="text" list="timewarrior-tags" value="${this.escapeHtml(row.tags)}" placeholder="tag1, tag2"></td>
  <td><button class="remove-btn" type="button" title="Remove row">Remove</button></td>
</tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day editor ${this.escapeHtml(title)}</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 16px; }
    h1 { margin: 0 0 10px 0; }
    .actions { display: flex; gap: 8px; margin-bottom: 12px; }
    button { border: 1px solid var(--vscode-button-border); background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 4px; padding: 6px 10px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--vscode-panel-border); padding: 6px; text-align: left; }
    tr.invalid td { background: color-mix(in srgb, var(--vscode-inputValidation-errorBackground) 35%, transparent); }
    .time-input { width: 110px; }
    .tags-input { width: 100%; }
    input { border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px; padding: 4px 6px; }
    .mono { font-family: var(--vscode-editor-font-family), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-variant-numeric: tabular-nums; }
    .time-input { font-family: var(--vscode-editor-font-family), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-variant-numeric: tabular-nums; }
    .hint { color: var(--vscode-descriptionForeground); margin: 8px 0 14px 0; }
    .status { margin: 8px 0 12px 0; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <h1>Day editor: ${this.escapeHtml(title)}</h1>
  <div class="hint">Use Tab / Shift+Tab to navigate. Ctrl+Enter adds a row. Ctrl+Backspace removes the current row.</div>
  <div class="actions">
    <button id="add-row" type="button">Add entry</button>
    <button id="save" type="button">Save</button>
  </div>
  <div id="status" class="status"></div>
  <datalist id="timewarrior-tags">${tagsDatalist}</datalist>
  <table>
    <thead>
      <tr><th>Start</th><th>End</th><th>Tags</th><th>Action</th></tr>
    </thead>
    <tbody id="rows">${rowsHtml}</tbody>
  </table>

  <script>
    const vscode = acquireVsCodeApi();
    const rowsBody = document.getElementById('rows');
    const status = document.getElementById('status');
    const saveButton = document.getElementById('save');

    const isValidTime = value => /^[0-9]{2}:[0-9]{2}$/.test(value);
    const toMinutes = value => {
      const [hour, minute] = value.split(':').map(Number);
      return hour * 60 + minute;
    };

    const validateRow = row => {
      const inputs = row.querySelectorAll('input');
      const start = inputs[0] ? inputs[0].value : '';
      const end = inputs[1] ? inputs[1].value : '';
      if (!isValidTime(start) || !isValidTime(end)) {
        return 'Start and end must be valid time values.';
      }
      if (toMinutes(end) <= toMinutes(start)) {
        return 'End must be after start.';
      }
      return '';
    };

    const refreshValidation = () => {
      const invalidMessages = [];
      const rows = Array.from(rowsBody.querySelectorAll('tr'));
      rows.forEach((row, index) => {
        const message = validateRow(row);
        row.classList.toggle('invalid', !!message);
        if (message) {
          invalidMessages.push('Row ' + (index + 1) + ': ' + message);
        }
      });

      if (invalidMessages.length > 0) {
        status.textContent = invalidMessages[0];
        saveButton.disabled = true;
      } else {
        status.textContent = rows.length > 0 ? 'All rows valid.' : 'No entries. Add at least one row to save.';
        saveButton.disabled = rows.length === 0;
      }
    };

    const createRow = (start = '09:00', end = '17:00', tags = '') => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td><input class="time-input mono" type="time"></td><td><input class="time-input mono" type="time"></td><td><input class="tags-input" type="text" list="timewarrior-tags" placeholder="tag1, tag2"></td><td><button class="remove-btn" type="button" title="Remove row">Remove</button></td>';
      tr.querySelectorAll('input')[0].value = start;
      tr.querySelectorAll('input')[1].value = end;
      tr.querySelectorAll('input')[2].value = tags;
      return tr;
    };

    const addRow = (start = '09:00', end = '17:00', tags = '') => {
      const row = createRow(start, end, tags);
      rowsBody.appendChild(row);
      row.querySelector('input').focus();
      refreshValidation();
    };

    document.getElementById('add-row').addEventListener('click', () => addRow());

    rowsBody.addEventListener('click', event => {
      const target = event.target;
      if (target instanceof HTMLButtonElement && target.classList.contains('remove-btn')) {
        const row = target.closest('tr');
        if (row) {
          row.remove();
          refreshValidation();
        }
      }
    });

    rowsBody.addEventListener('input', () => {
      refreshValidation();
    });

    document.addEventListener('keydown', event => {
      const target = event.target;
      const row = target instanceof HTMLElement ? target.closest('tr') : null;
      if (!(row instanceof HTMLTableRowElement)) {
        return;
      }

      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        const newRow = createRow();
        row.insertAdjacentElement('afterend', newRow);
        newRow.querySelector('input').focus();
      }

      if (event.ctrlKey && event.key === 'Backspace') {
        event.preventDefault();
        const next = row.nextElementSibling || row.previousElementSibling;
        row.remove();
        refreshValidation();
        if (next instanceof HTMLTableRowElement) {
          const firstInput = next.querySelector('input');
          if (firstInput) {
            firstInput.focus();
          }
        }
      }
    });

    const collectRows = () => Array.from(rowsBody.querySelectorAll('tr')).map(row => {
      const inputs = row.querySelectorAll('input');
      return {
        start: inputs[0] ? inputs[0].value : '',
        end: inputs[1] ? inputs[1].value : '',
        tags: inputs[2] ? inputs[2].value : '',
      };
    });

    document.getElementById('save').addEventListener('click', () => {
      refreshValidation();
      if (saveButton.disabled) {
        return;
      }
      vscode.postMessage({ type: 'save', rows: collectRows() });
    });

    if (rowsBody.children.length === 0) {
      addRow();
    } else {
      refreshValidation();
    }
  </script>
</body>
</html>`;
  }

  private async createMonthSummary(dataFile: DataFile): Promise<MonthSummary> {
    const intervals = await dataFile.getIntervals();
    const year = dataFile.date.getFullYear();
    const month = dataFile.date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 1);

    const dailyDurations = Array.from({ length: daysInMonth }, () => 0);
    const tagDurations: Record<string, number> = {};
    const individualTagDurations: Record<string, number> = {};
    let hasMultiTagIntervals = false;

    for (const interval of intervals) {
      const hasMultipleTags = this.addIntervalToSummary(
        interval,
        monthStart,
        monthEnd,
        dailyDurations,
        tagDurations,
        individualTagDurations
      );
      if (hasMultipleTags) {
        hasMultiTagIntervals = true;
      }
    }

    const now = new Date();
    const monthIndex = year * 12 + month;
    const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
    const showEstimation = monthIndex >= currentMonthIndex;
    const estimationFactor = monthIndex === currentMonthIndex ? daysInMonth / Math.max(1, now.getDate()) : 1;

    const tags = Object.entries(tagDurations)
      .map(([tag, duration]) => ({
        tag,
        duration,
        estimatedDuration: duration * estimationFactor,
      }))
      .sort((obj1, obj2) => obj2.duration - obj1.duration);

    const individualTags = Object.entries(individualTagDurations)
      .map(([tag, duration]) => ({
        tag,
        duration,
        estimatedDuration: duration * estimationFactor,
      }))
      .sort((obj1, obj2) => obj2.duration - obj1.duration);

    return {
      title: dataFile.date.toLocaleString('default', { month: 'long', year: 'numeric' }),
      dailyDurations,
      totalDuration: dailyDurations.reduce((sum, curr) => sum + curr, 0),
      tags,
      individualTags,
      hasMultiTagIntervals,
      showEstimation,
      estimationLabel: monthIndex === currentMonthIndex ? 'Estimated month end' : 'Estimation',
    };
  }

  private addIntervalToSummary(
    interval: Interval,
    monthStart: Date,
    monthEnd: Date,
    dailyDurations: Array<number>,
    tagDurations: Record<string, number>,
    individualTagDurations: Record<string, number>
  ) {
    const intervalStart = interval.start;
    const intervalEnd = interval.end || new Date();
    const effectiveStart = new Date(Math.max(intervalStart.getTime(), monthStart.getTime()));
    const effectiveEnd = new Date(Math.min(intervalEnd.getTime(), monthEnd.getTime()));

    if (effectiveEnd <= effectiveStart) {
      return false;
    }

    const duration = effectiveEnd.getTime() - effectiveStart.getTime();
    this.addDurationByDay(effectiveStart, effectiveEnd, dailyDurations, monthStart);

    const tagKey = interval.tags.length > 0 ? interval.tags.join(', ') : 'no tag';
    this.addDurationToBucket(tagDurations, tagKey, duration);

    if (interval.tags.length > 0) {
      for (const tag of interval.tags) {
        this.addDurationToBucket(individualTagDurations, tag, duration);
      }
    } else {
      this.addDurationToBucket(individualTagDurations, 'no tag', duration);
    }

    return interval.tags.length > 1;
  }

  private addDurationToBucket(bucket: Record<string, number>, key: string, duration: number) {
    if (!bucket[key]) {
      bucket[key] = 0;
    }
    bucket[key] += duration;
  }

  private addDurationByDay(
    rangeStart: Date,
    rangeEnd: Date,
    dailyDurations: Array<number>,
    monthStart: Date
  ) {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    let cursor = new Date(rangeStart);
    while (cursor < rangeEnd) {
      const startOfDay = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      const segmentEnd = new Date(Math.min(endOfDay.getTime(), rangeEnd.getTime()));

      if (cursor.getFullYear() === year && cursor.getMonth() === month) {
        const dayIndex = cursor.getDate() - 1;
        if (dayIndex >= 0 && dayIndex < dailyDurations.length) {
          dailyDurations[dayIndex] += segmentEnd.getTime() - cursor.getTime();
        }
      }

      cursor = segmentEnd;
    }
  }

  private getMonthSummaryHtml(summary: MonthSummary) {
    const pieColors = [
      'var(--vscode-charts-blue)',
      'var(--vscode-charts-green)',
      'var(--vscode-charts-yellow)',
      'var(--vscode-charts-orange)',
      'var(--vscode-charts-purple)',
      'var(--vscode-charts-red)',
      'var(--vscode-charts-foreground)',
    ];
    const totalTagDuration = summary.tags.reduce((sum, curr) => sum + curr.duration, 0);
    let percentageOffset = 0;
    const pieSegments = summary.tags
      .map((tag, index) => {
        const start = percentageOffset;
        const slicePercent = totalTagDuration > 0 ? (tag.duration / totalTagDuration) * 100 : 0;
        percentageOffset += slicePercent;
        return `${pieColors[index % pieColors.length]} ${start}% ${percentageOffset}%`;
      })
      .join(', ');
    const pieBackground =
      totalTagDuration > 0
        ? `conic-gradient(${pieSegments})`
        : 'conic-gradient(var(--vscode-panel-border) 0% 100%)';
    const estimationHeaderCell = summary.showEstimation
      ? `<th class="num">${this.escapeHtml(summary.estimationLabel)}</th>`
      : '';
    const legendItems =
      summary.tags.length > 0
        ? summary.tags
          .map((tag, index) => {
            const ratio = totalTagDuration > 0 ? (tag.duration / totalTagDuration) * 100 : 0;
            const ratioLabel = `${ratio.toFixed(1)}%`;
            return `<div class="legend-row"><span class="legend-swatch" style="background:${pieColors[index % pieColors.length]};"></span><span class="legend-tag">${this.escapeHtml(tag.tag)}</span><span class="legend-value">${this.formatDuration(tag.duration)} · ${ratioLabel}</span></div>`;
          })
          .join('')
        : '<div class="muted">No tracked tags for this month.</div>';

    const emptyEstimationColumn = summary.showEstimation ? '<td class="num">00:00</td>' : '';
    const estimatedTotalDuration = summary.tags.reduce((sum, curr) => sum + curr.estimatedDuration, 0);
    const rows =
      summary.tags.length > 0
        ? summary.tags
          .map(tag => {
            const estimationColumn = summary.showEstimation
              ? `<td class="num">${this.formatDuration(tag.estimatedDuration)}</td>`
              : '';
            return `<tr><td>${this.escapeHtml(tag.tag)}</td><td class="num">${this.formatDuration(tag.duration)}</td>${estimationColumn}</tr>`;
          })
          .join('')
        : `<tr><td>no data</td><td class="num">00:00</td>${emptyEstimationColumn}</tr>`;
    const estimationTotalCell = summary.showEstimation
      ? `<th class="num">${this.formatDuration(estimatedTotalDuration)}</th>`
      : '';
    const totalRow = `<tr><th>Total</th><th class="num">${this.formatDuration(summary.totalDuration)}</th>${estimationTotalCell}</tr>`;

    const individualRows =
      summary.individualTags.length > 0
        ? summary.individualTags
          .map(tag => {
            const estimationColumn = summary.showEstimation
              ? `<td class="num">${this.formatDuration(tag.estimatedDuration)}</td>`
              : '';
            return `<tr><td>${this.escapeHtml(tag.tag)}</td><td class="num">${this.formatDuration(tag.duration)}</td>${estimationColumn}</tr>`;
          })
          .join('')
        : `<tr><td>no data</td><td class="num">00:00</td>${emptyEstimationColumn}</tr>`;
    const individualSummarySection = summary.hasMultiTagIntervals
      ? `<div class="section">
    <h2>Per-tag summary</h2>
    <table>
      <thead>
        <tr>
          <th>Tag</th>
          <th class="num">Tracked</th>
          ${estimationHeaderCell}
        </tr>
      </thead>
      <tbody>${individualRows}</tbody>
    </table>
  </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timewarrior ${this.escapeHtml(summary.title)}</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 16px; }
    h1, h2 { margin: 0 0 8px 0; font-weight: 600; }
    .muted { color: var(--vscode-descriptionForeground); margin-bottom: 14px; }
    .chart-wrap { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 12px; display: flex; gap: 14px; align-items: center; }
    .pie { width: 180px; height: 180px; border-radius: 50%; border: 1px solid var(--vscode-panel-border); flex: 0 0 auto; }
    .legend { flex: 1 1 auto; min-width: 220px; }
    .legend-row { display: grid; grid-template-columns: 12px minmax(120px, 1fr) auto; align-items: center; gap: 8px; margin-bottom: 6px; }
    .legend-swatch { width: 12px; height: 12px; border-radius: 2px; border: 1px solid var(--vscode-panel-border); }
    .legend-tag { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .legend-value { color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border); text-align: left; }
    th { font-weight: 600; }
    .num { text-align: right; font-family: var(--vscode-editor-font-family), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-variant-numeric: tabular-nums; }
    .section { margin-top: 18px; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(summary.title)} summary</h1>
  <div class="muted">Total tracked: ${this.formatDuration(summary.totalDuration)}</div>

  <div class="section">
    <h2>Month graph</h2>
    <div class="chart-wrap">
      <div class="pie" style="background:${pieBackground}"></div>
      <div class="legend">${legendItems}</div>
    </div>
  </div>

  <div class="section">
    <h2>Tag summary</h2>
    <table>
      <thead>
        <tr>
          <th>Tag</th>
          <th class="num">Tracked</th>
          ${estimationHeaderCell}
        </tr>
      </thead>
      <tbody>${rows}${totalRow}</tbody>
    </table>
  </div>
  ${individualSummarySection}
</body>
</html>`;
  }

  private formatDuration(duration: number) {
    return formatDuration(duration);
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll('\'', '&#39;');
  }
}
