# ArchIToken Blender Runtime And Plugin System Integration

**Status**: active integration contract
**Date**: 2026-05-26
**Scope**: Blender runtime, add-ons, extensions, app templates, Python operators, headless jobs, scene derivatives and CDE audit integration

ArchIToken integrates Blender as a full DCC, geometry, render, video, IFC/Bonsai host and plug-in execution platform, but never embeds Blender GPL runtime code into the distributed core. Blender and every Blender add-on/extension run as an external worker process, sidecar service or licensed enterprise adapter. The core platform stores source files, manifests, audit events, approvals and derivative artifacts.

## External Baseline

- Blender source: `https://github.com/blender/blender`
- Blender Python operators: `https://docs.blender.org/api/current/bpy.ops.preferences.html`
- Blender extension manual: `https://docs.blender.org/manual/en/4.2/advanced/extensions/getting_started.html`
- Blender extension portal: `https://extensions.blender.org/`
- Bonsai/IfcOpenShell source: `https://github.com/IfcOpenShell/IfcOpenShell/tree/v0.8.5/src/bonsai`

Blender 4.2+ extension packages use `blender_manifest.toml` metadata. Legacy add-ons may still expose `bl_info`, `register()` and `unregister()` in Python. ArchIToken supports both forms through the same worker registry.

## Non-Negotiable Boundary

Blender integration follows the repository-wide adapter policy:

```text
CDE source file / plugin package
-> static plugin audit
-> workflow approval
-> ephemeral Blender user profile
-> add-on / extension install and enable
-> typed operator or scripted job
-> real scene/render/model derivative artifacts
-> Evaluator / RuleChecker / SchemaValidator / Approver
-> CDE version, audit event, module artifact
```

Rules:

1. Blender and plugins must run in an external process or sidecar container.
2. Core Rust, frontend React and Python orchestrator code must not import or link Blender runtime code.
3. Every plug-in package is audited before execution and produces `architoken.blender_plugin_audit.v1`.
4. Execution requires explicit module workflow approval and produces `architoken.blender_plugin_run.v1`.
5. Worker jobs use job-scoped `BLENDER_USER_RESOURCES`, `BLENDER_USER_CONFIG`, `BLENDER_USER_SCRIPTS` and `BLENDER_USER_EXTENSIONS`.
6. Network, filesystem, subprocess, package install and credential access are risk-scored before execution.
7. Generated `.blend`, OpenUSD/USDZ, 3D Tiles, GLB fallback, images and video are derivatives, not source truth.
8. IFC/openBIM semantics, units, coordinates, element ids, properties and approvals remain outside Blender-only scene state.
9. The embedded `native-open` workbench only advertises Blender formats with a registered importer in the current runtime profile. Bonsai/IfcOpenShell, SketchUp, Rhino and other plug-in-backed formats stay hidden or disabled until the plug-in self-check proves that the architecture, Python ABI, license boundary and operator are available.

## Worker Adapters

Current worker adapters:

| Adapter                         | Operation              | Purpose                                                                          |
| ------------------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `blender`                       | conversion/render host | Convert supported Blender scene/model sources through headless Blender           |
| `blender_plugin`                | `blender_plugin_audit` | Inspect `.py`, `.zip` or source-directory plug-ins without executing them        |
| `blender_plugin_run`            | `blender_plugin_run`   | Install and execute approved plug-ins inside an ephemeral Blender worker profile |
| `ifcopenshell` / `bonsai` route | IFC/Bonsai jobs        | Use Blender/Bonsai as external IFC authoring and validation host                 |

Accepted plugin source forms:

- single-file legacy add-on: `.py`
- packaged extension/add-on: `.zip`
- source directory with `blender_manifest.toml`, `__init__.py` or module files

Static audit captures:

- manifest metadata: id, name, version, type, license, Blender version range, permissions and website
- legacy `bl_info`
- Python entrypoints: `register()`, `unregister()` and declared operator `bl_idname`
- risk imports and calls such as `subprocess`, `socket`, `urllib`, `requests`, `os.system`, `eval` and `exec`
- execution boundary and manual license-review requirements

