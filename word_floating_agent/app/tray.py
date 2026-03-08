import sys
from PySide6.QtWidgets import QSystemTrayIcon, QMenu
from PySide6.QtGui import QIcon, QAction
from PySide6.QtCore import QCoreApplication

from app.settings import ASSETS_DIR, APP_NAME
from app.autostart import AutoStartManager

class TrayIcon(QSystemTrayIcon):
    def __init__(self, app, window):
        super().__init__(app)
        self.app = app
        self.window = window
        
        # Determine AutoStart Path
        if getattr(sys, 'frozen', False):
            # PyInstaller exe
            app_path = f'"{sys.executable}"'
        else:
            # Script
            # We need to run main.py. Assuming we are in app/tray.py
            # Best to use the entry point script if available, or just python -m app.main
            # But registry run key needs full path.
            # Let's find main.py relative to here
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            main_script = os.path.join(current_dir, "main.py")
            # Wrap in quotes
            app_path = f'"{sys.executable}" "{main_script}"'

        self.autostart_mgr = AutoStartManager(APP_NAME, app_path)
        
        # Icon
        self.setIcon(QIcon(str(ASSETS_DIR / "icon.png"))) # Needs an icon
        self.setToolTip(APP_NAME)
        
        # Menu
        self.menu = QMenu()
        
        self.action_show = QAction("Show/Hide", self)
        self.action_show.triggered.connect(self.window.toggle_visibility)
        self.menu.addAction(self.action_show)
        
        self.menu.addSeparator()
        
        self.action_autostart = QAction("Run at Startup", self)
        self.action_autostart.setCheckable(True)
        self.action_autostart.setChecked(self.autostart_mgr.is_enabled())
        self.action_autostart.triggered.connect(self.toggle_autostart)
        self.menu.addAction(self.action_autostart)
        
        self.menu.addSeparator()
        
        self.action_quit = QAction("Quit", self)
        self.action_quit.triggered.connect(self.quit_app)
        self.menu.addAction(self.action_quit)
        
        self.setContextMenu(self.menu)
        self.activated.connect(self.on_tray_activated)
        
        self.show()

    def on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.Trigger:
            self.window.toggle_visibility()

    def toggle_autostart(self):
        enabled = self.action_autostart.isChecked()
        # Re-initialize manager with correct path in main if needed, but for now:
        # If frozen (exe), use sys.executable. If script, use sys.executable + script path.
        if getattr(sys, 'frozen', False):
            path = sys.executable
        else:
            # We need absolute path to main.py
            import os
            main_path = os.path.abspath(sys.argv[0])
            path = f'"{sys.executable}" "{main_path}"' # Quote paths
            
        self.autostart_mgr.app_path = path
        self.autostart_mgr.set_enabled(enabled)

    def quit_app(self):
        self.window.cache_mgr.close()
        QCoreApplication.quit()
