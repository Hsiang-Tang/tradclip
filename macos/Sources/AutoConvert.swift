import Cocoa

/// Converts every copy, in any app (TC-6). macOS has no pasteboard change
/// notification, so the change count is polled.
final class AutoConvert {
    private let clipboard: Clipboard
    private var timer: Timer?

    init(clipboard: Clipboard) {
        self.clipboard = clipboard
    }

    func start() {
        guard timer == nil else { return }
        _ = clipboard.takeExternalChange()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in self?.tick() }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        guard clipboard.takeExternalChange() else { return }
        clipboard.convertInPlace()
    }
}
