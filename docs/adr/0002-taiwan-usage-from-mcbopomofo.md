# ADR-0002: Taiwan usage tables from McBopomofo, three-way sentence gate

Date: 2026-10-25. Status: accepted.

## Context

The first accuracy run (`tradclip --eval`) showed two kinds of error:

- The sentence gate converted only sentences with a Simplified-only character, so 之后
  and 由于 (every character also valid in Traditional) stayed Simplified, and a
  Traditional sentence holding one variant such as 卧 was rewritten.
- OpenCC's choices sometimes differ from what Taiwan writers use: 分布 to 分佈, 了解
  to 瞭解, 秘书 to 祕書; and 广, 万 count as valid Traditional although Taiwan text
  practically never uses them.

## Decision

- Gate: compare Simplified-only against Traditional-only characters (the latter from
  OpenCC's `TSCharacters`: a character OpenCC simplifies and never keeps). Simplified
  wins: full conversion. Otherwise any Traditional-only character: leave it.
  Neither: whole phrases only, then the Taiwan pass.
- Usage: `tools/build_taiwan_tables.py` reads McBopomofo's phrase frequencies (a
  Taiwan corpus, MIT) and writes `data/taiwan-phrases.tsv`: for each Simplified
  phrase, the Traditional spelling with at least 30 occurrences and twice the count
  of OpenCC's choice. It also writes `data/taiwan-simplified-chars.txt`: OpenCC keys
  that are 50 times rarer than their Traditional form, except 于后台里面干, which are
  real in Taiwan text (the surname 于, 皇后).
- The thresholds were picked on held-out phrases and the GSD sentences (the
  independent set); 30 and 2.0 scored best of six settings tried.

## Consequences

- Held-out phrases 98.74% to 99.53%; GSD sentences 89.63% to 91.13% exact.
- The tables are generated, not edited by hand; a different corpus or threshold
  means regenerating and re-measuring.
- Country names and other vocabulary stay untouched (意大利 stays 意大利), per
  ADR-0001.
