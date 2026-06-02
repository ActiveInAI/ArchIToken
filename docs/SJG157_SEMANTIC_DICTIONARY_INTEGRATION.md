# SJG 157-2024 Semantic Dictionary Integration

Status: implemented schema and platform API baseline.

ArchIToken stores SJG 157-2024 in `standard_library` as a semantic dictionary registry, not as a standalone product page. The source PDF remains an authorized local source; the repository stores schema, API contracts, and importer logic rather than the full standard tables.

## Scope

| Standard requirement | Platform implementation |
| --- | --- |
| Building, space, element, and system category tables | `semantic_dictionary_categories.object_group` and table codes `10`, `12`, `30`, `16` |
| Linear classification hierarchy | `level_num`, `level_name`, `parent_code`, `semantic_dictionary_category_tree` |
| IFC mapping | `ifc_entity` and `ifc_mapping_raw` |
| Classification namespace mapping | `semantic_dictionary_namespaces` and `semantic_dictionary_classification_mappings` |
| RDF/RDFS/OWL core | `semantic_dictionary_rdf_terms` seeded from chapter 5 and Appendix B |
| Domain terminology projection | `semantic_dictionary_terminologies` and `semantic_dictionary_term_projections` |
| BIM model-unit semantic binding | `bim_model_unit_semantic_bindings` with tenant/project RLS |

## Import

```bash
python3 04-backend/scripts/import-sjg157-semantic-dictionary.py \
  '/home/insome/下载/《建筑工程信息模型语义字典标准》SJG 157-2024.pdf' \
  --apply \
  --database-url "$DATABASE_URL"
```

The importer uses `pdftotext -layout`, records the PDF SHA-256 in `semantic_dictionary_standards.source_sha256`, and upserts Appendix A category rows by `(standard_id, code)`.

## Gateway

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/semantic-dictionaries/sjg157` | Standard metadata and ingestion status |
| `GET /v1/semantic-dictionaries/sjg157/categories` | Search/filter category codes, names, groups, levels, and IFC mappings |
| `GET /v1/semantic-dictionaries/sjg157/categories/{code}` | Fetch one category |

All endpoints use the existing runtime context and `RegistryRead` permission. Project/model bindings are tenant-scoped through RLS.
