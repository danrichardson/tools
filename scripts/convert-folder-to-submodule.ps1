[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ToolPath,

    [Parameter(Mandatory = $true)]
    [string]$RepoUrl,

    [string]$MainBranch = "main",

    [switch]$SkipPush
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

$clean = git status --porcelain
if ($clean) {
    throw "Working tree is not clean. Commit or stash changes before running migration."
}

if (-not (Test-Path $ToolPath)) {
    throw "Tool path not found: $ToolPath"
}

$toolName = Split-Path $ToolPath -Leaf
$splitBranch = "split/$toolName"
$tempRemote = "temp-$toolName"

$existingSplit = (git branch --list $splitBranch).Trim()
if ($existingSplit) {
    Invoke-Git @("branch", "-D", $splitBranch)
}

$existingRemote = git remote | Where-Object { $_ -eq $tempRemote }
if ($existingRemote) {
    Invoke-Git @("remote", "remove", $tempRemote)
}

Invoke-Git @("subtree", "split", "--prefix=$ToolPath", "-b", $splitBranch)

if (-not $SkipPush) {
    Invoke-Git @("remote", "add", $tempRemote, $RepoUrl)
    try {
        Invoke-Git @("push", $tempRemote, "${splitBranch}:$MainBranch")
    }
    finally {
        Invoke-Git @("remote", "remove", $tempRemote)
    }
}

Invoke-Git @("rm", "-r", $ToolPath)
Invoke-Git @("commit", "-m", "chore: move $toolName to standalone repo")

Invoke-Git @("submodule", "add", "-b", $MainBranch, $RepoUrl, $ToolPath)
Invoke-Git @("commit", "-m", "chore: track $toolName as submodule")

Invoke-Git @("branch", "-D", $splitBranch)

Write-Host ""
Write-Host "Migration complete."
Write-Host "1) Work inside '$ToolPath' as its own git repo."
Write-Host "2) Commit/push there first."
Write-Host "3) Commit updated submodule pointer in the umbrella repo."
