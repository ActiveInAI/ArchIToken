// lib/local-file-runtime.ts - Next.js local file runtime contract
// License: Apache-2.0

import { normalizeModuleId, type ModuleId } from './module-registry';

export type LocalFileStatus =
  | 'uploaded'
  | 'schema_validating'
  | 'pending_approval'
  | 'approved'
  | 'archived';

export type LocalFileViewerKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'text'
  | 'json'
  | 'csv'
  | 'office'
  | 'engineering'
  | 'archive'
  | 'unknown';

export interface LocalFileMetadata {
  fileId: string;
  originalName: string;
  moduleId: ModuleId;
  size: number;
  mimeType: string;
  ext: string;
  storagePath: string;
  createdAt: string;
  owner: string;
  status: LocalFileStatus;
  version: string;
  tags: string[];
  checksum: string;
}

export interface LocalFileIndex {
  files: LocalFileMetadata[];
}

export const localUploadsRelativeDir = '.architoken/uploads';
export const localUploadsIndexFile = 'index.json';

const textExtensions = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.yaml',
  '.yml',
  '.xml',
  '.log',
  '.mermaid',
  '.mmd',
]);
const jsonExtensions = new Set(['.json', '.geojson']);
const csvExtensions = new Set(['.csv', '.tsv']);
const officeExtensions = new Set([
  '.doc',
  '.docx',
  '.odt',
  '.rtf',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.xlsb',
  '.ods',
  '.ppt',
  '.pptx',
  '.odp',
]);
const engineeringExtensions = new Set([
  '.3dm',
  '.ifc',
  '.ifczip',
  '.glb',
  '.gltf',
  '.dwg',
  '.dxf',
  '.step',
  '.stp',
  '.iges',
  '.igs',
  '.brep',
  '.e57',
  '.las',
  '.ply',
  '.spz',
  '.bcf',
  '.ids',
  '.nc',
  '.obj',
  '.rfa',
  '.rvt',
  '.skp',
  '.stl',
  '.fbx',
]);
const archiveExtensions = new Set(['.zip', '.rar', '.7z', '.tar', '.gz']);

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export function inferMimeType(
  name: string,
  fallback = 'application/octet-stream',
): string {
  const ext = extensionOf(name);
  const map: Record<string, string> = {
    '.3dm': 'model/vnd.3dm',
    '.aac': 'audio/aac',
    '.bcf': 'application/bcf',
    '.brep': 'model/vnd.brep',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.dwg': 'application/acad',
    '.dxf': 'image/vnd.dxf',
    '.e57': 'model/e57',
    '.fbx': 'model/vnd.fbx',
    '.flac': 'audio/flac',
    '.gif': 'image/gif',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.gz': 'application/gzip',
    '.heic': 'image/heic',
    '.ifczip': 'application/x-ifczip',
    '.ifc': 'application/x-step',
    '.iges': 'model/iges',
    '.igs': 'model/iges',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.json': 'application/json',
    '.las': 'application/octet-stream',
    '.m4a': 'audio/mp4',
    '.md': 'text/markdown',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.nc': 'text/plain',
    '.obj': 'model/obj',
    '.odp': 'application/vnd.oasis.opendocument.presentation',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf',
    '.pdfa': 'application/pdf',
    '.ply': 'model/ply',
    '.png': 'image/png',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.rar': 'application/vnd.rar',
    '.rfa': 'application/vnd.autodesk.revit.family',
    '.rtf': 'application/rtf',
    '.rvt': 'application/vnd.autodesk.revit',
    '.skp': 'model/vnd.sketchup.skp',
    '.spz': 'model/vnd.gaussian-splat',
    '.stl': 'model/stl',
    '.step': 'model/step',
    '.stp': 'model/step',
    '.svg': 'image/svg+xml',
    '.tar': 'application/x-tar',
    '.txt': 'text/plain',
    '.wav': 'audio/wav',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
    '.xls': 'application/vnd.ms-excel',
    '.xlsb': 'application/vnd.ms-excel.sheet.binary.macroenabled.12',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroenabled.12',
    '.xlsx':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xml': 'application/xml',
    '.yaml': 'application/yaml',
    '.yml': 'application/yaml',
    '.zip': 'application/zip',
  };
  return map[ext] ?? fallback;
}

export function getLocalFileViewerKind(
  input: Pick<LocalFileMetadata, 'mimeType' | 'ext'>,
): LocalFileViewerKind {
  const mime = input.mimeType.toLowerCase();
  const ext = input.ext.toLowerCase();

  if (mime === 'application/pdf' || ext === '.pdf' || ext === '.pdfa')
    return 'pdf';
  if (jsonExtensions.has(ext) || mime.includes('json')) return 'json';
  if (csvExtensions.has(ext)) return 'csv';
  if (officeExtensions.has(ext)) return 'office';
  if (engineeringExtensions.has(ext) || mime.startsWith('model/'))
    return 'engineering';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (textExtensions.has(ext) || mime.startsWith('text/')) return 'text';
  if (archiveExtensions.has(ext)) return 'archive';
  return 'unknown';
}

export function isDigitalTwinSourceFile(
  input: Pick<LocalFileMetadata, 'ext' | 'mimeType'>,
): boolean {
  const kind = getLocalFileViewerKind(input);
  return kind === 'image' || kind === 'video' || kind === 'engineering';
}

export function normalizeUploadModuleId(
  value: FormDataEntryValue | string | null,
): ModuleId {
  const normalized = normalizeModuleId(
    String(value ?? 'construction_supervision'),
  );
  return normalized ?? 'construction_supervision';
}
