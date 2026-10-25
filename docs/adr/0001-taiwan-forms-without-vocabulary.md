# ADR-0001: Taiwan character forms, no vocabulary changes, 臺 as 台

Date: 2026-10-25. Status: accepted.

## Context

OpenCC offers `s2t` (OpenCC's own standard forms such as 裏 and 麪), `s2tw` (Taiwan
character forms: 裡, 麵, 著) and `s2twp` (Taiwan forms plus vocabulary: 软件 to 軟體).
The maintainer wants Simplified characters fixed without the wording being changed.
`s2tw` still writes 臺 (臺灣, 舞臺), the formal form, while 台 is what Taiwan writers
type every day and what Zhuyin input methods put first.

## Decision

Use the `s2tw` dictionary chain and no phrase vocabulary tables. Add
`data/overrides.tsv` to the Taiwan pass with 臺 to 台. 颱 and 檯 are separate
characters and are kept.

## Consequences

- 软件 stays 軟件 and 视频 stays 視頻: the wording is the speaker's.
- Anyone who prefers 臺 can drop the override line; nothing else depends on it.
