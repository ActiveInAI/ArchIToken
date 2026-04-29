// lib/business-workflow.ts - Module workflow helpers for the frontend workbench
// License: Apache-2.0

import {
  getModuleSpec,
  moduleActionLabels,
  type ArtifactSpec,
  type ModuleAction,
  type ModuleId,
} from './module-registry';
import { runModuleAction, type ModuleActionResult } from './module-actions';

export interface WorkbenchRuntimeState {
  moduleId: ModuleId;
  artifacts: ArtifactSpec[];
  auditTrail: ModuleActionResult['auditEvent'][];
}

export function createWorkbenchRuntime(moduleId: ModuleId): WorkbenchRuntimeState {
  const spec = getModuleSpec(moduleId);
  return {
    moduleId: spec.id,
    artifacts: spec.artifacts.map((artifact) => ({ ...artifact, evidence: [...artifact.evidence] })),
    auditTrail: [],
  };
}

export function applyWorkbenchAction(
  state: WorkbenchRuntimeState,
  artifactId: string,
  action: ModuleAction,
): WorkbenchRuntimeState {
  const artifact = state.artifacts.find((item) => item.id === artifactId);
  if (!artifact) {
    throw new Error(`Unknown artifact: ${artifactId}`);
  }

  const result = runModuleAction(state.moduleId, artifact, action);
  return {
    ...state,
    artifacts: state.artifacts.map((item) => (item.id === artifactId ? result.artifact : item)),
    auditTrail: [result.auditEvent, ...state.auditTrail].slice(0, 12),
  };
}

export function describeAction(action: ModuleAction): string {
  return moduleActionLabels[action];
}
