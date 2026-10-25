import Cocoa
import ServiceManagement

/// Menu bar item and settings (TC-9).
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private let clipboard = Clipboard()
    private lazy var autoConvert = AutoConvert(clipboard: clipboard)
    private lazy var pasteShortcut = PasteShortcut(clipboard: clipboard)
    private var statusItem: NSStatusItem?

    private let defaults = UserDefaults.standard

    func applicationDidFinishLaunching(_ notification: Notification) {
        defaults.register(defaults: ["autoConvert": true, "pasteShortcut": false])
        Converter.warmUp()

        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "繁"
        let menu = NSMenu()
        menu.delegate = self
        item.menu = menu
        statusItem = item

        apply()
    }

    private func apply() {
        if defaults.bool(forKey: "autoConvert") { autoConvert.start() } else { autoConvert.stop() }
        if defaults.bool(forKey: "pasteShortcut") { pasteShortcut.register() } else { pasteShortcut.unregister() }
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        menu.addItem(toggle("menu.auto", key: "autoConvert"))
        menu.addItem(toggle("menu.paste", key: "pasteShortcut"))
        if PasteShortcut.isTrusted {
            let ok = NSMenuItem(title: text("menu.ax.ok"), action: nil, keyEquivalent: "")
            ok.isEnabled = false
            menu.addItem(ok)
        } else {
            menu.addItem(action("menu.ax.missing", #selector(requestAccessibility)))
        }
        menu.addItem(.separator())
        let login = action("menu.login", #selector(toggleLogin))
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off
        menu.addItem(login)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: text("menu.quit"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
    }

    private func text(_ key: String) -> String {
        NSLocalizedString(key, comment: "")
    }

    private func action(_ key: String, _ selector: Selector) -> NSMenuItem {
        let item = NSMenuItem(title: text(key), action: selector, keyEquivalent: "")
        item.target = self
        return item
    }

    private func toggle(_ key: String, key setting: String) -> NSMenuItem {
        let item = action(key, #selector(flip(_:)))
        item.representedObject = setting
        item.state = defaults.bool(forKey: setting) ? .on : .off
        return item
    }

    @objc private func flip(_ sender: NSMenuItem) {
        guard let setting = sender.representedObject as? String else { return }
        defaults.set(!defaults.bool(forKey: setting), forKey: setting)
        apply()
    }

    @objc private func requestAccessibility() {
        PasteShortcut.requestTrust()
    }

    @objc private func toggleLogin() {
        let service = SMAppService.mainApp
        do {
            if service.status == .enabled { try service.unregister() } else { try service.register() }
        } catch {
            NSSound.beep()
        }
    }
}
