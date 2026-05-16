# 05-method_statement · DATA-MODEL

3 张表 · 完整 DDL。

---

## 1. 表清单

| # | 表 | 业务 |
|---|---|---|
| 1 | `csr.method_statements` | 专项施工方案 |
| 2 | `csr.technical_briefings` | 三级技术交底 |
| 3 | `csr.expert_reviews` | 危大专家论证 |

---

## 2. DDL

### 2.1 `csr.method_statements`

```sql
CREATE TABLE IF NOT EXISTS csr.method_statements (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    ms_no                TEXT        NOT NULL,                 -- "JP-MS-2026-0005"
    title                TEXT        NOT NULL,
    version_no           INTEGER     NOT NULL DEFAULT 1,

    scope                TEXT        NOT NULL,                 -- "二层钢结构吊装 · B×5~B×7 主梁"
    scope_activity_ids   UUID[]      NOT NULL DEFAULT '{}',    -- 关联工序

    hazard_category      TEXT        NOT NULL
                         CHECK (hazard_category IN (
                             'deep_excavation','high_formwork','lifting','scaffolding',
                             'dismantling','tunneling','underwater','open_caisson',
                             'temporary_structure','pipe_jacking','other'
                         )),
    is_super_scale       BOOLEAN     NOT NULL DEFAULT FALSE,   -- 超规模需专家论证

    pdf_uri              TEXT        NOT NULL,                 -- 方案 PDF 对象存储 URL
    pdf_sha256           CHAR(64)    NOT NULL,                 -- 防篡改

    authored_by_unit     TEXT        NOT NULL,                 -- 施工单位
    authored_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 监理审查
    review_status        TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (review_status IN ('pending','in_review','rejected','approved','superseded')),
    review_comments      JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                     -- [{"reviewer":"张总监","comment":"…","severity":"major","at":"…"}]
    reviewed_by          UUID,
    reviewed_at          TIMESTAMPTZ,

    -- 专家论证链接
    expert_review_id     UUID        REFERENCES csr.expert_reviews(id) ON DELETE SET NULL,
    expert_reviewed_at   TIMESTAMPTZ,

    standards_referenced JSONB       NOT NULL DEFAULT '[]'::jsonb,

    effective_from       DATE,
    effective_to         DATE,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ms_super_needs_expert
        CHECK (is_super_scale = FALSE OR review_status != 'approved' OR expert_reviewed_at IS NOT NULL)
);

COMMENT ON TABLE csr.method_statements IS '专项施工方案 · 超规模危大必须 expert_reviewed · PDF 哈希锁防篡';

CREATE UNIQUE INDEX idx_ms_no ON csr.method_statements(tenant_id, ms_no, version_no);
CREATE INDEX idx_ms_project_status ON csr.method_statements(project_id, review_status);
CREATE INDEX idx_ms_hazard ON csr.method_statements(project_id, hazard_category);

ALTER TABLE csr.method_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.method_statements FORCE ROW LEVEL SECURITY;
CREATE POLICY ms_tenant ON csr.method_statements
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.2 `csr.technical_briefings`

```sql
CREATE TABLE IF NOT EXISTS csr.technical_briefings (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    method_statement_id  UUID        REFERENCES csr.method_statements(id) ON DELETE SET NULL,

    level                TEXT        NOT NULL
                         CHECK (level IN ('company','project','crew')),
    sequence_no          SMALLINT    NOT NULL                   -- 1=company, 2=project, 3=crew
                         CHECK (sequence_no BETWEEN 1 AND 3),

    held_at              TIMESTAMPTZ NOT NULL,
    venue                TEXT,

    giver_id             UUID        NOT NULL,
    giver_unit           TEXT        NOT NULL,

    audience             JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                     -- [{"worker_id":"...","name":"...","signed":true,"signed_at":"..."}]
    audience_unit        TEXT        NOT NULL,

    topic                TEXT        NOT NULL,
    key_points           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    q_and_a              JSONB       NOT NULL DEFAULT '[]'::jsonb,

    duration_min         SMALLINT,
    audio_uri            TEXT,
    photo_evidence_ids   UUID[]      NOT NULL DEFAULT '{}',

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT tb_level_seq CHECK (
        (level='company' AND sequence_no=1) OR
        (level='project' AND sequence_no=2) OR
        (level='crew' AND sequence_no=3)
    )
);

