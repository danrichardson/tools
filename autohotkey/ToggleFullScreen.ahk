#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

dwellTime := 20  ; milliseconds to hold at top before triggering
topThreshold := 2  ; pixels from top of screen

atTop := false
topStartTime := 0
hasTriggered := false  ; prevents re-triggering until mouse leaves

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
        }
        else if (!hasTriggered and now - topStartTime >= dwellTime) {
            Send("{F11}")
            hasTriggered := true  ; won't fire again until mouse leaves top
        }
    }
    else {
        atTop := false
        hasTriggered := false  ; reset - mouse left, so next visit can trigger
    }
}