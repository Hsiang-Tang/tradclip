//! `tradclip --eval [dir]`: accuracy on the pinned data from tools/fetch-eval-data.sh.
//!
//! - Phrases: McBopomofo phrases (Taiwan Traditional, 2+ characters, count >= 30),
//!   simplified with Unihan kSimplifiedVariant, converted back, compared.
//! - Sentences: UD Chinese GSDSimp converted and compared with UD Chinese GSD.
//! - Traditional kept: GSD sentences must come back unchanged.
//!
//! References are put in Taiwan forms first, so 裏 and 裡 count as the same, and
//! “” and 「」 count as the same quote marks (the converter leaves punctuation alone).
//! `--holdout` scores only the phrases tools/build_taiwan_tables.py --holdout left out.

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use tradclip_core::{convert, taiwan_forms};

fn read(dir: &Path, name: &str) -> String {
    fs::read_to_string(dir.join(name)).unwrap_or_else(|e| {
        eprintln!("cannot read {name}: {e}; run tools/fetch-eval-data.sh first");
        std::process::exit(1);
    })
}

fn simplifier(dir: &Path) -> HashMap<char, char> {
    let parse = |u: &str| {
        u.strip_prefix("U+")
            .and_then(|h| u32::from_str_radix(h, 16).ok())
            .and_then(char::from_u32)
    };
    read(dir, "Unihan_Variants.txt")
        .lines()
        .filter_map(|l| {
            let mut f = l.split('\t');
            let (from, field, to) = (f.next()?, f.next()?, f.next()?);
            (field == "kSimplifiedVariant")
                .then(|| Some((parse(from)?, parse(to.split(' ').next()?)?)))?
        })
        .collect()
}

fn sentences(dir: &Path, name: &str) -> Vec<String> {
    ["train", "dev", "test"]
        .iter()
        .flat_map(|s| {
            read(dir, &format!("{name}-{s}.conllu"))
                .lines()
                .filter_map(|l| l.strip_prefix("# text = ").map(str::to_string))
                .collect::<Vec<_>>()
        })
        .collect()
}

fn is_han(c: char) -> bool {
    matches!(c, '\u{3400}'..='\u{4DBF}' | '\u{4E00}'..='\u{9FFF}' | '\u{F900}'..='\u{FAFF}' | '\u{20000}'..='\u{3134F}')
}

/// Wrong characters, counted position by position.
fn char_errors(got: &str, want: &str, pairs: &mut HashMap<(char, char), usize>) -> usize {
    let (g, w): (Vec<char>, Vec<char>) = (got.chars().collect(), want.chars().collect());
    if g.len() != w.len() {
        return w.len().max(g.len());
    }
    g.iter()
        .zip(&w)
        .filter(|(a, b)| a != b)
        .map(|(a, b)| *pairs.entry((*b, *a)).and_modify(|n| *n += 1).or_insert(1))
        .count()
}

fn top(pairs: &HashMap<(char, char), usize>, n: usize) -> String {
    let mut v: Vec<_> = pairs.iter().collect();
    v.sort_by(|a, b| b.1.cmp(a.1).then(a.0.cmp(b.0)));
    v.iter()
        .take(n)
        .map(|((want, got), k)| format!("{want}->{got} {k}"))
        .collect::<Vec<_>>()
        .join(", ")
}

/// Same rule as tools/build_taiwan_tables.py: the held-out fifth, by Simplified form.
fn held_out(simplified: &str) -> bool {
    simplified.chars().map(|c| c as u64).sum::<u64>() % 5 == 0
}

/// Characters OpenCC always simplifies; a test input still holding one is not real
/// Simplified text (Unihan has no mapping for a few, such as 錄 and 遊).
fn traditional_only() -> std::collections::HashSet<char> {
    include_str!("../../../data/opencc/TSCharacters.txt")
        .lines()
        .filter_map(|l| l.split_once('\t'))
        .filter(|(k, v)| !v.split(' ').any(|c| c == *k))
        .filter_map(|(k, _)| k.chars().next())
        .collect()
}

