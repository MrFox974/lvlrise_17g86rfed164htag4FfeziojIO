-- 005-jobs-uploads.sql
-- Génération de collections de flashcards côté serveur, et fichiers joints
-- servant de source aux générations.

CREATE TABLE IF NOT EXISTS flashcard_job (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  card_count INTEGER NOT NULL DEFAULT 30,
  level VARCHAR(20) NOT NULL DEFAULT 'intermediaire',
  language VARCHAR(40) NOT NULL DEFAULT 'français',
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  step VARCHAR(255),
  progress INTEGER NOT NULL DEFAULT 0,
  deck_id INTEGER,
  groups_total INTEGER NOT NULL DEFAULT 0,
  groups_done INTEGER NOT NULL DEFAULT 0,
  cards_created INTEGER NOT NULL DEFAULT 0,
  stats JSON,
  upload_ids JSON,
  error TEXT,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Le contrôleur cherche systématiquement une génération en cours pour
-- l'utilisateur avant d'en accepter une nouvelle.
CREATE INDEX IF NOT EXISTS idx_flashcard_job_user_status
  ON flashcard_job (user_id, status);

CREATE TABLE IF NOT EXISTS upload (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  storage_key VARCHAR(500) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  extracted_text TEXT,
  extracted_chars INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_upload_user ON upload (user_id);

-- Balayage de la purge quotidienne des fichiers arrivés à expiration.
CREATE INDEX IF NOT EXISTS idx_upload_expires ON upload (expires_at);

-- Documents source d'un parcours de la Bibliothèque, mêmes fichiers joints.
ALTER TABLE markdown_domain
  ADD COLUMN IF NOT EXISTS upload_ids JSON;
