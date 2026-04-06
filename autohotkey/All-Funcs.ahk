#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

; === DESKTOP CYCLING ===
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

!CapsLock::SetCapsLockState(!GetKeyState("CapsLock", "T"))

; === VOICE DICTATION: double-tap Shift ===
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

; === VOICE DICTATION: double-tap middle mouse ===
~MButton:: {
    if (A_PriorHotkey = "~MButton" && A_TimeSincePriorHotkey < 300)
        Send "#h"
}

; === MOUSE-TO-TOP: F11 fullscreen toggle ===
dwellTime := 20
topThreshold := 2
atTop := false
topStartTime := 0
hasTriggered := false

SetTimer(CheckTop, 50)

CheckTop() {
    global atTop, topStartTime, hasTriggered, dwellTime, topThreshold
    CoordMode("Mouse", "Screen")
    MouseGetPos(, &Y)
    now := A_TickCount
    if (Y <= topThreshold) {
        if (!atTop) {
            atTop := true
            topStartTime := now
        } else if (!hasTriggered and now - topStartTime >= dwellTime) {
            Send("{F11}")
            hasTriggered := true
        }
    } else {
        atTop := false
        hasTriggered := false
    }
}