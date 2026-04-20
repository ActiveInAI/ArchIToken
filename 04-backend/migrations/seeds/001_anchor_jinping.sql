-- 04-backend/migrations/seeds/001_anchor_jinping.sql
-- Seed data for the 应舍美居·锦屏 anchor project (§0 PRD).
-- License: Apache-2.0
--
-- Run AFTER schema migrations. Use ONLY in development / demo; production
-- tenants are created through the normal signup flow.

BEGIN;

-- Reset the `app.current_tenant` for seeding (we bypass RLS as superuser;
-- this script must be run by the DB owner).
SET LOCAL role insomeos;

-- Tenant: demo developer from Qiandongnan
INSERT INTO tenants (id, name, locale, region) VALUES
  ('a0000000-0000-4000-8000-000000000001',
   '应舍美居·示范项目部', 'zh-CN', 'cn')
ON CONFLICT (id) DO NOTHING;

-- Demo user (Supabase Auth sub is a UUID too)
INSERT INTO users (id, supabase_sub, email, display_name) VALUES
  ('b0000000-0000-4000-8000-000000000001',
   'demo-aia-anchor',
   'ActiveInAI@outlook.com',
   'AIA')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_tenant_roles (user_id, tenant_id, role) VALUES
  ('b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'admin'),
  ('b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'owner')
ON CONFLICT DO NOTHING;

-- Anchor project: 520 ㎡ three-storey heavy-steel villa, Guizhou Jinping.
INSERT INTO projects (id, tenant_id, name, description, phase,
                      area_sqm, location, budget_cny,
                      created_by, metadata)
VALUES
  ('c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '应舍美居·锦屏示范别墅',
   '贵州黔东南锦屏 · 重钢结构 Q355B · 三层别墅 · 300mm 模数网格 · 45 天交付',
   'concept',
   520.0,
   '贵州省黔东南苗族侗族自治州锦屏县',
   680000,
   'b0000000-0000-4000-8000-000000000001',
   '{
     "structure_system": "heavy_steel_frame",
     "grid_module_mm": 300,
     "seismic_fortification_intensity": 6,
     "wind_load_kpa": 0.35,
     "snow_load_kpa": 0.00,
     "storeys": 3,
     "delivery_days": 45,
     "reference_standard": ["GB 50017-2017", "GB 50009-2012", "GB 50011-2010"]
   }'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- A few BOQ rows for the anchor (truncated sample; real projects have 100+)
INSERT INTO boq_items (project_id, tenant_id, code, description, unit, quantity,
                       unit_price_cny, total_cny, category) VALUES
  ('c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '010101001', '平整场地', '㎡', 520,     8.50,   4420.00,   '土建'),
  ('c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '010401001', 'C30 混凝土独立基础', 'm³', 42,  620.00, 26040.00, '土建'),
  ('c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '010601001', 'Q355B 焊接 H 型钢柱', 't', 18.4,  9800.00, 180320.00, '结构钢'),
  ('c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '010602001', 'Q355B 焊接 H 型钢梁', 't', 22.7,  9600.00, 217920.00, '结构钢'),
  ('c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '011001001', '外墙保温 岩棉 100mm', '㎡', 380, 135.00,  51300.00, '围护'),
  ('c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '011004001', '中空 Low-E 玻璃', '㎡', 68,   480.00,  32640.00, '围护')
ON CONFLICT DO NOTHING;

-- One compliance finding (a harmless 'info' sample)
INSERT INTO compliance_findings (project_id, tenant_id, severity,
                                  regulation_code, regulation_clause,
                                  finding, recommendation, resolved) VALUES
  ('c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'info',
   'GB 50017-2017',
   '6.1.1',
   '主梁长细比经复核 < 120,满足要求',
   '保持现有设计',
   true);

COMMIT;

-- Expected state after seeding:
--   tenants:  1
--   users:    1
--   projects: 1 (锦屏)
--   boq_items: ≥ 6
--   compliance_findings: 1
