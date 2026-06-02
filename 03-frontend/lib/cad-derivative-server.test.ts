// lib/cad-derivative-server.test.ts - CAD derivative cache contract
// License: Apache-2.0

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildCadDerivativeManifest,
  probeCadDerivativeAdapters,
  readCadDerivativeBytes,
} from './cad-derivative-server';
import { saveLocalUpload } from './local-file-runtime-server';

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

describe('CAD derivative server', () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let previousEnableDxfSvgDerivative: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousEnableDxfSvgDerivative =
      process.env.ARCHITOKEN_ENABLE_DXF_SVG_DERIVATIVE;
    uploadDir = await mkdtemp(join(tmpdir(), 'architoken-cad-derivatives-'));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    delete process.env.ARCHITOKEN_ENABLE_DXF_SVG_DERIVATIVE;
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
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('exposes a source-bound DXF vector entity manifest with ETag and adapter probes', async () => {
    const saved = await saveLocalUpload({
      file: new File([minimalDxf], 'plan.dxf', { type: 'image/vnd.dxf' }),
      moduleId: 'detailed_design',
    });

    const manifest = await buildCadDerivativeManifest(saved.fileId);
    expect(manifest.schema).toBe('architoken.cad_derivative_manifest.v1');
    expect(manifest.sourceChecksum).toBe(saved.checksum);
    expect(manifest.sourceOfRecord.substitutePreview).toBe(false);
    expect(manifest.cachePolicy).toBe('stream+etag+checksum');
    expect(manifest.viewer).toBe('cad_vector_entities');
    expect(manifest.derivativeArtifact.kind).toBe('source-dxf');
    expect(manifest.derivativeArtifact.cacheHit).toBe(false);
    expect(manifest.etag).toContain(saved.checksum);
    expect(manifest.adapters.map((adapter) => adapter.id)).toContain(
      'librecad-dxf2pdf',
    );
    expect(manifest.sheets[0]?.url).toContain(saved.fileId);

    const bytes = await readCadDerivativeBytes(saved.fileId, 'dxf');
    expect(bytes.mediaType).toBe('application/dxf');
    expect(bytes.etag).toContain(saved.checksum);
    expect(bytes.bytes.toString('utf8')).toContain('SECTION');
  });

  it('records ODA, LibreDWG, LibreCAD, FreeCAD and DDC adapter boundaries', async () => {
    const adapters = await probeCadDerivativeAdapters();
    expect(adapters.map((adapter) => adapter.id)).toEqual(
      expect.arrayContaining([
        'oda-file-converter',
        'libredwg-dwg2dxf',
        'libredwg-dwgread',
        'freecad-headless',
        'librecad-dxf2pdf',
        'ddc-dwgexporter-vector-pdf',
      ]),
    );
    expect(
      adapters.find((adapter) => adapter.id === 'libredwg-dwg2dxf')
        ?.licenseBoundary,
    ).toBe('isolated_sidecar');
    expect(
      adapters.find((adapter) => adapter.id === 'ddc-dwgexporter-vector-pdf')
        ?.installHint,
    ).toContain('explicitly enabled');
    expect(
      adapters.find((adapter) => adapter.id === 'librecad-dxf2pdf')
        ?.licenseBoundary,
    ).toBe('isolated_sidecar');
  });
});
