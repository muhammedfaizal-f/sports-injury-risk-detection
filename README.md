# Sports Injury Risk Detection from Video

AI-powered platform analyzing athlete movement videos to detect biomechanical
risk factors and predict potential injuries before they occur.

Infosys Springboard Virtual Internship (June–Aug 2026).

## Tech Stack
- Frontend: React (Vite)
- Backend: FastAPI (Python)
- Database: PostgreSQL
- Auth: JWT (python-jose) + bcrypt
- CV/AI: OpenCV, MediaPipe

## Milestone Status
- [x] Milestone 1: Setup, auth, athlete profiles, dataset prep
- [x] Milestone 2: Pose estimation, biomechanical analysis, movement quality scoring
- [ ] Milestone 3: Injury prediction & recommendations (ML-based)
- [ ] Milestone 4: Dashboards, testing, deployment

## Milestone 2 — What's Implemented
- Video upload with quality validation (resolution, duration, fps)
- Frame extraction via OpenCV (~5fps sampling)
- Pose estimation via MediaPipe (33-point body landmark detection)
- Biomechanical analysis: joint angles (knee, hip, elbow), trunk lean,
  range of motion, left/right symmetry scoring
- Movement Quality Score (0-100) — heuristic based on symmetry, detection
  completeness, and joint coverage (NOT yet an ML-trained injury risk model
  — that's Milestone 3)
- Rule-based corrective recommendations from symmetry gaps
- Single `/analyze-full` endpoint chaining the whole pipeline
- Frontend Analysis page rendering real pipeline output

## Setup

### Backend