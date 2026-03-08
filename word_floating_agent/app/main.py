import sys
import os
from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QIcon, QFont, QPixmap, QColor, QPainter
from PySide6.QtCore import Qt

from app.ui import FloatingWindow
from app.tray import TrayIcon
from app.hotkey import GlobalHotkey
from app.cache import CacheManager
from app.settings import ASSETS_DIR, APP_NAME

def main():
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setQuitOnLastWindowClosed(False) # Important for tray app
    
    # Create assets dir if not exists (to avoid crash if icon missing)
    if not os.path.exists(ASSETS_DIR):
        os.makedirs(ASSETS_DIR)
    
    # Placeholder icon if missing
    icon_path = ASSETS_DIR / "icon.png"
    if not icon_path.exists():
        # Create a simple colored pixmap as icon
        pixmap = QPixmap(64, 64)
        pixmap.fill(QColor("transparent"))
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setBrush(QColor("#4A90E2"))
        painter.setPen(Qt.NoPen)
        painter.drawEllipse(0, 0, 64, 64)
        painter.setPen(QColor("white"))
        painter.setFont(QFont("Arial", 30, QFont.Bold))
        painter.drawText(pixmap.rect(), Qt.AlignCenter, "W")
        painter.end()
        pixmap.save(str(icon_path))

    app.setWindowIcon(QIcon(str(icon_path)))

    # Init Cache
    cache_mgr = CacheManager()

    # Init UI
    window = FloatingWindow(cache_mgr)
    window.show() # Initial show

    # Init Tray
    tray = TrayIcon(app, window)

    # Init Global Hotkey
    hotkey = GlobalHotkey()
    hotkey.activated.connect(window.toggle_visibility)
    hotkey.start()

    sys.exit(app.exec())

if __name__ == "__main__":
    main()
