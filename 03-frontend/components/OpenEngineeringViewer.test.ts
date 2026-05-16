// components/OpenEngineeringViewer.test.ts - Engineering viewer utility tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  buildDxfPreview,
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
