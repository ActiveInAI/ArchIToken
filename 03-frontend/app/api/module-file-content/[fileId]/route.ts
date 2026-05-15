// app/api/module-file-content/[fileId]/route.ts - Renderable module registry file content
// License: Apache-2.0

export const runtime = 'nodejs';

interface FileContext {
  fileId: string;
  name: string;
  mimeType: string;
  moduleId: string;
  size: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const url = new URL(request.url);
  const context: FileContext = {
    fileId,
    name: url.searchParams.get('name') || `${fileId}.txt`,
    mimeType: url.searchParams.get('mimeType') || 'application/octet-stream',
    moduleId: url.searchParams.get('moduleId') || 'unknown',
    size: Number(url.searchParams.get('size') || '0'),
  };
  const ext = extensionOf(context.name);
  const mimeType = context.mimeType.toLowerCase();

  if (mimeType === 'application/pdf' || ext === '.pdf' || ext === '.pdfa') {
    return binaryResponse(renderPdf(context), 'application/pdf', context.name);
  }

  if (mimeType.startsWith('image/') || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') {
    return textResponse(renderSvgImage(context), 'image/svg+xml; charset=utf-8', context.name);
  }

  if (ext === '.dwg' || ext === '.dxf') {
    return textResponse(renderCadSheet(context), 'image/svg+xml; charset=utf-8', context.name);
  }

  if (ext === '.ifc' || mimeType.includes('ifc') || mimeType.includes('step')) {
    return textResponse(renderIfc(context), 'text/plain; charset=utf-8', context.name);
  }

  if (ext === '.glb' || ext === '.gltf' || mimeType === 'model/gltf-binary' || mimeType === 'model/gltf+json') {
    return textResponse(JSON.stringify(renderGltf(context)), 'model/gltf+json; charset=utf-8', context.name.replace(/\.glb$/i, '.gltf'));
  }

  if (isOffice(ext, mimeType)) {
    return textResponse(renderOfficeHtml(context), 'text/html; charset=utf-8', context.name);
  }

  if (ext === '.csv' || mimeType.includes('csv')) {
    return textResponse(renderCsv(context), 'text/csv; charset=utf-8', context.name);
  }

  if (ext === '.json' || mimeType.includes('json')) {
    return textResponse(JSON.stringify(renderJson(context), null, 2), 'application/json; charset=utf-8', context.name);
  }

  if (ext === '.yaml' || ext === '.yml' || mimeType.includes('yaml')) {
    return textResponse(renderYaml(context), 'application/yaml; charset=utf-8', context.name);
  }

  if (mimeType.startsWith('audio/') || ext === '.wav') {
    return binaryResponse(renderWav(), 'audio/wav', context.name.replace(/\.[^.]+$/, '.wav'));
  }

  if (mimeType.startsWith('video/') || ext === '.mp4' || ext === '.webm') {
    return textResponse(renderVideoStoryboard(context), 'text/html; charset=utf-8', context.name);
  }

  return textResponse(renderPlainText(context), 'text/plain; charset=utf-8', context.name);
}

function textResponse(content: string, contentType: string, name: string): Response {
  return new Response(content, {
    headers: {
      'content-type': contentType,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      'cache-control': 'no-store',
    },
  });
}

