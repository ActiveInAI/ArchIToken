// components/OpenEngineeringViewer.test.ts - Engineering viewer utility tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';
import { cleanDxfText, decodeDxfBuffer } from './OpenEngineeringViewer';

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
    expect(cleanDxfText('\\X2\\4E2D6587\\X0\\%%c\\P\\S1#2;')).toBe(
      '中文Φ\n1/2',
    );
  });
});
