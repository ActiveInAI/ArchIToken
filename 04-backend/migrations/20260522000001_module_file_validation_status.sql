-- Add backend-owned module file validation result columns.

DO $$
BEGIN
  IF to_regclass('public.module_files') IS NOT NULL THEN
    ALTER TABLE module_files
      ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'validator_not_configured',
      ADD COLUMN IF NOT EXISTS validation_validator_ref TEXT,
      ADD COLUMN IF NOT EXISTS validation_report_ref TEXT,
      ADD COLUMN IF NOT EXISTS validation_summary TEXT,
      ADD COLUMN IF NOT EXISTS validation_checked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS validation_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END
$$;
