# Acceptance: clipboard conversion

## Conversion cases (automated)

`crates/tradclip-core/tests/cases.txt` holds one case per line, input and expected
output separated by a tab. `cargo test` runs every line. Never delete or loosen a case
to make an implementation pass.

| Case | Requirement | Input | Expected |
| --- | --- | --- | --- |
| C01 | TC-1 | 头发 | 頭髮 |
| C02 | TC-1 | 以后再说 | 以後再說 |
| C03 | TC-1 | 干净的衣服 | 乾淨的衣服 |
| C04 | TC-1 | 这里的面条很好吃 | 這裡的麵條很好吃 |
| C05 | TC-2 | 软件和视频 | 軟件和視頻 |
| C06 | TC-3 | 于先生說台灣很好 | unchanged |
| C07 | TC-3 | 這是繁體。这是简体。 | 這是繁體。這是簡體。 |
| C08 | TC-4 | mixed Latin and Chinese: 我们用GitHub开PR | 我們用GitHub開PR |
| C09 | TC-4 | code comment: `let x = 1; // 注释` | `let x = 1; // 註釋` |
| C10 | TC-4 | empty, ASCII, emoji, CRLF line endings | unchanged apart from Chinese |
| C11 | TC-5 | 台湾的台风 | 台灣的颱風 |
| C12 | TC-4 | converting the output of every case again | same output |

## Clipboard checks

| Check | Requirement | How |
| --- | --- | --- |
| K1 | TC-6 | With Claude frontmost, put Simplified text on the clipboard; it reads back Traditional. Scripted in `docs/VERIFICATION.md`. |
| K2 | TC-6 | With another app frontmost, the same text stays Simplified. Scripted. |
| K3 | TC-7 | Traditional or English text copied in Claude leaves the clipboard change count as is. Scripted. |
| K4 | TC-8 | In a terminal, Control+Option+V pastes Traditional text and the clipboard still holds the original afterwards. By hand. |
| K5 | TC-9 | Menu toggles persist after quitting and relaunching. By hand. |
| K6 | TC-11 | `cargo test --release` timing test. |
