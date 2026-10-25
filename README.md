# tradclip

Turns Simplified Chinese on the macOS clipboard into Traditional Chinese, with Taiwan
character forms and your own wording.

Voice transcription in the ChatGPT and Claude apps often comes out in Simplified
Chinese. tradclip fixes it on the way to wherever you paste, including terminals,
where a selection cannot be replaced in place.

- **Copy in ChatGPT or Claude**: the copied text is converted right away. Paste as
  usual. No permission needed.
- **Control+Option+V anywhere**: pastes the clipboard as Traditional and leaves the
  clipboard as it was. Needs Accessibility permission.

```
$ echo "我们用语音输入，这里的说明需要更新" | tradclip
我們用語音輸入，這裡的說明需要更新
```

What it does and does not change:

| Input | Output | Why |
| --- | --- | --- |
| 头发 | 頭髮 | phrases decide one-to-many characters (not 頭發) |
| 软件和视频 | 軟件和視頻 | characters only, wording kept (not 軟體和影片) |
| 台湾的台风 | 台灣的颱風 | everyday 台, but 颱 where it belongs |
| 于先生說台灣很好 | unchanged | Traditional sentences are left as written |

## Install

Apple Silicon, macOS 13 or later, Rust and the Xcode command line tools:

```
macos/build.sh
```

This builds `Tradclip.app`, installs it into `~/Applications` and starts it; 繁 appears
in the menu bar. For Control+Option+V, choose "Allow Accessibility" in that menu and
switch tradclip on in System Settings > Privacy & Security > Accessibility. Choose
"Open at Login" to keep it running.

The `tradclip` command (`cargo build --release -p tradclip-cli`) converts stdin or its
arguments, for example `pbpaste | tradclip | pbcopy`.

## How it works

`crates/tradclip-core` embeds OpenCC's `s2tw` dictionaries and matches the longest
phrase first, then single characters, in two passes (Simplified to Traditional, then
Taiwan forms). A sentence is converted only when it has a character that exists only
in Simplified, so Traditional text is never rewritten. 10,000 characters convert in
about 2 ms. The menu bar app (`macos/`) watches the clipboard and owns the shortcut;
it never reads concealed (password manager) contents, never logs clipboard text, and
makes no network requests.

Spec, plan and acceptance cases: `specs/001-clipboard-convert/`. Decisions:
`docs/adr/`.

## License

MIT. The OpenCC dictionaries are Apache-2.0; see `THIRD_PARTY_LICENSES.md`.
