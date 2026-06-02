// lib/cad-derivative-server.ts - Native CAD derivative runtime for local uploads
// License: Apache-2.0

import { constants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, parse, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import type {
  LocalFileMetadata,
  LocalFileRuntimeArtifact,
  LocalFileRuntimeFailureEvidence,
} from "./local-file-runtime";

export type CadDerivativeFormat = "dxf" | "pdf" | "svg" | "manifest";
export type CadDerivativeViewer =
  | "mlightcad_browser"
  | "cad_vector_entities"
  | "cad_vector_svg"
  | "cad_vector_pdf"
  | "dwg_vector_pdf";
export type CadDerivativeAdapterStatus =
  | "available"
  | "missing"
  | "blocked_by_policy";

export interface CadDerivativeSheet {
  id: string;
  name: string;
  url: string;
}

export interface CadDerivativeAdapterProbe {
  id: string;
  label: string;
  priority: number;
  status: CadDerivativeAdapterStatus;
  licenseBoundary:
    | "isolated_sidecar"
    | "external_licensed_adapter"
    | "browser_gpl_wasm"
    | "browser_source_parser";
  sourceUrl: string;
  installHint: string;
  executablePath?: string;
}

export interface CadDerivativeArtifact {
  kind:
    | "source-dxf"
    | "source-dwg"
    | "dxf-vector-svg"
    | "dxf-vector-pdf"
    | "dwg-dxf"
    | "dwg-vector-pdf";
  url: string;
  mediaType: string;
  engine: string;
  etag: string;
  cacheHit: boolean;
  cacheKey: string;
  size?: number;
  checksum: string;
}

export interface CadDerivativeManifest {
  schema: "architoken.cad_derivative_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: string;
  sourceChecksum: string;
  sourceOfRecord: {
    url: string;
    checksum: string;
    rangeRequests: true;
    substitutePreview: false;
  };
  etag: string;
  cachePolicy: "stream+etag+checksum";
  cacheKey: string;
  viewer: CadDerivativeViewer;
  engine: string;
  derivativeArtifact: CadDerivativeArtifact;
  artifacts: LocalFileRuntimeArtifact[];
  failureEvidence: LocalFileRuntimeFailureEvidence[];
  adapters: CadDerivativeAdapterProbe[];
  permissions: {
    canView: boolean;
    canEditSource: boolean;
    canWriteDerivative: boolean;
    requiresLicensedAdapter: boolean;
  };
  sheets: CadDerivativeSheet[];
  notes: string[];
}

export interface CadDerivativeBytes {
  bytes: Buffer;
  mediaType: string;
  fileName: string;
  engine: string;
  etag: string;
  cacheHit: boolean;
}

export class CadDerivativeError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "CadDerivativeError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ProcessResult {
  stdout: Buffer;
  stderr: Buffer;
}

interface DwgPdfDerivative {
  engine: string;
  cacheHit: boolean;
  size?: number;
  sheets: Array<{
    id: string;
    name: string;
    path: string;
  }>;
}

interface ConverterDefinition {
  id: string;
  label: string;
  priority: number;
  candidates: Array<string | undefined>;
  licenseBoundary: CadDerivativeAdapterProbe["licenseBoundary"];
  sourceUrl: string;
  installHint: string;
  policyEnabled?: boolean;
  runtimeAvailable?: boolean;
}

const dwgPdfTimeoutMs = 180_000;
const dwgDxfTimeoutMs = 120_000;
const dxfSvgTimeoutMs = 60_000;

export async function probeCadDerivativeAdapters(): Promise<
  CadDerivativeAdapterProbe[]
> {
  const definitions = cadAdapterDefinitions();
  const probes = await Promise.all(
    definitions.map(async (definition) => {
      const executablePath = await resolveExecutable(definition.candidates);
      const status = adapterStatus(definition, executablePath);
      const base = {
        id: definition.id,
        label: definition.label,
        priority: definition.priority,
        status,
        licenseBoundary: definition.licenseBoundary,
        sourceUrl: definition.sourceUrl,
        installHint: definition.installHint,
      };
      return executablePath ? { ...base, executablePath } : base;
    }),
  );
  return probes.sort((left, right) => left.priority - right.priority);
}

