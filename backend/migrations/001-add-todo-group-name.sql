-- 001-add-todo-group-name.sql
-- Ajout du champ group_name sur la table todo_item pour stocker le groupe de tâches (ex: "Main", "Travail", "Études").

ALTER TABLE todo_item
ADD COLUMN IF NOT EXISTS group_name VARCHAR(100) NOT NULL DEFAULT 'Main';

