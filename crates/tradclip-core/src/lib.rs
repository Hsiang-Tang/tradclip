//! Simplified to Traditional Chinese (Taiwan forms) conversion (specs/001-clipboard-convert).
//!
//! Two passes of forward longest match, as in OpenCC's `s2tw`: Simplified to
//! Traditional, then Taiwan character forms. Only sentences that contain a
//! Simplified-only character are converted, so Traditional text stays as written.

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

mod ffi;

const ST_PHRASES: &str = include_str!("../../../data/opencc/STPhrases.txt");
const ST_CHARACTERS: &str = include_str!("../../../data/opencc/STCharacters.txt");
const TS_CHARACTERS: &str = include_str!("../../../data/opencc/TSCharacters.txt");
const TW_PHRASES: &str = include_str!("../../../data/opencc/TWVariantsPhrases.txt");
const TW_CHARACTERS: &str = include_str!("../../../data/opencc/TWVariants.txt");
const OVERRIDES: &str = include_str!("../../../data/overrides.tsv");
const TAIWAN_PHRASES: &str = include_str!("../../../data/taiwan-phrases.tsv");
const TAIWAN_SIMPLIFIED: &str = include_str!("../../../data/taiwan-simplified-chars.txt");

const SENTENCE_END: &[char] = &['。', '！', '？', '!', '?', '；', ';', '\n'];

struct Dict {
    map: HashMap<String, String>,
    /// Key lengths in characters, longest first.
    lengths: Vec<usize>,
}

impl Dict {
    /// Later sources override earlier ones; each entry keeps its first candidate.
    fn from_sources(sources: &[&str]) -> Dict {
        let mut map = HashMap::new();
        for source in sources {
            for (key, candidates) in entries(source) {
                let first = candidates.split(' ').next().unwrap_or(candidates);
                map.insert(key.to_string(), first.to_string());
            }
        }
        let mut lengths: Vec<usize> = map
            .keys()
            .map(|k| k.chars().count())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        lengths.sort_unstable_by(|a, b| b.cmp(a));
        Dict { map, lengths }
    }

    fn apply(&self, text: &str, out: &mut String) {
        self.apply_with(text, 1, out, |value, out| out.push_str(value));
    }

    /// Longest match using keys of at least `min_len` characters; `emit` writes each
    /// matched value, unmatched characters are copied.
    fn apply_with(
        &self,
        text: &str,
        min_len: usize,
        out: &mut String,
        mut emit: impl FnMut(&str, &mut String),
    ) {
        let bounds: Vec<usize> = text
            .char_indices()
            .map(|(i, _)| i)
            .chain(std::iter::once(text.len()))
            .collect();
        let n = bounds.len() - 1;
        let mut i = 0;
        while i < n {
            let hit = self
                .lengths
                .iter()
                .filter(|&&len| len >= min_len && len <= n - i)
                .find_map(|&len| {
                    self.map
                        .get(&text[bounds[i]..bounds[i + len]])
                        .map(|v| (len, v))
                });
            match hit {
                Some((len, value)) => {
                    emit(value, out);
                    i += len;
                }
                None => {
                    out.push_str(&text[bounds[i]..bounds[i + 1]]);
                    i += 1;
                }
            }
        }
    }
}

fn entries(source: &str) -> impl Iterator<Item = (&str, &str)> {
    source
        .lines()
        .filter(|l| !l.starts_with('#') && !l.trim().is_empty())
        .filter_map(|l| l.split_once('\t'))
}

struct Converter {
    simplified: Dict,
    taiwan: Dict,
    simplified_only: HashSet<char>,
    traditional_only: HashSet<char>,
}

impl Converter {
    fn new() -> Converter {
        // A character is Simplified-only when its Traditional candidates do not include itself.
        let simplified_only = entries(ST_CHARACTERS)
            .filter(|(key, candidates)| !candidates.split(' ').any(|c| c == *key))
            .filter_map(|(key, _)| key.chars().next())
            .chain(
                TAIWAN_SIMPLIFIED
                    .lines()
                    .filter(|l| !l.starts_with('#'))
                    .filter_map(|l| l.chars().next()),
            )
            .collect();
        // Traditional-only: OpenCC simplifies it and never keeps it (後, 說, 們; not 像).
        let traditional_only = entries(TS_CHARACTERS)
            .filter(|(key, candidates)| !candidates.split(' ').any(|c| c == *key))
            .filter_map(|(key, _)| key.chars().next())
            .collect();
        Converter {
            // Phrases override single characters of the same key, as OpenCC's short circuit does.
            // Taiwan usage from McBopomofo overrides OpenCC's phrase choices (ADR-0002).
            simplified: Dict::from_sources(&[ST_CHARACTERS, ST_PHRASES, TAIWAN_PHRASES]),
            taiwan: Dict::from_sources(&[TW_CHARACTERS, TW_PHRASES, OVERRIDES]),
            simplified_only,
            traditional_only,
        }
    }

    /// Each sentence is judged on its own (TC-3): more Simplified-only than
    /// Traditional-only characters means Simplified; any Traditional-only character
    /// otherwise means Traditional; neither means only whole phrases are converted
    /// (之后 to 之後), never single characters (于先生 stays), before the Taiwan pass.
    fn convert(&self, text: &str) -> String {
        let mut out = String::with_capacity(text.len());
        let mut step = String::new();
        for sentence in text.split_inclusive(SENTENCE_END) {
            let simplified = sentence
                .chars()
                .filter(|c| self.simplified_only.contains(c))
                .count();
            let traditional = sentence
                .chars()
                .filter(|c| self.traditional_only.contains(c))
                .count();
            if simplified > traditional {
                step.clear();
                self.simplified.apply(sentence, &mut step);
                self.taiwan.apply(&step, &mut out);
            } else if traditional > 0 {
                out.push_str(sentence);
            } else {
                step.clear();
                self.simplified
                    .apply_with(sentence, 2, &mut step, |value, out| out.push_str(value));
                self.taiwan.apply(&step, &mut out);
            }
        }
        out
    }
}

fn converter() -> &'static Converter {
    static CONVERTER: OnceLock<Converter> = OnceLock::new();
    CONVERTER.get_or_init(Converter::new)
}

/// Loads the dictionaries now instead of on the first conversion.
pub fn warm_up() {
    converter();
}

/// Applies only the Taiwan character-form pass (裏 to 裡, 臺 to 台). The evaluation
/// uses it to put reference text in the same forms the converter writes.
pub fn taiwan_forms(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    converter().taiwan.apply(text, &mut out);
    out
}

/// Converts Simplified Chinese in `text` to Traditional Chinese with Taiwan forms.
pub fn convert(text: &str) -> String {
    converter().convert(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ambiguous_characters_are_not_simplified_only() {
        let c = converter();
        for ch in ['于', '后', '台', '干', '里', '面'] {
            assert!(!c.simplified_only.contains(&ch), "{ch}");
        }
        for ch in ['发', '说', '们', '这'] {
            assert!(c.simplified_only.contains(&ch), "{ch}");
        }
    }

    #[test]
    fn longest_match_wins() {
        assert_eq!(convert("头发"), "頭髮");
        assert_eq!(convert("发现"), "發現");
    }
}