export async function buildCadDerivativeManifest(
  fileId: string,
): Promise<CadDerivativeManifest> {
  const metadata = await requireLocalCadMetadata(fileId);
  const ext = metadata.ext.toLowerCase();
  const adapters = await probeCadDerivativeAdapters();
  const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  const cacheKey = derivativeCacheKey(metadata, "source");

  if (ext === ".dxf") {
    return await buildMlightCadSourceManifest(metadata, adapters, {
      artifactKind: "source-dxf",
      mediaType: "application/dxf",
      sourceFormat: "dxf",
      sourceUrl,
      cacheKey,
      requiresLicensedAdapter: false,
      notes: [
        "DXF is opened directly by @mlightcad/cad-simple-viewer with the MLightCAD data-model worker.",
        "The old dxf-parser SVG/entity replay path is retired; PDF/SVG derivatives are explicit diagnostics only.",
      ],
    });
  }

  if (ext === ".dwg") {
    return await buildMlightCadSourceManifest(metadata, adapters, {
      artifactKind: "source-dwg",
      mediaType: metadata.mimeType || "application/acad",
      sourceFormat: "dwg",
      sourceUrl,
      cacheKey,
      requiresLicensedAdapter: true,
      notes: [
        "DWG is opened directly by @mlightcad/cad-simple-viewer through its LibreDWG WASM worker.",
        "@mlightcad/libredwg-web is GPL-3.0 and must stay behind the recorded browser/WASM adapter boundary before production distribution approval.",
        "The old default DWG-to-DXF and automatic vector-PDF fallback path is retired; sidecars remain diagnostic/export adapters only.",
      ],
    });
  }

  throw new CadDerivativeError(
    415,
    "unsupported_cad_derivative_format",
    `Unsupported CAD derivative format: ${ext || metadata.mimeType}`,
    { extension: ext, mimeType: metadata.mimeType },
  );
}

async function buildMlightCadSourceManifest(
  metadata: LocalFileMetadata,
  adapters: CadDerivativeAdapterProbe[],
  options: {
    artifactKind: "source-dxf" | "source-dwg";
    mediaType: string;
    sourceFormat: "dxf" | "dwg";
    sourceUrl: string;
    cacheKey: string;
    requiresLicensedAdapter: boolean;
    notes: string[];
  },
): Promise<CadDerivativeManifest> {
  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const sourceStat = await stat(sourcePath);
  const etag = cadDerivativeEtag(metadata, options.artifactKind);
  const artifact: LocalFileRuntimeArtifact = {
    name: metadata.originalName,
    role: "cad_source_runtime",
    mediaType: options.mediaType,
    size: sourceStat.size,
    checksum: metadata.checksum,
    url: options.sourceUrl,
    engine: "original-source+@mlightcad/cad-simple-viewer",
  };
  return {
    schema: "architoken.cad_derivative_manifest.v1",
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    sourceFormat: options.sourceFormat,
    sourceChecksum: metadata.checksum,
    sourceOfRecord: {
      url: options.sourceUrl,
      checksum: metadata.checksum,
      rangeRequests: true,
      substitutePreview: false,
    },
    etag,
    cachePolicy: "stream+etag+checksum",
    cacheKey: options.cacheKey,
    viewer: "mlightcad_browser",
    engine: "@mlightcad/cad-simple-viewer",
    derivativeArtifact: {
      kind: options.artifactKind,
      url: options.sourceUrl,
      mediaType: options.mediaType,
      engine: "original-source+@mlightcad/cad-simple-viewer",
      etag,
      cacheHit: false,
      cacheKey: options.cacheKey,
      size: sourceStat.size,
      checksum: metadata.checksum,
    },
    artifacts: [artifact],
    failureEvidence: [],
    adapters,
    permissions: {
      canView: true,
      canEditSource: false,
      canWriteDerivative: false,
      requiresLicensedAdapter: options.requiresLicensedAdapter,
    },
    sheets: [
      {
        id: "model-space",
        name: "Model Space",
        url: options.sourceUrl,
      },
    ],
    notes: [
      ...options.notes,
      "The uploaded CAD source bytes remain the CDE source of record; substitute previews are not treated as source.",
    ],
  };
}

