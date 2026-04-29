// lib/business-modules.ts - Compatibility adapter for the Module Registry workbench
// License: Apache-2.0

import {
  getModuleDependencyIssues,
  getModuleReadinessScore,
  getModuleSpec,
  moduleSpecs,
  moduleStatusLabels,
  type ModuleId,
  type ModuleSpec,
  type ModuleStatus,
  type ModuleTrack,
} from './module-registry';

export type BusinessModuleStatus = ModuleStatus;
export type BusinessModuleTrack = ModuleTrack;

export interface BusinessModuleSpec {
  id: ModuleId;
  order: number;
  zhName: string;
  enName: string;
  track: BusinessModuleTrack;
  status: BusinessModuleStatus;
  summary: string;
  inputs: ModuleId[];
  outputs: ModuleId[];
  primaryArtifacts: string[];
  aiCapabilities: string[];
  standards: string[];
  qualityGates: string[];
  dataObjects: string[];
  routeHref: string;
  contractHref?: string;
}

export { getModuleDependencyIssues, getModuleReadinessScore, moduleStatusLabels };

function toBusinessModuleSpec(spec: ModuleSpec): BusinessModuleSpec {
  const base = {
    id: spec.id,
    order: spec.order,
    zhName: spec.zhName,
    enName: spec.enName,
    track: spec.track,
    status: spec.status,
    summary: spec.summary,
    inputs: spec.inputs,
    outputs: spec.outputs,
    primaryArtifacts: spec.artifacts.map((artifact) => artifact.name),
    aiCapabilities: spec.agentGates.map((gate) => `${gate.name}: ${gate.responsibility}`),
    standards: spec.standards,
    qualityGates: spec.workflowStates.map((step) => `${step.name}: ${step.description}`),
    dataObjects: spec.dataObjects,
    routeHref: spec.routeHref,
  };

  if (spec.id === 'digital_twin') {
    return { ...base, contractHref: '/02-architecture/DIGITAL_TWIN.md' };
  }

  return base;
}

export const businessModules: BusinessModuleSpec[] = moduleSpecs.map(toBusinessModuleSpec);

export function getBusinessModule(moduleId: string): BusinessModuleSpec {
  return toBusinessModuleSpec(getModuleSpec(moduleId));
}
