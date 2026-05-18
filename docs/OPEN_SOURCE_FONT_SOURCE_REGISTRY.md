# Open Source Font Source Registry

This document records font sources that are allowed for candidate discovery in ArchIToken. It is not a blanket approval to bundle every font from those sources.

## Boundary Rules

1. Catalogs and organizations are discovery sources only. A specific font family must be reviewed before runtime inclusion.
2. Runtime inclusion requires an exact source URL, release/tag or commit SHA, selected font files, copied license text, and a short notice file.
3. Fonts under OFL may have Reserved Font Names. If a font is modified, subsetted, converted, or rebuilt, the resulting name and license handling must be reviewed before distribution.
4. GPL/AGPL/SSPL/BUSL fonts are not allowed in distributed runtime without explicit isolation and license review.
5. System commercial fonts such as Microsoft YaHei are not open-source runtime candidates.

## Approved Discovery Sources

| Source | Link | Scope | Boundary |
|---|---|---|---|
| Google Fonts | https://fonts.google.com/ | Catalog discovery | Review each family license before use. |
| Google Fonts GitHub org | https://github.com/googlefonts | Organization discovery | Organization membership is not a license approval. Review each repository. |
| google/fonts | https://github.com/google/fonts | Repository catalog | Read the target family directory license and metadata before use. |
| Fontsource | https://github.com/fontsource/fontsource | Package catalog | Read the exact `@fontsource/*` package README/license before use. |
| Noto distribution | https://github.com/notofonts/notofonts.github.io | Distribution catalog | Use for Noto discovery and QA context; verify target font repo/release. |

## Runtime Candidates Requiring Final Selection

| Font Source | Link | Candidate Use | Required Before Inclusion |
|---|---|---|---|
| Noto CJK | https://github.com/notofonts/noto-cjk | Main CJK UI fallback and document rendering | Pick Sans/Serif, SC/TC/HK/JP/KR, exact release, files, and license. |
| Microsoft Selawik | https://github.com/microsoft/Selawik | Latin UI fallback similar to Segoe UI | Pick release/files and include OFL notice. |
| Microsoft Cascadia Code | https://github.com/microsoft/cascadia-code | Code, logs, IDs, and engineering text | Pick Code/Mono/PL/NF variant, release/files, and license. |

## Current Runtime Fonts

| Font | Status | Notes |
|---|---|---|
| System sans stack | Default | No bundled external font. |
| HarmonyOS Sans SC | Optional bundled font | Bundled from the existing local `harmonyos-sans` package with its license notice. |
