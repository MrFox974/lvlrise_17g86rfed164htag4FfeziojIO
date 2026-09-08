-- 007-single-card-generation.sql
-- Carte à l'unité générée par IA (« + carte ») : nature du travail, destination
-- des cartes dans la collection, et propositions en attente de validation.
--
-- Les colonnes sont aussi ajoutées au démarrage par app.js ; ce fichier permet
-- de préparer la base avant le déploiement, sans attendre le premier appel.

ALTER TABLE flashcard_job
  ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'deck';

ALTER TABLE flashcard_job
  ADD COLUMN IF NOT EXISTS chapter_mode VARCHAR(10) NOT NULL DEFAULT 'auto';

ALTER TABLE flashcard_job
  ADD COLUMN IF NOT EXISTS chapter_id INTEGER;

-- Propositions du mode « carte à l'unité » : [{ term, front, back, hint }].
ALTER TABLE flashcard_job
  ADD COLUMN IF NOT EXISTS proposals JSON;

-- Une photo sans texte est décrite au lieu d'être transcrite : le modèle doit
-- savoir laquelle des deux il lit.
ALTER TABLE upload
  ADD COLUMN IF NOT EXISTS content_kind VARCHAR(20) NOT NULL DEFAULT 'text';
