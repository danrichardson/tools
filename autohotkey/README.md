# ShortDanCuts (AutoHotkey)

ShortDanCuts is a Windows productivity utility written in AutoHotkey v2.

It supports fast virtual desktop switching, dictation by double-tapping Shift,
quick fullscreen toggle by hovering at the top edge, and a config UI for
feature toggles.

## Files

- `ShortDanCuts.ahk` - Main source file.
- `build.bat` - Compiles the script into `ShortDanCuts.exe`.
- `VirtualDesktopAccessor.dll` - Dependency used for virtual desktop API calls.
- `.gitignore` - Ignores local output and machine-specific settings.

## Requirements

- Windows 10 or Windows 11
- AutoHotkey v2 installed at the default path:
  - `C:\Program Files\AutoHotkey\Compiler\Ahk2Exe.exe`
  - `C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe`

## Build

1. Open a terminal in this directory.
2. Run `build.bat`.
3. The output executable is `ShortDanCuts.exe`.

If the build fails, verify AutoHotkey v2 is installed in the default location,
or update the paths in `build.bat`.

## Run

- Source mode: run `ShortDanCuts.ahk` with AutoHotkey v2.
- Compiled mode: run `ShortDanCuts.exe`.

On first launch, a configuration window opens automatically.

## Default Shortcuts

| Shortcut | Action |
|---|---|
| `CapsLock` | Next virtual desktop |
| `Shift+CapsLock` | Previous virtual desktop |
| `Alt+CapsLock` | Toggle CapsLock |
| Double-tap `Shift` | Open voice dictation (`Win+H`) |
| Mouse near top edge | Toggle fullscreen (`F11`) |
| `Ctrl+Shift+Alt+F12` | Open config popup |

## Settings and Startup

- Feature toggles are saved in `ShortDanCuts.ini`.
- "Run at startup" creates a shortcut in the user Startup folder.
- The config popup can be reopened with `Ctrl+Shift+Alt+F12`.

## Notes for Sub-Repo Use

When this folder is managed as its own repo and included in the umbrella repo as
a submodule:

1. Commit and push changes in this folder first.
2. Return to the umbrella repo.
3. Commit the updated submodule pointer there.

This keeps tool history local to the tool repo while still rolling changes up
into the umbrella repo.
