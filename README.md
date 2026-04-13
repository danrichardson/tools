# Tools

Personal utilities and scripts for Windows productivity.

<!-- AUTO-GENERATED: Everything between these markers is regenerated on request. -->
<!-- BEGIN TOOLS -->

## autohotkey/

- **README.md** - Detailed docs for this tool, including shortcuts, build steps, and runtime behavior.
- **ShortDanCuts.ahk** - Main AutoHotkey v2 source for desktop switching, dictation trigger, and config UI.
- **VirtualDesktopAccessor.dll** - Bundled dependency used by the script for Windows virtual desktop API calls.
- **build.bat** - Compiles `ShortDanCuts.ahk` into a standalone `ShortDanCuts.exe` using Ahk2Exe.

## autokeep-throughline/

- **README.md** - Tool-level overview with build/package steps and local-repo workflow.
- **copilot-auto-keep/** - VS Code extension project that auto-accepts Copilot Agent edits.
- **docs/** - Product and experimental specs describing behavior, safety tradeoffs, and command mapping.

## docs/

- **subrepos.md** - Umbrella plus local-tool-repo workflow where only tools is pushed to GitHub.

## scripts/

- **README.md** - Quick reference for repo-management scripts and typical usage examples.
- **init-local-tool-repo.ps1** - Initializes a local-only git repo inside a tool folder with no remotes.
- **rollup-tool-folder.ps1** - Stages and commits a tool folder into the umbrella tools repo.

<!-- END TOOLS -->

## Attribution

- [VirtualDesktopAccessor](https://github.com/Ciantic/VirtualDesktopAccessor) by Jari Pennanen — Rust DLL for Windows virtual desktop API access
- [AutoHotkey v2](https://www.autohotkey.com/) — scripting language and runtime
- [Ahk2Exe](https://www.autohotkey.com/docs/v2/Scripts.htm#ahk2exe) — compiler for bundling AHK scripts into standalone executables
