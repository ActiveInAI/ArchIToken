-- 20260611000005_bom_master_data.sql
-- R5 (code audit 2026-06-11): bom_lines.material_grade and section_size were inline
-- free-text, so weights could not be derived deterministically and material takeoff
-- (→ procurement / PBOM) could not group by a controlled spec. This adds controlled
-- engineering-reference master data and links bom_lines to it.
--
-- Design — additive, non-breaking:
--   * Global reference tables (no tenant RLS, like the semantic dictionary): material
--     grades carry a real density; section profiles carry profile type + formula kind
--     and an area/unit-weight the weight worker can populate/verify.
--   * bom_lines keeps its existing text columns and gains NULLABLE FK reference
--     columns. Existing rows stay valid; a safe backfill links rows whose text already
--     matches a known grade. No data is dropped or rewritten destructively.
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Controlled material grades (density is the basis for weight calculation).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bom_material_grades (
    grade_code      TEXT PRIMARY KEY,
    density_kg_m3   NUMERIC(10, 2) NOT NULL CHECK (density_kg_m3 > 0),
    material_family TEXT NOT NULL CHECK (material_family IN (
        'structural_steel', 'fastener_steel', 'stainless_steel',
        'aluminum_alloy', 'concrete', 'timber', 'other'
    )),
    standard_ref    TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO bom_material_grades (grade_code, density_kg_m3, material_family, standard_ref) VALUES
    ('Q235B', 7850, 'structural_steel', 'GB/T 700'),
    ('Q345B', 7850, 'structural_steel', 'GB/T 1591'),
    ('Q355B', 7850, 'structural_steel', 'GB/T 1591'),
    ('Q355D', 7850, 'structural_steel', 'GB/T 1591'),
    ('Q420C', 7850, 'structural_steel', 'GB/T 1591'),
    ('Q460C', 7850, 'structural_steel', 'GB/T 1591'),
    ('8.8S',  7850, 'fastener_steel',   'GB/T 1231'),
    ('10.9S', 7850, 'fastener_steel',   'GB/T 1231'),
    ('304',   7930, 'stainless_steel',  'GB/T 20878'),
    ('316',   7980, 'stainless_steel',  'GB/T 20878'),
    ('6061',  2700, 'aluminum_alloy',   'GB/T 3190'),
    ('6063',  2700, 'aluminum_alloy',   'GB/T 3190')
ON CONFLICT (grade_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Controlled section profiles (registry the weight worker populates/verifies).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bom_section_profiles (
    profile_key      TEXT PRIMARY KEY,
    section_text     TEXT NOT NULL DEFAULT '',
    profile_type     TEXT NOT NULL CHECK (profile_type IN (
        'h_section', 'box_section', 'channel', 'angle',
        'round_bar', 'round_tube', 'plate', 'bolt', 'other'
    )),
    formula_kind     TEXT NOT NULL CHECK (formula_kind IN (
        'h_beam', 'box', 'channel', 'angle', 'round', 'tube', 'plate', 'bolt_table', 'other'
    )),
    area_mm2         NUMERIC(18, 4),
    unit_weight_kg_m NUMERIC(18, 6),
    standard_ref     TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed two canonical profiles computed from the documented area formula at
-- 7850 kg/m3 (unit_weight = area_mm2 * 1000 mm * 7.85e-6 kg/mm3), as worked examples.
INSERT INTO bom_section_profiles
    (profile_key, section_text, profile_type, formula_kind, area_mm2, unit_weight_kg_m, standard_ref) VALUES
    ('H200X200X8X12', 'H 200x200x8x12', 'h_section', 'h_beam', 6208.0000, 48.732800, 'GB/T 11263'),
    ('D12',           'Round bar D12',  'round_bar', 'round',  113.0973,  0.887814,  'GB/T 702')
ON CONFLICT (profile_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Link bom_lines to the controlled master (additive, nullable, non-breaking).
-- ---------------------------------------------------------------------------
ALTER TABLE bom_lines
    ADD COLUMN IF NOT EXISTS material_grade_ref TEXT
        REFERENCES bom_material_grades(grade_code) ON DELETE SET NULL;
ALTER TABLE bom_lines
    ADD COLUMN IF NOT EXISTS section_profile_ref TEXT
        REFERENCES bom_section_profiles(profile_key) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bom_lines_material_grade_ref
    ON bom_lines(material_grade_ref);
CREATE INDEX IF NOT EXISTS idx_bom_lines_section_profile_ref
    ON bom_lines(section_profile_ref);

-- Safe backfill: link existing rows whose free-text already matches a known grade.
-- Only sets the ref where a controlled match exists; everything else stays NULL.
UPDATE bom_lines bl
SET material_grade_ref = bl.material_grade
WHERE bl.material_grade_ref IS NULL
  AND bl.material_grade <> ''
  AND EXISTS (SELECT 1 FROM bom_material_grades g WHERE g.grade_code = bl.material_grade);
