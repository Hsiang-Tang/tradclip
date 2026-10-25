import Cocoa

/// Owns every write to the general pasteboard so the watcher can tell its own
/// writes from the user's copies.
final class Clipboard {
    static let concealed = NSPasteboard.PasteboardType("org.nspasteboard.ConcealedType")
    static let transient = NSPasteboard.PasteboardType("org.nspasteboard.TransientType")

    let board = NSPasteboard.general
    private(set) var seenChangeCount: Int

    init() {
        seenChangeCount = board.changeCount
    }

    /// True once per change made outside this app.
    func takeExternalChange() -> Bool {
        guard board.changeCount != seenChangeCount else { return false }
        seenChangeCount = board.changeCount
        return true
    }

    var isPrivate: Bool {
        let types = board.types ?? []
        return types.contains(Self.concealed) || types.contains(Self.transient)
    }

    /// Converts plain text and HTML in place (TC-7). Writes nothing when neither changes.
    @discardableResult
    func convertInPlace() -> Bool {
        guard !isPrivate, let text = board.string(forType: .string) else { return false }
        let html = board.data(forType: .html).flatMap { String(data: $0, encoding: .utf8) }
        let newText = Converter.convert(text)
        let newHTML = html.map(Converter.convert)
        guard newText != text || newHTML != html else { return false }
        board.clearContents()
        board.setString(newText, forType: .string)
        if let newHTML {
            board.setString(newHTML, forType: .html)
        }
        seenChangeCount = board.changeCount
        return true
    }

    func write(_ text: String) {
        board.clearContents()
        board.setString(text, forType: .string)
        seenChangeCount = board.changeCount
    }

    /// Every item and type currently on the pasteboard, for restoring later.
    func snapshot() -> [NSPasteboardItem] {
        (board.pasteboardItems ?? []).map { item in
            let copy = NSPasteboardItem()
            for type in item.types {
                if let data = item.data(forType: type) {
                    copy.setData(data, forType: type)
                }
            }
            return copy
        }
    }

    func restore(_ items: [NSPasteboardItem]) {
        board.clearContents()
        board.writeObjects(items)
        seenChangeCount = board.changeCount
    }
}