function cadAdapterDefinitions(): ConverterDefinition[] {
  return [
    {
      id: "mlightcad-cad-simple-viewer",
      label: "MLightCAD cad-simple-viewer",
      priority: 1,
      candidates: [],
      licenseBoundary: "browser_source_parser",
      sourceUrl: "https://github.com/mlightcad/cad-viewer",
      installHint:
        "Use @mlightcad/cad-simple-viewer as the browser DXF/DWG runtime; worker assets are served by /api/mlightcad/assets.",
      runtimeAvailable: true,
    },
    {
      id: "mlightcad-libredwg-web",
      label: "MLightCAD LibreDWG WASM parser",
      priority: 2,
      candidates: [],
      licenseBoundary: "browser_gpl_wasm",
      sourceUrl: "https://github.com/mlightcad/libredwg-web",
      installHint:
        "Transitive GPL-3.0 DWG WASM parser used by MLightCAD; keep the license/isolation review attached to DWG distribution.",
      runtimeAvailable: true,
    },
    {
      id: "oda-file-converter",
      label: "ODA File Converter",
      priority: 10,
      candidates: [
        process.env.ODA_FILE_CONVERTER_PATH,
        "/usr/bin/ODAFileConverter",
        "/usr/local/bin/ODAFileConverter",
        "ODAFileConverter",
      ],
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: "https://www.opendesign.com/guestfiles/oda_file_converter",
      installHint:
        "Install ODA File Converter in an isolated licensed sidecar and set ODA_FILE_CONVERTER_PATH.",
    },
    {
      id: "libredwg-dwg2dxf",
      label: "LibreDWG dwg2dxf",
      priority: 20,
      candidates: [
        toolFromDir(process.env.ARCHITOKEN_LIBREDWG_BIN, "dwg2dxf"),
        toolFromDir(process.env.LIBREDWG_BIN_DIR, "dwg2dxf"),
        "/tmp/architoken-libredwg/bin/dwg2dxf",
        "/usr/local/bin/dwg2dxf",
        "/usr/bin/dwg2dxf",
        "dwg2dxf",
      ],
      licenseBoundary: "isolated_sidecar",
      sourceUrl: "https://github.com/LibreDWG/libredwg",
      installHint:
        "Build LibreDWG from source as an isolated GPL sidecar and set ARCHITOKEN_LIBREDWG_BIN or LIBREDWG_BIN_DIR.",
    },
    {
      id: "libredwg-dwgread",
      label: "LibreDWG dwgread",
      priority: 30,
      candidates: [
        toolFromDir(process.env.ARCHITOKEN_LIBREDWG_BIN, "dwgread"),
        toolFromDir(process.env.LIBREDWG_BIN_DIR, "dwgread"),
        "/tmp/architoken-libredwg/bin/dwgread",
        "/usr/local/bin/dwgread",
        "/usr/bin/dwgread",
        "dwgread",
      ],
      licenseBoundary: "isolated_sidecar",
      sourceUrl: "https://github.com/LibreDWG/libredwg",
      installHint:
        "Build LibreDWG from source as an isolated GPL sidecar; use dwgread -O DXF for stdout derivatives.",
    },
    {
      id: "freecad-headless",
      label: "FreeCAD / FreeCADCmd",
      priority: 40,
      candidates: [
        process.env.FREECADCMD_PATH,
        process.env.FREECAD_PATH,
        "/usr/bin/FreeCADCmd",
        "/usr/local/bin/FreeCADCmd",
        "/snap/bin/freecad",
        "FreeCADCmd",
        "freecadcmd",
        "freecad",
      ],
      licenseBoundary: "isolated_sidecar",
      sourceUrl: "https://github.com/FreeCAD/FreeCAD",
      installHint:
        "Build FreeCAD from source or install FreeCADCmd as a headless sidecar for DWG/DXF handoff and OCCT exchange conversions.",
    },
    {
      id: "librecad-dxf2pdf",
      label: "LibreCAD dxf2pdf",
      priority: 50,
      candidates: [
        process.env.LIBRECAD_PATH,
        "/usr/bin/librecad",
        "/usr/local/bin/librecad",
        "librecad",
      ],
      licenseBoundary: "isolated_sidecar",
      sourceUrl: "https://github.com/LibreCAD/LibreCAD",
      installHint:
        "Install LibreCAD in an isolated sidecar for faithful DXF vector PDF viewing; run headless with QT_QPA_PLATFORM=offscreen.",
    },
    {
      id: "ddc-dwgexporter-vector-pdf",
      label: "DDC DwgExporter vector PDF",
      priority: 90,
      candidates: [
        process.env.DDC_DWG_EXPORTER_PATH,
        "/usr/bin/DwgExporter",
        "DwgExporter",
      ],
      licenseBoundary: "external_licensed_adapter",
      sourceUrl:
        "https://github.com/datadrivenconstruction/cad2data-Revit-IFC-DWG-DGN",
      installHint:
        "Use as a controlled licensed vector-PDF fallback when DWG entity derivatives are unavailable; it must not replace DWG entity editing.",
      policyEnabled: shouldAttemptDwgVectorPdfFallback(),
    },
  ];
}

