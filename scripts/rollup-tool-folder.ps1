[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ToolPath,

    [string]$Message,

    [switch]$Push
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    param(
        [string]$WorkingDir,
        [string[]]$GitArgs
    )

    Write-Host ">> git -C $WorkingDir $($GitArgs -join ' ')"
    & git -C $WorkingDir @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git -C $WorkingDir $($GitArgs -join ' ')"
    }
}

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) {
    throw "Run this script from inside the umbrella git repository."
}

$repoRoot = $repoRoot.Trim()
Set-Location $repoRoot

$toolFullPath = Join-Path $repoRoot $ToolPath
if (-not (Test-Path $toolFullPath)) {
    throw "Tool path not found: $ToolPath"
}

$toolName = Split-Path $ToolPath -Leaf
if (-not $Message) {
    $toolSubject = (git -C $toolFullPath log -1 --pretty=%s 2>$null)
    if ($LASTEXITCODE -eq 0 -and $toolSubject) {
        $toolSubject = $toolSubject.Trim()
        $Message = "tools: roll up $toolName - $toolSubject"
    }
    else {
        $Message = "tools: roll up $toolName changes"
    }
}

Invoke-Git -WorkingDir $repoRoot -GitArgs @("add", "--", $ToolPath)

& git -C $repoRoot diff --cached --quiet -- $ToolPath
if ($LASTEXITCODE -eq 0) {
    Write-Host "No staged changes found for '$ToolPath'."
    exit 0
}

Invoke-Git -WorkingDir $repoRoot -GitArgs @("commit", "-m", $Message)

if ($Push) {
    Invoke-Git -WorkingDir $repoRoot -GitArgs @("push")
}

Write-Host "Rolled up '$ToolPath' into umbrella repo commit."
