-- 003-routine-day-snapshot.sql
-- Table pour figer les stats routines (total, done) par date.
-- Les statistiques des jours passés restent visibles au calendrier même après
-- suppression ou modification des routines.

CREATE TABLE IF NOT EXISTS routine_day_snapshot (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_routine_day_snapshot_user_date
  ON routine_day_snapshot (user_id, date);
