import Cocoa

/// Converts copies made in the listed apps (TC-6). macOS has no pasteboard change
/// notification, so the change count is polled.
final class AutoConvert {
    static let defaultApps = ["com.openai.codex", "com.openai.chat", "com.anthropic.claudefordesktop"]

    private let clipboard: Clipboard
    private var timer: Timer?
    private var previousFrontmost: String?

    init(clipboard: Clipboard) {
        self.clipboard = clipboard
    }

    var apps: Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: "apps") ?? Self.defaultApps)
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
        let frontmost = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
        defer { previousFrontmost = frontmost }
        guard clipboard.takeExternalChange() else { return }
        // A copy followed by a quick switch away can land between two ticks.
        let listed = apps
        guard [frontmost, previousFrontmost].contains(where: { $0.map(listed.contains) ?? false }) else { return }
        clipboard.convertInPlace()
    }
}
