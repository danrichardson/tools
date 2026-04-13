# Copilot Auto-Keep

Automatically accepts GitHub Copilot Agent edits so you never have to click Keep/Undo again.

This extension is a workaround for a missing built-in feature in VS Code and GitHub Copilot. Reference: GitHub Community discussion #185857.

Link: https://github.com/orgs/community/discussions/185857

## Warning

This removes a safety net. Use git. You have been warned.

## What It Does

- Watches for bursts of workspace edit activity.
- Waits for a debounce window (default 300ms).
- Executes the Keep All command automatically.
- Logs activity and failures to the Copilot Auto-Keep output channel.

## Install

1. Clone or copy this folder.
2. Run:

   npm install
   npm run compile
   npx vsce package

3. In VS Code, install the generated VSIX file.

## Commands

- Copilot Auto-Keep: Toggle
- Copilot Auto-Keep: Accept Pending Edits Now

## Settings

- copilotAutoKeep.enabled (boolean, default true)
- copilotAutoKeep.debounceMs (number, default 300)
- copilotAutoKeep.acceptCommand (string, default empty)

Use copilotAutoKeep.acceptCommand when a future VS Code update renames internal commands.

## Investigation Findings (April 2026)

The following command and context-key data was verified by inspecting VS Code internals in the local Windows install.

Source inspected:
- C:/Users/fubar/AppData/Local/Programs/Microsoft VS Code/41dd792b5e/resources/app/out/vs/workbench/workbench.desktop.main.js

### Keep Current File

- UI keybinding: Ctrl+Shift+Y
- Command ID: chatEditor.action.accept
- Precondition context: chatEdits.hasEditorModifications && !chatEdits.isCurrentlyBeingModified
- Keybinding when-context: editorFocus || notebookEditorFocused

### Keep All Files

- UI keybinding: Ctrl+Enter
- Command ID: chatEditing.acceptAllFiles
- Precondition context: hasUndecidedChatEditingResource
- Keybinding when-context: hasUndecidedChatEditingResource && inChatInput

### Related Internal Context Keys

- hasUndecidedChatEditingResource
- inChatInput
- chatEdits.hasEditorModifications
- chatEdits.isCurrentlyBeingModified
- chatEdits.cursorInChangeRange
- editorFocus
- notebookEditorFocused

Microsoft may rename these internals in any release. If that happens, set copilotAutoKeep.acceptCommand to the updated command ID.

## Notes

- Primary strategy uses context-compatible Keep All command execution.
- Fallback strategy uses document change heuristics and command retries.
- Single-file fallback commands are attempted in a bounded loop if all known Keep All commands fail.
