# Plan: product demo film

- `demo/render.mjs` builds the timeline (beats, mouse path, key presses), runs the
  release `tradclip` on the dictated sentence to get the Traditional text and the
  changed positions (DF-1), then seeks `demo/scene.html` frame by frame with
  playwright-core and Chrome and encodes with ffmpeg. Modes: `timeline`, `qa`,
  `stills`, `video`, `gif`, `all`.
- `demo/scene.js` draws a frame as a pure function of time: menu bar with 繁, a chat
  window, a clipboard card, a terminal, a mouse pointer, shortcut keycaps, captions
  and the end card. The windows sit in a world layer that a camera scales and moves
  between shots; the pointer, keycaps and captions stay in screen space. The drag
  selection is hit-tested from the pointer position (DF-8). `window.film.qa()`
  reports text overflowing its window and a shot's window leaving the frame.
- `demo/music.py` (standard library) mixes the score, the cues and the samples in
  `demo/sounds/` from the timeline's event list. The timeline places every event on
  a 100 bpm grid; the score (marimba arpeggio, soft bass, shaker and kick, melody,
  ping-pong delay) follows the same grid.
- Mouse samples: HunteR4708's CC0 Logitech click on Freesound (press and release),
  cut from the public preview; the mixer varies pitch slightly per click. Key samples: the CC0 Cherry MX Blue cuts
  already used by keyflip's film. Sources in `demo/sounds/SOURCES.md`.
