#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

; === CONFIGURATION ===
ConfigFile := A_ScriptDir "\ShortDanCuts.ini"
FirstRun := !FileExist(ConfigFile)

; Extract bundled DLL next to exe on first run
if A_IsCompiled && !FileExist(A_ScriptDir "\VirtualDesktopAccessor.dll")
    FileInstall("VirtualDesktopAccessor.dll", A_ScriptDir "\VirtualDesktopAccessor.dll", 0)

; === VIRTUAL DESKTOP ACCESSOR DLL ===
DllPath := A_ScriptDir "\VirtualDesktopAccessor.dll"
hVDA := DllCall("LoadLibrary", "Str", DllPath, "Ptr")
if !hVDA {
    MsgBox("Could not load VirtualDesktopAccessor.dll`nExpected at: " DllPath, "ShortDanCuts Error", 16)
    ExitApp
}
GetCurrentDesktopProc := DllCall("GetProcAddress", "Ptr", hVDA, "AStr", "GetCurrentDesktopNumber", "Ptr")
GoToDesktopProc := DllCall("GetProcAddress", "Ptr", hVDA, "AStr", "GoToDesktopNumber", "Ptr")
GetDesktopCountProc := DllCall("GetProcAddress", "Ptr", hVDA, "AStr", "GetDesktopCount", "Ptr")

; Mouse-to-top state
dwellTime := 20
topThreshold := 2
atTop := false
topStartTime := 0
hasTriggered := false

; Feature registry
Features := [
    {key: "DesktopCycleForward",  label: "Desktop Cycle Forward (CapsLock)"},
    {key: "DesktopCycleBack",     label: "Desktop Cycle Backward (Shift+CapsLock)"},
    {key: "ToggleCapsLock",       label: "Toggle CapsLock (Alt+CapsLock)"},
    {key: "DoubleTapDictation",   label: "Voice Dictation (Double-tap Shift)"},
    {key: "MouseTopFullscreen",   label: "Fullscreen Toggle (Mouse to Top)"}
]

Enabled := Map()
SavedState := Map()
RunAtStartup := false
SavedRunAtStartup := false
ConfigGui := ""
Checkboxes := Map()
StartupCheckbox := ""
StartupLink := A_AppData "\Microsoft\Windows\Start Menu\Programs\Startup\ShortDanCuts.lnk"

; === HOTKEY FUNCTIONS ===
DesktopForward(*) {
    global GetCurrentDesktopProc, GoToDesktopProc, GetDesktopCountProc
    current := DllCall(GetCurrentDesktopProc, "Int")
    count := DllCall(GetDesktopCountProc, "Int")
    next := current + 1 >= count ? 0 : current + 1
    DllCall(GoToDesktopProc, "Int", next, "Int")
}

DesktopBackward(*) {
    global GetCurrentDesktopProc, GoToDesktopProc, GetDesktopCountProc
    current := DllCall(GetCurrentDesktopProc, "Int")
    count := DllCall(GetDesktopCountProc, "Int")
    prev := current - 1 < 0 ? count - 1 : current - 1
    DllCall(GoToDesktopProc, "Int", prev, "Int")
}

ToggleCaps(*) {
    SetCapsLockState(!GetKeyState("CapsLock", "T"))
}

