import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    API_BASE_URL = os.getenv("API_BASE_URL", "https://api.example.com/v1")
    API_KEY = os.getenv("API_KEY", "")
    TIMEOUT = int(os.getenv("TIMEOUT", 300))
    POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", 5))
    MAX_RETRY = int(os.getenv("MAX_RETRY", 3))
    VIDEO_STYLE = os.getenv("VIDEO_STYLE", "cinematic")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    # Paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
    LOGS_DIR = os.path.join(BASE_DIR, "logs")

    @classmethod
    def get_template_path(cls, template_name):
        return os.path.join(cls.TEMPLATES_DIR, template_name)

    @classmethod
    def ensure_dirs(cls):
        if not os.path.exists(cls.LOGS_DIR):
            os.makedirs(cls.LOGS_DIR)
