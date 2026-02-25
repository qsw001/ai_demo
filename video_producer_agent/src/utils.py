import logging
import json
import sys
import os
from datetime import datetime
from .config import Config

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "func": record.funcName
        }
        if hasattr(record, "extra"):
            log_obj.update(record.extra)
        return json.dumps(log_obj)

def setup_logging(config: Config):
    Config.ensure_dirs()
    log_filename = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
    log_path = os.path.join(Config.LOGS_DIR, log_filename)

    logger = logging.getLogger("VideoProducerAgent")
    logger.setLevel(getattr(logging, config.LOG_LEVEL.upper(), logging.INFO))
    
    # File Handler (JSONL)
    file_handler = logging.FileHandler(log_path, encoding='utf-8')
    file_handler.setFormatter(JsonFormatter())
    
    # Console Handler (Standard)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger, log_path
