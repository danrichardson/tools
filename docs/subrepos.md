# Tools Umbrella + Local Tool Repos

This repository is the only GitHub repo.
Each tool folder can also have its own local git history for focused work.

## Target Model

- Umbrella repo (`tools`): the only remote-backed repo that is pushed to GitHub.
- Tool local repo (for example `autohotkey/.git`): local-only history, no remote.
- Roll-up commit: commit tool changes in the local tool repo first, then commit
  the same file changes in the umbrella repo.

This gives you both:

- Independent local commit history per tool
- One published repo (`tools`) containing all tool files

## Day-to-Day Workflow

1. Work in a tool folder.
2. Commit in the tool's local repo.
3. From the umbrella repo root, stage that folder.
4. Commit and push to `tools`.

## Initialize a Local Tool Repo

Use `scripts/init-local-tool-repo.ps1`.

Example:

```powershell
./scripts/init-local-tool-repo.ps1 -ToolPath autohotkey
```

What it does:

1. Verifies you are inside the umbrella git repo
2. Initializes git in the selected tool folder
3. Creates an initial local commit from current files
4. Removes any remotes from that tool repo

## Roll Up Tool Changes to Tools Repo

Use `scripts/rollup-tool-folder.ps1`.

Example:

```powershell
./scripts/rollup-tool-folder.ps1 -ToolPath autohotkey
```

Optional custom message and push:

```powershell
./scripts/rollup-tool-folder.ps1 -ToolPath autohotkey -Message "tools: roll up autohotkey" -Push
```

## Important Notes

- The local tool `.git` folder is not committed to the umbrella repo.
- Cloning `tools` on another machine does not include local tool history.
- To recreate a local tool repo on another machine, run the init script again.
