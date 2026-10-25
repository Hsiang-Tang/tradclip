# Tasks: Simplified to Traditional on the clipboard

- T1 Acceptance cases C01 to C12 in `crates/tradclip-core/tests/cases.txt`, run
  before the converter exists. Requirements TC-1 to TC-5. Status: done (2026-10-25); 11 of 14 failed
  against a stub.
- T2 Converter: dictionary loading, longest match, Taiwan pass, overrides, sentence
  gate. Requirements TC-1 to TC-5, TC-11. Status: done (2026-10-25).
- T3 C interface and `tradclip` CLI. Status: done (2026-10-25).
- T4 macOS menu bar app: clipboard watch and rewrite. Requirements TC-6, TC-7, TC-9,
  TC-10. Status: done (2026-10-25); K1 to K3 pass.
- T5 Paste as Traditional shortcut. Requirement TC-8. Status: done (2026-10-25); K4 passed
  in TextEdit, terminal check by hand open.
- T6 Build, install, scripted checks K1 to K3, docs. Status: done (2026-10-25).
- T7 Accuracy evaluation (`tradclip --eval`, pinned data), three-way sentence gate,
  Taiwan usage tables. Requirements TC-3, TC-12, TC-13. Status: done (2026-10-25).
