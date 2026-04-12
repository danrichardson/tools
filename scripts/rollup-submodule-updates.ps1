[CmdletBinding()]
param(
    [string]$Message = "chore: roll up submodule updates",
    [switch]$Push
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    param([string[]]$Args)

    Write-Host ">> git $($Args -join ' ')"
    & git @Args
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Args -join ' ')"
    }
}

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) {
    throw "Run this script from inside the umbrella git repository."
}

$repoRoot = $repoRoot.Trim()
Set-Location $repoRoot

if (-not (Test-Path ".gitmodules")) {
    throw "No .gitmodules file found. Add at least one submodule first."
}

$statusLines = git submodule status --recursive
if (-not $statusLines) {
    throw "No submodules found."
}

$changed = @()
foreach ($line in $statusLines) {
    if ($line.StartsWith("+")) {
        $normalized = $line.TrimStart("+", "-", "U", " ")
        $parts = $normalized -split "\s+"
        if ($parts.Length -ge 2) {
            $changed += $parts[1]
        }
    }
}

if ($changed.Count -eq 0) {
    Write-Host "No submodule pointer changes to roll up."
    exit 0
}

foreach ($path in $changed) {
    Invoke-Git @("add", "--", $path)
}

Invoke-Git @("commit", "-m", $Message)

if ($Push) {
    Invoke-Git @("push")
}

Write-Host "Rolled up $($changed.Count) submodule update(s)."
