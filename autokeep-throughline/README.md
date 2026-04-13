# AutoKeep Throughline

AutoKeep Throughline is a local tool repo that contains the Copilot Auto-Keep
extension source plus product/spec documentation.

## Structure

- `copilot-auto-keep/` - VS Code extension project (TypeScript).
- `docs/` - Functional and experimental specs for extension behavior.

## Requirements

- Node.js 20+
- npm
- VS Code Extension Manager (`vsce`) via `npx vsce`

## Build and Package

From `copilot-auto-keep/`:

1. `npm install`
2. `npm run compile`
3. `npx vsce package`

This generates a `.vsix` package you can install in VS Code.

## Run and Test

- Open `copilot-auto-keep/` in VS Code.
- Press `F5` to launch an Extension Development Host.
- Verify commands and settings documented in `copilot-auto-keep/README.md`.

## Local Repo Workflow

This folder is intended to be a local-only git repo (no remote).

1. Commit changes here first.
2. Return to the umbrella `tools` repo.
3. Commit the folder changes there for GitHub publication.
