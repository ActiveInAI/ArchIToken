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

Gateway chat inference registers the configured OpenAI-compatible `hugging_face` engine at startup. Local default config points Harness Core to this worker at `http://127.0.0.1:7071/v1`; the worker then forwards chat to `ARCHITOKEN_HF_LOCAL_CHAT_URL`, `ARCHITOKEN_HF_CHAT_URL`, or `ARCHITOKEN_VLLM_BASE_URL`. If `ARCHITOKEN_ENABLE_CHAT_FALLBACK=1`, unserved Hugging Face chat/code models can explicitly route to Ollama, LM Studio, OpenRouter, or another OpenAI-compatible fallback while preserving requested/served model metadata. Ollama fallback defaults to `ARCHITOKEN_OLLAMA_NUM_CTX=8192` and `ARCHITOKEN_OLLAMA_KEEP_ALIVE=30s` so large GGUF models do not allocate 128K/256K KV cache by accident. See `docs/HUGGINGFACE_MODEL_PROVIDER.md` for the full ArchIToken/Hugging Face provider boundary.

PanAI media providers are only used when `ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER=panai` or `ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER=panai` is set explicitly. Task routing is capability-first: `chat`, `code`, `ocr`, `text_to_image`, `image_to_image`, `image_to_video`, `image_to_3d`, `object_to_3d_asset`, and `world_3d_research` resolve through `ARCHITOKEN_HF_MODEL_ROUTES` first, then task-specific env such as `ARCHITOKEN_HF_CHAT_MODEL`, `ARCHITOKEN_HF_CODE_MODEL`, `ARCHITOKEN_HF_TEXT_TO_IMAGE_MODEL`, `ARCHITOKEN_HF_IMAGE_TO_VIDEO_MODEL`, and matching `*_URL` endpoint env.

The /v1/models endpoint scans data/model-repository/huggingface/<owner>/<model> plus ARCHITOKEN_HF_MODEL_REPOSITORY_DIR and returns every local Hugging Face repository model in both data and models. Unmapped repository models remain visible with inferred task metadata instead of being collapsed into the default chat route.

For the local workstation PanAI setup, `architoken-hf-endpoint.service` runs this provider on `127.0.0.1:7071` and enables Hugging Face cache discovery. `architoken-hf-llama-chat.service` runs a real local llama.cpp chat endpoint on `127.0.0.1:7072` for GGUF chat models:

```bash
systemctl --user enable --now architoken-hf-llama-chat.service
systemctl --user enable --now architoken-hf-endpoint.service
curl http://127.0.0.1:7072/v1/models
curl http://127.0.0.1:7071/v1/models
```

That endpoint is a registry and provider boundary, not permission to pretend every downloaded model is a warm chat model. It exposes cached Hugging Face repositories with task/runtime metadata:

- chat/code models require a real OpenAI-compatible vLLM/TGI/llama.cpp endpoint that advertises the same model id in `/v1/models`, or an explicit `ARCHITOKEN_ENABLE_CHAT_FALLBACK=1` mapping to a local/provider fallback. Fallback responses must expose requested and served model metadata; they are not presented as the original Hugging Face runtime.
- text-to-image can use the local diffusers command adapter when the configured Python environment supports the model.
- image/video/3D/OCR/vision models remain visible through `/v1/models` with their required runtime. Configured media adapters execute from the chat bridge or generation endpoints; unconfigured capabilities return a precise runtime diagnostic.

