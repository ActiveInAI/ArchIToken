# ArchIToken Production Workers

This package defines worker-side adapter contracts for CAD, BIM, Office, PDF, image, video, voice, point-cloud, panorama, GIS and AI generation jobs.

Workers receive a typed job payload, read/write through S3-compatible object storage, subscribe to NATS/Temporal queues, emit OpenTelemetry traces, and return outputs for the Rust API to persist and audit. Workers must not bypass `RuntimeContext`, RBAC, tenant/project isolation, object bindings, or audit policy.

Production execution path:

```bash
python -m architoken_workers.worker_cli --serve --require-all
```

The gateway publishes conversion jobs to `ARCHITOKEN_WORKER_SUBJECT` over NATS. The worker downloads `sourceObjectKey` from S3-compatible storage, executes the configured native adapter, writes artifacts to the job output directory, uploads every returned artifact back to S3-compatible storage, and posts the result to `/internal/conversion-jobs/{job_id}/worker-result` with `ARCHITOKEN_WORKER_RESULT_TOKEN`. In `ARCHITOKEN_PROFILE=production`, artifact upload is mandatory and the gateway rejects completed worker results without persisted artifact metadata.

Install for local contract testing:

```bash
python3 -m pip install -e ./06-workers
python3 -m pytest 06-workers/tests
```

Install production adapters:

```bash
python3 -m pip install -e './06-workers[production,bim,cad,geometry,speckle,document,image,ocr]'
```

Local multimodal generation provider:

```bash
ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER=huggingface \
ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER=huggingface \
ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_URL=http://127.0.0.1:7860/v1/generate/text-to-image \
ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_URL=http://127.0.0.1:7861/v1/generate/image-to-video \
ARCHITOKEN_HF_MODEL_ROUTES='{"chat":"nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4","code":"Multilingual-Multimodal-NLP/IndustrialCoder-Thinking-32B-FP8","ocr":"PaddlePaddle/PaddleOCR-VL-1.5","text_to_image":"baidu/ERNIE-Image","image_to_image":"black-forest-labs/FLUX.2-dev-NVFP4","image_to_video":"Lightricks/LTX-2.3-nvfp4","image_to_3d":"tencent/HY-World-2.0","object_to_3d_asset":"nvidia/asset-harvester","world_3d_research":"nvidia/Lyra-2.0"}' \
python3 06-workers/engine_server.py
```

The local HTTP provider exposes `/v1/generate/text-to-image` and `/v1/generate/image-to-video` for Harness Core `http_multimodal` mode. Hugging Face is the default provider family, but media generation is **local adapter first**: a local Hugging Face model repository is model data, not an executable image/video runtime. Text-to-image and image-to-video are considered configured only when one of these is present:

- `ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_URL` / `HUGGINGFACE_LOCAL_TEXT_TO_IMAGE_URL`
- `ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_URL` / `HUGGINGFACE_LOCAL_IMAGE_TO_VIDEO_URL`
- `ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_COMMAND` / `HUGGINGFACE_LOCAL_TEXT_TO_IMAGE_COMMAND`
- `ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_COMMAND` / `HUGGINGFACE_LOCAL_IMAGE_TO_VIDEO_COMMAND`
- `ARCHITOKEN_HF_LOCAL_MEDIA_URL` or `ARCHITOKEN_HF_LOCAL_MEDIA_COMMAND` for a shared local adapter
- `ARCHITOKEN_HF_REMOTE_ENABLED=1` plus `HF_TOKEN` / `HUGGINGFACE_API_TOKEN` when remote Hugging Face Inference API is explicitly allowed

Local HTTP adapters receive JSON with `taskType`, `capability`, `model`, `modelRepository`, `prompt`, `inputs`, `parameters`, `constraints`, `inputArtifacts`, and `outputFormats`, and must return real image/video bytes or JSON containing `base64`, `contentBase64`, `url`, or `downloadUrl`. Local command adapters receive `--input <request.json> --output <media-file> --task <task> --model <model>` and must write a non-empty media file. If no adapter is configured, the worker returns `adapter_not_configured` instead of a placeholder artifact.

OpenClaw media providers are only used when `ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER=openclaw` or `ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER=openclaw` is set explicitly. Task routing is capability-first: `chat`, `code`, `ocr`, `text_to_image`, `image_to_image`, `image_to_video`, `image_to_3d`, `object_to_3d_asset`, and `world_3d_research` resolve through `ARCHITOKEN_HF_MODEL_ROUTES` first, then task-specific env such as `ARCHITOKEN_HF_CHAT_MODEL`, `ARCHITOKEN_HF_CODE_MODEL`, `ARCHITOKEN_HF_TEXT_TO_IMAGE_MODEL`, `ARCHITOKEN_HF_IMAGE_TO_VIDEO_MODEL`, and matching `*_URL` endpoint env.