function shouldAttemptDwgVectorPdfFallback(): boolean {
  if (process.env.ARCHITOKEN_DISABLE_DWG_VECTOR_PDF_FALLBACK === "1") {
    return false;
  }
  return process.env.ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK === "1";
}

function adapterStatus(
  definition: ConverterDefinition,
  executablePath: string | null,
): CadDerivativeAdapterStatus {
  if (definition.runtimeAvailable) {
    return "available";
  }
  if (!executablePath) {
    return "missing";
  }
  if (definition.policyEnabled === false) {
    return "blocked_by_policy";
  }
  return "available";
}

function dwgToDxfConverterCandidates(): Array<string | undefined> {
  return [
    process.env.DWG_TO_DXF_PATH,
    ...cadAdapterDefinitions()
      .filter((definition) =>
        ["oda-file-converter", "libredwg-dwg2dxf", "libredwg-dwgread"].includes(
          definition.id,
        ),
      )
      .flatMap((definition) => definition.candidates),
  ];
}

export async function readCadDerivativeBytes(
  fileId: string,
  format: CadDerivativeFormat,
  sheetId?: string | null,
): Promise<CadDerivativeBytes> {
  const metadata = await requireLocalCadMetadata(fileId);
  const ext = metadata.ext.toLowerCase();

  if (ext === ".dxf" && format === "dxf") {
    return {
      bytes: await readFile(resolveLocalUploadStoragePath(metadata)),
      mediaType: "application/dxf",
      fileName: metadata.originalName,
      engine: "original-dxf",
      etag: cadDerivativeEtag(metadata, "source-dxf"),
      cacheHit: false,
    };
  }

  if (ext === ".dxf" && format === "pdf") {
    const derivative = await ensureDxfPdfDerivative(metadata);
    const sheet = selectSheet(derivative.sheets, sheetId);
    return {
      bytes: await readFile(sheet.path),
      mediaType: "application/pdf",
      fileName: `${safeDerivativeStem(metadata)}-${sheet.id}.pdf`,
      engine: derivative.engine,
      etag: cadDerivativeEtag(metadata, `dxf-vector-pdf-${sheet.id}`),
      cacheHit: derivative.cacheHit,
    };
  }

  if (ext === ".dxf" && format === "svg") {
    const derivative = await ensureDxfSvgDerivative(metadata);
    const sheet = selectSheet(derivative.sheets, sheetId);
    return {
      bytes: await readFile(sheet.path),
      mediaType: "image/svg+xml",
      fileName: `${safeDerivativeStem(metadata)}-${sheet.id}.svg`,
      engine: derivative.engine,
      etag: cadDerivativeEtag(metadata, `dxf-vector-svg-${sheet.id}`),
      cacheHit: derivative.cacheHit,
    };
  }

  if (ext === ".dwg" && format === "pdf") {
    if (!shouldAttemptDwgVectorPdfFallback()) {
      throw new CadDerivativeError(
        409,
        "dwg_pdf_fallback_disabled",
        "DWG PDF fallback is disabled. DWG files must be viewed through a real DWG-to-DXF CAD derivative unless ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK=1 is set for an explicit diagnostic path.",
        { fileId: metadata.fileId },
      );
    }
    const derivative = await ensureDwgPdfDerivative(metadata);
    const sheet = selectSheet(derivative.sheets, sheetId);
    return {
      bytes: await readFile(sheet.path),
      mediaType: "application/pdf",
      fileName: `${safeDerivativeStem(metadata)}-${sheet.id}.pdf`,
      engine: derivative.engine,
      etag: cadDerivativeEtag(metadata, `dwg-vector-pdf-${sheet.id}`),
      cacheHit: derivative.cacheHit,
    };
  }

  if (ext === ".dwg" && format === "dxf") {
    return await readDwgDxfDerivative(metadata);
  }

  throw new CadDerivativeError(
    415,
    "unsupported_cad_derivative_request",
    `Cannot serve ${format} derivative for ${ext}`,
    { extension: ext, requestedFormat: format },
  );
}

