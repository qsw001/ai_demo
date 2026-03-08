import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# Determine if running as script or frozen exe
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env
load_dotenv(BASE_DIR / ".env")

# Constants
APP_NAME = "WordFloatingAgent"
APP_VERSION = "0.1.0"
DEFAULT_WIDTH = 360
DEFAULT_HEIGHT = 220
DEFAULT_HOTKEY = "<ctrl>+<shift>+l"

# Paths
ASSETS_DIR = BASE_DIR / "assets"
CACHE_DB_PATH = BASE_DIR / "cache.db"
CONFIG_FILE = BASE_DIR / "config.json"

# API Config
API_KEY = os.getenv("OPENAI_API_KEY")
API_BASE = "https://ark.cn-beijing.volces.com/api/v3"
MODEL_NAME = "doubao-seed-1-6-251015"

def load_user_config():
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_user_config(config):
    try:
        current = load_user_config()
        current.update(config)
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(current, f, indent=2)
    except Exception as e:
        print(f"Error saving config: {e}")

USER_CONFIG = load_user_config()
