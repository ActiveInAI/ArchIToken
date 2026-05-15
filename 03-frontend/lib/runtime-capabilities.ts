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

export type OpenBimStandard =
  | 'ifc'
  | 'ifc2x3'
  | 'ifc4'
  | 'ifc4x3'
  | 'idm'
  | 'mvd'
  | 'bsdd'
  | 'bcf'
  | 'ids'
  | 'validate'
  | 'cobie'
  | 'open_cde_api';

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

export type CdeInformationState = 'work_in_progress' | 'shared' | 'published' | 'archive';

export type CdeStandardFamily =
  | 'information_management'
  | 'semantic_model'
  | 'information_requirement'
  | 'issue_coordination'
  | 'classification'
  | 'handover'
  | 'api_and_sync'
  | 'enterprise_interop';

export type CdeExecutionStatus =
  | 'enforced'
  | 'adapter_ready'
  | 'external_service_required'
  | 'reference_only';

export interface CdeStandardContract {
  id: string;
  name: string;
  family: CdeStandardFamily;
  basis: string;
  status: CdeExecutionStatus;
  controls: string[];
}

export interface CdeExternalAdapterContract {
  id: string;
  name: string;
  boundary: string;
  role: string;
  routes: string[];
  productionRule: string;
}

export interface RuntimeCdeCapabilities {
  informationStates: CdeInformationState[];
  standardContracts: CdeStandardContract[];
  externalAdapters: CdeExternalAdapterContract[];
  mandatoryContainerControls: string[];
  completeOpenBimStandardCoverage: boolean;
  speckleObjectGraphReady: boolean;
  chinaEnterpriseInteropReady: boolean;
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
  cde: RuntimeCdeCapabilities;
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
