# Tools Repo Instructions

## README Auto-Update

When the user asks to update the README (e.g. "update the readme", "refresh the readme", "do this on the readme"):

1. Scan every directory and file in the repo (recursively)
2. Read each script/config file to understand what it does
3. Regenerate the section between `<!-- BEGIN TOOLS -->` and `<!-- END TOOLS -->` in README.md
4. Keep the format: H2 heading per top-level directory, bulleted list of files with bold name + dash + concise description of what the tool does and how to use it
5. If a directory is empty, note it as _(Empty)_
6. Preserve everything outside the markers (title, intro paragraph)

The goal is a quick-reference catalog: someone should be able to read the README and know what every tool does, what keys to press, and any dependencies — without opening the source files.
