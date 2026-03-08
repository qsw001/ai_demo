# Word Floating Agent

A minimal, always-on-top floating window for quick English word lookups using LLM.

## Features
- **Floating Window**: Always on top, frameless, draggable.
- **Quick Lookup**: Type a word/phrase and hit Enter.
- **LLM Powered**: Provides IPA, definitions, usage, examples, and forms.
- **Global Hotkey**: `Ctrl+Shift+L` to show/hide.
- **Tray Icon**: Manage visibility and auto-start.
- **Cache**: Local SQLite cache for instant repeated lookups.

## Setup

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configuration**
   Copy `.env.example` to `.env` and set your API Key:
   ```
   OPENAI_API_KEY=your_doubao_api_key
   ```

3. **Run**
   ```bash
   python -m app.main
   ```
   *Note: On Windows, run `python -m app.main` from the `word_floating_agent` directory.*

## Building (Windows)
```powershell
pip install pyinstaller
./scripts/build_win.ps1
```
The executable will be in `dist/WordFloatingAgent.exe`.

## Tech Stack
- Python 3.10+
- PySide6 (Qt)
- LangChain (OpenAI Adapter)
- Pynput (Hotkeys)
- SQLite (Caching)
