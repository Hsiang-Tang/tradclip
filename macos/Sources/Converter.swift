import Foundation

/// Thin wrapper over the Rust core; the shell never edits text itself.
enum Converter {
    static func warmUp() {
        tradclip_warm_up()
    }

    static func convert(_ text: String) -> String {
        // A C string would stop at an embedded NUL and drop the rest.
        guard !text.contains("\0"), let out = text.withCString({ tradclip_convert($0) }) else {
            return text
        }
        defer { tradclip_free(out) }
        return String(cString: out)
    }
}
