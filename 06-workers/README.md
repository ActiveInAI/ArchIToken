# ArchIToken Production Workers

This package defines worker-side adapter contracts for CAD, BIM, Office, PDF, image, video, voice, point-cloud, panorama, GIS and AI generation jobs.

Workers receive a typed job payload, read/write through S3-compatible object storage, subscribe to NATS/Temporal queues, emit OpenTelemetry traces, and return outputs for the Rust API to persist and audit. Workers must not bypass `RuntimeContext`, RBAC, tenant/project isolation, object bindings, or audit policy.

Install for local contract testing:

```bash
python3 -m pip install -e ./06-workers
python3 -m pytest 06-workers/tests
```

Install production adapters:

```bash
python3 -m pip install -e './06-workers[production]'
```

Optional format adapters are installed separately so CI and local contract tests do not pretend every native toolchain is present:

```bash
python3 -m pip install -e './06-workers[bim,cad,document,ocr]'
```

Adapter boundary policy:

| Area | Real adapter dependency | Missing behavior |
| --- | --- | --- |
| IFC / openBIM | IfcOpenShell | `blocked` with `adapter_not_configured` |
| DXF | ezdxf | `blocked` with install hint |
| STEP / OCCT kernel | CadQuery OCP / OCCT sidecar | `blocked` with install hint |
| DWG / RVT | licensed service such as Autodesk APS or approved DWG adapter | `blocked` until service URL is configured |
| Office preview | LibreOffice headless | `blocked` until binary exists |
| PDF service edits | Stirling-PDF URL, PDFium, or MuPDF | `blocked` until service/binary exists |
| OCR / document structure | PaddleOCR, MinerU, MarkItDown | `blocked` until Python package exists |
| AI image/audio/video/CAD/BIM/document generation | provider API key or local model base URL | `blocked` until provider env is configured |

Workers must return a real derivative or an explicit blocked result. They must not emit synthetic PDF, image, CAD, BIM, Office, media, or AI generation output to make a preview look successful.
