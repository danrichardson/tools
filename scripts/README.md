# Scripts

This directory holds helper scripts for managing the umbrella repo and sub-repos.

## Scripts

- `convert-folder-to-submodule.ps1`
  - Converts an existing folder in the umbrella repo into a standalone repo
    tracked as a git submodule.
  - Uses `git subtree split` so historical commits from that folder can be
    pushed into the new repo.

- `rollup-submodule-updates.ps1`
  - Stages and commits changed submodule pointers in the umbrella repo.
  - Optional `-Push` switch pushes after commit.

## Typical Usage

```powershell
# Convert an existing folder to its own repo + submodule
./convert-folder-to-submodule.ps1 -ToolPath autohotkey -RepoUrl https://github.com/danrichardson/autohotkey.git

# Later, after making submodule commits, roll up pointer changes
./rollup-submodule-updates.ps1 -Message "chore: roll up tool updates"
```
