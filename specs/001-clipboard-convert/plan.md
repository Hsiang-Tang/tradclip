# Plan: Simplified to Traditional on the clipboard

## Shape

- `crates/tradclip-core`: the converter. Pure Rust, no system APIs. Also builds as a
  static library with a two-function C interface (`include/tradclip.h`) for the
  macOS shell.
- `crates/tradclip-cli`: `tradclip` reads stdin (or arguments) and prints the
  converted text, for tests and for `pbpaste | tradclip | pbcopy`.
- `macos/`: a Swift menu bar app (`LSUIElement`) that watches the clipboard and owns
  the shortcut. It never decides how to convert; it only calls the core.

## Conversion (TC-1 to TC-5)

OpenCC's `s2tw` configuration is a chain of two dictionary passes:

1. `STPhrases` and `STCharacters`, matched forward by longest key.
2. `TWVariantsPhrases` and `TWVariants`, matched the same way over the result.

The core embeds the four files (pinned in `data/opencc/SOURCES.txt`) and parses them
once on first use. Each entry's first candidate is used. A key is looked up as a
`&str` slice of the input, so matching allocates nothing per probe; the set of key
lengths present is kept so only those lengths are tried.

OpenCC's build also generates `STPhrases_GeneratedFromRegionalPhrases` and applies a
compatibility-ideograph normalization; both are left out (small coverage, extra build
step). `data/overrides.tsv` is applied in the second pass after OpenCC's tables and
holds the project's own choices; today only 臺 to 台 (ADR-0001).

Traditional text (TC-3): a character is Simplified-only when it is a key in
`STCharacters` and its candidates do not include itself (发, 说, 们; not 于, 后, 台),
plus the generated `data/taiwan-simplified-chars.txt`. A character is
Traditional-only when `TSCharacters` simplifies it and never keeps it (後, 說; not
像). Text is cut into sentences after 。！？!?；; and line breaks; each sentence is
converted fully, left alone, or converted phrase by phrase (ADR-0002).

Taiwan usage (TC-12): `data/taiwan-phrases.tsv`, generated from McBopomofo's phrase
frequencies, is loaded after `STPhrases` and wins over it (ADR-0002).

Accuracy (TC-13): `tradclip --eval` scores McBopomofo phrases simplified with Unihan
(an answer key independent of OpenCC), UD Chinese GSDSimp against GSD sentences,
and GSD sentences that must stay unchanged.

## Clipboard shell (TC-6 to TC-10)

- Watch: a 0.25 s timer compares `NSPasteboard.general.changeCount` and converts on
  every change made outside the app, whichever app made it. Polling is the only
  public way to observe the pasteboard on macOS.
- Rewrite: skip if the types include `org.nspasteboard.ConcealedType` or
  `org.nspasteboard.TransientType`. Convert the string and, if present, the HTML;
  write both back only if either changed, then record the new change count so the
  app does not react to its own write.
- Paste as Traditional: a Carbon `RegisterEventHotKey` for Control+Option+V (no
  permission needed to listen). On press: snapshot every item and type on the
  pasteboard, write the converted text, post Command+V with `CGEvent` (this is what
  needs Accessibility), and restore the snapshot 0.5 s later.
- Settings in `UserDefaults`; Open at Login with `SMAppService.mainApp` (macOS 13+).
- Signing: `macos/build.sh` signs with the first Apple Development identity when one
  exists, so the Accessibility grant survives rebuilds; ad hoc otherwise.

## Verification

- `cargo test` (cases, idempotence, timing in release) and `cargo clippy`.
- Scripted clipboard checks K1 to K3 drive the real app with `osascript` and
  `pbcopy`/`pbpaste`; K4 and K5 are hand checks.
