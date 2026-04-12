# Tools Umbrella + Sub-Repo Workflow

This repository is the umbrella repo.
Each top-level tool directory can be promoted into its own git repository and
tracked here as a submodule.

## Target Model

- Umbrella repo: tracks docs, shared scripts, and submodule pointers.
- Tool repos: own source code, releases, build details, and detailed README docs.
- Roll-up commit: after tool changes are pushed, umbrella repo commits the updated
  submodule pointer.

This gives you both:

- Independent work and history for each tool
- A single umbrella repo that references exact versions of all tools

## Day-to-Day Workflow

1. Work inside a tool repo directory.
2. Commit and push in that tool repo.
3. In the umbrella repo, stage the tool directory (submodule pointer update).
4. Commit and push umbrella repo.

## Converting an Existing Folder to a Submodule Repo

Use the script in `scripts/convert-folder-to-submodule.ps1`.

Example (PowerShell):

```powershell
./scripts/convert-folder-to-submodule.ps1 `
  -ToolPath autohotkey `
  -RepoUrl https://github.com/danrichardson/autohotkey.git
```

What it does:

1. Verifies clean umbrella repo working tree
2. Splits tool history with `git subtree split`
3. Pushes split history to the tool repo
4. Removes the folder from umbrella index
5. Re-adds it as a proper git submodule
6. Creates migration commits in the umbrella repo

## Rolling Up Submodule Changes

Use `scripts/rollup-submodule-updates.ps1` to commit all changed submodule
pointers in one command.

Example:

```powershell
./scripts/rollup-submodule-updates.ps1 -Message "chore: roll up tool updates"
```

Optional push:

```powershell
./scripts/rollup-submodule-updates.ps1 -Message "chore: roll up tool updates" -Push
```

## Recommended Repo Naming

Keep names predictable:

- Umbrella: `tools`
- Tool repos: same as folder name, for example `autohotkey`

## Notes

- Submodule URLs are stored in `.gitmodules` in the umbrella repo.
- If a tool repo is private, ensure your git credentials can access it before
  adding it as a submodule.
