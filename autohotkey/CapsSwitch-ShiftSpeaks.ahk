; AHK v2

; --- CapsLock: cycle through N desktops ---
DesktopCount := 3
Current := 1

CapsLock:: {
    global Current, DesktopCount
    if (Current >= DesktopCount) {
        Loop DesktopCount - 1
            Send "^#{Left}"
        Current := 1
    } else {
        Send "^#{Right}"
        Current++
    }
}

; Shift+CapsLock: cycle backward
+CapsLock:: {
    global Current, DesktopCount
    if (Current <= 1) {
        Loop DesktopCount - 1
            Send "^#{Right}"
        Current := DesktopCount
    } else {
        Send "^#{Left}"
        Current--
    }
}

; Alt+CapsLock: toggle CapsLock properly
!CapsLock::SetCapsLockState(!GetKeyState("CapsLock", "T"))

; --- Double-tap Shift: voice dictation ---
~Shift Up:: {
    static lastTap := 0
    if (A_TimeSinceThisHotkey > 200)
        return
    now := A_TickCount
    if (now - lastTap < 400) {
        lastTap := 0
        Send "#h"
    } else
        lastTap := now
}

; --- Double-tap middle mouse: voice dictation ---
~MButton:: {
    if (A_PriorHotkey = "~MButton" && A_TimeSincePriorHotkey < 300)
        Send "#h"
}