async function requireLocalCadMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new CadDerivativeError(404, "file_not_found", "file not found", {
      fileId,
    });
  }
  return metadata;
}

async function ensureDxfPdfDerivative(
  metadata: LocalFileMetadata,
): Promise<DwgPdfDerivative> {
  const derivativeDir = dwgDerivativeDir(metadata, "pdf");
  const outputPdf = join(derivativeDir, `${safeDerivativeStem(metadata)}.pdf`);
  try {
    await access(outputPdf, constants.R_OK);
    const pdfStat = await stat(outputPdf);
    return {
      engine: "cached-dxf-vector-pdf",
      cacheHit: true,
      size: pdfStat.size,
      sheets: [
        {
          id: "model-space",
          name: "Model Space",
          path: outputPdf,
        },
      ],
    };
  } catch {
    // Continue to converter discovery.
  }

  const converter = await resolveExecutable([
    process.env.LIBRECAD_PATH,
    "/usr/bin/librecad",
    "/usr/local/bin/librecad",
    "librecad",
  ]);
  if (!converter) {
    throw new CadDerivativeError(
      501,
      "dxf_pdf_converter_missing",
      "No DXF vector PDF converter was found. Install LibreCAD or configure LIBRECAD_PATH.",
      {
        checked: [
          "LIBRECAD_PATH",
          "/usr/bin/librecad",
          "/usr/local/bin/librecad",
          "librecad",
        ],
      },
    );
  }

  await mkdir(derivativeDir, { recursive: true });
  const inputDxf = join(derivativeDir, `${safeDerivativeStem(metadata)}.dxf`);
  await copyFile(resolveLocalUploadStoragePath(metadata), inputDxf);
  await runProcess(
    converter,
    ["dxf2pdf", "-a", "-c", "-m", "-p", "420x297", inputDxf],
    derivativeDir,
    dwgPdfTimeoutMs,
    { QT_QPA_PLATFORM: process.env.QT_QPA_PLATFORM || "offscreen" },
  );

  const generatedPdf = await firstReadableFile([
    outputPdf,
    ...(await listDerivativeFiles(derivativeDir, ".pdf")),
  ]);
  if (!generatedPdf) {
    throw new CadDerivativeError(
      502,
      "dxf_pdf_derivative_missing",
      "LibreCAD finished but did not produce a DXF vector PDF.",
      { derivativeDir },
    );
  }
  if (generatedPdf !== outputPdf) {
    await copyFile(generatedPdf, outputPdf);
  }
  await access(outputPdf, constants.R_OK);
  const pdfStat = await stat(outputPdf);
  return {
    engine: basename(converter),
    cacheHit: false,
    size: pdfStat.size,
    sheets: [
      {
        id: "model-space",
        name: "Model Space",
        path: outputPdf,
      },
    ],
  };
}

