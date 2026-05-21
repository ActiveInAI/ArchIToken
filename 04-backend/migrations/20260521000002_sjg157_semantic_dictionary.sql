-- migrations/20260521000002_sjg157_semantic_dictionary.sql
-- ArchIToken standard_library durable schema for SJG 157-2024.
-- Source: 《建筑工程信息模型语义字典标准》SJG 157-2024.
-- Scope: global semantic dictionary registry plus tenant/project BIM model-unit bindings.

CREATE TABLE IF NOT EXISTS semantic_dictionary_standards (
    id                          TEXT PRIMARY KEY,
    module_id                   TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT
                                    DEFAULT 'standard_library'
                                    CHECK (module_id = 'standard_library'),
    standard_code               TEXT NOT NULL,
    title_zh                    TEXT NOT NULL,
    title_en                    TEXT NOT NULL,
    jurisdiction                TEXT NOT NULL,
    source_authority            TEXT NOT NULL,
    published_on                DATE NOT NULL,
    effective_on                DATE NOT NULL,
    digital_representation      TEXT NOT NULL DEFAULT 'RDF/RDFS/OWL',
    namespace_prefix            TEXT NOT NULL DEFAULT 'szbd',
    namespace_uri               TEXT NOT NULL,
    source_file_name            TEXT NOT NULL,
    source_sha256               TEXT,
    ingestion_status            TEXT NOT NULL DEFAULT 'metadata_registered'
                                    CHECK (ingestion_status IN (
                                        'metadata_registered',
                                        'categories_imported',
                                        'verified',
                                        'blocked'
                                    )),
    metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semantic_dictionary_namespaces (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id         TEXT NOT NULL REFERENCES semantic_dictionary_standards(id) ON DELETE CASCADE,
    prefix              TEXT NOT NULL,
    uri                 TEXT NOT NULL,
    classification_name TEXT NOT NULL,
    identifier_rule     TEXT NOT NULL,
    example             TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (standard_id, prefix)
);

CREATE TABLE IF NOT EXISTS semantic_dictionary_rdf_terms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id     TEXT NOT NULL REFERENCES semantic_dictionary_standards(id) ON DELETE CASCADE,
    qname           TEXT NOT NULL,
    rdf_kind        TEXT NOT NULL CHECK (rdf_kind IN (
                        'class',
                        'object_property',
                        'datatype_property',
                        'rdfs_property'
                    )),
    parent_qname    TEXT,
    domain_qname    TEXT,
    range_qname     TEXT,
    description_zh  TEXT NOT NULL,
    source_ref      TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (standard_id, qname)
);

