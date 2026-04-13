# Build: `copilot-auto-keep` VS Code extension

## Goal

Build a VS Code extension that automatically handles GitHub Copilot Agent approval prompts so the user never has to click through review UI. The extension handles two tiers of approvals, each independently toggleable:

**Tier 1 (default: ON) — Auto-Keep**
Automatically accepts (keeps) all pending Copilot Agent file edits that surface the "Keep / Undo" review UI. These are edits already made to workspace files; git is the undo mechanism.

**Tier 2 (default: OFF) — Punch-Through**
Automatically approves VS Code's explicitly-gated "cannot be auto approved" dialogs that appear even when `chat.tools.global.autoApprove` is on. These include terminal write operations and other actions VS Code has specifically carved out as requiring human confirmation. This is a safety-off mode — it bypasses the last gate between the model and arbitrary filesystem/command execution. Default OFF for good reason.

This is a widely-requested feature with no built-in VS Code setting for Tier 1 (see GitHub Community discussion #185857) and no setting at all for Tier 2. We're building both workarounds behind clear toggles.

Target: Windows 11 / WSL2 primary, cross-platform where possible.

## Behavior spec

### Tier 1 — Auto-Keep (default ON)

When Copilot Agent produces pending file edits that surface the "Keep / Undo" review UI, auto-fire the "Keep All" command.

Must NOT fire when:
- Tier 1 is disabled via setting or runtime toggle.
- There are no pending edits.

Should fire when:
- Copilot Agent has finished streaming and one or more files have pending keep/undo state.
- A 300ms idle debounce has elapsed since the last edit signal.

### Tier 2 — Punch-Through (default OFF)

When VS Code shows a "cannot be auto approved" gated dialog (terminal write operations, sensitive file writes, and any other future gates Microsoft adds), auto-fire the Allow command for that dialog.

Must NOT fire when:
- Tier 2 is disabled via setting or runtime toggle.
- Current workspace is not trusted (`vscode.workspace.isTrusted === false`).
- First-time enable confirmation has not been completed (see below).

Must fire an **audit log entry** on every successful Tier 2 auto-approval: timestamp, dialog type, command text if available, file path if available. Logged to both the output channel and a persistent log file (`~/.copilot-auto-keep/audit.log`, with rotation at 10MB).

Must perform **per-dialog investigation, not a single-command assumption.** The "cannot be auto approved" class contains multiple distinct dialogs (terminal writes, sensitive file edits, other Microsoft-added gates), and each likely has its own command ID. The extension must:
1. During investigation (below), enumerate each gated dialog type.
2. Build an internal registry mapping context-key or dialog-type signal → approval command ID.
3. Dispatch based on which dialog is actually showing, not fire a catch-all.
4. Log any unrecognized dialog type to the output channel instead of guessing.

### First-time Tier 2 enable warning

The first time the user enables Tier 2 (via any path: setting, command, status bar click), show a modal warning dialog:

```
Enabling Punch-Through Mode

This disables VS Code's last safety gate on AI-generated actions, including
terminal commands that write files outside your workspace. If a prompt injection
attack ever lands in your Copilot context, this gate is what would stop it.

git undo does not protect against this.

Enable anyway?

[Enable for this session only]  [Enable persistently]  [Cancel]
```

"Session only" enables Tier 2 until VS Code restart, then auto-reverts to off. "Persistently" sets the configuration value. "Cancel" leaves it off. Store a flag indicating the warning has been shown so subsequent toggles skip it.

## Investigation required (do this FIRST)

The user has confirmed via their VS Code Keyboard Shortcuts UI that:

- **Keep current file** (Tier 1): bound to `Ctrl+Shift+Y`
- **Keep all files** (Tier 1): bound to `Ctrl+Enter`
- **Allow gated terminal write** (Tier 2): also bound to `Ctrl+Enter` when the gated dialog is focused — which means the same keybinding routes to different commands based on which dialog is active. Investigation must confirm this and identify the distinct command IDs.

Your first task is to discover the actual command IDs behind each keybinding, the context key(s) that gate them (the `when` clause), and any relevant events.

### For Tier 1 (Keep/Undo)

1. Open VS Code's default keybindings via Command Palette → "Preferences: Open Default Keyboard Shortcuts (JSON)".
2. Search for `ctrl+enter` and `ctrl+shift+y` entries with a Copilot/chat-edit scope.
3. Note the `command` field and the `when` clause for each. Context keys like `chatEditsPending` or similar tell us what to listen for.
4. Likely candidates to verify (do not guess — confirm by inspection): `chatEditor.action.acceptHunk`, `chatEditing.acceptAllFiles`, `workbench.action.chat.applyAll`, `chatEditor.action.accept`.

### For Tier 2 (Punch-Through)

1. Trigger a gated dialog (simplest reproduction: ask Copilot Agent to run a PowerShell/bash command that writes a file to `/tmp` or outside the workspace).
2. While the "cannot be auto approved" dialog is visible, open Command Palette → "Developer: Inspect Context Keys" and click on the dialog. Record every context key that is currently true, especially any matching `chat.*`, `terminal.*`, `tool.*`, or `approval.*` namespaces.
3. With the dialog still visible, check Keyboard Shortcuts for what `ctrl+enter` is bound to in this context. The `when` clause will be different from Tier 1. Record the command ID.
4. Repeat for as many distinct gated-dialog variants as you can reproduce: terminal write, sensitive file write, any others surfaced by Microsoft in current VS Code versions.
5. Build a registry: `{ contextKeyPattern → commandId }` for each.

**Document all findings in the README.** These internals change frequently and the user needs to be able to diagnose breakage.

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
      "copilotAutoKeep.autoKeep.enabled": {
        "type": "boolean",
        "default": true,
        "description": "Tier 1: Automatically accept pending Copilot Agent edits (Keep/Undo review UI)."
      },
      "copilotAutoKeep.punchThrough.enabled": {
        "type": "boolean",
        "default": false,
        "description": "Tier 2: Automatically approve VS Code's 'cannot be auto approved' gated dialogs, including terminal write operations. This bypasses the last safety gate between the AI model and arbitrary execution. Default OFF. Requires trusted workspace."
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
        "description": "Override the VS Code command ID used to accept all Tier 1 edits. Leave empty to use the default discovered for your VS Code version."
      },
      "copilotAutoKeep.punchThroughCommands": {
        "type": "object",
        "default": {},
        "description": "Override the context-key → command-ID registry for Tier 2 gated dialogs. Leave empty to use defaults discovered for your VS Code version."
      }
    }
  },
  "commands": [
    {
      "command": "copilotAutoKeep.autoKeep.toggle",
      "title": "Copilot Auto-Keep: Toggle Tier 1 (Auto-Keep)"
    },
    {
      "command": "copilotAutoKeep.punchThrough.toggle",
      "title": "Copilot Auto-Keep: Toggle Tier 2 (Punch-Through)"
    },
    {
      "command": "copilotAutoKeep.punchThrough.enableForSession",
      "title": "Copilot Auto-Keep: Enable Punch-Through for This Session Only"
    },
    {
      "command": "copilotAutoKeep.panicDisable",
      "title": "Copilot Auto-Keep: PANIC — Disable Everything Now"
    },
    {
      "command": "copilotAutoKeep.acceptNow",
      "title": "Copilot Auto-Keep: Accept Pending Edits Now"
    },
    {
      "command": "copilotAutoKeep.openAuditLog",
      "title": "Copilot Auto-Keep: Open Audit Log"
    }
  ],
  "keybindings": [
    {
      "command": "copilotAutoKeep.panicDisable",
      "key": "ctrl+alt+k",
      "mac": "cmd+alt+k"
    }
  ]
}
```

### Status bar item

Status bar item must visually distinguish the three safety states:

- **Both tiers OFF**: `$(circle-slash) Auto-Keep` in default color.
- **Tier 1 ON, Tier 2 OFF** (normal operation): `$(check) Auto-Keep` in default color.
- **Tier 1 ON, Tier 2 ON** (danger mode): `$(warning) Auto-Keep + PUNCH` in `statusBarItem.warningBackground` color (yellow/orange). This must be peripheral-vision obvious.
- **Tier 2 ON in session-only mode**: append `(session)` to the label.

Click opens a quick pick menu:
- Toggle Tier 1
- Toggle Tier 2 (persistent)
- Enable Tier 2 for session only
- Open audit log
- Panic disable everything

Tooltip shows current state of each tier and whether Tier 2 is session-only.

### Panic kill-switch

Keybinding `Ctrl+Alt+K` (Mac: `Cmd+Alt+K`) fires `copilotAutoKeep.panicDisable` which:
1. Sets both tier enabled settings to false immediately (global scope so it survives reload).
2. Logs the panic event to the audit log with timestamp.
3. Shows a prominent toast: "Copilot Auto-Keep disabled. Review audit log for recent activity."
4. Offers a "Re-enable Tier 1" button on the toast for quick recovery.

## Implementation notes

- TypeScript, compiled to `out/`. Standard `yo code` scaffold.
- Single `src/extension.ts`, no runtime deps beyond `@types/vscode` and `@types/node`.
- Create output channel "Copilot Auto-Keep" and log:
  - Discovered command IDs on activation (Tier 1 and Tier 2 registry).
  - Each auto-accept invocation with timestamp and success/failure.
  - Every Tier 2 dispatch with dialog type, command text, file path.
  - Config changes.
  - Panic disable events.
- **Persistent audit log** at `~/.copilot-auto-keep/audit.log` (or platform equivalent via `os.homedir()`). Log rotates at 10MB, keeping two historical files. Tier 2 events are appended here in addition to the output channel. Tier 1 events go only to the output channel (git is the record).
- **Workspace trust gating**: Tier 2 code paths must short-circuit with a log entry if `vscode.workspace.isTrusted === false`. No dispatch on untrusted workspaces, ever, regardless of setting.
- **Session-only state**: store in extension memory (not configuration) so it's lost on reload. On activation, read the persistent `punchThrough.enabled` setting as the baseline; session-enable overlays on top.
- **First-time warning**: store a `hasSeenPunchThroughWarning` flag in `context.globalState`. Show the modal dialog only when this flag is unset and the user attempts to enable Tier 2. Set the flag after any of the three dialog outcomes (including cancel).
- Guard against rapid-fire: if an auto-accept is in flight, ignore new signals until it completes.
- Honor live config changes via `vscode.workspace.onDidChangeConfiguration`.
- Honor workspace trust changes via `vscode.workspace.onDidGrantWorkspaceTrust`.

## Deliverables

1. Complete project scaffolded in new directory `copilot-auto-keep/`.
2. `package.json`, `tsconfig.json`, `src/extension.ts`, `.vscodeignore`, `README.md`, `LICENSE` (MIT, copyright Dan / Throughline Technical Services LLC).
3. Working build: `npm install && npm run compile` with zero errors.
4. Packaged `.vsix` via `npx vsce package`.
5. README including:
   - Install instructions.
   - Clear statement that this is a workaround for a missing Microsoft feature (link GitHub Community #185857).
   - **Prominent "Tier 2 is dangerous" section** explaining what Punch-Through bypasses and why git doesn't save you from prompt injection attacks via that vector.
   - Documented command IDs and context keys discovered during investigation, with a note that Microsoft may rename these.
   - The `copilotAutoKeep.acceptCommand` and `copilotAutoKeep.punchThroughCommands` override settings, for when renames happen.
   - Audit log location and rotation behavior.
   - Panic kill-switch keybinding.
   - Caveat: "Tier 1 removes a convenience review. Tier 2 removes a safety gate. Know the difference."

## Out of scope for v1

- Per-command allow/deny patterns within Tier 2 (future: regex-based allowlist of terminal commands to auto-approve, everything else still prompts).
- Integration with other AI agents (Cursor, Windsurf, Claude Code). Focus on GitHub Copilot Agent mode only. TJCG's extension covers Claude Code.
- Automatic rejection / undo. This tool only accepts.
- Publishing to the VS Code marketplace. Local `.vsix` install only.

## Test checklist (manual)

### Tier 1 — Auto-Keep
- [ ] Default: Tier 1 ON, Tier 2 OFF after fresh install.
- [ ] Fire up Copilot Agent mode, ask it to make an edit → edit is auto-kept without user interaction.
- [ ] Multi-file edits → all files auto-kept in a single action.
- [ ] Toggle Tier 1 off → Keep/Undo UI returns to normal manual behavior.
- [ ] Status bar shows `$(check) Auto-Keep` in default color when only Tier 1 is on.

### Tier 2 — Punch-Through
- [ ] First-time enable triggers the modal warning dialog with three options.
- [ ] "Cancel" on warning leaves Tier 2 off.
- [ ] "Enable persistently" sets the config value and applies immediately.
- [ ] "Enable for session only" enables Tier 2 but does NOT set the persistent config; reloading VS Code reverts to off.
- [ ] Subsequent Tier 2 toggles do NOT re-show the warning.
- [ ] Status bar in danger mode: `$(warning) Auto-Keep + PUNCH` with warning background color, clearly visible.
- [ ] Session mode shows `(session)` in the status bar label.
- [ ] Ask Copilot to run a command that writes to `/tmp` → gated dialog appears briefly and is auto-approved.
- [ ] Untrusted workspace: Tier 2 does NOT fire even when enabled. Log entry explains why.
- [ ] Audit log at `~/.copilot-auto-keep/audit.log` receives entry with timestamp, command text, file path for every Tier 2 dispatch.
- [ ] Audit log rotates at 10MB.
- [ ] Unrecognized gated dialog: extension logs the context keys and does NOT fire blindly.

### Panic kill-switch
- [ ] `Ctrl+Alt+K` immediately disables both tiers.
- [ ] Toast appears with panic message and re-enable button for Tier 1.
- [ ] Re-enable button on toast restores Tier 1 only.
- [ ] Audit log records the panic event.

### General
- [ ] Command override: set `copilotAutoKeep.acceptCommand` to a bogus value → extension logs error, does not crash.
- [ ] Punch-through command registry override works.
- [ ] VS Code restart: extension re-activates cleanly, status bar present, session-only Tier 2 state is cleared.
- [ ] Output channel shows useful logs for both tiers.

## Attribution & repo hygiene

- Public GitHub repo.
- README links GitHub Community discussion #185857.
- No Co-Authored-By trailer in commits.
- Single hyphens, not em dashes, in all written content.