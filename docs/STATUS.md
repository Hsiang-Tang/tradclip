# Status

Updated 2026-10-25.

## Where we are

Feature 001 (clipboard conversion) is built and installed on the maintainer's Mac.
The converter passes all acceptance cases; auto-convert from Claude passed the
scripted checks.

## Next action

- Maintainer: allow Accessibility for tradclip, then hand-test K4 (Control+Option+V
  in a VS Code terminal) and K5 (menu choices persist after relaunch).

## Not verified

- K4 Paste as Traditional, K5 menu persistence: need a human.
- Auto-convert from the ChatGPT app: the same code path as Claude, not yet run with
  ChatGPT frontmost.
- Other Macs: Homebrew's Rust standard library targets the build machine's macOS
  (26), so a build from this machine may not run on older macOS.

## Blockers

- None.
