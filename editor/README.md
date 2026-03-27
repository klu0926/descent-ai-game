# Enemy Editor

Local web editor that reads and writes enemy data files in this project.

## Run

```bash
node editor/server.js
```

Or on Windows, double-click:

- `editor/start-editor.bat` to start
- `editor/stop-editor.bat` to stop

Open:

```text
http://127.0.0.1:8787
```

## What it does

- Loads all enemies from `entity/enemy_class/*/*_data.js`
- Lets you filter and edit enemy fields in a table
- Saves edits back to each enemy `*_data.js` file
- Lets you add a new enemy
- Updates `entity/enemy_class/index.js` automatically after adding

## Notes

- This is a local dev tool meant to run on your machine.
- It writes directly to source files, so use git to review changes.
