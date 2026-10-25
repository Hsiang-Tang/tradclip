# Spec: product demo film

## Problem

The README explains tradclip in words. A short film shows the whole point in seconds:
voice typing comes out Simplified, you copy and paste as usual, Traditional comes out.

## Requirements

- DF-1 Truthful: the converted text and the changed characters come from the real
  converter (`tradclip`), not typed by hand.
- DF-2 Story in four beats: dictation in a chat window comes out Simplified; select
  and Command+C; the clipboard turns Traditional (menu bar 繁 reacts, changed
  characters flip one by one); click into a terminal and Command+V pastes Traditional.
- DF-3 Generic look: no real product's name, logo or window design (no ChatGPT,
  Claude or Apple branding); the same paper style and captions as keyflip's film.
- DF-4 Sound: recorded CC0 mouse clicks (press on mouse down, release on mouse up),
  CC0 key sounds for the shortcuts, synthesized mic, conversion and paste cues, and a
  quiet synthesized score under them. Every sample's source and license is recorded.
- DF-5 Ends on the name and the repository address only.
- DF-6 Output: 1920x1080 MP4 with sound (kept out of Git, attached to the release),
  and a short silent GIF for the README (under 2 MB).
- DF-7 Reproducible: one command rebuilds timeline, frames, audio, MP4 and GIF; a QA
  pass checks that text stays inside its window and nothing leaves the frame.

## Not doing

- Real screen recordings, narration, statistics on screen.