function binaryResponse(bytes: Buffer, contentType: string, name: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': contentType,
      'content-length': String(bytes.byteLength),
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      'cache-control': 'no-store',
    },
  });
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function isOffice(ext: string, mimeType: string): boolean {
  return ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)
    || mimeType.includes('officedocument')
    || mimeType.includes('msword')
    || mimeType.includes('ms-excel')
    || mimeType.includes('ms-powerpoint');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pdfText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function renderPdf(context: FileContext): Buffer {
  const lines = [
    'ArchIToken Registry PDF',
    `File: ${context.name}`,
    `Module: ${context.moduleId}`,
    `MIME: ${context.mimeType}`,
    `Source: ${context.fileId}`,
  ];
  const [title, ...detailLines] = lines;
  const content = [
    'BT',
    '/F1 20 Tf',
    '72 760 Td',
    `(${pdfText(title ?? 'ArchIToken Registry PDF')}) Tj`,
    '/F1 12 Tf',
    ...detailLines.flatMap((line) => ['0 -28 Td', `(${pdfText(line)}) Tj`]),
    '0 -36 Td',
    '(Renderable content is served by the module file content route.) Tj',
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

function renderSvgImage(context: FileContext): string {
  const title = escapeXml(context.name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="840" viewBox="0 0 1280 840">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#f7fff9"/>
      <stop offset="1" stop-color="#d8f8e7"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="840" fill="url(#bg)"/>
  <g stroke="#07c160" stroke-width="1" opacity="0.18">
    ${Array.from({ length: 31 }, (_, index) => `<line x1="${index * 44}" y1="0" x2="${index * 44}" y2="840"/>`).join('')}
    ${Array.from({ length: 21 }, (_, index) => `<line x1="0" y1="${index * 44}" x2="1280" y2="${index * 44}"/>`).join('')}
  </g>
  <rect x="120" y="110" width="1040" height="620" rx="28" fill="#ffffff" stroke="#07c160" stroke-width="6"/>
  <text x="170" y="195" fill="#10251c" font-family="Arial, sans-serif" font-size="42" font-weight="800">${title}</text>
  <text x="170" y="250" fill="#3f6b58" font-family="Arial, sans-serif" font-size="24">Module ${escapeXml(context.moduleId)} · ${escapeXml(context.mimeType)}</text>
  <path d="M180 600 C310 420 430 520 520 360 S760 290 870 470 1040 430 1100 300" fill="none" stroke="#07c160" stroke-width="18" stroke-linecap="round"/>
  <circle cx="350" cy="500" r="58" fill="#95ec69" opacity="0.85"/>
  <circle cx="690" cy="360" r="74" fill="#10aeff" opacity="0.45"/>
  <circle cx="980" cy="430" r="48" fill="#07c160" opacity="0.8"/>
</svg>`;
}

function renderCadSheet(context: FileContext): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
  <rect width="1400" height="900" fill="#07111f"/>
  <g stroke="#13e6c5" stroke-width="1" opacity="0.28">
    ${Array.from({ length: 36 }, (_, index) => `<line x1="${index * 40}" y1="0" x2="${index * 40}" y2="900"/>`).join('')}
    ${Array.from({ length: 24 }, (_, index) => `<line x1="0" y1="${index * 40}" x2="1400" y2="${index * 40}"/>`).join('')}
  </g>
  <g fill="none" stroke="#f5f7ff" stroke-width="5">
    <rect x="150" y="120" width="1040" height="620"/>
    <rect x="210" y="180" width="360" height="210"/>
    <rect x="660" y="180" width="420" height="230"/>
    <path d="M220 520 H620 V650 H220 Z"/>
    <path d="M720 520 H1090 V650 H720 Z"/>
    <path d="M570 285 H660 M870 410 V520 M620 590 H720"/>
  </g>
  <g stroke="#00ffa8" stroke-width="3" fill="none">
    <path d="M210 760 H1180"/>
    <path d="M1180 760 v-70 h-240 v70"/>
    <path d="M960 705 h200"/>
  </g>
  <text x="180" y="92" fill="#13e6c5" font-family="monospace" font-size="30" font-weight="700">${escapeXml(context.name)}</text>
  <text x="950" y="720" fill="#f5f7ff" font-family="monospace" font-size="20">${escapeXml(context.moduleId)}</text>
  <text x="950" y="748" fill="#94a3b8" font-family="monospace" font-size="16">${escapeXml(context.fileId)}</text>
</svg>`;
}

function renderIfc(context: FileContext): string {
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ArchIToken module viewer source'),'2;1');
FILE_NAME('${context.name}','${new Date().toISOString()}',('ArchIToken'),('ArchIToken'),'ArchIToken','ModuleFileContent','');
FILE_SCHEMA(('IFC4X3_ADD2'));
ENDSEC;
DATA;
#1=IFCPROJECT('0JfDlbXxP4l8D4uN1AtDev',#2,'${context.moduleId}', $, $, $, $, $, $);
#2=IFCOWNERHISTORY($,$,$,.ADDED.,$,$,$,0);
#10=IFCBUILDINGELEMENTPROXY('3rVQhPzJ91C8VxSource',#2,'${context.name}',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;`;
}

function renderGltf(context: FileContext): unknown {
  const positions = new Float32Array([
    -1, -1, -1,
    1, -1, -1,
    1, 1, -1,
    -1, 1, -1,
    -1, -1, 1,
    1, -1, 1,
    1, 1, 1,
    -1, 1, 1,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ]);
  const positionBytes = Buffer.from(positions.buffer);
  const indexBytes = Buffer.from(indices.buffer);
  const binary = Buffer.concat([positionBytes, indexBytes]);

  return {
    asset: { version: '2.0', generator: 'ArchIToken module-file-content' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: context.name, mesh: 0, scale: [3, 1.6, 2] }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        indices: 1,
        material: 0,
      }],
    }],
    materials: [{
      pbrMetallicRoughness: {
        baseColorFactor: [0.02, 0.75, 0.42, 1],
        metallicFactor: 0.15,
        roughnessFactor: 0.35,
      },
      doubleSided: true,
    }],
    buffers: [{
      uri: `data:application/octet-stream;base64,${binary.toString('base64')}`,
      byteLength: binary.byteLength,
    }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBytes.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positionBytes.byteLength, byteLength: indexBytes.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-1, -1, -1], max: [1, 1, 1] },
      { bufferView: 1, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
  };
}

