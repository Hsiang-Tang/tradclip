//! TC-11: 10,000 characters convert in under 50 ms. Release builds only.

#[cfg(not(debug_assertions))]
#[test]
fn ten_thousand_characters_under_50_ms() {
    let sentence = "我们明天用GitHub开PR给团队审查，这里的说明文件需要更新。";
    let text: String = sentence.chars().cycle().take(10_000).collect();
    tradclip_core::warm_up();
    let start = std::time::Instant::now();
    let out = tradclip_core::convert(&text);
    let took = start.elapsed();
    assert!(out.contains("我們"));
    assert!(took.as_millis() < 50, "took {took:?}");
    println!("10,000 characters in {took:?}");
}
