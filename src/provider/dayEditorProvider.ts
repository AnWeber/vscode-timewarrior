import * as vscode from 'vscode';
import { DisposeProvider, formatDate, Interval } from '../dataAccess';
import { DateIntervals } from './treeItem';
import { MonthSummaryProvider } from './monthSummaryProvider';

interface DayEditorRow {
  start: string;
  end: string;
  tags: string;
}

export class DayEditorProvider extends DisposeProvider {
  readonly #dayEditorPanels = new Map<string, vscode.WebviewPanel>();

  constructor(private readonly _monthSummaryProvider: MonthSummaryProvider) {
    super();

    this.subscriptions = [vscode.commands.registerCommand('timewarrior.dayEditor', this.dayEditor, this)];
  }

  private async dayEditor(day?: DateIntervals): Promise<void> {
    if (!day?.dataFile) {
      vscode.window.showInformationMessage('No day selected for editing.');
      return;
    }

    const key = `${day.dataFile.uri.toString()}_${day.start.toDateString()}`;
    const existingPanel = this.#dayEditorPanels.get(key);
    if (existingPanel) {
      existingPanel.reveal(vscode.ViewColumn.Active);
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
        retainContextWhenHidden: true,
      }
    );
    this.#dayEditorPanels.set(key, panel);
    panel.onDidDispose(() => this.#dayEditorPanels.delete(key));
    panel.webview.html = this.getDayEditorHtml(title, rows, tagOptions);
    panel.webview.onDidReceiveMessage(
      async message => {
        if (message?.type !== 'save') {
          return;
        }
        try {
          await this.saveDay(day, message.rows as Array<DayEditorRow>);
          await vscode.commands.executeCommand('timewarrior.refreshHistory');
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
      if (Number.isNaN(startHour) || Number.isNaN(startMinute) || Number.isNaN(endHour) || Number.isNaN(endMinute)) {
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
    await vscode.workspace.fs.writeFile(day.dataFile.uri, new TextEncoder().encode(content ? `${content}\n` : ''));
    day.dataFile.invalidateIntervals();

    this._monthSummaryProvider.refreshMonthDataFile(day.dataFile);
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
  <td><input class="tags-input" type="text" list="timewarrior-tags" value="${this.escapeHtml(
    row.tags
  )}" placeholder="tag1, tag2"></td>
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

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