async function ensureDxfSvgDerivative(
  metadata: LocalFileMetadata,
): Promise<DwgPdfDerivative> {
  const derivativeDir = dwgDerivativeDir(metadata, "svg");
  const outputSvg = join(derivativeDir, `${safeDerivativeStem(metadata)}.svg`);
  try {
    await access(outputSvg, constants.R_OK);
    const svgStat = await stat(outputSvg);
    return {
      engine: "cached-dxf-vector-svg",
      cacheHit: true,
      size: svgStat.size,
      sheets: [
        {
          id: "model-space",
          name: "Model Space",
          path: outputSvg,
        },
      ],
    };
  } catch {
    // Continue to converter discovery.
  }

  const converter = await resolveExecutable([
    process.env.PDFTOCAIRO_PATH,
    "/usr/bin/pdftocairo",
    "/usr/local/bin/pdftocairo",
    "pdftocairo",
  ]);
  if (!converter) {
    throw new CadDerivativeError(
      501,
      "dxf_svg_converter_missing",
      "No PDF-to-SVG converter was found. Install poppler-utils or configure PDFTOCAIRO_PATH.",
      {
        checked: [
          "PDFTOCAIRO_PATH",
          "/usr/bin/pdftocairo",
          "/usr/local/bin/pdftocairo",
          "pdftocairo",
        ],
      },
    );
  }

  await mkdir(derivativeDir, { recursive: true });
  const pdfDerivative = await ensureDxfPdfDerivative(metadata);
  const sheet = selectSheet(pdfDerivative.sheets, "model-space");
  await runProcess(
    converter,
    ["-svg", sheet.path, outputSvg],
    derivativeDir,
    dxfSvgTimeoutMs,
  );
  await access(outputSvg, constants.R_OK);
  const svgStat = await stat(outputSvg);
  return {
    engine: `${pdfDerivative.engine}+${basename(converter)}`,
    cacheHit: pdfDerivative.cacheHit,
    size: svgStat.size,
    sheets: [
      {
        id: "model-space",
        name: "Model Space",
        path: outputSvg,
      },
    ],
  };
}

async function ensureDwgPdfDerivative(
  metadata: LocalFileMetadata,
): Promise<DwgPdfDerivative> {
  const derivativeDir = dwgDerivativeDir(metadata, "pdf");
  const outputStem = `${metadata.fileId}-dwg`;
  const sheetDir = join(derivativeDir, `SHEETS_PDF_${outputStem}`);
  const cachedSheets = await listPdfSheets(sheetDir);
  if (cachedSheets.length > 0) {
    return { engine: "ddc-dwgexporter", cacheHit: true, sheets: cachedSheets };
  }

  const exporter = await resolveExecutable([
    process.env.DDC_DWG_EXPORTER_PATH,
    "/usr/bin/DwgExporter",
    "DwgExporter",
  ]);
  if (!exporter) {
    throw new CadDerivativeError(
      501,
      "dwg_native_exporter_missing",
      "No native DWG exporter was found. Install DDC DWG Community, ODAFileConverter, or LibreDWG on the server.",
      {
        checked: [
          "DDC_DWG_EXPORTER_PATH",
          "/usr/bin/DwgExporter",
          "DwgExporter",
        ],
      },
    );
  }

  await mkdir(derivativeDir, { recursive: true });
  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const outputXlsx = join(derivativeDir, `${outputStem}.xlsx`);
  await runProcess(
    exporter,
    [sourcePath, outputXlsx, "sheets2pdf"],
    derivativeDir,
    dwgPdfTimeoutMs,
  );

  const sheets = await listPdfSheets(sheetDir);
  if (sheets.length === 0) {
    throw new CadDerivativeError(
      502,
      "dwg_pdf_derivative_missing",
      "The native DWG exporter finished but did not produce PDF sheets.",
      { exporter, sheetDir },
    );
  }

  return { engine: "ddc-dwgexporter", cacheHit: false, sheets };
}

