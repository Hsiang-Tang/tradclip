# Verification

## Commands

```
cargo test                      # cases C01 to C12, unit tests
cargo test --release            # adds the TC-11 timing test
cargo clippy --all-targets -- -D warnings
macos/build.sh                  # build, sign, install, launch
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