CREATE TABLE IF NOT EXISTS semantic_dictionary_categories (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id             TEXT NOT NULL REFERENCES semantic_dictionary_standards(id) ON DELETE CASCADE,
    code                    TEXT NOT NULL,
    table_code              TEXT NOT NULL CHECK (table_code IN ('10','12','16','30')),
    object_group            TEXT NOT NULL CHECK (object_group IN ('building','space','element','system')),
    level_num               SMALLINT NOT NULL CHECK (level_num BETWEEN 1 AND 5),
    level_name              TEXT NOT NULL CHECK (level_name IN ('大类','中类','小类','细类','微类')),
    parent_code             TEXT,
    name_zh                 TEXT NOT NULL,
    rdf_identifier          TEXT NOT NULL,
    rdf_uri                 TEXT NOT NULL,
    ifc_entity              TEXT,
    ifc_mapping_raw         TEXT,
    planning_terms          JSONB NOT NULL DEFAULT '[]'::jsonb,
    drawing_terms           JSONB NOT NULL DEFAULT '[]'::jsonb,
    handover_terms          JSONB NOT NULL DEFAULT '[]'::jsonb,
    terminology_raw         TEXT,
    remark                  TEXT,
    source_ref              TEXT NOT NULL DEFAULT 'SJG 157-2024 Appendix A',
    source_line             INTEGER,
    raw_text                TEXT NOT NULL DEFAULT '',
    import_batch_id         UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (standard_id, code),
    CHECK (code ~ '^(10|12|16|30)-[0-9]{2}\.[0-9]{2}\.[0-9]{2}(\.[0-9]{2})?(\.[0-9]{2})?$'),
    FOREIGN KEY (standard_id, parent_code)
        REFERENCES semantic_dictionary_categories(standard_id, code)
        ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_semantic_categories_lookup
    ON semantic_dictionary_categories(standard_id, object_group, level_num, code);
CREATE INDEX IF NOT EXISTS idx_semantic_categories_parent
    ON semantic_dictionary_categories(standard_id, parent_code);
CREATE INDEX IF NOT EXISTS idx_semantic_categories_ifc
    ON semantic_dictionary_categories(standard_id, ifc_entity);
CREATE INDEX IF NOT EXISTS idx_semantic_categories_name_trgm
    ON semantic_dictionary_categories USING gin (name_zh gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_semantic_categories_raw_trgm
    ON semantic_dictionary_categories USING gin (raw_text gin_trgm_ops);

CREATE TABLE IF NOT EXISTS semantic_dictionary_classification_mappings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id         TEXT NOT NULL REFERENCES semantic_dictionary_standards(id) ON DELETE CASCADE,
    category_code       TEXT NOT NULL,
    target_namespace    TEXT NOT NULL,
    target_identifier   TEXT NOT NULL,
    predicate_qname     TEXT NOT NULL DEFAULT 'szbd:referTo',
    mapping_status      TEXT NOT NULL DEFAULT 'draft'
                            CHECK (mapping_status IN ('draft','verified','deprecated')),
    source_ref          TEXT NOT NULL DEFAULT 'SJG 157-2024 4.3.3',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (standard_id, category_code, target_namespace, target_identifier),
    FOREIGN KEY (standard_id, category_code)
        REFERENCES semantic_dictionary_categories(standard_id, code)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_semantic_mappings_target
    ON semantic_dictionary_classification_mappings(target_namespace, target_identifier);

CREATE TABLE IF NOT EXISTS semantic_dictionary_terminologies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id         TEXT NOT NULL REFERENCES semantic_dictionary_standards(id) ON DELETE CASCADE,
    term_key            TEXT NOT NULL,
    label_zh            TEXT NOT NULL,
    term_source         TEXT NOT NULL,
    source_ref          TEXT NOT NULL DEFAULT 'SJG 157-2024 4.3.4',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (standard_id, term_key)
);

CREATE TABLE IF NOT EXISTS semantic_dictionary_term_projections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id         TEXT NOT NULL REFERENCES semantic_dictionary_standards(id) ON DELETE CASCADE,
    terminology_id      UUID NOT NULL REFERENCES semantic_dictionary_terminologies(id) ON DELETE CASCADE,
    category_code       TEXT NOT NULL,
    additional_tags     JSONB NOT NULL DEFAULT '[]'::jsonb,
    projection_status   TEXT NOT NULL DEFAULT 'draft'
                            CHECK (projection_status IN ('draft','verified','deprecated')),
    source_ref          TEXT NOT NULL DEFAULT 'SJG 157-2024 4.3.4',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (standard_id, category_code)
        REFERENCES semantic_dictionary_categories(standard_id, code)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_semantic_term_projection_category
    ON semantic_dictionary_term_projections(standard_id, category_code);

CREATE TABLE IF NOT EXISTS project_semantic_standard_adoptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    standard_id         TEXT NOT NULL REFERENCES semantic_dictionary_standards(id) ON DELETE RESTRICT,
    module_id           TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT
                            DEFAULT 'standard_library'
                            CHECK (module_id = 'standard_library'),
    adoption_status     TEXT NOT NULL DEFAULT 'draft'
                            CHECK (adoption_status IN (
                                'draft',
                                'active',
                                'superseded',
                                'archived'
                            )),
    adopted_by          UUID REFERENCES users(id),
    adopted_at          TIMESTAMPTZ,
    evidence_refs       JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, standard_id)
);
CREATE INDEX IF NOT EXISTS idx_project_semantic_adoptions_scope
    ON project_semantic_standard_adoptions(tenant_id, project_id, adoption_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS bim_model_unit_semantic_bindings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id                  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id                   TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT
                                    DEFAULT 'standard_library',
    bim_upload_id               UUID REFERENCES bim_uploads(id) ON DELETE SET NULL,
    model_unit_id               TEXT NOT NULL,
    element_global_id           TEXT,
    dictionary_standard_id      TEXT NOT NULL REFERENCES semantic_dictionary_standards(id) ON DELETE RESTRICT
                                    DEFAULT 'sjg157-2024',
    category_code               TEXT,
    composite_code              TEXT,
    code_expression_operator    TEXT CHECK (code_expression_operator IN ('plus','range','subordinate','primary_modifier')),
    classification_name         TEXT,
    ifc_entity                  TEXT,
    binding_status             TEXT NOT NULL DEFAULT 'draft'
                                    CHECK (binding_status IN (
                                        'draft',
                                        'validated',
                                        'needs_review',
                                        'approved',
                                        'archived'
                                    )),
    evidence_refs               JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by                  UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (category_code IS NOT NULL OR composite_code IS NOT NULL),
    FOREIGN KEY (dictionary_standard_id, category_code)
        REFERENCES semantic_dictionary_categories(standard_id, code)
        ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_bim_model_unit_semantic_scope
    ON bim_model_unit_semantic_bindings(tenant_id, project_id, module_id, binding_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bim_model_unit_semantic_model_unit
    ON bim_model_unit_semantic_bindings(tenant_id, project_id, model_unit_id);
CREATE INDEX IF NOT EXISTS idx_bim_model_unit_semantic_category
    ON bim_model_unit_semantic_bindings(dictionary_standard_id, category_code);

CREATE OR REPLACE VIEW semantic_dictionary_category_tree AS
SELECT
    child.standard_id,
    child.code,
    child.name_zh,
    child.object_group,
    child.table_code,
    child.level_num,
    child.level_name,
    child.parent_code,
    parent.name_zh AS parent_name_zh,
    child.ifc_entity,
    child.rdf_identifier,
    child.rdf_uri,
    child.terminology_raw,
    child.remark,
    child.updated_at
FROM semantic_dictionary_categories child
LEFT JOIN semantic_dictionary_categories parent
  ON parent.standard_id = child.standard_id
 AND parent.code = child.parent_code;

INSERT INTO semantic_dictionary_standards (
    id,
    standard_code,
    title_zh,
    title_en,
    jurisdiction,
    source_authority,
    published_on,
    effective_on,
    namespace_prefix,
    namespace_uri,
    source_file_name,
    metadata
) VALUES (
    'sjg157-2024',
    'SJG 157-2024',
    '建筑工程信息模型语义字典标准',
    'Standard for Building Engineering Information Modeling Semantic Data Dictionary',
    '深圳市',
    '深圳市住房和建设局',
    DATE '2024-02-15',
    DATE '2024-04-01',
    'szbd',
    'http://www.cbims.org.cn/ns/szbd#',
    '《建筑工程信息模型语义字典标准》SJG 157-2024.pdf',
    jsonb_build_object(
        'objectGroups', jsonb_build_array('building','space','element','system'),
        'tableCodes', jsonb_build_object('building','10','space','12','element','30','system','16'),
        'codeOperators', jsonb_build_array('+','/','<'),
        'sourceFilePathHint', '/home/insome/下载/《建筑工程信息模型语义字典标准》SJG 157-2024.pdf'
    )
)
ON CONFLICT (id) DO UPDATE
SET standard_code = EXCLUDED.standard_code,
    title_zh = EXCLUDED.title_zh,
    title_en = EXCLUDED.title_en,
    jurisdiction = EXCLUDED.jurisdiction,
    source_authority = EXCLUDED.source_authority,
    published_on = EXCLUDED.published_on,
    effective_on = EXCLUDED.effective_on,
    namespace_prefix = EXCLUDED.namespace_prefix,
    namespace_uri = EXCLUDED.namespace_uri,
    source_file_name = EXCLUDED.source_file_name,
    metadata = semantic_dictionary_standards.metadata || EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO semantic_dictionary_namespaces (
    standard_id,
    prefix,
    uri,
    classification_name,
    identifier_rule,
    example
) VALUES
    ('sjg157-2024', 'szbd', 'http://www.cbims.org.cn/ns/szbd#', 'Shenzhen Building Dictionary', '类目名称', 'szbd:司法空间'),
    ('sjg157-2024', 'ifc', 'https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2_TC1/OWL/#', 'IFC', '类目名称[_预定义类型]', 'ifc:IfcWall_SHEAR'),
    ('sjg157-2024', 'gbt51269', 'https://www.nssi.org.cn/nssi/front/107326353.html#', 'GB/T51269', '类目编号', 'gbt51269:30-30.40.30'),
    ('sjg157-2024', 'omniclass', 'https://csitest.csiresources.org/standards/omniclass/#', 'OmniClass', '类目编号', 'omniclass:22-03.31.23'),
    ('sjg157-2024', 'uniclass', 'https://uniclass.thenbs.com/#', 'UniClass', '类目编号', 'uniclass:En_80_45_08')
ON CONFLICT (standard_id, prefix) DO UPDATE
SET uri = EXCLUDED.uri,
    classification_name = EXCLUDED.classification_name,
    identifier_rule = EXCLUDED.identifier_rule,
    example = EXCLUDED.example;

INSERT INTO semantic_dictionary_rdf_terms (
    standard_id,
    qname,
    rdf_kind,
    parent_qname,
    domain_qname,
    range_qname,
    description_zh,
    source_ref
) VALUES
    ('sjg157-2024', 'szbd:AbstractDef', 'class', 'owl:Class', NULL, NULL, '字典中所有类目的公共抽象上位类', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'szbd:Cate', 'class', 'szbd:AbstractDef', NULL, NULL, '分类类目', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'szbd:Prop', 'class', 'szbd:AbstractDef', NULL, NULL, '属性定义', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'szbd:Geom', 'class', 'szbd:AbstractDef', NULL, NULL, '几何表达定义', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'szbd:Matl', 'class', 'szbd:AbstractDef', NULL, NULL, '材质表达定义', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'szbd:Dspl', 'class', 'szbd:AbstractDef', NULL, NULL, '专业领域定义', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'szbd:Role', 'class', 'szbd:AbstractDef', NULL, NULL, '组织角色定义', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'szbd:Usecase', 'class', 'szbd:AbstractDef', NULL, NULL, '用例定义', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'szbd:AdditionalTag', 'class', 'szbd:AbstractDef', NULL, NULL, '补充标识', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'szbd:Terminology', 'class', 'szbd:AbstractDef', NULL, NULL, '领域规范术语', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'szbd:TermProjection', 'class', 'szbd:AbstractDef', NULL, NULL, '领域规范术语映射', 'SJG 157-2024 Table 5.0.3 / Appendix B'),
    ('sjg157-2024', 'rdfs:subClassOf', 'rdfs_property', NULL, 'szbd:AbstractDef', 'szbd:AbstractDef', '是上位类与下位类关系', 'SJG 157-2024 Table 5.0.4'),
    ('sjg157-2024', 'rdfs:label', 'rdfs_property', NULL, 'szbd:AbstractDef', 'xsd:string', '名称', 'SJG 157-2024 Table 5.0.4'),
    ('sjg157-2024', 'rdfs:comment', 'rdfs_property', NULL, 'szbd:AbstractDef', 'xsd:string', '描述', 'SJG 157-2024 Table 5.0.4'),
    ('sjg157-2024', 'szbd:rel', 'object_property', NULL, 'szbd:AbstractDef', 'szbd:AbstractDef', '语义字典关联字段的抽象字段', 'SJG 157-2024 Table 5.0.5 / Appendix B'),
    ('sjg157-2024', 'szbd:hasPropDef', 'object_property', 'szbd:rel', 'szbd:AbstractDef', 'szbd:Prop', '具有属性定义', 'SJG 157-2024 Table 5.0.5 / Appendix B'),
    ('sjg157-2024', 'szbd:usedIn', 'object_property', 'szbd:rel', 'szbd:AbstractDef', 'szbd:Usecase', '在用例中被使用', 'SJG 157-2024 Table 5.0.5 / Appendix B'),
    ('sjg157-2024', 'szbd:assignedTo', 'object_property', 'szbd:rel', 'szbd:AbstractDef', 'szbd:Dspl | szbd:Role', '分配给专业或角色', 'SJG 157-2024 Table 5.0.5 / Appendix B'),
    ('sjg157-2024', 'szbd:referTo', 'object_property', 'szbd:rel', 'szbd:AbstractDef', 'rdfs:Class', '映射至其它分类体系', 'SJG 157-2024 Table 5.0.5 / Appendix B'),
    ('sjg157-2024', 'szbd:hasTagOption', 'object_property', 'szbd:rel', 'szbd:Cate', 'szbd:AdditionalTag', '类目可选的补充标识', 'SJG 157-2024 Table 5.0.5 / Appendix B'),
    ('sjg157-2024', 'szbd:hasProjection', 'object_property', 'szbd:rel', 'szbd:Terminology', 'szbd:TermProjection', '领域规范术语具有术语映射', 'SJG 157-2024 Table 5.0.5 / Appendix B'),
    ('sjg157-2024', 'szbd:relatedCate', 'object_property', 'szbd:rel', 'szbd:TermProjection', 'szbd:Cate', '术语映射关联的类目', 'SJG 157-2024 Table 5.0.5 / Appendix B'),
    ('sjg157-2024', 'szbd:relatingTag', 'object_property', 'szbd:rel', 'szbd:TermProjection', 'szbd:AdditionalTag', '术语映射关联的补充标识', 'SJG 157-2024 Table 5.0.5 / Appendix B'),
    ('sjg157-2024', 'szbd:pSetName', 'datatype_property', NULL, 'szbd:Prop', 'xsd:string', '属性的属性集名称', 'SJG 157-2024 Table 5.0.6 / Appendix B'),
    ('sjg157-2024', 'szbd:termSource', 'datatype_property', NULL, 'szbd:Terminology', 'xsd:string', '领域规范术语的来源', 'SJG 157-2024 Table 5.0.6 / Appendix B')
ON CONFLICT (standard_id, qname) DO UPDATE
SET rdf_kind = EXCLUDED.rdf_kind,
    parent_qname = EXCLUDED.parent_qname,
    domain_qname = EXCLUDED.domain_qname,
    range_qname = EXCLUDED.range_qname,
    description_zh = EXCLUDED.description_zh,
    source_ref = EXCLUDED.source_ref;

CREATE OR REPLACE FUNCTION current_tenant() RETURNS UUID AS $$
DECLARE
    t TEXT;
BEGIN
    BEGIN
        t := current_setting('app.current_tenant', true);
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
    IF t IS NULL OR t = '' THEN RETURN NULL; END IF;
    RETURN t::UUID;
END
$$ LANGUAGE plpgsql STABLE;

ALTER TABLE project_semantic_standard_adoptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bim_model_unit_semantic_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_semantic_standard_adoptions_tenant
    ON project_semantic_standard_adoptions;
CREATE POLICY project_semantic_standard_adoptions_tenant
    ON project_semantic_standard_adoptions
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS bim_model_unit_semantic_bindings_tenant
    ON bim_model_unit_semantic_bindings;
CREATE POLICY bim_model_unit_semantic_bindings_tenant
    ON bim_model_unit_semantic_bindings
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

ALTER TABLE project_semantic_standard_adoptions FORCE ROW LEVEL SECURITY;
ALTER TABLE bim_model_unit_semantic_bindings FORCE ROW LEVEL SECURITY;
