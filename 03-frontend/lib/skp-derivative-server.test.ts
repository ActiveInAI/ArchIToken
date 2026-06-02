// lib/skp-derivative-server.test.ts - SKP derivative adapter contract
// License: Apache-2.0

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildSkpDerivativeManifest,
  readSkpDerivativeBytes,
} from './skp-derivative-server';
import { saveLocalUpload } from './local-file-runtime-server';

describe('SKP derivative server', () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let previousSketchupAdapterUrl: string | undefined;
  let previousLicensedAdapterUrl: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousSketchupAdapterUrl = process.env.SKETCHUP_ADAPTER_URL;
    previousLicensedAdapterUrl = process.env.LICENSED_BIM_ADAPTER_URL;
    uploadDir = await mkdtemp(join(tmpdir(), 'architoken-skp-derivatives-'));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    delete process.env.SKETCHUP_ADAPTER_URL;
    delete process.env.LICENSED_BIM_ADAPTER_URL;
  });

  afterEach(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    } else {
      process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = previousUploadDir;
    }
    if (previousSketchupAdapterUrl === undefined) {
      delete process.env.SKETCHUP_ADAPTER_URL;
    } else {
      process.env.SKETCHUP_ADAPTER_URL = previousSketchupAdapterUrl;
    }
    if (previousLicensedAdapterUrl === undefined) {
      delete process.env.LICENSED_BIM_ADAPTER_URL;
    } else {
      process.env.LICENSED_BIM_ADAPTER_URL = previousLicensedAdapterUrl;
    }
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('fails closed until a licensed Prengine SKP adapter is configured', async () => {
    const saved = await saveLocalUpload({
      file: new File(['SketchUp placeholder'], 'model.skp', {
        type: 'model/vnd.sketchup.skp',
      }),
      moduleId: 'construction_management',
    });

    const manifest = await buildSkpDerivativeManifest(saved.fileId);
    expect(manifest.schema).toBe('architoken.skp_derivative_manifest.v1');
    expect(manifest.viewer).toBe('licensed_adapter_required');
    expect(manifest.permissions.canView).toBe(false);
    expect(manifest.adapters[0]?.id).toBe('prengine-sketchup-adapter');
    expect(manifest.adapters[0]?.status).toBe('missing');
    expect(manifest.notes[0]).toContain('不会用字节预览');

    await expect(readSkpDerivativeBytes(saved.fileId, 'glb')).rejects.toMatchObject({
      code: 'skp_adapter_not_configured',
      status: 503,
    });
  });
});
