// components/OpenEngineeringViewer.test.ts - Engineering viewer utility tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';
import { Mesh, MeshStandardMaterial } from 'three';
import {
  DEPRECATED_ENGINEERING_ROLE_LABELS,
  buildDxfPreview,
  buildExchangeObjectPropertyRows,
  buildIfcPropertyRows,
  buildOcctGroup,
  cleanDxfText,
  decodeDxfBuffer,
} from './OpenEngineeringViewer';

function concatBytes(...chunks: Uint8Array[]): ArrayBuffer {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

describe('OpenEngineeringViewer DXF utilities', () => {
  it('decodes DXF text with AutoCAD GB18030 code page', () => {
    const ascii = new TextEncoder().encode(
      '0\nSECTION\n2\nHEADER\n9\n$DWGCODEPAGE\n3\nANSI_936\n0\nENDSEC\n0\nTEXT\n1\n',
    );
    const gb18030Chinese = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]);

    const decoded = decodeDxfBuffer(concatBytes(ascii, gb18030Chinese));

    expect(decoded.codePage).toBe('ANSI_936');
    expect(decoded.decoder).toBe('gb18030');
    expect(decoded.text).toContain('中文');
  });

  it('normalizes AutoCAD text escapes without dropping Chinese text', () => {
    expect(cleanDxfText('\\X2\\4E2D6587\\X0\\%%c\\p\\S1#2;^J轴网')).toBe(
      '中文Φ\n1/2\n轴网',
    );
  });

  it('removes MTEXT font controls while preserving engineering symbols', () => {
    expect(
      cleanDxfText('{\\fSimSun|b0|i0|c134|p2;轴网%%p5%%d}\\P\\C1;A%%176'),
    ).toBe('轴网±5°\nA°');
  });

  it('uses AutoCAD color index instead of treating ACI as true color', () => {
    const preview = buildDxfPreview(
      {
        entities: [
          {
            type: 'LINE',
            layer: '0',
            colorIndex: 7,
            color: 16777215,
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: 10, y: 0, z: 0 },
            ],
          },
        ],
      } as never,
      'UTF-8',
    );

    expect(preview.primitives[0]?.color).toBe('#111827');
  });

  it('renders INSERT block entities with inherited layer, color, and transform', () => {
    const preview = buildDxfPreview(
      {
        entities: [
          {
            type: 'INSERT',
            layer: 'A-WALL',
            name: 'AXIS',
            colorIndex: 1,
            position: { x: 10, y: 5, z: 0 },
            xScale: 2,
            yScale: 2,
            rotation: 90,
          },
        ],
        blocks: {
          AXIS: {
            position: { x: 0, y: 0, z: 0 },
            entities: [
              {
                type: 'LINE',
                layer: '0',
                colorIndex: 0,
                vertices: [
                  { x: 0, y: 0, z: 0 },
                  { x: 1, y: 0, z: 0 },
                ],
              },
            ],
          },
        },
      } as never,
      'UTF-8',
    );

    const primitive = preview.primitives[0];

    expect(primitive?.kind).toBe('polyline');
    expect(primitive?.layer).toBe('A-WALL');
    expect(primitive?.color).toBe('#ff2a2a');
    if (primitive?.kind === 'polyline') {
      expect(primitive.points[0]).toEqual({ x: 10, y: 5 });
      expect(primitive.points[1]?.x).toBeCloseTo(10);
      expect(primitive.points[1]?.y).toBeCloseTo(7);
    }
  });

  it('renders 3DFACE vertices as solid primitives', () => {
    const preview = buildDxfPreview(
      {
        entities: [
          {
            type: '3DFACE',
            layer: 'FACE',
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
              { x: 1, y: 1, z: 0 },
            ],
          },
        ],
      } as never,
      'UTF-8',
    );

    expect(preview.primitives[0]?.kind).toBe('solid');
  });
});

describe('OpenEngineeringViewer IFC property rows', () => {
  it('uses separated engineering roles and commercial material fields', () => {
    const rows = buildIfcPropertyRows(
      {
        version: 'v2.0',
        updatedAt: '2026-05-19T00:00:00.000Z',
      } as never,
      {
        renderedFragments: 12,
        totalMeshes: 8,
        renderOffset: { x: 0, y: 0, z: 0 },
      } as never,
      {
        expressID: 1,
        type: 'IFCBEAM',
        globalId: 'beam-guid',
        name: '主梁',
        objectType: 'H型钢梁',
        tag: 'B-01',
        predefinedType: '',
        properties: [
          { label: '源系统自定义字段', value: '原始属性应保留' },
          { label: '方案设计师', value: '王方案' },
          { label: '深化设计师', value: '李深化' },
          { label: '工艺工程师', value: '赵工艺' },
          { label: '材质', value: 'Q355B' },
          { label: '密度', value: '7850 kg/m3' },
          { label: '重量', value: '2.5 t' },
          { label: '单位', value: 't' },
          { label: '单价', value: '6200' },
          { label: '总价', value: '15500' },
        ],
      } as never,
      {},
    );

    const labels = rows.map((row) => row.label);

    expect(labels).toContain('方案设计师');
    expect(labels).toContain('深化设计师');
    expect(labels).toContain('工艺工程师');
    expect(labels).toContain('源系统自定义字段');
    expect(labels).toContain('材质');
    expect(labels).toContain('密度');
    expect(labels).toContain('重量');
    expect(labels).toContain('单位');
    expect(labels).toContain('单价');
    expect(labels).toContain('总价');
    DEPRECATED_ENGINEERING_ROLE_LABELS.forEach((label) => {
      expect(labels).not.toContain(label);
    });
    expect(rows.find((row) => row.label === '密度')?.value).toBe('7850 kg/m3');
  });
});

describe('OpenEngineeringViewer exchange mesh properties', () => {
  it('keeps neutral source-safe materials and exposes mm dimensions', () => {
    const preview = buildOcctGroup(
      [
        {
          name: 'steel-beam-source-id',
          attributes: {
            position: {
              array: [0, 0, 0, 1000, 0, 0, 0, 500, 200],
            },
            normal: { array: [] },
          },
          index: { array: [0, 1, 2] },
        } as never,
      ],
      {
        sourceFormat: '.step',
        sourceName: 'beam.step',
        routeLabel: 'OCCT WASM CAD exchange 真实解析',
      },
    );

    const mesh = preview.group.children[0] as Mesh;
    const material = mesh.material as MeshStandardMaterial;

    expect(material.color.getHexString()).toBe('cbd5e1');
    expect(mesh.userData.materialSource).toBe('源文件未声明颜色，使用可视化默认色');

    const rows = buildExchangeObjectPropertyRows(
      mesh,
      {
        name: 'beam.step',
        mimeType: 'model/step',
        version: 'v1.0',
        updatedAt: '2026-05-19T00:00:00.000Z',
      } as never,
      'OCCT WASM CAD exchange 真实解析',
    );

    expect(rows.find((row) => row.label === '构件ID')?.value).toBe(
      'steel-beam-source-id',
    );
    expect(rows.find((row) => row.label === '三维尺寸（mm）')?.value).toContain(
      '1,000 mm',
    );
    expect(rows.find((row) => row.label === 'X尺寸（mm）')?.value).toBe(
      '1,000 mm',
    );
    expect(rows.find((row) => row.label === '坐标位置（mm）')?.value).toContain(
      '500 mm',
    );
  });
});
