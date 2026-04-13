# Build: `copilot-auto-keep` VS Code extension

## Goal

Build a VS Code extension that automatically accepts (keeps) all pending GitHub Copilot Agent edits as soon as they appear, so the user never has to click the "Keep" button again. The user uses git for undo and does not want the review UI interrupting their flow.

This is a widely-requested feature with no built-in VS Code setting (see GitHub Community discussion #185857). We're building the workaround.

Target: Windows 11 / WSL2 primary, cross-platform where possible.

## Behavior spec

When GitHub Copilot Agent (or any equivalent chat edit flow) produces pending file edits that surface the "Keep / Undo" review UI, the extension should automatically fire the "Keep All" action without user input. The user should never see or interact with the Keep/Undo buttons again.

Must NOT fire when:
- The extension is disabled via a setting (default: enabled).
- There are no pending edits.

Should fire when:
- Copilot Agent has finished streaming and one or more files have pending keep/undo state.
- A reasonable debounce window has elapsed so we don't accept mid-stream. Start with 300ms idle after the last edit signal before firing.

## Investigation required (do this FIRST)

The user has confirmed via their VS Code Keyboard Shortcuts UI that:

- **Keep current file**: bound to `Ctrl+Shift+Y`
- **Keep all files**: bound to `Ctrl+Enter`

Your first task is to discover the actual command IDs behind these keybindings, the context key(s) that gate them (the `when` clause), and any relevant events. Steps:

1. Open VS Code's `keybindings.json` via Command Palette → "Preferences: Open Keyboard Shortcuts (JSON)".
2. Or inspect via Command Palette → "Preferences: Open Default Keyboard Shortcuts (JSON)" and search for `ctrl+enter` and `ctrl+shift+y` entries with Copilot/chat scope.
3. Note the `command` field and the `when` clause. The command is what we'll invoke. The `when` clause names context key(s) we can subscribe to.
4. Likely candidates to verify: `chatEditor.action.acceptHunk`, `chatEditing.acceptAllFiles`, `workbench.action.chat.applyAll`, `chatEditor.action.accept`, or similar. Do not guess — verify by inspecting keybindings.

Also run Command Palette → "Developer: Inspect Context Keys" while the Keep/Undo UI is visible, to learn which context keys are currently true. This tells us what to listen for.

**Document findings in the README** so future debugging is possible when VS Code inevitably renames these internals.

## Implementation approach

Once command IDs and trigger context keys are known:

1. On activation, listen for changes to the relevant context key(s) via `vscode.commands.executeCommand('getContextKeyInfo')` if available, or more realistically: poll via `vscode.commands.executeCommand` against a cheap "are there pending edits?" signal, or use the `vscode.chat` / `vscode.lm` APIs if they expose edit state.
2. When pending-edits state transitions from false to true, start a debounce timer (300ms default, configurable).
3. When the timer fires, execute the "Keep all files" command via `vscode.commands.executeCommand('<command-id>')`.
4. If the command fails (e.g. wrong ID across VS Code versions), log to output channel "Copilot Auto-Keep" and fall back to the single-file command in a loop if that's the only thing that works.

### Fallback strategy if no clean event hook exists

If the VS Code API does not expose a clean way to observe pending-edits state:

- Register a listener on `vscode.workspace.onDidChangeTextDocument` filtered to the workspace.
- After any burst of programmatic changes (heuristic: changes not made via direct user keystroke), start the debounce timer and fire the accept command.
- The accept command is a no-op when there's nothing to accept, so false-positives are harmless.

Prefer the context-key approach if feasible; fall back to document-change heuristic if not.

## Package.json essentials

- `name`: `copilot-auto-keep`
- `publisher`: `throughline` (Throughline Technical Services LLC)
- `displayName`: `Copilot Auto-Keep`
- `description`: `Automatically accepts GitHub Copilot Agent edits so you never see the Keep/Undo review UI. For people who use git as their undo system.`
- `engines.vscode`: `^1.85.0`
- `categories`: `["Other"]`
- `activationEvents`: `["onStartupFinished"]`
- `main`: `./out/extension.js`

### Configuration

```json
"contributes": {
  "configuration": {
    "title": "Copilot Auto-Keep",
    "properties": {
      "copilotAutoKeep.enabled": {
        "type": "boolean",
        "default": true,
        "description": "Automatically accept pending Copilot Agent edits."
      },
      "copilotAutoKeep.debounceMs": {
        "type": "number",
        "default": 300,
        "minimum": 0,
        "maximum": 10000,
        "description": "Milliseconds to wait after the last edit signal before auto-accepting."
      },
      "copilotAutoKeep.acceptCommand": {
        "type": "string",
        "default": "",
        "description": "Override the VS Code command ID used to accept all edits. Leave empty to use the default discovered for your VS Code version."
      }
    }
  },
  "commands": [
    {
      "command": "copilotAutoKeep.toggle",
      "title": "Copilot Auto-Keep: Toggle"
    },
    {
      "command": "copilotAutoKeep.acceptNow",
      "title": "Copilot Auto-Keep: Accept Pending Edits Now"
    }
  ]
}
```

### Status bar item

- Small status bar item showing `$(check) Auto-Keep` when enabled, `$(circle-slash) Auto-Keep` when disabled.
- Click fires `copilotAutoKeep.toggle`.
- Tooltip describes current state.

## Implementation notes

- TypeScript, compiled to `out/`. Standard `yo code` scaffold.
- Single `src/extension.ts`, no runtime deps beyond `@types/vscode` and `@types/node`.
- Create output channel "Copilot Auto-Keep" and log:
  - Discovered command ID on activation.
  - Each auto-accept invocation with timestamp and success/failure.
  - Config changes.
- Guard against rapid-fire: if an auto-accept is in flight, ignore new signals until it completes.
- Honor live config changes via `vscode.workspace.onDidChangeConfiguration`.

## Deliverables

1. Complete project scaffolded in new directory `copilot-auto-keep/`.
2. `package.json`, `tsconfig.json`, `src/extension.ts`, `.vscodeignore`, `README.md`, `LICENSE` (MIT, copyright Dan / Throughline Technical Services LLC).
3. Working build: `npm install && npm run compile` with zero errors.
4. Packaged `.vsix` via `npx vsce package`.
5. README including:
   - Install instructions.
   - Clear statement that this is a workaround for a missing Microsoft feature (link GitHub Community #185857).
   - Documented command IDs and context keys discovered during investigation, with a note that Microsoft may rename these.
   - The `copilotAutoKeep.acceptCommand` override setting, for when that rename inevitably happens.
   - Caveat: "This removes a safety net. Use git. You have been warned."

## Out of scope for v1

- Per-file acceptance rules (accept some files, leave others pending).
- Integration with other AI agents (Cursor, Windsurf, Claude Code). Focus on GitHub Copilot Agent mode only.
- Automatic rejection / undo. This tool only keeps.
- Publishing to the VS Code marketplace. Local `.vsix` install only.

## Test checklist (manual)

- [ ] Fire up Copilot Agent mode, ask it to make an edit → edit is auto-kept without user interaction, Keep/Undo UI never appears or disappears quickly.
- [ ] Multi-file edits → all files auto-kept in a single action.
- [ ] Set `copilotAutoKeep.enabled` to false → Keep/Undo UI returns to normal manual behavior.
- [ ] Status bar item toggles state correctly on click.
- [ ] `Copilot Auto-Keep: Accept Pending Edits Now` command works manually.
- [ ] Command override: set `copilotAutoKeep.acceptCommand` to a bogus value → extension logs error, does not crash, Keep/Undo UI returns to manual.
- [ ] VS Code restart: extension re-activates cleanly, status bar present.
- [ ] Output channel shows useful logs.

## Attribution & repo hygiene

- Public GitHub repo.
- README links GitHub Community discussion #185857.
- No Co-Authored-By trailer in commits.
- Single hyphens, not em dashes, in all written content.