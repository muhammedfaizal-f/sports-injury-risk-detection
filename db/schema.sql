-- ============================================================
-- Sports Injury Risk Detection from Video
-- Database Schema — PostgreSQL
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'athlete', 'coach', 'physiotherapist', 'sports_scientist', 'admin'
);

-- ---------- MILESTONE 1 ----------

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'athlete',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE athletes (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport_type      VARCHAR(100),
    position        VARCHAR(100),
    age             INTEGER,
    height_cm       NUMERIC(5,2),
    weight_kg       NUMERIC(5,2),
    injury_history  TEXT,
    training_load   VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE coach_athlete (
    id              SERIAL PRIMARY KEY,
    coach_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    athlete_id      INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    UNIQUE (coach_id, athlete_id)
);

-- ---------- MILESTONE 2 ----------

CREATE TABLE videos (
    id              SERIAL PRIMARY KEY,
    athlete_id      INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    file_path       VARCHAR(255) NOT NULL,
    activity_type   VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'uploaded',
    uploaded_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pose_results (
    id              SERIAL PRIMARY KEY,
    video_id        INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    frame_count     INTEGER,
    keypoints_json  JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE biomechanics_results (
    id              SERIAL PRIMARY KEY,
    video_id        INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    analysis_json   JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

ALTER TABLE pose_results ADD COLUMN total_frames INTEGER;

CREATE TABLE quality_reports (
    id              SERIAL PRIMARY KEY,
    video_id        INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    quality_score   NUMERIC(5,2),
    risk_category   VARCHAR(20),
    report_json     JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE risk_predictions (
    id              SERIAL PRIMARY KEY,
    video_id        INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    risk_score      NUMERIC(5,2),
    risk_category   VARCHAR(20),
    injury_type     VARCHAR(50),
    factors_json    JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN avatar_path VARCHAR(255);

CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE invites (
    id              SERIAL PRIMARY KEY,
    coach_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    athlete_email   VARCHAR(150) NOT NULL,
    status          invite_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT NOW(),
    responded_at    TIMESTAMP
);

CREATE TYPE recovery_plan_status AS ENUM ('not_started', 'in_progress', 'completed');

CREATE TABLE recovery_plans (
    id              SERIAL PRIMARY KEY,
    physio_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    athlete_id      INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    exercises_json  JSONB,
    notes           TEXT,
    status          recovery_plan_status NOT NULL DEFAULT 'not_started',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
-- ============================================================
-- STUB — Milestone 3
-- ============================================================
-- CREATE TABLE assessments (
--     id                  SERIAL PRIMARY KEY,
--     video_id            INTEGER REFERENCES videos(id),
--     risk_score          NUMERIC(5,2),
--     risk_category       VARCHAR(20),
--     injury_type         VARCHAR(50),
--     recommendations     TEXT,
--     created_at          TIMESTAMP DEFAULT NOW()
-- );

-- Check existing constraints (run in psql)
SELECT conname, confdeltype FROM pg_constraint WHERE conname LIKE '%video_id%';
-- confdeltype should be 'c' (cascade) for each row. If any show 'a' (no action), fix with:

ALTER TABLE pose_results DROP CONSTRAINT pose_results_video_id_fkey;
ALTER TABLE pose_results ADD CONSTRAINT pose_results_video_id_fkey
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

-- repeat the same pattern for biomechanics_results, quality_reports, risk_predictions
-- if their constraint names differ, get the real name from the SELECT above first