<p align="center">
<img src="https://github.com/AnWeber/vscode-timewarrior/raw/main/icon.png" alt="Timewarrior" />
</p>
# timewarrior

[Timewarrior](https://timewarrior.net/docs/) integration in VSCode

> It is expected that Timewarrior has been added to the PATH and can be called using `timew`.

## Features

- Timewarrior Sidebar to view tracked time
- StatusbarItem with tag in current tracked time
- commands to start/stop tracking
- `checkin` command to start/ stop tracked time with tag selection from list
  - recently used tags
  - tag extracted from current branch
  - config tags
- reminder and auto-track time for configurable ranges

### History view

- deterministic sorting (newest first)
- current year months shown on top level
- previous years grouped in collapsible year nodes
- ongoing intervals shown as `start - now`

### Month summary view

- month action button in History view
- pie chart per tag
- summary table with tracked time per tag
- total row in summary table
- additional per-tag summary if entries contain multiple tags
- estimation column for current/future months

### Day editor

- day action button in History view
- editable rows with start/end time picker
- tag input with completion
- add/remove rows
- keyboard navigation and shortcuts
  - `Tab` / `Shift+Tab`
  - `Ctrl+Enter` add row
  - `Ctrl+Backspace` remove row
- inline validation before save
- save keeps editor open
- open month summary refreshes after day save

### UI

- time and duration values in webviews use a monospace style (editor font first)

## Usage

### Run in development mode

1. Open this repository in VS Code
2. Run:

   ```bash
   npm install
   npm run compile
   ```

3. Press `F5` to open the Extension Development Host

### Use the new actions

- In the History view, click the graph icon on a month to open Month summary
- In the History view, click the edit icon on a day to open Day editor

### Build and install your fork

```bash
npm run package:local
code --install-extension ./timewarrior-0.7.0.vsix --force
```

![Main Screen](https://github.com/AnWeber/vscode-timewarrior/raw/main/docs/main_screen.png)

## Ideas

- overlap/conflict detection assistant in day editor
- export month summary to CSV/Markdown
- optional custom color mapping for tags in charts

## License

[MIT License](LICENSE)

## Change Log

[CHANGELOG](CHANGELOG.md)
