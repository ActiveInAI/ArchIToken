# Steel Platform Detailed Design Integration

**Status**: active integration note
**Module**: `detailed_design`
**Source input**: user-supplied `/home/insome/下载/steel-platform-full.zip` and `/home/insome/下载/实操.mp4`

## Boundary

The archive is integrated as a detailed-design capability, not as a standalone page or product entry.

Excluded from repository integration:

- `.git/`
- `.claude/`
- archive-local assistant identity files
- generated binary caches and Python bytecode
- arbitrary Python execution from the archive

The accepted product contract is:

```text
2D plan blocks
-> steel grid / columns / beams / wall bays / enclosure columns / interior wall studs / roof
-> exterior openings / interior doors / removed interior walls
-> BOM
-> review-required CDE artifacts
-> optional build123d/OCP STEP/STL/glTF worker derivatives
```

## Frontend

`03-frontend/components/DetailedDesignSteelPlatformWorkbench.tsx` is now the `detailed_design` business home.

It replaces the previous Code-as-Room business home with the steel platform workflow:

- prompt-driven floorplan generation and template-driven room requirements
- 300mm / 4800mm grid preview with floor switching
- custom orthogonal outline capture
- room palette insertion and numeric room editing
- steel column grid and dual-direction beam derivation
- wall bay selection for exterior doors/windows
- interior door placement, door swing flipping and interior-wall removal marking
- exterior construction-column groups and interior wall stud groups
- interactive 3D full/enclosure view and frame-only view
- grouped BOM table covering steel, slabs, wall panels, openings, interior walls and roof purlins
- Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver gate state
- CDE JSON package save through `moduleFileApiClient`

The frontend kernel lives in `03-frontend/lib/steel-platform.ts` and emits:

- `architoken.steel_platform_design_package.v1`
- `architoken.steel_platform_bom.v1`

All outputs are marked `professional_review_required`.

## Worker

`06-workers/architoken_workers/steel_platform_worker.py` adds the `steel_platform` adapter.

It accepts only structured plan blocks, steel-platform settings and the edit state mirrored from the video prototype:

- `exterior_openings` / `exteriorOpenings`
- `interior_doors` / `interiorDoors`
- `removed_interior_walls` / `removedInteriorWallIds`
- roof type, ridge axis, slope and purlin spacing
- construction-column and interior-wall switches

It writes:

- `steel_platform_design_package.json`
- `steel_platform_bom.json`

If `outputFormats` requests `step`, `stl`, `gltf` or `glb`, the worker only generates geometry when real `build123d` / OCP is installed. Missing build123d returns an explicit `blocked` result and does not fake geometry.

The adapter is registered in:

- `06-workers/architoken_workers/worker_cli.py`
- `06-workers/architoken_workers/engine_registry.py`

## Module Registry

The `detailed_design` registry now includes:

- subdomain: `steel-platform-2d3d-bom`
- artifacts: `steel-platform-design-package`, `steel-platform-bom`
- data objects: `steel_platform_design_packages`, `steel_platform_boms`, `structural_member_schedules`, `steel_platform_worker_jobs`
- file folders for steel platform design package, BOM and STEP/GLTF derivatives

## Compliance

The steel platform output is not construction-ready, submission-ready or manufacturing-release-ready by itself.

Required downstream gates:

- registered structural engineer / design lead review
- standards and clause source confirmation
- RuleChecker and SchemaValidator evidence
- Approver signoff
- manufacturing handoff only after approved Design Token
