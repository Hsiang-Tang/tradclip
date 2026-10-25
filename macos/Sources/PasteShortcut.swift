import Carbon
import Cocoa

/// Control+Option+V pastes the clipboard as Traditional and then puts the original
/// back (TC-8). Listening needs no permission; posting Command+V needs Accessibility.
final class PasteShortcut {
    private let clipboard: Clipboard
    private var hotKey: EventHotKeyRef?
    private var handler: EventHandlerRef?

    init(clipboard: Clipboard) {
        self.clipboard = clipboard
    }

    static var isTrusted: Bool { AXIsProcessTrusted() }

    static func requestTrust() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        if !AXIsProcessTrustedWithOptions(options),
           let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
    }

    func register() {
        guard hotKey == nil else { return }
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, _, context in
            guard let context else { return OSStatus(eventNotHandledErr) }
            Unmanaged<PasteShortcut>.fromOpaque(context).takeUnretainedValue().pressed()
            return noErr
        }, 1, &spec, Unmanaged.passUnretained(self).toOpaque(), &handler)
        let id = EventHotKeyID(signature: OSType(0x5452_4350), id: 1) // "TRCP"
        RegisterEventHotKey(UInt32(kVK_ANSI_V), UInt32(controlKey | optionKey), id,
                            GetApplicationEventTarget(), 0, &hotKey)
    }

    func unregister() {
        if let hotKey { UnregisterEventHotKey(hotKey) }
        if let handler { RemoveEventHandler(handler) }
        hotKey = nil
        handler = nil
    }

    private func pressed() {
        guard Self.isTrusted else {
            Self.requestTrust()
            return
        }
        guard !clipboard.isPrivate, let text = clipboard.board.string(forType: .string) else { return }
        let converted = Converter.convert(text)
        guard converted != text else {
            whenModifiersReleased(postCommandV)
            return
        }
        let original = clipboard.snapshot()
        clipboard.write(converted)
        let ours = clipboard.board.changeCount
        whenModifiersReleased { [clipboard] in
            Self.postCommandV()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                // Leave a newer copy made in the meantime alone.
                if clipboard.board.changeCount == ours {
                    clipboard.restore(original)
                }
            }
        }
    }

    private func postCommandV() {
        Self.postCommandV()
    }

    private static func postCommandV() {
        let source = CGEventSource(stateID: .combinedSessionState)
        for keyDown in [true, false] {
            let event = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(kVK_ANSI_V), keyDown: keyDown)
            event?.flags = .maskCommand
            event?.post(tap: .cghidEventTap)
        }
    }

    /// Control and Option are still held when the shortcut fires; some apps read the
    /// live modifier state, so wait (up to 1 s) until they are up.
    private func whenModifiersReleased(_ action: @escaping () -> Void, waited: Double = 0) {
        let held = NSEvent.modifierFlags.intersection([.control, .option])
        if held.isEmpty || waited >= 1 {
            action()
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) { [weak self] in
                self?.whenModifiersReleased(action, waited: waited + 0.02)
            }
        }
    }
}
