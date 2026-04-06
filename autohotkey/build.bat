@echo off
setlocal
set "DIR=%~dp0"

echo Compiling ShortDanCuts.ahk ...
"C:\Program Files\AutoHotkey\Compiler\Ahk2Exe.exe" /in "%DIR%ShortDanCuts.ahk" /out "%DIR%ShortDanCuts.exe" /base "C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe"

if exist "%DIR%ShortDanCuts.exe" (
    echo Done: ShortDanCuts.exe
    echo DLL is bundled inside the exe.
) else (
    echo FAILED - check for errors above
)
pause
