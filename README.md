# Tools

Personal utilities and scripts for Windows productivity.

<!-- AUTO-GENERATED: Everything between these markers is regenerated on request. -->
<!-- BEGIN TOOLS -->

## autohotkey/

- **README.md** - Detailed docs for this tool, including shortcuts, build steps, and runtime behavior.
- **ShortDanCuts.ahk** - Main AutoHotkey v2 source for desktop switching, dictation trigger, and config UI.
- **VirtualDesktopAccessor.dll** - Bundled dependency used by the script for Windows virtual desktop API calls.
- **build.bat** - Compiles `ShortDanCuts.ahk` into a standalone `ShortDanCuts.exe` using Ahk2Exe.

## docs/

- **subrepos.md** - Umbrella/sub-repo architecture, migration flow, and roll-up workflow for submodules.

## scripts/

- **README.md** - Quick reference for repo-management scripts and typical usage examples.
- **convert-folder-to-submodule.ps1** - Migrates an existing folder to its own repo and reconnects it as a git submodule.
- **rollup-submodule-updates.ps1** - Stages and commits changed submodule pointers in the umbrella repo.

<!-- END TOOLS -->

## Attribution

- [VirtualDesktopAccessor](https://github.com/Ciantic/VirtualDesktopAccessor) by Jari Pennanen — Rust DLL for Windows virtual desktop API access
- [AutoHotkey v2](https://www.autohotkey.com/) — scripting language and runtime
- [Ahk2Exe](https://www.autohotkey.com/docs/v2/Scripts.htm#ahk2exe) — compiler for bundling AHK scripts into standalone executables
