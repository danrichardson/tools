[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ToolPath,

    [string]$BranchName = "main",

    [string]$InitialCommitMessage = "chore: initialize local tool history"
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
$toolFullPath = Join-Path $repoRoot $ToolPath

if (-not (Test-Path $toolFullPath)) {
    throw "Tool path not found: $ToolPath"
}

$embeddedGitPath = Join-Path $toolFullPath ".git"
$isRepo = (Test-Path $embeddedGitPath)

if (-not $isRepo) {
    Invoke-Git -WorkingDir $toolFullPath -GitArgs @("init", "-b", $BranchName)
}

Invoke-Git -WorkingDir $toolFullPath -GitArgs @("branch", "-M", $BranchName)

$remotes = git -C $toolFullPath remote
foreach ($remote in $remotes) {
    Invoke-Git -WorkingDir $toolFullPath -GitArgs @("remote", "remove", $remote)
}

Invoke-Git -WorkingDir $toolFullPath -GitArgs @("add", "-A")

$changes = git -C $toolFullPath status --porcelain
$hasCommits = $false
$oldErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
git -C $toolFullPath rev-parse --quiet --verify HEAD >$null 2>$null
$revParseExit = $LASTEXITCODE
$ErrorActionPreference = $oldErrorActionPreference
if ($revParseExit -eq 0) {
    $hasCommits = $true
}

if (-not $hasCommits -and $changes) {
    Invoke-Git -WorkingDir $toolFullPath -GitArgs @("commit", "-m", $InitialCommitMessage)
}

Write-Host ""
Write-Host "Local tool repo initialized at '$ToolPath'."
Write-Host "No remotes are configured for this tool repo."
if ($hasCommits) {
    Write-Host "Repo already had commits, so no automatic commit was created."
}
Write-Host ""
Write-Host "Next steps:"
Write-Host "1) Commit inside '$ToolPath' as needed."
Write-Host "2) Roll up folder changes in umbrella repo with scripts/rollup-tool-folder.ps1."