Execution captures:

- enabled module list
- invoked operator id and result
- job-scoped runtime profile path
- persisted scene outputs such as `.blend`, `.glb`, `.gltf`, `.usd`, `.usda` or `.usdc`

## Plugin Registry Fields

Blender plugin registry entries must be represented as data, not hardcoded enums:

```json
{
  "id": "bonsai",
  "name": "Bonsai",
  "source": "https://github.com/IfcOpenShell/IfcOpenShell/tree/v0.8.5/src/bonsai",
  "source_type": "extension_directory",
  "license": "GPL-3.0-or-later / upstream review",
  "isolation": "external_process",
  "capabilities": ["ifc_authoring", "ifc_validation", "openbim_editing"],
  "required_blender": "4.x",
  "required_python": "bundled_blender_python",
  "permissions": {
    "files": "required",
    "network": "blocked_by_default"
  },
  "workflow_gate": "professional_review_required",
  "artifact_schema": "architoken.blender_plugin_run.v1"
}
```

Required registry dimensions:

- `source`: official extension portal, GitHub source, private plugin package or internal source path
- `license`: SPDX or explicit upstream license note
- `isolation`: `external_process`, `sidecar_service`, `licensed_service` or `reference_only`
- `capabilities`: render, animation, IFC, USD, geometry, material, texture, simulation, import/export, operator automation
- `permissions`: file, network, subprocess, package install, credentials and GPU usage
- `supported_formats`: source and derivative formats
- `module_scope`: allowed ArchIToken modules
- `approval_policy`: who may approve execution and what evidence is required
- `security_scan`: audit status, risks, hash and SBOM/package evidence

## Module Mapping

| Module                    | Blender use                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `concept_design`          | Concept rooms, material boards, rendered options, Code-as-Room style scene generation            |
| `detailed_design`         | Geometry refinement candidates, IFC/Bonsai authoring, object placement, clash-prep derivatives   |
| `standard_library`        | Family/material/node/template authoring and versioned plugin-assisted asset generation           |
| `construction_management` | 4D visual simulation, method statements, lift/sequence animation and visual evidence             |
| `digital_twin`            | Design-state scene layers, reality-capture comparison layers and render/video derivatives        |
| `digital_archive`         | Long-term archive of source package, plugin audit, run manifest and generated derivatives        |
| `ai_center`               | Model route, prompt route, tool permission, plugin registry, cost/audit and evaluator governance |
| `settings_center`         | Tenant-level plugin allowlist, license policy, GPU/runtime profile and execution budget          |

## Integration Phases

1. **Foundation**: source-build Blender, headless binary smoke, `blender` worker, plugin audit and plugin run worker.
2. **Registry**: add `BlenderPluginRegistry`, plugin allowlist, license status, version constraints and permission policy.
3. **OpenBIM**: wire Bonsai/IfcOpenShell plugin jobs to IFC source truth, IDS checks, bSDD enrichment and BCF issues.
4. **Scene Generation**: wire Code-as-Room and similar Blender-code pipelines behind `ai_center`, then export scene derivatives.
5. **Viewer/Workbench**: expose plugin-run artifacts as CDE files in the unified module workbench, not a standalone Blender page.
6. **Enterprise Runtime**: package a GPU-capable Blender worker image with CUDA/OptiX evidence where NVIDIA hardware is available.

## Completion Criteria

Blender integration is considered production-ready only when all of these are true:

- `architoken-source-build build blender` has real completed evidence for the target worker image or host.
- `architoken-worker --self-check` reports Blender and plugin runtime availability.
- Every enabled plugin has a registry row, license review state, audit manifest and approval rule.
- Plug-in execution happens in an ephemeral worker profile and persists real artifacts to object storage.
- Result artifacts enter Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver before downstream use.
- OpenUSD/USDZ/3D Tiles are attempted before GLB fallback when the target is an engineering/digital-twin asset.
- GPU evidence is real on GPU workers; failed GPU evidence is recorded before CPU fallback.
