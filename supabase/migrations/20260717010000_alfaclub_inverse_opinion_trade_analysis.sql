-- Independent analysis-only snapshots for InverseAKITA opinion-trade journal lifecycles.

CREATE TABLE IF NOT EXISTS alfaclub.inverse_opinion_trade_analyses (
  analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_id UUID NOT NULL
    REFERENCES alfaclub.inverse_position_lifecycles(lifecycle_id) ON DELETE RESTRICT,
  reporting_window_start TIMESTAMPTZ NOT NULL,
  reporting_window_end TIMESTAMPTZ NOT NULL,
  evidence_bundle JSONB NOT NULL,
  interpretation JSONB NOT NULL,
  verdict TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  evidence_refs JSONB NOT NULL,
  invalidation_condition TEXT NOT NULL,
  watch_condition TEXT NOT NULL,
  closed_thesis_assessment TEXT,
  model_name VARCHAR(120) NOT NULL,
  model_version VARCHAR(120),
  analysis_only BOOLEAN NOT NULL DEFAULT TRUE,
  failure_reason VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inverse_opinion_trade_analysis_window_check
    CHECK (reporting_window_start < reporting_window_end),
  CONSTRAINT inverse_opinion_trade_analysis_evidence_object_check
    CHECK (jsonb_typeof(evidence_bundle) = 'object'),
  CONSTRAINT inverse_opinion_trade_analysis_interpretation_object_check
    CHECK (jsonb_typeof(interpretation) = 'object'),
  CONSTRAINT inverse_opinion_trade_analysis_verdict_check
    CHECK (verdict IN ('hold', 'add', 'trim', 'exit', 'watch')),
  CONSTRAINT inverse_opinion_trade_analysis_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT inverse_opinion_trade_analysis_refs_array_check
    CHECK (jsonb_typeof(evidence_refs) = 'array'),
  CONSTRAINT inverse_opinion_trade_analysis_closed_assessment_check
    CHECK (
      closed_thesis_assessment IS NULL
      OR closed_thesis_assessment IN ('correct', 'early', 'late', 'invalidated')
    ),
  CONSTRAINT inverse_opinion_trade_analysis_only_check
    CHECK (analysis_only IS TRUE)
);

CREATE INDEX IF NOT EXISTS inverse_opinion_trade_analyses_lifecycle_time_idx
  ON alfaclub.inverse_opinion_trade_analyses (lifecycle_id, created_at ASC);
CREATE INDEX IF NOT EXISTS inverse_opinion_trade_analyses_window_idx
  ON alfaclub.inverse_opinion_trade_analyses (reporting_window_start, reporting_window_end);

ALTER TABLE alfaclub.inverse_opinion_trade_analyses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE alfaclub.inverse_opinion_trade_analyses FROM anon, authenticated;
GRANT USAGE ON SCHEMA alfaclub TO service_role;
GRANT ALL ON TABLE alfaclub.inverse_opinion_trade_analyses TO service_role;

COMMENT ON TABLE alfaclub.inverse_opinion_trade_analyses IS
  'Immutable analysis-only Hermit snapshots; lifecycle and execution facts remain independently authoritative.';
