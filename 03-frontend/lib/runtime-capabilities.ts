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
  viewer: RuntimeViewerCapabilities;
  registry: RuntimeRegistryCapabilities;
  storage: RuntimeStorageCapabilities;
  storeCapabilities: RuntimeStoreCapabilities;
  localImplementationMode: 'in_memory_preview';
  productionCaveats: string[];
}

export const runtimeCapabilitiesClient = {
  get: () =>
    backendRequest<RuntimeCapabilities>('/v1/runtime/capabilities', {
      cache: 'no-store',
    }),
};