pub fn run(dir: &Path, holdout: bool) {
    let simp = simplifier(dir);
    let traditional = traditional_only();
    let mut skipped = 0;
    let simplify = |s: &str| {
        s.chars()
            .map(|c| *simp.get(&c).unwrap_or(&c))
            .collect::<String>()
    };

    // Phrases.
    let mut seen = std::collections::HashSet::new();
    let (mut total, mut exact, mut weight, mut weight_ok, mut unchanged_total, mut unchanged_ok) =
        (0, 0, 0u64, 0u64, 0, 0);
    let mut pairs = HashMap::new();
    let mut misses = Vec::new();
    let mut changed = Vec::new();
    for line in read(dir, "phrase.occ").lines() {
        let Some((text, count)) = line.split_once(' ') else {
            continue;
        };
        let count: u64 = count.trim().parse().unwrap_or(0);
        if count < 30
            || text.chars().count() < 2
            || !text.chars().all(is_han)
            || !seen.insert(text.to_string())
        {
            continue;
        }
        let want = taiwan_forms(text);
        let input = simplify(text);
        // Real Simplified text stays in the common block; Unihan sometimes points to rare forms.
        if !input
            .chars()
            .all(|c| ('\u{4E00}'..='\u{9FFF}').contains(&c))
            || (holdout && !held_out(&input))
        {
            continue;
        }
        if input.chars().any(|c| traditional.contains(&c)) {
            skipped += 1;
            continue;
        }
        let got = convert(&input);
        if input == text {
            unchanged_total += 1;
            if got == want || got == text {
                unchanged_ok += 1;
            } else {
                changed.push((count, format!("{text} -> {got}")));
            }
            continue;
        }
        total += 1;
        weight += count;
        if got == want {
            exact += 1;
            weight_ok += count;
        } else {
            char_errors(&got, &want, &mut pairs);
            misses.push((count, format!("{input} -> {got} (want {want})")));
        }
    }
    misses.sort_by_key(|a| std::cmp::Reverse(a.0));
    println!(
        "Phrases with Simplified forms: {total}, {exact} exact ({:.2}%), by frequency {:.2}%",
        100.0 * exact as f64 / total as f64,
        100.0 * weight_ok as f64 / weight as f64
    );
    println!("Phrases identical in Simplified: {unchanged_total}, {unchanged_ok} kept; {skipped} skipped (no Unihan mapping)");
    changed.sort_by_key(|a| std::cmp::Reverse(a.0));
    println!(
        "  changed: {}",
        changed
            .iter()
            .take(40)
            .map(|m| m.1.as_str())
            .collect::<Vec<_>>()
            .join("; ")
    );
    println!(
        "  most frequent misses: {}",
        misses
            .iter()
            .take(60)
            .map(|m| m.1.as_str())
            .collect::<Vec<_>>()
            .join("; ")
    );
    println!("  top character errors (want->got): {}", top(&pairs, 25));

    // Sentences.
    let (trad, simp_s) = (sentences(dir, "GSD"), sentences(dir, "GSDSimp"));
    assert_eq!(trad.len(), simp_s.len(), "GSD and GSDSimp differ in length");
    let mut pairs = HashMap::new();
    let (mut ok, mut chars, mut wrong_chars, mut kept) = (0, 0, 0, 0);
    let mut misses = Vec::new();
    for (t, s) in trad.iter().zip(&simp_s) {
        let want = taiwan_forms(t).replace('「', "“").replace('」', "”");
        let got = convert(s);
        chars += want.chars().filter(|c| is_han(*c)).count();
        let e = char_errors(&got, &want, &mut pairs);
        wrong_chars += e;
        if e == 0 {
            ok += 1
        } else if misses.len() < 15 {
            misses.push(format!("{got}\n      want {want}"))
        }
        kept += usize::from(convert(t) == *t);
    }
    println!(
        "Sentences: {}, {ok} exact ({:.2}%), {:.3}% of {chars} Han characters wrong",
        trad.len(),
        100.0 * ok as f64 / trad.len() as f64,
        100.0 * wrong_chars as f64 / chars as f64
    );
    println!("  top character errors (want->got): {}", top(&pairs, 30));
    for m in &misses {
        println!("    {m}")
    }
    println!(
        "Traditional kept: {kept} of {} GSD sentences unchanged",
        trad.len()
    );
}