DoubleTapShift(*) {
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

; === REGISTER HOTKEYS (all start enabled, then ApplyConfig toggles) ===
Hotkey "CapsLock", DesktopForward
Hotkey "+CapsLock", DesktopBackward
Hotkey "!CapsLock", ToggleCaps
Hotkey "~Shift Up", DoubleTapShift
SetTimer(CheckTop, 50)

; Config hotkey â€” always active
Hotkey "^+!F12", ShowConfig

; === CONFIG FUNCTIONS ===
LoadConfig() {
    global Enabled, SavedState, ConfigFile, Features
    global RunAtStartup, SavedRunAtStartup, StartupLink
    for feat in Features
        Enabled[feat.key] := IniRead(ConfigFile, "Features", feat.key, "1") = "1"
    for feat in Features
        SavedState[feat.key] := Enabled[feat.key]
    RunAtStartup := FileExist(StartupLink) != ""
    SavedRunAtStartup := RunAtStartup
}

SaveConfig() {
    global Enabled, SavedState, ConfigFile, Features
    global RunAtStartup, SavedRunAtStartup, StartupLink
    for feat in Features {
        IniWrite(Enabled[feat.key] ? "1" : "0", ConfigFile, "Features", feat.key)
        SavedState[feat.key] := Enabled[feat.key]
    }
    ; Update startup shortcut
    if (RunAtStartup) {
        if !FileExist(StartupLink) {
            shell := ComObject("WScript.Shell")
            lnk := shell.CreateShortcut(StartupLink)
            lnk.TargetPath := A_ScriptFullPath
            lnk.WorkingDirectory := A_ScriptDir
            lnk.Description := "ShortDanCuts AutoHotkey"
            lnk.Save()
        }
    } else {
        if FileExist(StartupLink)
            FileDelete(StartupLink)
    }
    SavedRunAtStartup := RunAtStartup
}

ApplyConfig() {
    global Enabled
    Hotkey "CapsLock",   Enabled["DesktopCycleForward"] ? "On" : "Off"
    Hotkey "+CapsLock",  Enabled["DesktopCycleBack"]    ? "On" : "Off"
    Hotkey "!CapsLock",  Enabled["ToggleCapsLock"]      ? "On" : "Off"
    Hotkey "~Shift Up",  Enabled["DoubleTapDictation"]  ? "On" : "Off"
    SetTimer(CheckTop,   Enabled["MouseTopFullscreen"]  ? 50 : 0)
}

; === CONFIG GUI ===
ShowConfig(*) {
    global ConfigGui, Checkboxes, Enabled, Features
    global StartupCheckbox, RunAtStartup

    if (ConfigGui != "")
        try ConfigGui.Destroy()

    ConfigGui := Gui("+AlwaysOnTop", "ShortDanCuts Configuration")
    ConfigGui.SetFont("s10")
    ConfigGui.AddText(, "Enable or disable features:")
    ConfigGui.AddText(, "")

    for feat in Features {
        cb := ConfigGui.AddCheckbox(Enabled[feat.key] ? "Checked" : "", feat.label)
        cb.Name := feat.key
        cb.OnEvent("Click", OnCheckboxToggle)
        Checkboxes[feat.key] := cb
    }

    ConfigGui.AddText(, "")
    StartupCheckbox := ConfigGui.AddCheckbox(RunAtStartup ? "Checked" : "", "Run at Windows startup")
    StartupCheckbox.OnEvent("Click", OnStartupToggle)

    ConfigGui.AddText(, "")
    ConfigGui.AddText("cGray", "Reopen anytime:  Ctrl+Shift+Alt+F12")
    ConfigGui.AddText(, "")

    btnSave := ConfigGui.AddButton("w100", "Save")
    btnSave.OnEvent("Click", OnSave)
    btnCancel := ConfigGui.AddButton("w100 x+10 yp", "Cancel")
    btnCancel.OnEvent("Click", OnCancel)

    ConfigGui.OnEvent("Close", OnCancel)
    ConfigGui.Show()
}

OnCheckboxToggle(ctrl, *) {
    global Enabled
    Enabled[ctrl.Name] := ctrl.Value
    ApplyConfig()
}

OnStartupToggle(ctrl, *) {
    global RunAtStartup
    RunAtStartup := ctrl.Value
}

OnSave(*) {
    global ConfigGui
    SaveConfig()
    ConfigGui.Destroy()
    ConfigGui := ""
}

OnCancel(*) {
    global ConfigGui, Enabled, SavedState, Features
    global RunAtStartup, SavedRunAtStartup
    for feat in Features
        Enabled[feat.key] := SavedState[feat.key]
    RunAtStartup := SavedRunAtStartup
    ApplyConfig()
    ConfigGui.Destroy()
    ConfigGui := ""
}

; === INIT ===
LoadConfig()
ApplyConfig()
if (FirstRun)
    ShowConfig()
