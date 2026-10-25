//! `tradclip [text...]`: converts the arguments, or stdin when there are none.

use std::io::{Read, Write};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
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
