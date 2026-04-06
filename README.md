# Tools

Personal utilities and scripts for Windows productivity.

<!-- AUTO-GENERATED: Everything between these markers is regenerated on request. -->
<!-- BEGIN TOOLS -->

## autohotkey/

AutoHotkey v2 scripts for keyboard remapping, virtual desktop navigation, and input shortcuts on Windows.

- **All-Funcs.ahk** — The kitchen-sink script. Combines all features into one launcher:
  - **CapsLock** cycles forward through virtual desktops (wraps around); **Shift+CapsLock** cycles backward
  - **Alt+CapsLock** toggles actual CapsLock on/off
  - **Double-tap Shift** or **double-tap middle mouse button** triggers Windows voice dictation (`Win+H`)
  - **Mouse to top edge** of screen for 20ms sends F11 (fullscreen toggle — great for browsers)

- **CapsSwitch-ShiftSpeaks.ahk** — Standalone version of the desktop-cycling + voice-dictation features (no fullscreen toggle). Same CapsLock/Shift+CapsLock desktop switching and double-tap Shift/middle-mouse dictation.

- **CapsToSwitch.ahk** — Minimal CapsLock desktop switcher using `VirtualDesktopAccessor.dll` for direct desktop queries. CapsLock cycles forward through desktops; wraps to first when at the last.

- **ToggleFullScreen.ahk** — Standalone mouse-to-top-edge fullscreen toggle. Hover the mouse at the top of the screen (~2px) for 20ms and it sends F11.

- **VirtualDesktopAccessor.dll** — Third-party DLL used by `CapsToSwitch.ahk` to query the Windows virtual desktop API directly.

## docs/

_(Empty — reserved for documentation.)_

<!-- END TOOLS -->
