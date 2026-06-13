# IFC / openBIM validation path (§4 schema source-of-truth)

ArchIToken treats the IFC model and its openBIM semantics as a first-class
schema, alongside OpenAPI / AsyncAPI / JSON Schema / Module Schema. This file
records the validation path every BIM/IFC output must pass before it can be used
as an engineering artifact.

Source of truth: `docs/OPENBIM_STANDARD_BASELINE.md` (IFC / IDM / bSDD / BCF /
IDS / Validate) and the worker adapters under `06-workers`.

## 1. Schema authority

- **IFC schema**: `IFC4` (and `IFC2X3` for legacy interop). The schema string is
  carried on every generated model header and asserted on re-parse.
- **Semantic dictionary**: SJG 157-2024 (`semantic_dictionary_categories`),
  mapping component types to IFC entities (IfcColumn/IfcBeam/IfcMember/…).
- **Information delivery**: IDS (Information Delivery Specification) via
  `ifctester` for requirement checking.

## 2. Generation → validation pipeline

1. **Generate** — `06-workers/architoken_workers/text_to_bim_worker.py`
   (`ifcopenshell_text_to_bim`) produces a real IFC file from a structured
   `bimSpec` (no arbitrary user Python). Served by
   `06-workers/engine_server.py` `POST /v1/generate/text-to-bim`.
2. **Re-parse / schema check** — the worker re-opens the produced file with
   `ifcopenshell.open()` and verifies the schema and the expected entity counts
   (IfcProject / IfcBuildingStorey / walls / slabs / openings) before returning.
   A worker that cannot load `ifcopenshell` returns `blocked`
   (`adapter_not_configured`) rather than a fake model.
3. **Requirement check (IDS)** — engineering-critical models are checked against
   an IDS with `ifctester`; failing requirements block approval.
4. **Gate** — the model never leaves the harness as `ready`; it stays
   `professional_review_required` until a responsible professional signs the
   linked evidence (see the harness RuleChecker/SchemaValidator/Approver gates,
   issue #6).

## 3. Honesty boundary

If the native IFC stack is unavailable, the path degrades to an explicit
`blocked` state — never a frontend-derived stand-in. glTF/GLB is only a web
runtime / delivery fallback; the original source file, openBIM semantics,
property schema, units/coordinates and audit chain remain the source of truth.

## 4. CI

`scripts/check-schemas.sh` verifies this document and the schema set exist and
are well-formed. The worker's own IFC round-trip is covered by
`06-workers/tests/test_text_to_bim_worker.py` (run in the Workers CI job).
