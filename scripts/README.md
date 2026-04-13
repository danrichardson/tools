# Scripts

This directory holds helper scripts for managing local tool repos and rolling
changes into the umbrella repo.

## Scripts

- `init-local-tool-repo.ps1`
  - Initializes a local git repo inside a tool folder.
  - Creates an initial commit and removes all remotes so the tool stays local.

- `rollup-tool-folder.ps1`
  - Stages and commits a tool folder in the umbrella repo.
  - Uses the latest local tool commit subject as the default commit message.
  - Optional `-Push` switch pushes after commit.

## Typical Usage

```powershell
# Initialize local history for a tool folder
./init-local-tool-repo.ps1 -ToolPath autohotkey

# After committing in the tool repo, roll changes into tools repo
./rollup-tool-folder.ps1 -ToolPath autohotkey
```
