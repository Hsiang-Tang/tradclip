# Status

Updated 2026-10-25.

## Where we are

Feature 001 (clipboard conversion) is built and installed on the maintainer's Mac:
every copy is converted, Control+Option+V is off by default. Published at
https://github.com/Hsiang-Tang/tradclip (2026-10-25).
The converter passes all 22 acceptance cases; accuracy is in the README (held-out
Taiwan phrases 99.53%, Wikipedia sentences 91.13% exact). Auto-convert from Claude
passed the scripted checks. A notarized universal build for macOS 13 and later is
published as release v0.1.0
(https://github.com/Hsiang-Tang/tradclip/releases/tag/v0.1.0) with the demo film
attached, and the demo film (specs/002-demo-film) is rendered; the
README shows its GIF.

## Next action

- Maintainer: use Command+C and Command+V as usual for a while; check that menu
  choices persist after relaunch (K5).

## Not verified

- K5 menu persistence: needs a human.
- Launching on an Intel Mac or on macOS 13: no such machine here.

## Blockers

- None.