async function readDwgDxfDerivative(
  metadata: LocalFileMetadata,
): Promise<CadDerivativeBytes> {
  const derivativeDir = dwgDerivativeDir(metadata, "dxf");
  const outputDxf = join(derivativeDir, `${metadata.fileId}.dxf`);
  try {
    await access(outputDxf, constants.R_OK);
    return {
      bytes: await readFile(outputDxf),
      mediaType: "application/dxf",
      fileName: `${safeDerivativeStem(metadata)}.dxf`,
      engine: "cached-dwg-dxf",
      etag: cadDerivativeEtag(metadata, "dwg-dxf"),
      cacheHit: true,
    };
  } catch {
    // Continue to converter discovery.
  }

  const sharedDxf = await findSharedDwgDxfDerivative(metadata);
  if (sharedDxf) {
    await mkdir(derivativeDir, { recursive: true });
    await copyFile(sharedDxf, outputDxf);
    return {
      bytes: await readFile(outputDxf),
      mediaType: "application/dxf",
      fileName: `${safeDerivativeStem(metadata)}.dxf`,
      engine: "shared-cached-dwg-dxf",
      etag: cadDerivativeEtag(metadata, "dwg-dxf"),
      cacheHit: true,
    };
  }

  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const converter = await resolveExecutable(dwgToDxfConverterCandidates());
  if (!converter) {
    throw new CadDerivativeError(
      501,
      "dwg_dxf_converter_missing",
      "No DWG to DXF converter was found. Install LibreDWG dwg2dxf/dwgread, ODAFileConverter, or configure DWG_TO_DXF_PATH / ODA_FILE_CONVERTER_PATH.",
      {
        checked: [
          "DWG_TO_DXF_PATH",
          "ODA_FILE_CONVERTER_PATH",
          "/usr/bin/ODAFileConverter",
          "ODAFileConverter",
          "ARCHITOKEN_LIBREDWG_BIN/dwg2dxf",
          "LIBREDWG_BIN_DIR/dwg2dxf",
          "/tmp/architoken-libredwg/bin/dwg2dxf",
          "/usr/local/bin/dwg2dxf",
          "/usr/bin/dwg2dxf",
          "dwg2dxf",
          "ARCHITOKEN_LIBREDWG_BIN/dwgread",
          "LIBREDWG_BIN_DIR/dwgread",
          "/tmp/architoken-libredwg/bin/dwgread",
          "/usr/local/bin/dwgread",
          "/usr/bin/dwgread",
          "dwgread",
        ],
      },
    );
  }

  await mkdir(derivativeDir, { recursive: true });
  const converterName = basename(converter).toLowerCase();
  if (converterName.includes("odafileconverter")) {
    await runOdaFileConverter(converter, metadata, derivativeDir, outputDxf);
  } else if (converterName.includes("dwgread")) {
    const result = await runProcess(
      converter,
      ["-O", "DXF", sourcePath],
      derivativeDir,
      dwgDxfTimeoutMs,
    );
    if (!looksLikeDxf(result.stdout)) {
      throw new CadDerivativeError(
        502,
        "dwgread_dxf_output_invalid",
        "dwgread finished but did not return DXF text on stdout.",
      );
    }
    await writeFile(outputDxf, result.stdout);
  } else {
    await runProcess(
      converter,
      ["-o", outputDxf, sourcePath],
      derivativeDir,
      dwgDxfTimeoutMs,
    );
  }

  await access(outputDxf, constants.R_OK);
  return {
    bytes: await readFile(outputDxf),
    mediaType: "application/dxf",
    fileName: `${safeDerivativeStem(metadata)}.dxf`,
    engine: basename(converter),
    etag: cadDerivativeEtag(metadata, "dwg-dxf"),
    cacheHit: false,
  };
}

async function findSharedDwgDxfDerivative(
  metadata: LocalFileMetadata,
): Promise<string | null> {
  const derivativeRoot = join(getLocalUploadsDir(), "derivatives");
  const checksumPrefix = metadata.checksum.slice(0, 16);
  let entries;
  try {
    entries = await readdir(derivativeRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === metadata.fileId) continue;
    const dxfDir = join(derivativeRoot, entry.name, checksumPrefix, "dxf");
    const candidates = await listDerivativeFiles(dxfDir, ".dxf");
    const exact = join(dxfDir, `${entry.name}.dxf`);
    const selected = await firstReadableFile([exact, ...candidates]);
    if (selected) {
      return selected;
    }
  }
  return null;
}

async function runOdaFileConverter(
  converter: string,
  metadata: LocalFileMetadata,
  derivativeDir: string,
  outputDxf: string,
) {
  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const inputDir = join(derivativeDir, "oda-input");
  const outputDir = join(derivativeDir, "oda-output");
  const inputName = `${safeDerivativeStem(metadata)}.dwg`;
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await copyFile(sourcePath, join(inputDir, inputName));
  await runProcess(
    converter,
    [inputDir, outputDir, "ACAD2018", "DXF", "0", "1"],
    derivativeDir,
    dwgDxfTimeoutMs,
  );

  const candidates = await listDerivativeFiles(outputDir, ".dxf");
  const exact = candidates.find(
    (candidate) =>
      parse(candidate).name.toLowerCase() ===
      parse(inputName).name.toLowerCase(),
  );
  const selected = exact ?? candidates[0];
  if (!selected) {
    throw new CadDerivativeError(
      502,
      "oda_dxf_output_missing",
      "ODAFileConverter finished but did not produce a DXF file.",
      { outputDir },
    );
  }
  await copyFile(selected, outputDxf);
}

