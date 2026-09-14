-- Keep readiness history focused on meaningful state changes.
-- A fingerprint represents the complete deterministic readiness state, so
-- identical fingerprints for the same project/contractor are duplicates.
DELETE FROM readiness_traces newer
USING readiness_traces older
WHERE newer.company_id = older.company_id
  AND newer.project_id = older.project_id
  AND newer.contractor_id = older.contractor_id
  AND newer.fingerprint = older.fingerprint
  AND (newer.created_at, newer.id) > (older.created_at, older.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_readiness_traces_state_fingerprint
ON readiness_traces (company_id, project_id, contractor_id, fingerprint);
