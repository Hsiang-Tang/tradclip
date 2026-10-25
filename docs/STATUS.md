# Status

Updated 2026-10-25.

## Where we are

Feature 001 (clipboard conversion) is built and installed on the maintainer's Mac.
The converter passes all 22 acceptance cases; accuracy is in the README (held-out
Taiwan phrases 99.53%, Wikipedia sentences 91.13% exact). Auto-convert from Claude
passed the scripted checks.

## Next action

- Maintainer: try Control+Option+V in a VS Code terminal and check that menu choices
  persist after relaunch (K5).

## Not verified

- K4 in a terminal (passed in TextEdit), K5 menu persistence: need a human.
- Auto-convert from the ChatGPT app: the same code path as Claude, not yet run with
  ChatGPT frontmost.
- Other Macs: Homebrew's Rust standard library targets the build machine's macOS
  (26), so a build from this machine may not run on older macOS.

## Blockers

- None.
