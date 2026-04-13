# Build: `open-in-typora` VS Code extension

## Goal

Create a VS Code extension that adds an **"Open in Typora"** entry to the Explorer context menu. This is a full replacement for the official `typora.io` "Open in Typora" extension — we will uninstall that one once this ships.

It must handle four cases:

1. **Right-click a markdown file** → opens that file in Typora.
2. **Right-click a folder** (including nested folders) → opens the folder in Typora as a file-tree sidebar.
3. **Right-click the workspace root folder** (the top-level project name at the top of the Explorer) → opens the entire project in Typora. This is the primary use case.
4. **Shift/Ctrl-click multiple items, then right-click** → opens all selected items in Typora in one action.

Plus two always-visible UI affordances for the "open the whole workspace" action:

5. **Explorer view title button** — a small Typora icon in the header of the Explorer panel (next to the `…` menu). One click opens the current workspace in Typora.
6. **Status bar item** — a persistent button in the bottom status bar showing a Typora icon and label. One click opens the current workspace in Typora. Clickable from any panel.

Target platforms: Windows (primary), macOS, Linux. Dev environment is Windows 11 / WSL2.

## Behavior spec

### Menu visibility

- On a markdown-like file: menu entry shows as "Open in Typora".
- On a folder: menu entry shows as "Open in Typora".
- **On the workspace root folder header**: menu entry shows as "Open in Typora". VS Code fires `explorer/context` with `explorerResourceIsFolder == true` and `explorerResourceIsRoot == true` for the workspace root, so the folder handler should naturally catch it. **Verify this during development** — right-click on the top-level project name in the explorer and confirm the menu entry appears. If it doesn't for some reason (multi-root workspace quirks, etc.), add an explicit `when` clause covering `explorerResourceIsRoot`.
- On any other file type (e.g. `.json`, `.ts`): menu entry does NOT show.
- On a mixed multi-selection where at least one item is a markdown file or folder: menu entry shows. (VS Code's `when` clause evaluates against the right-clicked item, so if user right-clicks on an eligible item within a mixed selection, the menu appears — this is fine.)

### Supported markdown extensions

Match the upstream `typora.io` extension defaults. Expose as a single setting:

```
openInTypora.supportedExtensions: string[]
  default: ["md","markdown","mdown","mmd","text","txt","rmarkdown","mkd","mdwn","mdtxt","rmd","qmd","mdtext","mdx"]
```

Extensions are stored without the leading dot. The `when` clause for files should check membership; use a contributed context key (`openInTypora.isSupported`) updated on selection changes if `resourceExtname =~ /.../` regex gets unwieldy. A straightforward approach:

```
"when": "!explorerResourceIsFolder && resourceExtname in openInTypora.supportedExtensionsWithDot"
```

…where `supportedExtensionsWithDot` is a context key you set on activation containing the extensions with leading dots. If that's awkward, a regex-based `when` with the default extensions hardcoded is acceptable for v1.

### Command handler signature

VS Code passes `(clickedUri: Uri, selectedUris: Uri[])` to explorer context menu commands.

- If `selectedUris` is a non-empty array → iterate over it.
- If `selectedUris` is empty/undefined (palette or keybinding invocation) → fall back to `[clickedUri]`.
- For each URI:
  - If it's a folder → open folder in Typora.
  - If it's a supported markdown file → open file in Typora.
  - Otherwise → skip silently (don't error out mixed selections).

### Launch behavior

Open each target as a separate Typora invocation. Yes, this may open multiple Typora windows on Windows — that's an upstream Typora limitation, not ours. Document it in the README.

Platform invocations:

- **Windows**: `cmd /c start "" typora "<path>"`
- **macOS**: `open -a Typora "<path>"`
- **Linux**: `typora "<path>"` (spawned detached)

Use `child_process.spawn` with `detached: true`, `stdio: 'ignore'`, and `.unref()` so VS Code doesn't hang on them. On Windows, use `shell: true` for the `start` command. Handle quoting so paths with spaces work.

### Command palette

- Register `openInTypora.open` as "Typora: Open in Typora".
- Palette invocation with no args → show a quick pick: "Open current file" / "Open current workspace folder" / "Choose…". The "Choose…" option opens `vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: true, canSelectMany: true })`.
- Register a second dedicated command `openInTypora.openWorkspace` as "Typora: Open Workspace in Typora". This opens the current workspace's root folder directly, no prompt. It's the command users will bind to a keyboard shortcut for the "big kahuna" workflow of dropping the whole project into Typora. If there are multiple workspace folders, prompt the user to pick one.

### Explorer view title button

- Contribute the `openInTypora.openWorkspace` command to the `view/title` menu for `workbench.view.explorer`.
- Use `group: "navigation"` so it renders as an inline icon button (not in the overflow `…` menu).
- Use a codicon for the icon — `$(book)` or `$(file-symlink-directory)` are reasonable stand-ins for Typora. If a bundled SVG icon is desired, place it at `resources/typora.svg` and reference it via `"icon": { "light": "...", "dark": "..." }`. Keep v1 simple with a codicon.
- Tooltip: "Open workspace in Typora".
- Only show when a workspace folder is open. Gate with `"when": "workbenchState != empty"`.

### Status bar item

- Create on activation via `vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)`.
- Text: `$(book) Typora` (codicon + label).
- Tooltip: "Open workspace in Typora".
- Command: `openInTypora.openWorkspace`.
- Show only when a workspace folder is open; hide when none. Listen to `vscode.workspace.onDidChangeWorkspaceFolders` to keep this in sync.
- Add a setting `openInTypora.showStatusBarItem: boolean` (default `true`) so users can hide it. Honor setting changes live via `vscode.workspace.onDidChangeConfiguration`.

### Error handling

- Create an output channel "Open in Typora".
- Log spawn errors there. Show a single toast on failure: "Could not launch Typora. Is it installed and on PATH? See output for details."
- Don't spam toasts on multi-select failures — one toast per invocation, details in the output channel.

## Package.json essentials

- `name`: `open-in-typora`
- `publisher`: `throughline` (Throughline Technical Services LLC)
- `displayName`: `Open in Typora`
- `description`: `Right-click files or folders in the VS Code explorer to open them in Typora. Supports multi-select.`
- `engines.vscode`: `^1.85.0`
- `categories`: `["Other"]`
- `activationEvents`: `["onStartupFinished"]` (needed to set the supported-extensions context key early)
- `main`: `./out/extension.js`

### Contributes block (sketch)

```json
"contributes": {
  "commands": [
    { "command": "openInTypora.open", "title": "Open in Typora" },
    {
      "command": "openInTypora.openWorkspace",
      "title": "Typora: Open Workspace in Typora",
      "icon": "$(book)"
    }
  ],
  "menus": {
    "explorer/context": [
      {
        "when": "explorerResourceIsFolder",
        "command": "openInTypora.open",
        "group": "navigation@30"
      },
      {
        "when": "!explorerResourceIsFolder && resourceExtname =~ /\\.(md|markdown|mdown|mmd|text|txt|rmarkdown|mkd|mdwn|mdtxt|rmd|qmd|mdtext|mdx)$/",
        "command": "openInTypora.open",
        "group": "navigation@30"
      }
    ],
    "editor/title/context": [
      {
        "when": "resourceExtname =~ /\\.(md|markdown|mdown|mmd|text|txt|rmarkdown|mkd|mdwn|mdtxt|rmd|qmd|mdtext|mdx)$/",
        "command": "openInTypora.open",
        "group": "navigation"
      }
    ],
    "commandPalette": [
      { "command": "openInTypora.open" },
      { "command": "openInTypora.openWorkspace" }
    ],
    "view/title": [
      {
        "command": "openInTypora.openWorkspace",
        "when": "view == workbench.view.explorer && workbenchState != empty",
        "group": "navigation"
      }
    ]
  },
  "configuration": {
    "title": "Open in Typora",
    "properties": {
      "openInTypora.supportedExtensions": {
        "type": "array",
        "items": { "type": "string" },
        "default": ["md","markdown","mdown","mmd","text","txt","rmarkdown","mkd","mdwn","mdtxt","rmd","qmd","mdtext","mdx"],
        "description": "File extensions (without leading dot) that trigger the 'Open in Typora' menu entry on files."
      },
      "openInTypora.showStatusBarItem": {
        "type": "boolean",
        "default": true,
        "description": "Show a 'Typora' button in the status bar that opens the current workspace in Typora."
      }
    }
  }
}
```

If you implement the dynamic context-key approach for respecting the setting, wire that up in `extension.ts` and have the `when` clauses reference the context key instead of a hardcoded regex. Either implementation is acceptable — just be consistent.

## Implementation notes

- TypeScript, compiled to `out/`. Standard `yo code` scaffold layout.
- Single `src/extension.ts`, no runtime dependencies beyond `@types/vscode` and `@types/node`.
- For the URI type check (file vs folder), use `vscode.workspace.fs.stat(uri)` and check `type === vscode.FileType.Directory`. Don't rely on extension heuristics.
- Wrap each spawn in try/catch; log and continue on errors in multi-select.

## Deliverables

1. Complete project scaffolded in new directory `open-in-typora/`.
2. `package.json`, `tsconfig.json`, `src/extension.ts`, `.vscodeignore`, `README.md`, `LICENSE` (MIT, copyright Dan / Throughline Technical Services LLC).
3. Working build: `npm install && npm run compile` with zero errors.
4. Packaged `.vsix` via `npx vsce package`.
5. README with:
   - Install instructions (`code --install-extension <file>.vsix`).
   - Note to uninstall the official `typora.io` "Open in Typora" extension first to avoid duplicate menu entries.
   - PATH requirement on Windows/Linux.
   - Known issue: Typora opens a new window per invocation (upstream limitation).
   - Credit to `typora/vscode-open-in-typora` as inspiration.

## Out of scope for v1

- Configurable Typora executable path (rely on PATH / macOS default app resolution).
- Batching multiple files into one Typora window (Typora doesn't support it).
- Publishing to the VS Code marketplace. Local `.vsix` install only.
- Keybinding defaults (user can add their own).

## Test checklist (manual)

### Workspace root (primary use case)
- [ ] Right-click the top-level workspace folder header in the Explorer → menu shows "Open in Typora", click opens the whole project in Typora.
- [ ] Run `Typora: Open Workspace in Typora` from the command palette → same behavior, no prompt.
- [ ] Bind `openInTypora.openWorkspace` to a keyboard shortcut → fires correctly.
- [ ] Multi-root workspace: `openInTypora.openWorkspace` prompts to pick which folder.

### UI buttons
- [ ] Explorer view title bar shows a Typora icon button next to the `…` menu when a workspace is open.
- [ ] Clicking the explorer title button opens the current workspace in Typora.
- [ ] Explorer title button is hidden when no workspace folder is open.
- [ ] Status bar shows a "Typora" button on the right side when a workspace is open.
- [ ] Clicking the status bar button opens the current workspace in Typora.
- [ ] Status bar button hides when no workspace is open.
- [ ] Setting `openInTypora.showStatusBarItem` to `false` hides the status bar button live (no reload needed).

### Single-target
- [ ] Right-click `.md` file → menu shows, click opens file in Typora.
- [ ] Right-click `.qmd`, `.mdx`, `.markdown` → menu shows.
- [ ] Right-click `.json` or `.ts` → menu does NOT show.
- [ ] Right-click a folder → menu shows, click opens folder in Typora.
- [ ] Right-click editor tab on an open `.md` → menu shows, click opens in Typora.

### Multi-select
- [ ] Shift-click two `.md` files, right-click → menu shows, click opens both.
- [ ] Ctrl-click a folder and a `.md` file, right-click → menu shows, click opens both.
- [ ] Select five markdown files, right-click → all five open (multiple Typora windows expected).
- [ ] Mixed selection including a `.json` → markdown/folder items open, `.json` skipped silently.

### Edge cases
- [ ] Path with spaces works on Windows.
- [ ] Path with non-ASCII characters works.
- [ ] Supported-extensions setting: remove `qmd` from settings → right-click on `.qmd` no longer shows menu (only if dynamic context-key approach is used; if hardcoded regex, document this as a v2 item).
- [ ] Command palette: "Typora: Open in Typora" prompts with quick pick.
- [ ] Typora not installed / not on PATH → single error toast, details in output channel.

## Attribution & repo hygiene

- Standalone extension, not a fork.
- README credits `typora/vscode-open-in-typora` and links to it.
- Git: **public GitHub repo**. No Gitea mirror.
- No Co-Authored-By trailer in commits.
- Single hyphens, not em dashes, in all written content.