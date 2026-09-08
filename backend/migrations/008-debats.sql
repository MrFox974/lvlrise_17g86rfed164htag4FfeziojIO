-- 008-debats.sql
-- Outil « Débat » : analyser des sources pour se forger un avis en cinq étapes
-- (captation, recherche/vérification, relecture, explication orale, opinion).
--
-- Les tables sont aussi créées au démarrage par `sequelize.sync({ force: false })`
-- via app.js ; ce fichier permet de préparer la base AVANT que la nouvelle Lambda
-- ne reçoive du trafic, pour qu'aucun appel ne tombe sur une table absente le
-- temps du premier cold start.
--
-- Tout est idempotent : rejouer la migration ne change rien.

-- Le débat : le sujet et son cadrage, partagés par la question centrale et tous
-- les sous-débats.
CREATE TABLE IF NOT EXISTS debate (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  question VARCHAR(255) NOT NULL DEFAULT 'Pour ou contre ?',
  desc_termes TEXT,
  desc_limites TEXT,
  desc_tensions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS debate_user_id_idx ON debate (user_id);

-- Un nœud : la question centrale (kind = 'general') ou un sous-débat.
-- step_done retient l'étape la plus avancée atteinte (0 à 5).
CREATE TABLE IF NOT EXISTS debate_node (
  id SERIAL PRIMARY KEY,
  debate_id INTEGER NOT NULL REFERENCES debate(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'sub',
  step_done INTEGER NOT NULL DEFAULT 0,
  opinion TEXT,
  side VARCHAR(10),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS debate_node_debate_id_idx ON debate_node (debate_id);
CREATE INDEX IF NOT EXISTS debate_node_user_id_idx ON debate_node (user_id);

-- Un argument capté dans une source, avec sa vérification.
CREATE TABLE IF NOT EXISTS debate_argument (
  id SERIAL PRIMARY KEY,
  node_id INTEGER NOT NULL REFERENCES debate_node(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  side VARCHAR(10) NOT NULL DEFAULT 'pour',
  text TEXT NOT NULL,
  tags JSON,
  source VARCHAR(255),
  support VARCHAR(100),
  date_label VARCHAR(40),
  verdict VARCHAR(10),
  note TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS debate_argument_node_id_idx ON debate_argument (node_id);
CREATE INDEX IF NOT EXISTS debate_argument_user_id_idx ON debate_argument (user_id);