The /v1/models endpoint scans data/model-repository/huggingface/<owner>/<model> plus ARCHITOKEN_HF_MODEL_REPOSITORY_DIR and returns every local Hugging Face repository model in both data and models. Unmapped repository models remain visible with inferred task metadata instead of being collapsed into the default chat route.

Optional format adapters are still split into extras so CI and local contract tests do not pretend every native toolchain is present:

Adapter boundary policy:

Capability is the first selection axis. License, authorization, hosting model,
and runtime weight decide isolation, not whether a strong project can be selected.

| Area | Real adapter dependency | Missing behavior |
| --- | --- | --- |
| IFC / openBIM | IfcOpenShell | `blocked` with `adapter_not_configured` |
| IFC geometry derivatives | IfcOpenShell IfcConvert + Cesium ion for 3D Tiles | `blocked` until binary/token/source is configured |
| Text-to-BIM | IfcOpenShell structured BIM spec generator | `blocked` with `adapter_not_configured` |
| DXF | ezdxf | `blocked` with install hint |
| STEP / OCCT kernel | CadQuery OCP / OCCT sidecar | `blocked` with install hint |
| CadQuery Text-to-CAD | CadQuery/OCP | `blocked` with install hint |
| build123d Text-to-CAD | build123d structured spec worker | `blocked` until package and structured `build123dSpec` exist |
| FreeCAD | FreeCADCmd | `blocked` until binary exists |
| Blender | Blender headless binary | `blocked` until binary exists |
| Speckle Server | specklepy + SPECKLE_SERVER_URL + SPECKLE_TOKEN | `blocked` until package/env is configured |
| buildingSMART IFC / IDM / bSDD / BCF / IDS / Validate | IfcOpenShell, structured IDM, bSDD API, BCF parser, ifctester, buildingSMART Validate service/CLI | persisted reports or `blocked` when validation deps are absent |
| CGAL | pygalmesh/CGAL | `blocked` with install hint |
| Cesium ion / 3D Tiles | CESIUM_ION_TOKEN | `blocked` until token/source is configured |
| GIS / PostGIS | GeoJSON parser + GDAL/OGR `ogr2ogr` | `blocked` until source/POSTGIS_DSN/binary exists |
| Point cloud | PDAL metadata + Cesium ion point-cloud tiling | `blocked` until source/binary/token exists |
| ForgeCAD | isolated FORGECAD_URL service or `forgecad` CLI process | `blocked` until service URL or CLI exists; `completed` only with generated artifacts |
| DWG / RVT / SKP | licensed service such as Autodesk APS, approved DWG adapter, or legal SketchUp reader/exporter. SKP->IFC may use `PRENGINE_SKP_TO_IFC_COMMAND`; SKP->GLB preview may use `PRENGINE_SKP_CONVERTER_COMMAND`. | `blocked` until service URL or command is configured; SKP->IFC never falls back to GLB |
| Office preview | LibreOffice headless | `blocked` until binary exists |
| PDF service edits | Stirling-PDF self-hosted API, PDFium, or MuPDF | `blocked` until operation path/service/binary/source exists |
| Document structure | Docling, MinerU CLI, MarkItDown | `blocked` until package/binary/source exists |
| OCR | PaddleOCR | `blocked` until package/source exists |
| Audio/video/image transcode | FFmpeg | `blocked` until binary/source exists |
| Image analysis/derivatives | OpenCV and ImageMagick | `blocked` until package/binary/source exists |
| Gantt / flow / mind map | Mermaid CLI | `blocked` until `mmdc` exists |
| Visual chart analysis | persisted ECharts/Vega-compatible chart spec | input validation failure until a real spec exists |
| Open Design prototypes/exports | isolated OPEN_DESIGN_URL service | `blocked` until service URL exists |
| SiYuan knowledge import | isolated SIYUAN_API_URL service | `blocked` until service/source exists |
| AI image/audio/video/CAD/BIM/document generation | ArchIToken provider-router service or `06-workers/engine_server.py` HTTP media provider | `blocked` until provider-router, Hugging Face, or OpenClaw media provider env is configured |

Workers must return a real derivative or an explicit blocked result. They must not emit synthetic PDF, image, CAD, BIM, Office, media, or AI generation output to make a preview look successful.

Every dispatchable adapter is registered in `architoken_workers.engine_registry` with a runtime isolation mode:

- `in_process_library` for reviewed worker libraries such as Docling, OpenCV, build123d, CadQuery, and IfcOpenShell APIs.
- `external_process` for binaries and desktop runtimes such as ForgeCAD CLI, FreeCADCmd, Blender, FFmpeg, ImageMagick, GDAL/OGR, PDAL, MuPDF, and MinerU.
- `sidecar_service` for Stirling-PDF, Speckle, SiYuan, Open Design, Collabora/Office services, and similar systems.
- `licensed_service` for DWG/RVT/Revit/Tekla/Rhino routes that require official user-provided licenses and credentials.

Worker dispatch fails if a new adapter is added without an isolation policy.
