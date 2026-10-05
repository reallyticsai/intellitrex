CREATE TABLE model_configurations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  base_url TEXT NOT NULL,
  model_id TEXT NOT NULL CHECK (length(trim(model_id)) BETWEEN 1 AND 200),
  api_key_encrypted TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX one_active_model_configuration
ON model_configurations(is_active) WHERE is_active = 1;
