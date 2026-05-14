// Runtime capability client.
// License: Apache-2.0

import { backendRequest } from './backend-api';

export interface RuntimeGenerationCapabilities {
  modes: string[];
  artifactKinds: string[];
  artifactStatuses: string[];
  geometryFormats: string[];
  propertyIndexFormats: string[];
  assetKindsPhase7: string[];
  conversionOperations: string[];
}

export interface RuntimeViewerCapabilities {
  adapterHints: string[];
  commandKinds: string[];
  candidateOnlyAdapterHints: string[];
}

export type BimInformationDomain =
  | 'spatial_structure'
  | 'element_identity'
  | 'geometry'
  | 'properties'
  | 'materials'
  | 'systems'
  | 'relationships'
  | 'classifications'
  | 'model_quantity_takeoff'
  | 'schedule_4d'
  | 'cost_5d'
  | 'documents'
  | 'coordination'
  | 'issue_management'
  | 'geospatial_context'
  | 'operations'
  | 'change_history';

export interface RuntimeHarnessEngineCapability {
  kind: 'geometry' | 'data' | 'display' | 'render' | 'ai';
  engineId: string;
  displayName: string;
  formats: Array<'cad' | 'bim' | 'pdf' | 'office' | 'image' | 'voice' | 'video'>;
  bimDomains: BimInformationDomain[];
  harnessStages: Array<'planner' | 'generator' | 'evaluator' | 'rule_checker' | 'schema_validator' | 'approver'>;
  responsibilities: string[];
  executionBoundary: 'in_process' | 'isolated_worker' | 'external_adapter';
  maturity: 'contract' | 'preview' | 'production_ready';
  productionRouteEnabled: boolean;
  proprietaryRuntimeAllowed: boolean;
}

export interface RuntimeHarnessEngineCapabilities {
  engineKinds: Array<'geometry' | 'data' | 'display' | 'render' | 'ai'>;
  requiredFormats: Array<'cad' | 'bim' | 'pdf' | 'office' | 'image' | 'voice' | 'video'>;
  requiredBimDomains: BimInformationDomain[];
  coveredBimDomains: BimInformationDomain[];
  capabilities: RuntimeHarnessEngineCapability[];
  allRequiredFormatsCovered: boolean;
  allRequiredBimDomainsCovered: boolean;
  allHarnessStagesEnforced: boolean;
}

export type OpenBimStandard = 'ifc' | 'ifc2x3' | 'ifc4' | 'ifc4x3' | 'bsdd' | 'bcf' | 'ids' | 'cobie';

export type SourceAuthoringTool =
  | 'cad'
  | 'tekla_structures'
  | 'revit'
  | 'rhino'
  | 'sketch_up'
  | 'solid_works'
  | 'unknown';

export interface RuntimeOpenBimCapabilities {
  standards: OpenBimStandard[];
  sourceAuthoringTools: SourceAuthoringTool[];
  firstDeliveryFeatures: string[];
  modelViewEnabled: boolean;
  steelBomExportEnabled: boolean;
  textToBimCurrentlyDeferred: boolean;
}

export interface RuntimeFileWorkbenchCapabilities {
  viewFamilies: string[];
  editOperations: string[];
  binarySemanticEditRequiresAdapter: boolean;
}

export interface RuntimeRegistryCapabilities {
  skills: boolean;
  mcpTools: boolean;
  knowledgeSources: boolean;
}

export interface RuntimeStorageCapabilities {
  providers: string[];
  persistsRealBytes: boolean;
  productionReady: boolean;
  s3ObjectBindings: boolean;
}

export interface RuntimeStoreCapabilities {
  objectStore: boolean;
  transactionStore: boolean;
  eventStore: boolean;
  registryStore: boolean;
  artifactStore: boolean;
  viewerCommandStore: boolean;
  knowledgeSourceStore: boolean;
  inMemoryOnly: boolean;
  inMemoryFallbackAllowed: boolean;
  postgres: boolean;
  seaOrmMigrations: boolean;
  seaweedfsS3: boolean;
  deterministicPagination: boolean;
}

export interface RuntimeCapabilities {
  activeModuleIds: string[];
  generation: RuntimeGenerationCapabilities;
  engines: RuntimeHarnessEngineCapabilities;
  openBim: RuntimeOpenBimCapabilities;
  fileWorkbench: RuntimeFileWorkbenchCapabilities;
  viewer: RuntimeViewerCapabilities;
  registry: RuntimeRegistryCapabilities;
  storage: RuntimeStorageCapabilities;
  storeCapabilities: RuntimeStoreCapabilities;
  localImplementationMode: 'in_memory_preview' | 'durable_postgres';
  productionCaveats: string[];
}

export const runtimeCapabilitiesClient = {
  get: () =>
    backendRequest<RuntimeCapabilities>('/v1/runtime/capabilities', {
      cache: 'no-store',
    }),
};