PanAI sync consumes `http://127.0.0.1:7071/v1/models` and adds every Hugging Face entry exposed by the endpoint. Short UI labels such as `ERNIE-Image`, `LTX-2.3-nvfp4`, or `PaddleOCR-VL-1.5` are canonicalized back to `huggingface/<owner>/<model>` before requests leave the workbench.

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
| Blender add-ons/extensions | `blender_plugin` static audit, then `blender_plugin_run` with `BLENDER_BINARY` and workflow approval | audit returns a manifest without execution; run is `blocked` until `allowPluginExecution=true` and Blender is configured |
| Speckle Server | specklepy + SPECKLE_SERVER_URL + SPECKLE_TOKEN | `blocked` until package/env is configured |
| buildingSMART IFC / IDM / bSDD / BCF / IDS / Validate | IfcOpenShell, structured IDM, bSDD API, BCF parser, ifctester, buildingSMART Validate service/CLI | persisted reports or `blocked` when validation deps are absent |
| CGAL | pygalmesh/CGAL | `blocked` with install hint |
| Cesium ion / 3D Tiles | CESIUM_ION_TOKEN | `blocked` until token/source is configured |
| GIS / PostGIS | GeoJSON parser + GDAL/OGR `ogr2ogr` | `blocked` until source/POSTGIS_DSN/binary exists |
| Point cloud | PDAL metadata + Cesium ion point-cloud tiling | `blocked` until source/binary/token exists |
| ForgeCAD | isolated FORGECAD_URL service or `forgecad` CLI process | `blocked` until service URL or CLI exists; `completed` only with generated artifacts |
| DWG / RVT / SKP | licensed service such as Autodesk APS, approved DWG adapter, or legal SketchUp reader/exporter. SKP uses the `docs/SKETCHUP_SKP_SIDECAR.md` contract: SketchUp Ruby `Model#export`, isolated GPL BIM-Tools IFC Manager for IFC, Yulio glTF exporter for GLB, or Speckle SketchUp sidecar. SKP->IFC may use `PRENGINE_SKP_TO_IFC_COMMAND`; SKP->GLB preview may use `PRENGINE_SKP_CONVERTER_COMMAND`. | `blocked` until service URL or command is configured; SKP->IFC never falls back to GLB |
| Office preview/edit | Office-native structure route with Collabora WOPI, OfficeCLI, LibreOffice, ONLYOFFICE/Univer/Excelize adapters; PDF export is optional layout evidence only | online editing defaults to isolated Collabora Online (`COLLABORA_ONLINE_URL`) through ArchIToken WOPI CheckFileInfo/contents/PutFile save-back; OnlyOffice is an explicit fallback only; browser structure preview remains read-only; OfficeCLI structured generation/preview runs through the `officecli` external-process worker |
| PDF preview/edit | Browser source viewer for default PDF viewing; independent Stirling-PDF Docker sidecar for PDF page operations/conversion/security/signing/redaction/forms/metadata/automation/compression/derivatives; PDFium/MuPDF/licensed adapter fallback for render/low-level needs | PDF semantic extraction is MinerU; scanned-PDF OCR/layout/chinese multilingual recognition is PaddleOCR/PaddleOCR-VL/PP-StructureV3; OCR output is evidence, not edit success; Collabora/OnlyOffice PDF UI is not the PDF editing route; Stirling-PDF operations return real artifacts or `blocked` until service/API path/source exists |
| Document structure | MinerU 3.1.15+ CLI/container, Docling, MarkItDown | MinerU is the primary PDF/Office document-intelligence parser; `blocked` until package/binary/source exists |
| OCR | PaddleOCR / PaddleOCR-VL / PP-StructureV3 | PDF/image OCR, scanned document structure, Chinese/multilingual text recognition and layout extraction; `blocked` until package/source/model runtime exists |
| Audio/video/image transcode | FFmpeg | `blocked` until binary/source exists |
| Image analysis/derivatives | OpenCV and ImageMagick | `blocked` until package/binary/source exists |
| Gantt / flow / mind map | Mermaid CLI | `blocked` until `mmdc` exists |
| Visual chart analysis | persisted ECharts/Vega-compatible chart spec | input validation failure until a real spec exists |
| Open Design prototypes/exports | isolated OPEN_DESIGN_URL service | `blocked` until service URL exists |
| SiYuan knowledge import | isolated SIYUAN_API_URL service | `blocked` until service/source exists |
| AI image/audio/video/CAD/BIM/document generation | ArchIToken provider-router service or `06-workers/engine_server.py` HTTP media provider | `blocked` until provider-router, Hugging Face, or PanAI media provider env is configured |

Workers must return a real derivative or an explicit blocked result. They must not emit synthetic PDF, image, CAD, BIM, Office, media, or AI generation output to make a preview look successful.

