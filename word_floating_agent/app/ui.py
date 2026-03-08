import sys
import uuid
import datetime
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLineEdit, QLabel, 
    QPushButton, QScrollArea, QFrame, QApplication, QSystemTrayIcon, QMenu
)
from PySide6.QtCore import Qt, Signal, QThread, QEvent, QTimer
from PySide6.QtGui import QIcon, QAction, QFont, QCursor, QGuiApplication

from app.llm_client import LLMClient
from app.cache import CacheManager
from app.settings import ASSETS_DIR, DEFAULT_WIDTH, DEFAULT_HEIGHT, APP_NAME, save_user_config, USER_CONFIG

# --- Worker Thread for LLM ---
class QueryWorker(QThread):
    finished = Signal(dict, str) # result, request_id
    progress = Signal(str, str) # status, request_id
    
    def __init__(self, query_text, cache_mgr, request_id):
        super().__init__()
        self.query_text = query_text
        self.cache_mgr = cache_mgr
        self.request_id = request_id
        self.llm_client = LLMClient()

    def run(self):
        # We can't easily signal per-attempt progress from LLMClient unless we pass a callback.
        # For MVP, we just signal 'Loading'.
        # Or we could modify LLMClient to accept a callback.
        # Let's keep it simple for now, LLMClient handles retries internally.
        
        try:
            self.progress.emit("Loading...", self.request_id)
            result = self.llm_client.query_word(self.query_text)
            
            if result and "error" not in result:
                # Add cache meta
                result['meta'] = {'cache': 'miss'}
                self.cache_mgr.set_cache(self.query_text, result)
                result['source'] = 'llm'
            elif result and "error" in result:
                 result['source'] = 'error'
            
            self.finished.emit(result, self.request_id)
        except Exception as e:
            self.finished.emit({'error': {'type': 'unknown', 'message': str(e)}}, self.request_id)

