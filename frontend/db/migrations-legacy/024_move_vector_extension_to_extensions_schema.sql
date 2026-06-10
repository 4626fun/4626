-- Phase 11: move pgvector extension out of public schema.
-- Supabase lint expects extensions to live outside `public`.

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  current_schema_name TEXT;
BEGIN
  SELECT n.nspname
    INTO current_schema_name
  FROM pg_extension e
  INNER JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'vector';

  IF current_schema_name IS NULL THEN
    CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
  ELSIF current_schema_name <> 'extensions' THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;
END
$$;
