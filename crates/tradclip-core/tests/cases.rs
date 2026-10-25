//! Runs every line of cases.txt (C01 to C11) and checks idempotence on each (C12).

use tradclip_core::convert;

fn unescape(s: &str) -> String {
    s.replace("\\r", "\r").replace("\\n", "\n")
}

fn cases() -> Vec<(String, String, String)> {
    include_str!("cases.txt")
        .lines()
        .filter(|l| !l.starts_with('#') && !l.is_empty())
        .map(|l| {
            let f: Vec<&str> = l.split('\t').collect();
            assert_eq!(f.len(), 3, "bad case line: {l}");
            (f[0].to_string(), unescape(f[1]), unescape(f[2]))
        })
        .collect()
}

#[test]
fn acceptance_cases() {
    let failed: Vec<String> = cases()
        .into_iter()
        .filter_map(|(id, input, want)| {
            let got = convert(&input);
            (got != want).then(|| format!("{id}: {input:?} gave {got:?}, want {want:?}"))
        })
        .collect();
    assert!(failed.is_empty(), "{} failed:\n{}", failed.len(), failed.join("\n"));
}

#[test]
fn converting_twice_changes_nothing() {
    for (id, input, _) in cases() {
        let once = convert(&input);
        assert_eq!(convert(&once), once, "C12 on {id}");
    }
}