COMMENT ON TABLE csr.technical_briefings IS '三级技术交底 · company=1 · project=2 · crew=3 · 按序进行';

CREATE INDEX idx_tb_ms ON csr.technical_briefings(method_statement_id, sequence_no);
CREATE INDEX idx_tb_project ON csr.technical_briefings(project_id, held_at DESC);

ALTER TABLE csr.technical_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.technical_briefings FORCE ROW LEVEL SECURITY;
CREATE POLICY tb_tenant ON csr.technical_briefings
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.3 `csr.expert_reviews`

```sql
CREATE TABLE IF NOT EXISTS csr.expert_reviews (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    review_no            TEXT        NOT NULL,                 -- "JP-ER-2026-0002"
    ms_draft_uri         TEXT        NOT NULL,                 -- 会前方案 URI
    ms_draft_sha256      CHAR(64)    NOT NULL,

    scheduled_at         TIMESTAMPTZ NOT NULL,
    held_at              TIMESTAMPTZ,
    venue                TEXT,
    meeting_mode         TEXT        NOT NULL DEFAULT 'onsite'
                         CHECK (meeting_mode IN ('onsite','video','hybrid')),

    experts              JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                     -- [{"name":"...","specialty":"钢结构","institution":"...","id_no":"..."}]
    attendees_count      INTEGER     NOT NULL DEFAULT 0,
    specialties_covered  TEXT[]      NOT NULL DEFAULT '{}',

    agenda               JSONB       NOT NULL DEFAULT '[]'::jsonb,
    minutes_md           TEXT,

    verdict              TEXT
                         CHECK (verdict IS NULL OR verdict IN ('pass','pass_with_revisions','fail')),
    verdict_comments     JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                     -- [{"expert":"...","comment":"...","mandatory":true}]

    final_ms_uri         TEXT,                                 -- 修订后的最终方案
    final_ms_sha256      CHAR(64),

    status               TEXT        NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','in_progress','concluded','archived')),

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT er_min_experts CHECK (attendees_count = 0 OR attendees_count >= 5),
    CONSTRAINT er_min_specialties CHECK (array_length(specialties_covered, 1) IS NULL OR array_length(specialties_covered, 1) >= 3)
);

COMMENT ON TABLE csr.expert_reviews IS '危大专家论证会 · 至少 5 名专家 · 涵盖 3 个相关专业(住建部 37 号令)';

CREATE UNIQUE INDEX idx_er_no ON csr.expert_reviews(tenant_id, review_no);
CREATE INDEX idx_er_project ON csr.expert_reviews(project_id, scheduled_at DESC);

ALTER TABLE csr.expert_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.expert_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY er_tenant ON csr.expert_reviews
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 3. 示例 INSERT (锦屏 · 吊装方案)

```sql
INSERT INTO csr.method_statements (
    tenant_id, project_id, ms_no, title, scope, scope_activity_ids,
    hazard_category, is_super_scale, pdf_uri, pdf_sha256,
    authored_by_unit, review_status, standards_referenced
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'JP-MS-2026-0005', '二层钢结构吊装专项施工方案',
    '二层 B×5~B×7 主梁吊装 · 单件最大 11.2t · 塔吊 QTZ40',
    ARRAY['<A1210>','<A1215>','<A1220>']::uuid[],
    'lifting', TRUE,  -- 11.2t > 10t 门槛 · 超规模
    's3://architoken/projects/jp/ms/JP-MS-2026-0005-v1.pdf',
    'a1b2c3d4e5f6...(64 hex)...',
    '贵州某钢构公司', 'pending',
    '["GB 5144-2006","JGJ 33-2012","JGJ 80-2016","住建部令 第 37 号"]'::jsonb
);

