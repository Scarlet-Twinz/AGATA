-- Existing AGATA databases may have audit_events.created_at as NOT NULL
-- without the server default introduced in the current SQLAlchemy model.
ALTER TABLE audit_events
    ALTER COLUMN created_at SET DEFAULT NOW();
