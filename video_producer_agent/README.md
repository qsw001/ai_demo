# Video Producer Agent

A CLI tool for automating video generation workflows.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Configure environment:
   Copy `.env.example` to `.env` and adjust settings.

## Usage

### Run with JSON input
```bash
python -m src.main --input shot_example.json
```

### Run with CLI arguments
```bash
python -m src.main --episode-id EP1 --shot-id S1 --main-subject "A cat" --shoot-desc "sleeping"
```

## Project Structure
- `src/`: Source code
- `templates/`: Prompt templates
- `config/`: Configuration
- `logs/`: Execution logs

## Extending
- **ApiClient**: Implement `src.api_client.ApiClient` for real API integration.
- **Scoring**: Modify `src.scoring.ScoringEngine` weights.
