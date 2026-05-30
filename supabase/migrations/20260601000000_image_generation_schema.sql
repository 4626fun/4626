-- Image generation projects, assets, attempts, and jobs.
-- Extracted from duplicated runtime bootstrap in frontend/server/_lib/image/imageProjects.ts.

CREATE TABLE IF NOT EXISTS image_generation_projects (
  id TEXT PRIMARY KEY,
  owner_address TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  instruction TEXT NOT NULL DEFAULT '',
  style_preset TEXT,
  brand_context_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_response_id TEXT,
  latest_error TEXT,
  vault_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS image_generation_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES image_generation_projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS image_generation_attempts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES image_generation_projects(id) ON DELETE CASCADE,
  job_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  model TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS image_generation_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES image_generation_projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'generate',
  status TEXT NOT NULL DEFAULT 'pending',
  provider_job_id TEXT,
  result_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE image_generation_projects IS 'Image generation projects (owner, instruction, style, vault context).';
COMMENT ON TABLE image_generation_assets IS 'Generated assets (images) belonging to a project.';
COMMENT ON TABLE image_generation_attempts IS 'Individual generation attempts for a project.';
COMMENT ON TABLE image_generation_jobs IS 'Provider jobs associated with a project.';