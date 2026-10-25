# Verification

## Commands

```
cargo test                      # cases C01 to C12, unit tests
cargo test --release            # adds the TC-11 timing test
cargo clippy --all-targets -- -D warnings
macos/build.sh                  # build, sign, install, launch
tools/fetch-eval-data.sh        # pinned evaluation data into eval-data/
cargo run --release -p tradclip-cli -- --eval
python3 -I tools/build_taiwan_tables.py --holdout && cargo run --release -p tradclip-cli -- --eval --holdout
python3 -I tools/build_taiwan_tables.py   # restore the full tables afterwards
```

Scripted clipboard checks (K1 to K3): bring Claude to the front with `open -a Claude`,
put text on the clipboard with `pbcopy`, wait 0.8 s, read it back with `pbpaste`;
repeat with another app in front. Check the frontmost bundle ID with System Events
first: `osascript -e 'tell application "Claude" to activate'` sometimes leaves the
previous app in front, and a run like that tests nothing.

## Log

### 2026-10-25 Converter (T1 to T3)

- Cases C01 to C11 written before the converter; against a stub that returns its
  input, 11 of 14 lines failed (the three that expect unchanged text passed).
- After the converter: all 14 lines and the idempotence check pass, plus 3 unit tests
  (Simplified-only set, longest match, C interface round trip).
- Release timing: 10,000 characters in 2.0 ms (limit 50 ms).
- `cargo clippy --all-targets -D warnings` clean.

### 2026-10-25 Menu bar app (T4 to T6)

- `macos/build.sh` built and signed with the Apple Development identity and launched
  the app. The linker warns that Homebrew's Rust standard library objects target
  macOS 26 while the app targets 13.
- K1: Claude frontmost, `我们用语音输入，这里的说明` read back as
  `我們用語音輸入，這裡的說明`.
- K2: another app frontmost, `我们用语音输入` stayed Simplified.
- K3: `Hello 這是繁體` copied with Claude frontmost left the change count at 26.
- HTML: plain text and HTML (`<b>头发说明</b>`) were both converted.
- Concealed: content marked `org.nspasteboard.ConcealedType` stayed Simplified.
- First HTML attempt tested nothing: `activate` had left VS Code in front. Rerun with
  `open -a Claude` and the frontmost ID checked; recorded above.
- Not run: K4 and K5 (need Accessibility and a human).

### 2026-10-25 Accuracy (T7)

- Maintainer request: more tests and higher accuracy, in the style of keyflip's table.
- Evaluation added: McBopomofo phrases simplified with Unihan, UD Chinese GSDSimp
  against GSD, and GSD sentences that must stay unchanged. Reference text is put in
  Taiwan forms and “” counts as 「」.
- Baseline (first gate, OpenCC only): phrases 94.10% exact; sentences 83.81% exact
  without the quote rule; 4,944 of 4,997 Traditional sentences unchanged.
- Three-way gate: phrases 98.05%; Traditional unchanged 4,996.
- Evaluation fixes, not converter changes: inputs with Unihan's rare simplified forms
  (讚 to 𬤮) are skipped, and so are inputs Unihan left with a Traditional-only
  character (錄, 遊; 220 phrases), since neither is real Simplified text. The first
  Traditional-only rule wrongly counted 像; it now comes from `TSCharacters`.
- Usage tables (ADR-0002). Same held-out fifth, tables built without it: 98.74%
  without tables, 99.53% with. GSD sentences with the quote rule: 89.63% to 91.13%.
  Thresholds tried (min count, dominance; GSD exact): 30, 2.0: 90.99; 10, 2.0: 90.67;
  10, 1.5: 90.67; 5, 1.2: 90.57; 30, 1.2: 90.93; 50, 3.0: 90.73 (held-out phrases
  99.53% for all). Kept 30, 2.0.
- First table build marked 于 and 后 as Simplified (rare in the corpus); excluded with
  台里面干, since 于先生 must stay.
- Cases C13 to C20 were written after the change. Run against the previous commit's
  converter, C13, C15, C18 and C20 fail; C14, C16, C17 and C19 already passed there,
  so they guard against regressions rather than prove the change.
- Final: 22 cases pass, idempotence passes, clippy clean; 10,000 characters still
  under 50 ms.

### 2026-10-25 Paste as Traditional (K4)

- The app now installs into `/Applications`: the maintainer could not find
  `~/Applications` in the Accessibility file picker. Accessibility granted by the
  maintainer.
- K4 scripted in TextEdit: clipboard `我们了解秘书的工作，之后再说`, Control+Option+V sent
  with System Events; the document received `我們了解秘書的工作，之後再說` and the
  clipboard read back the original Simplified text afterwards.
- Not yet run: K4 in a VS Code terminal, K5 (menu choices after relaunch).
- Maintainer hand test: Control+Option+V first seemed to fail; the event log
  (`log show --predicate 'subsystem == "com.hsiangtang.tradclip"'`, event names only)
  showed no press reached the app. The maintainer had pressed Control+V, their paste
  habit. With Control+Option+V it pasted Traditional text. A temporary key monitor
  used to diagnose this was removed; the event log stays.

### 2026-10-25 Auto-convert in every app (TC-6 revised)

- Maintainer decision: keep Command+C and Command+V; convert every copy in any app
  instead of only ChatGPT and Claude. Control+Option+V is now off by default.
- First check run tested nothing: the app was not running after that build (killall
  in the next step found no process). Rebuilt, confirmed the process, reran.
- K1: VS Code frontmost, `我们了解秘书的工作，之后再说` read back
  `我們了解秘書的工作，之後再說`; Finder frontmost, `这里的说明` read back `這裡的說明`.
- K2: with `autoConvert` false the text stayed Simplified; with the setting removed
  (default on) it converted again.
- K3: Traditional and English text left the change count as is (97 to 97).
- Concealed content stayed Simplified.
