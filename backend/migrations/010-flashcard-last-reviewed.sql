-- 010-flashcard-last-reviewed.sql
-- Recentrage de l'application sur Flashcards / Routines / To-do list.
--
-- La vue d'ensemble affiche désormais un cadran alimenté par les flashcards :
-- arc extérieur = cartes révisées sur la période, arc intérieur = cartes dues.
-- Jusqu'ici aucune colonne ne datait la dernière révision (`updated_at` bouge
-- aussi lors d'une simple édition), d'où cette colonne dédiée.

ALTER TABLE flashcard
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS flashcard_last_reviewed_at_idx
  ON flashcard (last_reviewed_at);
