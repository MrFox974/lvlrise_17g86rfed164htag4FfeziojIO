-- 006-todo-groups-and-new-cards.sql
-- 1. Les groupes de to-do existent pour eux-mêmes : un groupe vide reste
--    visible, et sur tous les appareils de l'utilisateur.
-- 2. Une carte retient sa première réussite : tant qu'elle n'en a pas, elle est
--    signalée comme nouvelle dans l'interface.

CREATE TABLE IF NOT EXISTS todo_group (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Un même nom ne peut désigner qu'un seul groupe chez un utilisateur : c'est ce
-- sur quoi s'appuie l'enregistrement idempotent d'un groupe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_group_user_name
  ON todo_group (user_id, name);

-- Reprise de l'existant : les groupes déduits des tâches deviennent des groupes
-- à part entière, sans quoi ils disparaîtraient une fois leurs tâches terminées.
INSERT INTO todo_group (user_id, name, position, created_at, updated_at)
SELECT DISTINCT t.user_id, t.group_name, 0, NOW(), NOW()
FROM todo_item t
WHERE t.group_name IS NOT NULL
  AND t.group_name <> ''
  AND t.group_name <> 'Main'
ON CONFLICT DO NOTHING;

ALTER TABLE flashcard
  ADD COLUMN IF NOT EXISTS learned_at TIMESTAMP WITH TIME ZONE;

-- Les cartes déjà réussies ne doivent pas réapparaître comme neuves : une carte
-- ayant au moins une réussite consécutive a forcément été sue.
UPDATE flashcard
SET learned_at = COALESCE(updated_at, created_at, NOW())
WHERE learned_at IS NULL
  AND repetitions > 0;
