// lib/rvt-derivative-server.test.ts - RVT derivative adapter contract
// License: Apache-2.0

import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildRvtDerivativeManifest,
  readRvtDerivativeBytes,
} from './rvt-derivative-server';
import { saveLocalUpload } from './local-file-runtime-server';

describe('RVT derivative server', () => {
  let uploadDir: string;
  let binDir: string;
  let previousUploadDir: string | undefined;
  let previousRvtExporter: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousRvtExporter = process.env.DDC_RVT_EXPORTER_PATH;
    uploadDir = await mkdtemp(join(tmpdir(), 'architoken-rvt-derivatives-'));
    binDir = await mkdtemp(join(tmpdir(), 'architoken-rvt-exporter-'));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
  });

  afterEach(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    } else {
      process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = previousUploadDir;
    }
    if (previousRvtExporter === undefined) {
      delete process.env.DDC_RVT_EXPORTER_PATH;
    } else {
      process.env.DDC_RVT_EXPORTER_PATH = previousRvtExporter;
    }
    await rm(uploadDir, { recursive: true, force: true });
    await rm(binDir, { recursive: true, force: true });
  });

  it('uses Prengine RVT exporter output instead of source-byte preview', async () => {
    const exporter = join(binDir, 'RvtExporter');
    await writeFile(
      exporter,
      [
        '#!/usr/bin/env node',
        'const fs = require("node:fs");',
        'const [source, dae, xlsx] = process.argv.slice(2);',
        'if (/[^\\x00-\\x7F]/.test([source, dae, xlsx].join("|"))) process.exit(3);',
        'fs.writeFileSync(dae, "<COLLADA><asset/></COLLADA>");',
        'fs.writeFileSync(xlsx, Buffer.from("PK\\x03\\x04rvt-schedule"));',
      ].join('\n'),
      'utf8',
    );
    await chmod(exporter, 0o755);
    process.env.DDC_RVT_EXPORTER_PATH = exporter;

    const saved = await saveLocalUpload({
      file: new File(['RVT placeholder'], '中文模型.rvt', {
        type: 'application/vnd.autodesk.revit',
      }),
      moduleId: 'construction_management',
    });

    const manifest = await buildRvtDerivativeManifest(saved.fileId);
    expect(manifest.schema).toBe('architoken.rvt_derivative_manifest.v1');
    expect(manifest.viewer).toBe('prengine_rvt_model');
    expect(manifest.engine).toBe('Prengine');
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.derivativeArtifact?.kind).toBe('rvt-collada');
    expect(manifest.scheduleArtifact?.kind).toBe('rvt-schedule');

    const dae = await readRvtDerivativeBytes(saved.fileId, 'dae');
    expect(dae.engine).toBe('Prengine');
    expect(dae.mediaType).toBe('model/vnd.collada+xml');
    expect(dae.bytes.toString('utf8')).toContain('<COLLADA>');
  });

  it('sanitizes duplicate Collada ids from RVT exporter output', async () => {
    const exporter = join(binDir, 'RvtExporter');
    await writeFile(
      exporter,
      [
        '#!/usr/bin/env node',
        'const fs = require("node:fs");',
        'const [source, dae, xlsx] = process.argv.slice(2);',
        'void source;',
        'fs.writeFileSync(dae, `<COLLADA><library_visual_scenes><visual_scene id="VisualSceneNode"><node id="duplicate"><node id="duplicate"/></node><node id="duplicate"/></visual_scene></library_visual_scenes><scene><instance_visual_scene url="#VisualSceneNode"/></scene></COLLADA>`);',
        'fs.writeFileSync(xlsx, Buffer.from("PK\x03\x04rvt-schedule"));',
      ].join('\n'),
      'utf8',
    );
    await chmod(exporter, 0o755);
    process.env.DDC_RVT_EXPORTER_PATH = exporter;

    const saved = await saveLocalUpload({
      file: new File(['RVT placeholder'], '重复节点.rvt', {
        type: 'application/vnd.autodesk.revit',
      }),
      moduleId: 'construction_management',
    });

    const dae = await readRvtDerivativeBytes(saved.fileId, 'dae');
    const text = dae.bytes.toString('utf8');
    expect(text).toContain('id="duplicate"');
    expect(text).toContain('id="duplicate__2"');
    expect(text).toContain('id="duplicate__3"');
  });

  it('removes Collada geometry instances that reference missing DDC geometry ids', async () => {
    const exporter = join(binDir, 'RvtExporter');
    await writeFile(
      exporter,
      [
        '#!/usr/bin/env node',
        'const fs = require("node:fs");',
        'const [source, dae, xlsx] = process.argv.slice(2);',
        'void source;',
        'fs.writeFileSync(dae, `<COLLADA><library_geometries><geometry id="present-lib"><mesh/></geometry></library_geometries><library_visual_scenes><visual_scene id="VisualSceneNode"><node id="valid"><instance_geometry url="#present-lib"/></node><node id="broken"><instance_geometry url="#missing-lib"/></node></visual_scene></library_visual_scenes><scene><instance_visual_scene url="#VisualSceneNode"/></scene></COLLADA>`);',
        'fs.writeFileSync(xlsx, Buffer.from("PK\x03\x04rvt-schedule"));',
      ].join('\n'),
      'utf8',
    );
    await chmod(exporter, 0o755);
    process.env.DDC_RVT_EXPORTER_PATH = exporter;

    const saved = await saveLocalUpload({
      file: new File(['RVT placeholder'], '断开几何.rvt', {
        type: 'application/vnd.autodesk.revit',
      }),
      moduleId: 'construction_management',
    });

    const dae = await readRvtDerivativeBytes(saved.fileId, 'dae');
    const text = dae.bytes.toString('utf8');
    expect(text).toContain('url="#present-lib"');
    expect(text).not.toContain('url="#missing-lib"');
    expect(text).not.toContain('id="broken"');
  });

  it('replaces all-black Collada display materials with visible engineering color', async () => {
    const exporter = join(binDir, 'RvtExporter');
    await writeFile(
      exporter,
      [
        '#!/usr/bin/env node',
        'const fs = require("node:fs");',
        'const [source, dae, xlsx] = process.argv.slice(2);',
        'void source;',
        'fs.writeFileSync(dae, `<COLLADA><library_effects><effect id="black-effect"><profile_COMMON><technique sid="common"><phong><diffuse><color>0 0 0 1</color></diffuse><specular><color>0 0 0 1</color></specular></phong></technique></profile_COMMON></effect></library_effects></COLLADA>`);',
        'fs.writeFileSync(xlsx, Buffer.from("PK\x03\x04rvt-schedule"));',
      ].join('\n'),
      'utf8',
    );
    await chmod(exporter, 0o755);
    process.env.DDC_RVT_EXPORTER_PATH = exporter;

    const saved = await saveLocalUpload({
      file: new File(['RVT placeholder'], '黑色材质.rvt', {
        type: 'application/vnd.autodesk.revit',
      }),
      moduleId: 'construction_management',
    });

    const dae = await readRvtDerivativeBytes(saved.fileId, 'dae');
    const text = dae.bytes.toString('utf8');
    expect(text).toContain('<diffuse><color>0.74 0.78 0.82 1</color></diffuse>');
    expect(text).toContain('<specular><color>0 0 0 1</color></specular>');
  });

});
