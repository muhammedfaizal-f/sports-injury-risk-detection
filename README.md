# Sports Injury Risk Detection from Video

AI-powered platform that analyzes athlete movement videos to detect
biomechanical risk factors and predict potential injuries before they occur.

Built as part of the Infosys Springboard Virtual Internship (June–Aug 2026).

## Tech Stack
- Frontend: React (Vite)
- Backend: FastAPI (Python)
- Database: PostgreSQL
- Auth: JWT (python-jose) + bcrypt password hashing
- AI/CV (from Milestone 2 onward): OpenCV, MediaPipe

## Milestone Status

- [x] **Milestone 1** (Week 1–2): Project setup, auth, athlete profiles, dataset prep
- [ ] Milestone 2 (Week 3–4): Pose estimation
- [ ] Milestone 3 (Week 5–6): Injury prediction & recommendations
- [ ] Milestone 4 (Week 7–8): Dashboards, testing, deployment

## Milestone 1 — What's Implemented

- Project structure: `frontend/`, `backend/`, `docs/`, `db/`, `datasets/`
- PostgreSQL schema: `users`, `athletes`, `coach_athlete` (see `db/schema.sql`)
- User registration & login with JWT authentication
- Role-based access control: athlete, coach, physiotherapist, sports_scientist, admin
- Athlete profile CRUD (create / read / update) — restricted to athlete role,
  viewable by other roles via athlete ID
- Sample pose-estimation dataset (COCO Keypoints) identified and documented
  in `docs/DATASETS.md`

## Setup Instructions

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create a .env file with:
# DATABASE_URL=postgresql://user:password@localhost:5432/sports_injury_db
# SECRET_KEY=your-secret-key

uvicorn main:app --reload --port 8000
```
API docs available at `http://localhost:8000/docs`

### Database
```bash
createdb sports_injury_db
psql sports_injury_db < db/schema.sql
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs at `http://localhost:5173`

## Project Docs
- [`docs/PROJECT_OBJECTIVES.md`](docs/PROJECT_OBJECTIVES.md) — objectives, workflow, roadmap
- [`docs/DATASETS.md`](docs/DATASETS.md) — datasets identified for pose estimation
- [`db/schema.sql`](db/schema.sql) — database schema