-- 专家论证
INSERT INTO csr.expert_reviews (
    tenant_id, project_id, review_no, ms_draft_uri, ms_draft_sha256,
    scheduled_at, venue, meeting_mode,
    experts, attendees_count, specialties_covered, status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'JP-ER-2026-0002',
    's3://architoken/projects/jp/ms/JP-MS-2026-0005-v1.pdf', 'a1b2c3...',
    TIMESTAMPTZ '2026-05-13 14:00:00+08', '腾讯会议', 'video',
    '[
      {"name":"刘工","specialty":"钢结构","institution":"贵州大学土木学院","id_no":"****0101"},
      {"name":"陈工","specialty":"起重机械","institution":"省建筑机械协会","id_no":"****0202"},
      {"name":"王工","specialty":"施工安全","institution":"省安监站","id_no":"****0303"},
      {"name":"赵工","specialty":"项目管理","institution":"省建设科研院","id_no":"****0404"},
      {"name":"孙工","specialty":"监理","institution":"省监理协会","id_no":"****0505"}
    ]'::jsonb,
    5, ARRAY['steel_structure','lifting_machinery','safety'], 'scheduled'
);

-- 公司级交底(论证后)
INSERT INTO csr.technical_briefings (
    tenant_id, project_id, method_statement_id, level, sequence_no,
    held_at, giver_id, giver_unit, audience_unit, topic
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '<ms id>', 'company', 1,
    TIMESTAMPTZ '2026-05-14 10:00:00+08', '<总工 uid>', '贵州某钢构公司',
    '项目部 + 监理部', '二层钢结构吊装方案交底(公司级)'
);
```

---

## 4. 维护脚本

### 4.1 三级交底顺序强制

```sql
-- 同一 method_statement · 若 level='project' · 必须 level='company' 已存在
CREATE OR REPLACE FUNCTION csr.fn_briefing_sequence() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sequence_no = 2 THEN
        PERFORM 1 FROM csr.technical_briefings
        WHERE method_statement_id = NEW.method_statement_id AND sequence_no = 1
        LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'project-level briefing requires prior company-level'; END IF;
    END IF;
    IF NEW.sequence_no = 3 THEN
        PERFORM 1 FROM csr.technical_briefings
        WHERE method_statement_id = NEW.method_statement_id AND sequence_no = 2
        LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'crew-level briefing requires prior project-level'; END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_briefing_sequence
BEFORE INSERT ON csr.technical_briefings
FOR EACH ROW EXECUTE FUNCTION csr.fn_briefing_sequence();
```

---

## 5. 查询样例

```sql
-- 待审查的方案
SELECT ms_no, title, authored_at FROM csr.method_statements
WHERE project_id = $1 AND review_status = 'in_review'
ORDER BY authored_at;

-- 未完成三级交底的方案(project 开工前必过)
SELECT ms.ms_no, ms.title,
       (SELECT count(*) FROM csr.technical_briefings tb WHERE tb.method_statement_id = ms.id) AS briefing_count
FROM csr.method_statements ms
WHERE ms.project_id = $1 AND ms.review_status = 'approved'
GROUP BY ms.id
HAVING (SELECT count(*) FROM csr.technical_briefings tb WHERE tb.method_statement_id = ms.id) < 3;

-- 超规模方案 · 论证状态
SELECT ms.ms_no, ms.title, er.verdict, er.held_at
FROM csr.method_statements ms
LEFT JOIN csr.expert_reviews er ON ms.expert_review_id = er.id
WHERE ms.project_id = $1 AND ms.is_super_scale
ORDER BY ms.authored_at;
```

---

version: 0.1.0 · 2026-04-23