Collabora + MinerU local document profile:

```bash
docker compose -f 05-infra/docker/docker-compose.yml --profile office up -d collabora-online
```

For local Office editing, set `ARCHITOKEN_OFFICE_EDITOR_PROVIDER=collabora`, `COLLABORA_ONLINE_URL` to the browser-reachable Collabora URL, `ARCHITOKEN_PUBLIC_BASE_URL` to the browser/Collabora-reachable ArchIToken URL, and `COLLABORA_WOPI_TOKEN_SECRET` to a real secret. The WOPI host exposes `CheckFileInfo`, `contents`, locks, and `PutFile` save-back. MinerU stays in the worker lane for Markdown/JSON/OCR/table/formula extraction; it is not an editor. Without Collabora or another explicitly selected native service, Office editing remains blocked instead of falling back to fake HTML editing. PDF editing is handled separately through the Stirling-PDF sidecar.

Stirling-PDF + PaddleOCR PDF profile:

- Start the isolated PDF service with `docker compose --profile pdf up -d stirling-pdf`, then set `STIRLING_PDF_URL=http://127.0.0.1:8083` for local worker jobs or `http://stirling-pdf:8080` inside compose networks. Pin `STIRLING_PDF_IMAGE_TAG` to the reviewed release; the current local sidecar baseline is `2.11.0`.
- `stirling_pdf` accepts `pdfOperation` for registered PDF operations such as `merge-pdfs`, `split-pages`, `compress-pdf`, `ocr-pdf`, `redact`, `fill`, `pipeline`, and `pdf-to-pdfa`. It also accepts `stirlingOperationPath` for endpoints verified in the deployed `/swagger-ui.html` or `/swagger-ui/index.html`.
- Multi-file PDF operations pass the primary `sourcePath` plus `additionalSourcePaths`; all inputs must be mounted real files.
- PaddleOCR routes use `paddleocr-ocr`, `paddleocr-layout`, or `paddleocr-vl` through the OCR worker lane. `paddleocr-ocr` uses `PaddleOCR`, `paddleocr-layout` uses `PPStructureV3`, and `paddleocr-vl` uses `PaddleOCRVL`; these produce structured evidence for search/review/RuleChecker, not PDF edit success.
- The OCR extra installs both `paddleocr` and `paddlepaddle`. For reproducible local model downloads in CN-friendly environments, set `PADDLE_PDX_MODEL_SOURCE=bos` and `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=true`; otherwise PaddleX may default to Hugging Face and block on model download.
- Frontend local-file integration exposes `GET/POST /api/local-files/:fileId/pdf-operation`. POST accepts `pdfOperation`, `fields`, `additionalFileIds`, `paddleocrOptions`, `saveMode` (`new_file`, `overwrite`, or `artifact_only`) and routes to the same worker contract; completed PDF derivatives can be saved as controlled local files.

OfficeCLI POC job:

```bash
OFFICECLI_BINARY=/path/to/officecli \
python -m architoken_workers.worker_cli \
  --adapter officecli \
  --job 06-workers/examples/officecli-poc-job.json
```

The `officecli` adapter accepts a structured `officecliTask` with allowlisted verbs (`add`, `set`, `remove`) and preview formats (`outline`, `html`, `screenshot`). It returns `blocked` when the OfficeCLI binary is absent and never executes arbitrary shell text.

Every dispatchable adapter is registered in `architoken_workers.engine_registry` with a runtime isolation mode:

- `in_process_library` for reviewed worker libraries such as Docling, OpenCV, build123d, CadQuery, and IfcOpenShell APIs.
- `external_process` for binaries and desktop runtimes such as ForgeCAD CLI, FreeCADCmd, Blender, FFmpeg, ImageMagick, GDAL/OGR, PDAL, MuPDF, and MinerU.
- `sidecar_service` for Stirling-PDF, Speckle, SiYuan, Open Design, Collabora/Office services, and similar systems.
- `licensed_service` for DWG/RVT/Revit/Tekla/Rhino routes that require official user-provided licenses and credentials.

Worker dispatch fails if a new adapter is added without an isolation policy.
