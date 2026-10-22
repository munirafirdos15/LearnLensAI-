# LearnLensAI Backend

FastAPI backend for LearnLensAI, an AI-powered personalised learning and learning-gap detection project.

## Requirements

- Python

## Run locally (PowerShell)

From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install fastapi uvicorn
python -m uvicorn app.main:app --reload
```

The API runs at <http://127.0.0.1:8000>. Interactive documentation is at <http://127.0.0.1:8000/docs>, and the health check is at <http://127.0.0.1:8000/health>.

On startup, the application creates the local SQLite database at `backend/learning.db` and loads its question bank from `backend/app/questions.json`. The database and local backups are excluded from Git; the JSON question bank is tracked as seed data.

## Main API routes

- `GET /health` — service health check.
- `GET /topics` and `GET /questions` — learning topics and questions.
- `POST /students` — create a student.
- `POST /submit-answer` — record a quiz answer.
- `GET /students/{student_id}/learning-gaps` — review learning gaps.
- `GET /students/{student_id}/recommendations` — retrieve recommendations.
