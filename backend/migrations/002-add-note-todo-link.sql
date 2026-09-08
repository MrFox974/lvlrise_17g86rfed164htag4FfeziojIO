-- 002-add-note-todo-link.sql
-- Ajout du lien optionnel entre une note et une tâche (todo_item).
-- Permet de lier une note à une tâche spécifique pour l'édition depuis la to do list
-- et d'afficher cette liaison dans l'interface Notes.

ALTER TABLE note
ADD COLUMN IF NOT EXISTS todo_item_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'note_todo_item_fk'
  ) THEN
    ALTER TABLE note
    ADD CONSTRAINT note_todo_item_fk
    FOREIGN KEY (todo_item_id) REFERENCES todo_item(id)
    ON DELETE SET NULL;
  END IF;
END$$;

