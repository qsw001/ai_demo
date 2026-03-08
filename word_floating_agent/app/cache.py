import sqlite3
import json
import time
from app.settings import CACHE_DB_PATH

class CacheManager:
    def __init__(self):
        self.conn = sqlite3.connect(CACHE_DB_PATH, check_same_thread=False)
        self.create_tables()

    def create_tables(self):
        cursor = self.conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cache (
                query TEXT PRIMARY KEY,
                payload TEXT,
                updated_at INTEGER
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT,
                ts INTEGER
            )
        ''')
        self.conn.commit()

    def get_cache(self, query):
        cursor = self.conn.cursor()
        cursor.execute('SELECT payload FROM cache WHERE query = ?', (query.lower().strip(),))
        row = cursor.fetchone()
        if row:
            try:
                return json.loads(row[0])
            except:
                return None
        return None

    def set_cache(self, query, payload):
        cursor = self.conn.cursor()
        now = int(time.time())
        json_payload = json.dumps(payload, ensure_ascii=False)
        cursor.execute('''
            INSERT OR REPLACE INTO cache (query, payload, updated_at)
            VALUES (?, ?, ?)
        ''', (query.lower().strip(), json_payload, now))
        self.conn.commit()

    def add_history(self, query):
        cursor = self.conn.cursor()
        now = int(time.time())
        # Avoid duplicate consecutive entries or just log all? Let's just log all for now but maybe clean up later
        # Check if last entry is same
        cursor.execute('SELECT query FROM history ORDER BY id DESC LIMIT 1')
        last = cursor.fetchone()
        if last and last[0] == query:
            return # Don't add duplicate consecutive
        
        cursor.execute('INSERT INTO history (query, ts) VALUES (?, ?)', (query, now))
        self.conn.commit()

    def get_history(self, limit=50):
        cursor = self.conn.cursor()
        cursor.execute('SELECT query FROM history ORDER BY id DESC LIMIT ?', (limit,))
        return [row[0] for row in cursor.fetchall()]

    def close(self):
        self.conn.close()
