import sys
import os
import platform
import winreg

class AutoStartManager:
    def __init__(self, app_name, app_path):
        self.app_name = app_name
        self.app_path = app_path
        self.system = platform.system()

    def is_enabled(self):
        if self.system == "Windows":
            return self._check_windows()
        elif self.system == "Darwin":
            return self._check_macos()
        return False

    def set_enabled(self, enabled):
        if self.system == "Windows":
            if enabled:
                self._enable_windows()
            else:
                self._disable_windows()
        elif self.system == "Darwin":
            if enabled:
                self._enable_macos()
            else:
                self._disable_macos()

    def _check_windows(self):
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_READ)
            value, _ = winreg.QueryValueEx(key, self.app_name)
            winreg.CloseKey(key)
            return value == self.app_path
        except FileNotFoundError:
            return False
        except Exception as e:
            print(f"Registry check error: {e}")
            return False

    def _enable_windows(self):
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
            winreg.SetValueEx(key, self.app_name, 0, winreg.REG_SZ, self.app_path)
            winreg.CloseKey(key)
        except Exception as e:
            print(f"Registry enable error: {e}")

    def _disable_windows(self):
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
            winreg.DeleteValue(key, self.app_name)
            winreg.CloseKey(key)
        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"Registry disable error: {e}")

    def _get_plist_path(self):
        return os.path.expanduser(f"~/Library/LaunchAgents/com.{self.app_name.lower()}.plist")

    def _check_macos(self):
        return os.path.exists(self._get_plist_path())

    def _enable_macos(self):
        # This is a simplified implementation. 
        # For a real app, we might need a wrapper script if it's not a .app bundle.
        # Assuming we run the python script or the executable.
        plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.{self.app_name.lower()}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{sys.executable}</string>
        <string>{self.app_path}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
"""
        try:
            with open(self._get_plist_path(), 'w') as f:
                f.write(plist_content)
        except Exception as e:
            print(f"MacOS enable error: {e}")

    def _disable_macos(self):
        try:
            path = self._get_plist_path()
            if os.path.exists(path):
                os.remove(path)
        except Exception as e:
            print(f"MacOS disable error: {e}")
