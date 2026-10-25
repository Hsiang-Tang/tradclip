//! `tradclip [text...]`: converts the arguments, or stdin when there are none.
//! `tradclip --eval [--holdout] [dir]`: accuracy report (eval.rs).

use std::io::{Read, Write};

mod eval;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("--eval") {
        let holdout = args.iter().any(|a| a == "--holdout");
        let dir = args
            .iter()
            .skip(1)
            .find(|a| !a.starts_with("--"))
            .map_or("eval-data", String::as_str);
        eval::run(std::path::Path::new(dir), holdout);
        return;
    }
    let input = if args.is_empty() {
        let mut s = String::new();
        if let Err(e) = std::io::stdin().read_to_string(&mut s) {
            eprintln!("tradclip: cannot read stdin: {e}");
            std::process::exit(1);
        }
        s
    } else {
        args.join(" ") + "\n"
    };
    let _ = std::io::stdout().write_all(tradclip_core::convert(&input).as_bytes());
}
