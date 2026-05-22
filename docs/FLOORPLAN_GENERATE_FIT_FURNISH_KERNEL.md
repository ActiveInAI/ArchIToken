# ArchIToken Floorplan Generate / Fit / Furnish Kernel

**Status**: active frontend kernel, backend-worker ready contract  
**Scope**: `concept_design` and `detailed_design` residential / hotel-unit layout candidates  
**Review state**: `professional_review_required`

## 1. Purpose

The floorplan kernel turns a room program and optional boundary input into comparable layout candidates:

```text
Program + boundary + entrance + facade hints
  -> Generate / Fit / Furnish candidates
  -> Evaluator / RuleChecker / SchemaValidator evidence
  -> CDE artifact manifest
  -> professional review
```

This is a clean-room ArchIToken implementation inspired by the observed workflow pattern of Rhino/Revit floor-plan plugins. It does not copy proprietary code, models, assets or product internals.

## 2. Shared Implementation

| Path | Role |
|---|---|
| `03-frontend/lib/architoken/floorplan-layout.ts` | Shared typed layout kernel, candidate generation, template fit, furniture placement, evaluation, CDE payload |
| `03-frontend/components/DetailedDesignPlanFinderWorkbench.tsx` | Detailed design Generate / Fit / Furnish / Manage workbench UI |
| `03-frontend/lib/insome/floorplan/variants/residential-generator.ts` | Concept design floorplan proposals backed by the same kernel |
| `03-frontend/lib/architoken/floorplan-layout.test.ts` | Kernel and concept/detailed integration tests |
| `06-workers/architoken_workers/floorplan_worker.py` | Backend worker adapter emitting the same manifest/evaluation schema |
| `06-workers/tests/test_floorplan_worker.py` | Worker manifest, dispatch and review-state tests |

## 3. Algorithm Boundary

The current kernel is deterministic and rule based:

- normalizes a residential room program into a typed `StudioIntent`
- generates baseline room blocks on a 300 mm grid
- retrieves the closest template for `Fit`
- adapts template geometry to the target envelope
- places furniture by room type with simple clearance checks
- evaluates area, room count, grid snap, structural span hints, wet-zone stacking and furniture fit
- records the AI gate chain: `Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver`

The evaluator is intentionally conservative. Missing professional rules, jurisdictional clauses, project contracts or registered reviewer approval keep the artifact in `professional_review_required`.

## 4. Module Contract

`concept_design` uses the kernel for early option comparison and renderer-friendly `Floorplan` output.

`detailed_design` uses the same kernel for editable candidates, 2D/3D preview, furniture layers, evaluation gates and CDE JSON persistence.

Neither module may mark the output as compliant, submission-ready or construction-ready until professional standards and approval evidence are attached.

## 5. Next Backend Step

The `floorplan_layout` worker is the stable backend contract. A future worker implementation can replace the deterministic generator with CP-SAT / ILP / graph search / learned-prior proposal generation as long as it preserves the same manifest, evaluation and approval boundary.
