// buildingSMART openBIM API client.
// License: Apache-2.0

import { backendRequest } from './backend-api';
import type { OpenBimStandard, SourceAuthoringTool } from './runtime-capabilities';

export type IfcSchema = 'ifc2x3' | 'ifc4' | 'ifc4x3';

export interface OpenBimIngestRequest {
  name: string;
  sourceAuthoringTool?: SourceAuthoringTool;
  ifcContent: string;
  actor?: string;
}

export interface OpenBimModelRecord {
  modelId: string;
  name: string;
  schema: IfcSchema;
  standards: OpenBimStandard[];
  sourceAuthoringTool: SourceAuthoringTool;
  elementCount: number;
  steelElementCount: number;
  tenantId: string;
  projectId: string;
  actor: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BimViewerManifest {
  manifestId: string;
  modelId: string;
  modelName: string;
  schema: IfcSchema;
  preferredGeometryFormat: 'ifc';
  elementIdNamespace: 'ifc_guid';
  viewerAdapters: string[];
  supportedCommands: string[];
  elementCount: number;
  steelElementCount: number;
  sourceAuthoringTool: SourceAuthoringTool;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SteelBomItem {
  rowNo: number;
  stepId: string;
  ifcGuid: string;
  ifcEntity: string;
  category: string;
  name: string | null;
  objectType: string | null;
  tag: string | null;
  material: string | null;
  profile: string | null;
  quantity: string;
  unit: string;
  lengthM: string | null;
  areaM2: string | null;
  volumeM3: string | null;
  weightKg: string | null;
  sourceLine: number;
}

export interface SteelBomSummary {
  totalItems: number;
  byIfcEntity: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface SteelBomExport {
  exportId: string;
  modelId: string;
  modelName: string;
  schema: IfcSchema;
  standard: string;
  items: SteelBomItem[];
  summary: SteelBomSummary;
  csv: string;
  generatedAt: string;
}

export const openBimClient = {
  ingestModel: (body: OpenBimIngestRequest) =>
    backendRequest<OpenBimModelRecord>('/v1/openbim/models', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getModel: (modelId: string) =>
    backendRequest<OpenBimModelRecord>(`/v1/openbim/models/${modelId}`, {
      cache: 'no-store',
    }),
  viewerManifest: (modelId: string) =>
    backendRequest<BimViewerManifest>(`/v1/openbim/models/${modelId}/viewer-manifest`, {
      cache: 'no-store',
    }),
  steelBom: (modelId: string) =>
    backendRequest<SteelBomExport>(`/v1/openbim/models/${modelId}/bom`, {
      cache: 'no-store',
    }),
  steelBomCsvUrl: (modelId: string) => `/v1/openbim/models/${modelId}/bom.csv`,
};