function selectSheet(
  sheets: DwgPdfDerivative["sheets"],
  sheetId?: string | null,
): DwgPdfDerivative["sheets"][number] {
  const selected =
    (sheetId ? sheets.find((sheet) => sheet.id === sheetId) : null) ??
    sheets[0];
  if (!selected) {
    throw new CadDerivativeError(
      404,
      "dwg_pdf_sheet_not_found",
      "No DWG PDF sheets are available.",
    );
  }
  return selected;
}

function dwgDerivativeDir(
  metadata: LocalFileMetadata,
  kind: "pdf" | "dxf" | "svg",
): string {
  return join(
    getLocalUploadsDir(),
    "derivatives",
    metadata.fileId,
    metadata.checksum.slice(0, 16),
    kind,
  );
}

function derivativeCacheKey(
  metadata: LocalFileMetadata,
  kind: "source" | "dxf" | "pdf" | "svg",
): string {
  return `${metadata.fileId}:${metadata.checksum.slice(0, 16)}:${kind}`;
}

function cadDerivativeEtag(
  metadata: LocalFileMetadata,
  variant: string,
): string {
  return `"sha256-${metadata.checksum}-${variant}"`;
}

async function listPdfSheets(
  sheetDir: string,
): Promise<DwgPdfDerivative["sheets"]> {
  try {
    const entries = await readdir(sheetDir, { withFileTypes: true });
    return entries
      .filter(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"),
      )
      .map((entry) => {
        const parsed = parse(entry.name);
        return {
          id: safeSheetId(parsed.name),
          name: parsed.name || "Sheet",
          path: join(sheetDir, entry.name),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return [];
  }
}

async function listDerivativeFiles(
  directory: string,
  extension: string,
): Promise<string[]> {
  const result: string[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(extension)
      ) {
        result.push(path);
      }
    }
  }
  await walk(directory);
  return result.sort((left, right) => left.localeCompare(right));
}

async function firstReadableFile(paths: string[]): Promise<string | null> {
  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    try {
      await access(path, constants.R_OK);
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

async function resolveExecutable(
  candidates: Array<string | undefined>,
): Promise<string | null> {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = candidate.includes("/")
      ? resolve(candidate)
      : await findOnPath(candidate);
    if (!resolved) continue;
    try {
      await access(resolved, constants.X_OK);
      return resolved;
    } catch {
      continue;
    }
  }
  return null;
}

async function findOnPath(command: string): Promise<string | null> {
  const pathValue = process.env.PATH ?? "";
  for (const segment of pathValue.split(":")) {
    if (!segment) continue;
    const candidate = join(segment, command);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function runProcess(
  executable: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  extraEnv: Partial<NodeJS.ProcessEnv> = {},
): Promise<ProcessResult> {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: {
        ...process.env,
        TMPDIR: process.env.TMPDIR || tmpdir(),
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new CadDerivativeError(
          504,
          "cad_derivative_timeout",
          `${basename(executable)} timed out after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const result = {
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      };
      if (code === 0) {
        resolveProcess(result);
        return;
      }
      reject(
        new CadDerivativeError(
          502,
          "cad_derivative_process_failed",
          `${basename(executable)} exited with code ${code ?? "unknown"}.`,
          {
            stdout: result.stdout.toString("utf8").slice(-4000),
            stderr: result.stderr.toString("utf8").slice(-4000),
          },
        ),
      );
    });
  });
}

function looksLikeDxf(bytes: Buffer): boolean {
  const head = bytes
    .subarray(0, Math.min(bytes.length, 1024))
    .toString("latin1");
  return /(^|\r?\n)\s*0\s*(\r?\n)\s*SECTION/i.test(head);
}

function safeSheetId(value: string): string {
  return (
    value
      .replace(/\.[^.]+$/, "")
      .replace(/[^\p{L}\p{N}._-]+/gu, "_")
      .slice(0, 96) || "sheet"
  );
}

function toolFromDir(directory: string | undefined, binary: string) {
  return directory ? join(directory, binary) : undefined;
}

function safeDerivativeStem(metadata: LocalFileMetadata): string {
  const stem = metadata.originalName.slice(
    0,
    metadata.originalName.length - extname(metadata.originalName).length,
  );
  return safeSheetId(stem || metadata.fileId);
}
