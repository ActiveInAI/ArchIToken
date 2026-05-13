// Module catalog API client.
// License: Apache-2.0

import { backendRequest } from './backend-api';

export interface ModuleCatalogLegacyAlias {
  alias: string;
  normalizedModuleId: string;
  reason: string;
}

export interface ModuleCatalogItem {
  id: string;
  order: number;
  zhName: string;
  enName: string;
  track: string;
  status: string;
  summary: string;
  routeHref: string;
  schemaRef: string;
  legacyAliases: ModuleCatalogLegacyAlias[];
}

export interface ModuleCatalogResponse {
  modules: ModuleCatalogItem[];
  total: number;
}

export const moduleCatalogClient = {
  list: () =>
    backendRequest<ModuleCatalogResponse>('/v1/modules', {
      cache: 'no-store',
    }),
};
