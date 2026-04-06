# Tools

Personal utilities and scripts for Windows productivity.

<!-- AUTO-GENERATED: Everything between these markers is regenerated on request. -->
<!-- BEGIN TOOLS -->

## autohotkey/

**ShortDanCuts** — a single-exe Windows productivity tool (AutoHotkey v2). Download `ShortDanCuts.exe` from [Releases](../../releases) and run it — no install needed.

### Features

All features can be toggled on/off via a config popup. Settings persist across restarts.

| Shortcut | Action |
|---|---|
| **CapsLock** | Cycle forward through virtual desktops (wraps around) |
| **Shift+CapsLock** | Cycle backward through virtual desktops |
| **Alt+CapsLock** | Toggle actual CapsLock on/off |
| **Double-tap Shift** | Windows voice dictation (`Win+H`) |
| **Mouse to top edge** | Hover ~2px from top for 20ms to send F11 (fullscreen toggle) |
| **Ctrl+Shift+Alt+F12** | Open the configuration popup |

- First run opens the config popup automatically
- "Run at Windows startup" checkbox creates/removes a Start Menu shortcut
- Desktop switching uses [VirtualDesktopAccessor.dll](https://github.com/Ciantic/VirtualDesktopAccessor) for accurate desktop tracking (bundled inside the exe)

### Source files

- **ShortDanCuts.ahk** — Source script
- **VirtualDesktopAccessor.dll** — Third-party DLL for Windows virtual desktop API (bundled into exe at compile time)
- **build.bat** — Double-click to recompile the `.ahk` into a standalone `.exe`

## docs/

_(Empty — reserved for documentation.)_

<!-- END TOOLS -->
