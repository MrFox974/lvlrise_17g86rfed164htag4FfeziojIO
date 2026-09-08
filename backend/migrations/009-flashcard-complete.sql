-- 009-flashcard-complete.sql
-- Mode « compléter » des collections de flashcards : l'IA étoffe chaque groupe
-- existant à partir de son propre thème et des cartes qu'il contient déjà.
--
-- Une consigne facultative affine la demande. Elle vit à part de `subject`, qui
-- doit rester le sujet d'origine de la collection : les deux servent au même
-- appel mais ne jouent pas le même rôle.
--
-- La colonne est aussi ajoutée au démarrage par app.js ; ce fichier prépare la
-- base avant le déploiement, sans attendre le premier appel.

ALTER TABLE flashcard_job
  ADD COLUMN IF NOT EXISTS refine_prompt TEXT;
