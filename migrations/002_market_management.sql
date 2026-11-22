-- Apply AFTER 001, manually and only to an authorized database.
BEGIN;
CREATE TABLE merchants (
  id uuid PRIMARY KEY,
  dni varchar(8) NOT NULL UNIQUE CHECK (dni ~ '^[0-9]{8}$'),
  name varchar(120) NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  trade varchar(80) NOT NULL CHECK (length(btrim(trade)) BETWEEN 2 AND 80),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE stalls (
  id uuid PRIMARY KEY,
  code varchar(20) NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9 -]{0,19}$'),
  sector varchar(80) NOT NULL CHECK (length(btrim(sector)) BETWEEN 2 AND 80),
  merchant_id uuid UNIQUE REFERENCES merchants(id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE dossiers (
  id uuid PRIMARY KEY,
  merchant_id uuid NOT NULL UNIQUE REFERENCES merchants(id),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_revision', 'completo')),
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE dossier_requirements (
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code IN ('identificacion', 'declaracion_actividad', 'revision_sanitaria')),
  fulfilled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (dossier_id, code)
);
CREATE INDEX dossiers_status_idx ON dossiers(status);
COMMIT;
