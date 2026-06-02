# ArchIToken AionUi Fork Strategy

**Status**: Active migration decision
**Product name**: ArchIToken
**Legacy repository / codebase name**: ArchIToken
**Upstream**: https://github.com/iOfficeAI/AionUi
**Upstream license**: Apache-2.0

## Decision

ArchIToken may use AionUi as an Apache-2.0 upstream source for the Agent/Office workbench, including source-level modification, feature parity work, packaging changes and redistribution, subject to Apache-2.0 notice, attribution and dependency-license compliance.

ArchIToken must not binary-patch an installed AionUi package and present it as a native ArchIToken implementation. Production distribution must be built from source, with a reproducible build record, SBOM, dependency-license scan and smoke evidence.

## License Boundary

Apache-2.0 allows use, modification, distribution and sublicensing under its stated terms. ArchIToken must:

- Include the Apache-2.0 license text with distributed source and binaries.
- Preserve upstream copyright, patent, attribution and NOTICE material where present.
- Mark files or packages changed by ArchIToken.
- Avoid implying AionUi, iOfficeAI or other upstream trademark endorsement.
- Audit bundled third-party dependencies, icons, models, extensions and assets separately; Apache-2.0 on the top-level project does not automatically relicense every bundled component.

## Product Boundary

ArchIToken is the active user-facing product name. `ArchIToken` remains a historical repository name and migration alias. AionUi is an upstream source and capability seed, not the final product identity.

Required rename surface for a proper source fork:

- `productName`, application name and About dialog: `ArchIToken`.
- Linux desktop entry and package name: `architoken`.
- Window title and startup class: `ArchIToken`.
- App ID / protocol scheme: `ai.architoken.workbench` and `architoken://` unless compatibility requires additional aliases.
- User config and data directory: `ArchIToken`, with migration from `AionUi` only when explicitly requested.
- Icons, splash, docs and release artifacts: ArchIToken-branded assets with upstream attribution retained.

## Feature Parity Target

ArchIToken should fully implement AionUi-equivalent workbench functions only through source-level integration:

- Agent registry and local/remote agent orchestration.
- Office/document generation and editing workflows.
- MCP/server extension handling.
- Provider and assistant configuration.
- Conversation/workspace state, logs and local data.
- Built-in guide, extension and skill surfaces.

Feature parity does not waive ArchIToken governance. AI calls still route through ArchIToken Router / ModelRouter / InferenceRouter / ToolRouter / WorkflowRouter boundaries when integrated into the main platform.

## Implementation Phases

1. Source import: fork or mirror AionUi at a pinned tag/commit, record license and build evidence.
2. Branding fork: rename package/app/window/config/protocol surfaces to ArchIToken while preserving attribution.
3. Dependency audit: produce SBOM and license scan for Electron, bundled services, extensions and assets.
4. Workbench integration: expose AionUi-derived capabilities through ArchIToken worker/sidecar or desktop-service boundary.
5. Feature parity tests: verify agent, office, MCP, provider, conversation and local-data workflows.
6. Platform governance: connect ArchIToken Router, audit, approval and schema gates before marking production-ready.

## Non-Goals

- Do not remove upstream license or attribution.
- Do not imply AionUi or iOfficeAI endorsement.
- Do not mix unreviewed GPL/AGPL/SSPL/BUSL dependencies into distributed runtime.
- Do not bypass ArchIToken professional compliance, audit, Router or approval boundaries.
