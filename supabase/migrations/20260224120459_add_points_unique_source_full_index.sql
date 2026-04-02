CREATE UNIQUE INDEX IF NOT EXISTS points_unique_source_full
  ON points (signup_id, source, source_id);
;
