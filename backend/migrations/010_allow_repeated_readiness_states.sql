-- A readiness state may legitimately recur later (for example, a blocker is
-- resolved and then reappears). Prevent only duplicate captures of the same
-- state at the same point in history; do not enforce global fingerprint
-- uniqueness.
DROP INDEX IF EXISTS uq_readiness_traces_state_fingerprint;

CREATE INDEX IF NOT EXISTS ix_readiness_traces_state_fingerprint
ON readiness_traces (company_id, project_id, contractor_id, fingerprint);
