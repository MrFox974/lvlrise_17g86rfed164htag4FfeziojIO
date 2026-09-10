-- 011-flashcard-web-research.sql
-- Cartes à contenu récent : la génération peut commencer par une recherche web
-- (services/web-research.service.js), dont le dossier daté sert de source aux
-- cartes. Ce drapeau dit si l'utilisateur l'a demandée ; le résultat de la
-- récolte (statut, sources citées) est rangé dans la colonne JSON `stats`.
--
-- La colonne est aussi ajoutée au démarrage par app.js ; ce fichier permet de
-- préparer la base avant le déploiement, sans attendre le premier appel.

ALTER TABLE flashcard_job
  ADD COLUMN IF NOT EXISTS web_search BOOLEAN NOT NULL DEFAULT FALSE;
