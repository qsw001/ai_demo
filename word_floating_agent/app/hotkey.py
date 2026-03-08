from pynput import keyboard
from PySide6.QtCore import QObject, Signal

class GlobalHotkey(QObject):
    activated = Signal()

    def __init__(self):
        super().__init__()
        self.listener = None
        # Default hotkey: Ctrl+Shift+L
        # pynput format: <ctrl>+<shift>+l
        self.hotkey_str = "<ctrl>+<shift>+l"

    def start(self):
        try:
            self.listener = keyboard.GlobalHotKeys({
                self.hotkey_str: self.on_activate
            })
            self.listener.start()
        except Exception as e:
            print(f"Failed to start global hotkey: {e}")

    def stop(self):
        if self.listener:
            self.listener.stop()
            self.listener = None

    def on_activate(self):
        self.activated.emit()