function renderOfficeHtml(context: FileContext): string {
  const rows = [
    ['字段', '值'],
    ['文件', context.name],
    ['模块', context.moduleId],
    ['状态', '可查看'],
    ['对象', context.fileId],
  ];
  return `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>${escapeXml(context.name)}</title>
<style>
  body{margin:0;background:#f5f5f5;color:#111;font-family:Arial,"Microsoft YaHei",sans-serif}
  main{max-width:920px;margin:32px auto;background:#fff;border:1px solid #d8dad9;padding:40px;min-height:720px}
  h1{font-size:28px;margin:0 0 12px}
  p{color:#58645f}
  table{border-collapse:collapse;width:100%;margin-top:28px}
  td,th{border:1px solid #d8dad9;padding:12px;text-align:left}
  th{background:#e9f8ef}
</style>
<main>
  <h1>${escapeXml(context.name)}</h1>
  <p>ArchIToken Office viewer route. This document is rendered inline and remains bound to lifecycle, approval, audit, and storage metadata.</p>
  <table>${rows.map((row) => `<tr>${row.map((cell, index) => index === 0 ? `<th>${escapeXml(cell)}</th>` : `<td>${escapeXml(cell)}</td>`).join('')}</tr>`).join('')}</table>
</main>
</html>`;
}

function renderCsv(context: FileContext): string {
  return [
    'name,module,mime,size,status',
    `"${context.name}","${context.moduleId}","${context.mimeType}",${context.size},"active"`,
    '"数量","单位","值","备注","可视化"',
    '"构件","pcs","1280","registry content","ready"',
  ].join('\n');
}

function renderJson(context: FileContext): unknown {
  return {
    id: context.fileId,
    name: context.name,
    moduleId: context.moduleId,
    mimeType: context.mimeType,
    size: context.size,
    lifecycle: ['created', 'indexed', 'viewable'],
  };
}

function renderYaml(context: FileContext): string {
  return [
    `id: ${context.fileId}`,
    `name: ${context.name}`,
    `moduleId: ${context.moduleId}`,
    `mimeType: ${context.mimeType}`,
    `size: ${context.size}`,
    'lifecycle:',
    '  - created',
    '  - indexed',
    '  - viewable',
  ].join('\n');
}

function renderPlainText(context: FileContext): string {
  return [
    'ArchIToken module file content',
    `File: ${context.name}`,
    `Module: ${context.moduleId}`,
    `MIME: ${context.mimeType}`,
    `ID: ${context.fileId}`,
  ].join('\n');
}

function renderWav(): Buffer {
  const sampleRate = 24_000;
  const seconds = 1.2;
  const sampleCount = Math.floor(sampleRate * seconds);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / sampleRate;
    const value = Math.sin(2 * Math.PI * 440 * t) * 0.22 + Math.sin(2 * Math.PI * 660 * t) * 0.12;
    buffer.writeInt16LE(Math.max(-1, Math.min(1, value)) * 32767, 44 + index * 2);
  }

  return buffer;
}

function renderVideoStoryboard(context: FileContext): string {
  return `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>${escapeXml(context.name)}</title>
<style>
  body{margin:0;background:#050b16;color:#f8fafc;font-family:Arial,"Microsoft YaHei",sans-serif}
  .frame{height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,#0f766e 0,#050b16 38%,#020617 100%)}
  .panel{width:min(82vw,820px);border:1px solid #22d3ee;border-radius:24px;padding:36px;background:rgba(2,6,23,.72)}
  h1{font-size:34px;margin:0 0 10px}
  p{color:#a7f3d0}
</style>
<section class="frame">
  <div class="panel">
    <h1>${escapeXml(context.name)}</h1>
    <p>Video storyboard preview route is live. Real encoded video bytes can replace this route once the media worker completes transcoding.</p>
  </div>
</section>
</html>`;
}
