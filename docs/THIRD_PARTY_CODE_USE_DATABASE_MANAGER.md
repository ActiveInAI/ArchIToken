# ArchIToken Database Manager Third-Party Code Use

Snapshot: 2026-06-08.

This record documents the upstream code now used in the ArchIToken database
operations workbench. The code is adapted into the ArchIToken Apache-2.0 core
instead of vendoring full upstream applications.

## Integrated Apache-2.0 Sources

| Upstream   | Version / commit                                            | Upstream files used                                                                                                                                                                                                                                                                                                                                                                  | ArchIToken target                                                                                                               |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Headlamp   | `00a0316e00519cfd4cc66b989a227f4838cdce06`                  | `frontend/src/components/common/Resource/ResourceTable.tsx`, `frontend/src/components/common/Resource/DetailsDrawer.tsx`, `frontend/src/components/common/Resource/ResourceTableMultiActions.tsx`, `frontend/src/components/common/NameValueTable/NameValueTable.tsx`, `frontend/src/components/common/ActionButton/ActionButton.tsx`, `frontend/src/components/Sidebar/Sidebar.tsx` | `03-frontend/components/database-manager/UpstreamResourceConsole.tsx`, `03-frontend/components/SettingsCenterDatabasePanel.tsx` |
| KubeSphere | `v3.4.1`, commit `3e0493a1c5e1c4413a7b77e8b408d428220ed929` | `pkg/api/types.go`, `pkg/apiserver/query/types.go`                                                                                                                                                                                                                                                                                                                                   | `03-frontend/components/database-manager/UpstreamResourceConsole.tsx`                                                           |

## What Was Reused

- Headlamp resource-table shape: generic resource rows, columns with renderers,
  selected rows, row actions and operation columns.
- Headlamp resource-console layout: resource sidebar, central workbench and
  right-side details drawer.
- Headlamp multi-action boundary: operations are grouped by selected resource
  and destructive actions stay gated.
- Headlamp action-button shape: a single action primitive with short
  description, optional long description and icon.
- Headlamp name/value table shape: definition-list style resource detail rows.
- KubeSphere `ListResult` shape: `items` plus `totalItems`.
- KubeSphere query shape: `page`, `limit`, `offset`, `sortBy` and `ascending`
  resource-list state.

## License Boundary

Both integrated source lines above are Apache-2.0 for the reviewed versions.

KubeSphere current 4.x code is not merged into the ArchIToken Apache-2.0 core in
this change. KubeSphere 4.x can be evaluated only as an external reference or
isolated integration until license review approves a specific distribution
boundary. The current KubeSphere `master` license text contains additional
conditions for 4.x and later, while v3.4.1 remains the reviewed Apache-2.0
source boundary.

## Current In-Repo Use

`SettingsCenterDatabasePanel` now renders database runtime resources as a
three-pane resource console: left resource navigation, central
resource/schema/CRUD workbench and right-side details drawer. PostgreSQL-backed
resources embed the real table CRUD manager in the current page; schema catalog
rows switch into the embedded CRUD workbench instead of opening a decorative
detail card. Non-PostgreSQL rows expose connection, probe, event and audit
evidence, while destructive operations stay disabled pending policy review.

## Source Links

- Headlamp: <https://github.com/headlamp-k8s/headlamp>
- Headlamp License: <https://github.com/headlamp-k8s/headlamp/blob/main/LICENSE>
- KubeSphere v3.4.1: <https://github.com/kubesphere/kubesphere/tree/v3.4.1>
- KubeSphere v3.4.1 License: <https://github.com/kubesphere/kubesphere/blob/v3.4.1/LICENSE>