# --- Main Floating Window ---
class FloatingWindow(QWidget):
    hidden_signal = Signal()

    def __init__(self, cache_mgr):
        super().__init__()
        self.cache_mgr = cache_mgr
        self.history = []
        self.history_index = -1
        self.current_request_id = None
        self.worker = None
        self.logs = [] # List of strings
        
        # Window Flags
        self.setWindowFlags(
            Qt.Window | 
            Qt.FramelessWindowHint | 
            Qt.WindowStaysOnTopHint | 
            Qt.Tool # Hides from taskbar
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        # Dimensions & Position
        self.resize(DEFAULT_WIDTH, DEFAULT_HEIGHT)
        if "pos_x" in USER_CONFIG and "pos_y" in USER_CONFIG:
            self.move(USER_CONFIG["pos_x"], USER_CONFIG["pos_y"])
        else:
            screen = self.screen().availableGeometry()
            self.move(screen.width() // 2 - DEFAULT_WIDTH // 2, screen.height() // 3)

        self.init_ui()
        self.log_event("App started")
        
        # Dragging logic
        self.old_pos = None

    def init_ui(self):
        # Main Layout
        self.main_layout = QVBoxLayout()
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self.setLayout(self.main_layout)

        # Background Frame
        self.bg_frame = QFrame()
        self.bg_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(30, 30, 30, 240);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 30);
                color: #EEE;
            }
        """)
        self.main_layout.addWidget(self.bg_frame)

        # Content Layout
        self.content_layout = QVBoxLayout(self.bg_frame)
        self.content_layout.setContentsMargins(12, 12, 12, 12)
        self.content_layout.setSpacing(6)

        # 0. Status Bar (Top)
        self.status_layout = QHBoxLayout()
        self.status_lbl = QLabel("Idle")
        self.status_lbl.setStyleSheet("color: #888; font-size: 10px;")
        self.status_layout.addWidget(self.status_lbl)
        self.status_layout.addStretch()
        
        self.btn_report = QPushButton("Report")
        self.btn_report.setCursor(Qt.PointingHandCursor)
        self.btn_report.setStyleSheet("color: #AAA; font-size: 10px; border: none;")
        self.btn_report.clicked.connect(self.copy_diagnostics)
        self.status_layout.addWidget(self.btn_report)
        
        self.content_layout.addLayout(self.status_layout)

        # 1. Header: Search Bar + Controls
        self.header_layout = QHBoxLayout()
        
        self.input_field = QLineEdit()
        self.input_field.setPlaceholderText("Type word & Enter...")
        self.input_field.setStyleSheet("""
            QLineEdit {
                background-color: rgba(0, 0, 0, 50);
                border: 1px solid rgba(255, 255, 255, 20);
                border-radius: 6px;
                padding: 4px 8px;
                color: white;
                font-size: 14px;
            }
            QLineEdit:focus {
                border: 1px solid #4A90E2;
            }
        """)
        self.input_field.returnPressed.connect(self.perform_query)
        self.input_field.installEventFilter(self)

        self.min_btn = QPushButton("—") # Hide button
        self.min_btn.setFixedSize(24, 24)
        self.min_btn.setCursor(Qt.PointingHandCursor)
        self.min_btn.clicked.connect(self.hide_window)
        self.min_btn.setStyleSheet("""
            QPushButton {
                background: transparent;
                color: #AAA;
                border: none;
                font-weight: bold;
            }
            QPushButton:hover {
                color: #FFF;
                background-color: rgba(255,255,255,20);
                border-radius: 4px;
            }
        """)

        self.header_layout.addWidget(self.input_field)
        self.header_layout.addWidget(self.min_btn)
        self.content_layout.addLayout(self.header_layout)

        # 2. Result Area
        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setStyleSheet("""
            QScrollArea { border: none; background: transparent; }
            QScrollBar:vertical { width: 4px; background: transparent; }
            QScrollBar::handle:vertical { background: #555; border-radius: 2px; }
        """)
        
        self.result_container = QWidget()
        self.result_container.setStyleSheet("background: transparent;")
        self.result_layout = QVBoxLayout(self.result_container)
        self.result_layout.setContentsMargins(0, 0, 0, 0)
        self.result_layout.setSpacing(4)
        self.result_layout.setAlignment(Qt.AlignTop)

        self.scroll_area.setWidget(self.result_container)
        self.content_layout.addWidget(self.scroll_area)

        # Content Placeholders
        self.lbl_word = QLabel("")
        self.lbl_word.setStyleSheet("font-size: 18px; font-weight: bold; color: #FFF;")
        self.lbl_ipa = QLabel("")
        self.lbl_ipa.setStyleSheet("font-size: 12px; color: #AAA; font-family: 'Segoe UI', sans-serif;")
        
        self.lbl_meaning = QLabel("Ready to search.")
        self.lbl_meaning.setWordWrap(True)
        self.lbl_meaning.setStyleSheet("font-size: 13px; color: #DDD; margin-top: 4px;")
        
        self.lbl_usage = QLabel("")
        self.lbl_usage.setWordWrap(True)
        self.lbl_usage.setStyleSheet("font-size: 12px; color: #CCC; margin-top: 8px;")
        
        self.result_layout.addWidget(self.lbl_word)
        self.result_layout.addWidget(self.lbl_ipa)
        self.result_layout.addWidget(self.lbl_meaning)
        self.result_layout.addWidget(self.lbl_usage)
        
        # Log/Debug Area (Hidden by default, used for Copy Diagnostics)
        # We store logs in memory self.logs

    def log_event(self, msg):
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        entry = f"[{ts}] {msg}"
        self.logs.append(entry)
        # Keep max 50 logs
        if len(self.logs) > 50:
            self.logs.pop(0)
            
    def set_status(self, status):
        self.status_lbl.setText(status)
        self.log_event(f"Status: {status}")

    def eventFilter(self, obj, event):
        if obj == self.input_field and event.type() == QEvent.KeyPress:
            if event.key() == Qt.Key_Up:
                self.navigate_history(1)
                return True
            elif event.key() == Qt.Key_Down:
                self.navigate_history(-1)
                return True
            elif event.key() == Qt.Key_Escape:
                self.hide_window()
                return True
        if event.type() == QEvent.KeyPress and event.key() == Qt.Key_Escape:
            self.hide_window()
            return True
        return super().eventFilter(obj, event)

    def closeEvent(self, event):
        # Override close to hide
        event.ignore()
        self.hide_window()
        # Optional: Show bubble notification if first time?
        # For now just hide.

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.old_pos = event.globalPos()

    def mouseMoveEvent(self, event):
        if self.old_pos:
            delta = event.globalPos() - self.old_pos
            self.move(self.pos() + delta)
            self.old_pos = event.globalPos()

    def mouseReleaseEvent(self, event):
        self.old_pos = None
        save_user_config({"pos_x": self.x(), "pos_y": self.y()})

    def perform_query(self):
        text = self.input_field.text().strip()
        if not text:
            return

        self.current_request_id = str(uuid.uuid4())
        self.log_event(f"Query start: {text} (ID: {self.current_request_id})")

        # UI Update
        self.clear_results()
        self.set_status("Loading...")
        self.input_field.setDisabled(True)
        
        # History
        self.cache_mgr.add_history(text)
        self.history = self.cache_mgr.get_history()
        self.history_index = -1

        # 1. Check Cache
        cached = self.cache_mgr.get_cache(text)
        if cached:
            cached['source'] = 'cache'
            cached['meta'] = {'cache': 'hit'}
            self.on_query_finished(cached, self.current_request_id)
            return

        # 2. Start Thread
        if self.worker and self.worker.isRunning():
            self.worker.terminate()
            self.worker.wait()
            
        self.worker = QueryWorker(text, self.cache_mgr, self.current_request_id)
        self.worker.finished.connect(self.on_query_finished)
        self.worker.progress.connect(self.on_worker_progress)
        self.worker.start()

    def on_worker_progress(self, status, request_id):
        if request_id == self.current_request_id:
            self.set_status(status)

    def on_query_finished(self, result, request_id):
        if request_id != self.current_request_id:
            self.log_event(f"Ignored stale result for ID {request_id}")
            return

        self.input_field.setDisabled(False)
        self.input_field.setFocus()
        self.input_field.selectAll()
        
        if not result:
            self.set_status("Error: No response")
            self.lbl_meaning.setText("Error: No response.")
            return
            
        if "error" in result:
             # Check if it is a dict error from our LLMClient
             err_obj = result['error']
             if isinstance(err_obj, dict):
                 err_type = err_obj.get('type', 'unknown')
                 err_msg = err_obj.get('message', '')
                 attempts = err_obj.get('attempts', 0)
                 display_msg = f"Error ({err_type}): {err_msg} (Attempts: {attempts})"
             else:
                 display_msg = f"Error: {err_obj}"
                 
             self.set_status("Error")
             self.lbl_meaning.setText(display_msg)
             self.log_event(f"Query failed: {display_msg}")
             return

        # Success
        source = result.get('meta', {}).get('cache', 'miss')
        self.set_status(f"Success ({'Cache Hit' if source == 'hit' else 'Live'})")
        self.log_event("Query success")

        # Populate UI
        query = result.get('query', '')
        ipa = result.get('ipa', '')
        pos_list = result.get('pos', [])
        usage_list = result.get('usage', [])
        examples = result.get('examples', [])
        forms = result.get('forms', {})
        notes = result.get('notes', [])

        self.lbl_word.setText(query)
        if ipa:
            self.lbl_ipa.setText(f"/{ipa}/")
        else:
            self.lbl_ipa.setText("")

        meanings_text = ""
        for p in pos_list:
            meanings_text += f"<b>{p.get('p','')}</b> {p.get('meaning_zh','')}<br>"
        self.lbl_meaning.setText(meanings_text)

        extra_text = ""
        if forms:
            f_list = [f"{k}:{v}" for k,v in forms.items() if v]
            if f_list:
                extra_text += f"<div style='color:#888; font-size:10px; margin-bottom:4px;'>{' | '.join(f_list)}</div>"
        
        if notes:
            extra_text += f"<div style='color:#E67E22; font-size:11px; margin-bottom:4px;'><b>Note:</b> {', '.join(notes)}</div>"

        if usage_list:
            extra_text += "<div style='margin-top:4px;'><b>Usage:</b><ul style='margin:0; padding-left:15px;'>"
            for u in usage_list[:4]:
                extra_text += f"<li>{u}</li>"
            extra_text += "</ul></div>"
        
        if examples:
            extra_text += "<div style='margin-top:4px;'><b>Ex:</b><br>"
            for ex in examples[:2]:
                extra_text += f"<i style='color:#AAA;'>{ex.get('en','')}</i><br><span style='color:#888;'>{ex.get('zh','')}</span><br>"
            extra_text += "</div>"

        self.lbl_usage.setText(extra_text)

    def clear_results(self):
        self.lbl_word.setText("")
        self.lbl_ipa.setText("")
        self.lbl_meaning.setText("")
        self.lbl_usage.setText("")

    def navigate_history(self, direction):
        if not self.history:
            self.history = self.cache_mgr.get_history()
        
        if not self.history:
            return
        
        new_index = self.history_index + direction
        if new_index < -1: new_index = -1
        elif new_index >= len(self.history): new_index = len(self.history) - 1
            
        self.history_index = new_index
        if self.history_index == -1:
            self.input_field.clear()
        else:
            self.input_field.setText(self.history[self.history_index])

    def show_window(self):
        self.show()
        self.raise_()
        self.activateWindow()
        self.input_field.setFocus()
        self.input_field.selectAll()
        self.log_event("Window shown")

    def hide_window(self):
        self.hide()
        self.hidden_signal.emit()
        self.log_event("Window hidden")

    def toggle_visibility(self):
        if self.isVisible():
            self.hide_window()
        else:
            self.show_window()

    def copy_diagnostics(self):
        report = "--- Diagnostic Report ---\n"
        report += f"App: {APP_NAME}\n"
        report += f"Time: {datetime.datetime.now()}\n"
        report += "--- Recent Logs ---\n"
        report += "\n".join(self.logs[-20:])
        
        cb = QGuiApplication.clipboard()
        cb.setText(report)
        self.set_status("Report Copied!")
