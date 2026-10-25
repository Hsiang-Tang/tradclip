# Spec: Simplified to Traditional on the clipboard

## Problem

Voice transcription in the ChatGPT and Claude desktop apps often comes out in
Simplified Chinese. The maintainer copies that text into a terminal (VS Code, Claude
Code), where a selection cannot be replaced in place. Converting by hand means a
round trip through another tool for every message.

## Users and context

- A Traditional Chinese (Taiwan) writer on macOS who dictates in ChatGPT or Claude
  and pastes the result elsewhere, mostly into a terminal.
- Works in any app as the paste target, including Electron apps and terminals.

## Requirements

Conversion (core):

- TC-1 Converts Simplified Chinese to Traditional Chinese with Taiwan character
  forms, using OpenCC's `s2tw` dictionaries (phrases first by longest match, then
  single characters). One-to-many characters are decided by phrases: 头发 gives 頭髮,
  not 頭發.
- TC-2 Characters only, never vocabulary: 软件 gives 軟件, not 軟體.
- TC-3 Traditional text stays as written. Text is split into sentences (after
  。！？!?；; and line breaks); a sentence is converted only when it contains at least
  one character that exists only in Simplified. A sentence such as 于先生說 is left
  alone, so the surname 于 is never turned into 於.
- TC-4 Everything that is not Chinese (Latin letters, digits, code, emoji, spacing,
  line endings) is unchanged, and converting twice gives the same result as once.
- TC-5 臺 is written 台, the everyday Taiwan form; 颱 and 檯 are kept (台风 gives 颱風).

Clipboard (macOS shell):

- TC-6 Auto-convert: when the clipboard changes while ChatGPT or Claude is the
  frontmost app, its text is converted in place. The app list defaults to
  `com.openai.codex`, `com.openai.chat` and `com.anthropic.claudefordesktop`. Copies
  made in any other app are never touched. Needs no system permission.
- TC-7 The clipboard is rewritten only when conversion changes the text. Plain text
  and HTML are converted; other formats are dropped only when a rewrite happens.
  Contents marked concealed or transient (password managers) are never read.
- TC-8 Paste as Traditional: Control+Option+V converts the clipboard text, pastes it
  into the frontmost app, and then restores the clipboard to what it held before.
  Needs Accessibility permission; without it the shortcut does nothing but explain
  how to grant it.
- TC-9 Menu bar item with: Auto-convert from ChatGPT and Claude (on/off), Paste as
  Traditional shortcut (on/off), Accessibility status (opens the settings pane when
  missing), Open at Login, Quit. Choices persist across launches.
- TC-10 Private: no network access, and clipboard text is never logged or stored.
- TC-11 Fast: converting 10,000 characters takes under 50 ms in a release build.

## Acceptance

- Conversion cases are listed in `acceptance.md` and run by
  `crates/tradclip-core/tests/cases.txt`.
- Clipboard behavior is checked by hand and by script as listed in `acceptance.md`.

## Not doing

- Vocabulary changes (OpenCC `s2twp`), Traditional to Simplified, Hong Kong forms.
- Replacing a selection in place (terminals cannot), automatic conversion in other
  apps, iOS.
