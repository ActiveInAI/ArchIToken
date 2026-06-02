// lib/cad-derivative-server.test.ts - CAD derivative cache contract
// License: Apache-2.0

import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCadDerivativeManifest,
  probeCadDerivativeAdapters,
  readCadDerivativeBytes,
} from "./cad-derivative-server";
import { saveLocalUpload } from "./local-file-runtime-server";

const minimalDxf = `0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
0
10
0
20
0
11
100
21
100
0
ENDSEC
0
EOF
`;

describe("CAD derivative server", () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let previousEnableDxfSvgDerivative: string | undefined;
  let previousDwgExporterPath: string | undefined;
  let previousAllowDwgVectorPdfFallback: string | undefined;
  let previousDisableDwgVectorPdfFallback: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousEnableDxfSvgDerivative =
      process.env.ARCHITOKEN_ENABLE_DXF_SVG_DERIVATIVE;
    previousDwgExporterPath = process.env.DDC_DWG_EXPORTER_PATH;
    previousAllowDwgVectorPdfFallback =
      process.env.ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK;
    previousDisableDwgVectorPdfFallback =
      process.env.ARCHITOKEN_DISABLE_DWG_VECTOR_PDF_FALLBACK;
    uploadDir = await mkdtemp(join(tmpdir(), "architoken-cad-derivatives-"));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    delete process.env.ARCHITOKEN_ENABLE_DXF_SVG_DERIVATIVE;
    delete process.env.DDC_DWG_EXPORTER_PATH;
    delete process.env.ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK;
    delete process.env.ARCHITOKEN_DISABLE_DWG_VECTOR_PDF_FALLBACK;
  });

  afterEach(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    } else {
      process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = previousUploadDir;
    }
    if (previousEnableDxfSvgDerivative === undefined) {
      delete process.env.ARCHITOKEN_ENABLE_DXF_SVG_DERIVATIVE;
    } else {
      process.env.ARCHITOKEN_ENABLE_DXF_SVG_DERIVATIVE =
        previousEnableDxfSvgDerivative;
    }
    if (previousDwgExporterPath === undefined) {
      delete process.env.DDC_DWG_EXPORTER_PATH;
    } else {
      process.env.DDC_DWG_EXPORTER_PATH = previousDwgExporterPath;
    }
    if (previousAllowDwgVectorPdfFallback === undefined) {
      delete process.env.ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK;
    } else {
      process.env.ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK =
        previousAllowDwgVectorPdfFallback;
    }
    if (previousDisableDwgVectorPdfFallback === undefined) {
      delete process.env.ARCHITOKEN_DISABLE_DWG_VECTOR_PDF_FALLBACK;
    } else {
      process.env.ARCHITOKEN_DISABLE_DWG_VECTOR_PDF_FALLBACK =
        previousDisableDwgVectorPdfFallback;
    }
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("exposes a source-bound DXF MLightCAD manifest with ETag and adapter probes", async () => {
    const saved = await saveLocalUpload({
      file: new File([minimalDxf], "plan.dxf", { type: "image/vnd.dxf" }),
      moduleId: "detailed_design",
    });

    const manifest = await buildCadDerivativeManifest(saved.fileId);
    expect(manifest.schema).toBe("architoken.cad_derivative_manifest.v1");
    expect(manifest.sourceChecksum).toBe(saved.checksum);
    expect(manifest.sourceOfRecord.substitutePreview).toBe(false);
    expect(manifest.cachePolicy).toBe("stream+etag+checksum");
    expect(manifest.viewer).toBe("mlightcad_browser");
    expect(manifest.engine).toBe("@mlightcad/cad-simple-viewer");
    expect(manifest.derivativeArtifact.kind).toBe("source-dxf");
    expect(manifest.derivativeArtifact.checksum).toBe(saved.checksum);
    expect(manifest.derivativeArtifact.url).toBe(
      `/api/local-files/${encodeURIComponent(saved.fileId)}`,
    );
    expect(manifest.derivativeArtifact.cacheHit).toBe(false);
    expect(manifest.artifacts[0]).toMatchObject({
      role: "cad_source_runtime",
      checksum: saved.checksum,
      size: saved.size,
    });
    expect(manifest.failureEvidence).toEqual([]);
    expect(manifest.etag).toContain(saved.checksum);
    expect(manifest.adapters.map((adapter) => adapter.id)).toContain(
      "mlightcad-cad-simple-viewer",
    );
    expect(manifest.sheets[0]?.url).toContain(saved.fileId);

    const bytes = await readCadDerivativeBytes(saved.fileId, "dxf");
    expect(bytes.mediaType).toBe("application/dxf");
    expect(bytes.etag).toContain(saved.checksum);
    expect(bytes.bytes.toString("utf8")).toContain("SECTION");
  });

  it("records MLightCAD plus optional sidecar adapter boundaries", async () => {
    const adapters = await probeCadDerivativeAdapters();
    expect(adapters.map((adapter) => adapter.id)).toEqual(
      expect.arrayContaining([
        "mlightcad-cad-simple-viewer",
        "mlightcad-libredwg-web",
        "oda-file-converter",
        "libredwg-dwg2dxf",
        "libredwg-dwgread",
        "freecad-headless",
        "librecad-dxf2pdf",
        "ddc-dwgexporter-vector-pdf",
      ]),
    );
    expect(
      adapters.find((adapter) => adapter.id === "mlightcad-cad-simple-viewer")
        ?.licenseBoundary,
    ).toBe("browser_source_parser");
    expect(
      adapters.find((adapter) => adapter.id === "mlightcad-libredwg-web")
        ?.licenseBoundary,
    ).toBe("browser_gpl_wasm");
    expect(
      adapters.find((adapter) => adapter.id === "libredwg-dwg2dxf")
        ?.licenseBoundary,
    ).toBe("isolated_sidecar");
    expect(
      adapters.find((adapter) => adapter.id === "ddc-dwgexporter-vector-pdf")
        ?.installHint,
    ).toContain("controlled licensed vector-PDF fallback");
    expect(
      adapters.find((adapter) => adapter.id === "librecad-dxf2pdf")
        ?.licenseBoundary,
    ).toBe("isolated_sidecar");
  });

  it("keeps DWG manifest on MLightCAD while explicit vector PDF diagnostics remain opt-in", async () => {
    const exporterPath = join(uploadDir, "fake-dwgexporter.mjs");
    await writeFile(
      exporterPath,
      [
        "#!/usr/bin/env node",
        "import { mkdir, writeFile } from 'node:fs/promises';",
        "import { basename, dirname, extname, join } from 'node:path';",
        "const [, , , output] = process.argv;",
        "const outputDir = dirname(output);",
        "const outputStem = basename(output, extname(output));",
        "const sheetDir = join(outputDir, `SHEETS_PDF_${outputStem}`);",
        "await mkdir(sheetDir, { recursive: true });",
        "await writeFile(join(sheetDir, 'Model.pdf'), '%PDF-1.4\\n% fake dwg sheet\\n');",
        "await writeFile(output, 'PK\\u0003\\u0004');",
      ].join("\n"),
    );
    await chmod(exporterPath, 0o755);
    process.env.DDC_DWG_EXPORTER_PATH = exporterPath;
    process.env.ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK = "1";

    const saved = await saveLocalUpload({
      file: new File(["AC1018 fake dwg"], "plan.dwg", {
        type: "image/vnd.dwg",
      }),
      moduleId: "detailed_design",
    });

    const manifest = await buildCadDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("mlightcad_browser");
    expect(manifest.derivativeArtifact.kind).toBe("source-dwg");
    expect(manifest.sourceOfRecord.substitutePreview).toBe(false);
    expect(manifest.permissions.canEditSource).toBe(false);
    expect(manifest.notes.join(" ")).toContain("LibreDWG WASM");

    const bytes = await readCadDerivativeBytes(saved.fileId, "pdf");
    expect(bytes.mediaType).toBe("application/pdf");
    expect(bytes.bytes.toString("utf8")).toContain("%PDF-1.4");
  });

  it("blocks direct DWG PDF fallback unless explicitly enabled", async () => {
    const exporterPath = join(uploadDir, "fake-dwgexporter.mjs");
    await writeFile(
      exporterPath,
      [
        "#!/usr/bin/env node",
        "import { mkdir, writeFile } from 'node:fs/promises';",
        "import { basename, dirname, extname, join } from 'node:path';",
        "const [, , , output] = process.argv;",
        "const outputDir = dirname(output);",
        "const outputStem = basename(output, extname(output));",
        "const sheetDir = join(outputDir, `SHEETS_PDF_${outputStem}`);",
        "await mkdir(sheetDir, { recursive: true });",
        "await writeFile(join(sheetDir, 'Model.pdf'), '%PDF-1.4\\n% fake dwg sheet\\n');",
        "await writeFile(output, 'PK\\u0003\\u0004');",
      ].join("\n"),
    );
    await chmod(exporterPath, 0o755);
    process.env.DDC_DWG_EXPORTER_PATH = exporterPath;

    const saved = await saveLocalUpload({
      file: new File(["AC1018 fake dwg"], "plan.dwg", {
        type: "image/vnd.dwg",
      }),
      moduleId: "detailed_design",
    });

    await expect(
      readCadDerivativeBytes(saved.fileId, "pdf"),
    ).rejects.toMatchObject({
      code: "dwg_pdf_fallback_disabled",
      status: 409,
    });
  });

  it("keeps DWG manifest on source bytes while explicit DWG-to-DXF diagnostics can reuse cache", async () => {
    const source = "AC1018 duplicate dwg bytes";
    const first = await saveLocalUpload({
      file: new File([source], "first-plan.dwg", { type: "image/vnd.dwg" }),
      moduleId: "detailed_design",
    });
    const second = await saveLocalUpload({
      file: new File([source], "second-plan.dwg", { type: "image/vnd.dwg" }),
      moduleId: "detailed_design",
    });
    const sharedDxfDir = join(
      uploadDir,
      "derivatives",
      first.fileId,
      first.checksum.slice(0, 16),
      "dxf",
    );
    await mkdir(sharedDxfDir, { recursive: true });
    await writeFile(join(sharedDxfDir, `${first.fileId}.dxf`), minimalDxf);

    const manifest = await buildCadDerivativeManifest(second.fileId);
    expect(manifest.viewer).toBe("mlightcad_browser");
    expect(manifest.derivativeArtifact.kind).toBe("source-dwg");
    expect(manifest.derivativeArtifact.cacheHit).toBe(false);

    const bytes = await readCadDerivativeBytes(second.fileId, "dxf");
    expect(bytes.mediaType).toBe("application/dxf");
    expect(bytes.engine).toBe("shared-cached-dwg-dxf");
    expect(bytes.bytes.toString("utf8")).toContain("SECTION");
  });
});
