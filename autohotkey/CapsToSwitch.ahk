; AHK v2
hVDA := DllCall("LoadLibrary", "Str", A_ScriptDir "\VirtualDesktopAccessor.dll", "Ptr")

GetCurrent() => DllCall("VirtualDesktopAccessor\GetCurrentDesktopNumber", "Int")
GetCount() => DllCall("VirtualDesktopAccessor\GetDesktopCount", "Int")

CapsLock:: {
    current := GetCurrent()
    count := GetCount()
    if (current >= count - 1)
        Send "^#{Left " (count - 1) "}"  ; jump back to first
    else
        Send "^#{Right}"
}