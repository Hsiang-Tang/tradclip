# Acceptance: product demo film

| Case | Requirement | Check | Expected |
| --- | --- | --- | --- |
| F1 | DF-1 | `node demo/render.mjs timeline` | builds `tradclip`, prints the sentence before and after; fails if the length changes |
| F2 | DF-2, DF-5 | contact sheet from `node demo/render.mjs stills` | dictation, selection with Command+C, clipboard flip with the menu bar pulse, click and Command+V into the terminal, then the end card with name and address only |
| F3 | DF-3 | contact sheet, by eye | no real product name, logo or window design |
| F4 | DF-4 | `demo/sounds/SOURCES.md`, levels of `demo/out/audio.wav` around each event in `timeline.json` | every sample has a source and CC0 license; every event is audible above the score; the end fades out |
| F5 | DF-6 | `ffprobe` on the MP4, size of the GIF | 1920x1080 with an audio stream; GIF under 2 MB; MP4 not tracked by Git |
| F6 | DF-7 | `node demo/render.mjs all` | rebuilds everything; the QA pass prints `qa: OK` |
