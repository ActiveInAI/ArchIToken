// lib/module-actions.ts - Module Workbench action handlers
// License: Apache-2.0

import type { ArtifactSpec, ArtifactStatus, ModuleAction, ModuleId } from './module-registry';

export interface ModuleActionResult {
  moduleId: ModuleId;
  artifact: ArtifactSpec;
  action: ModuleAction;
  message: string;
  auditEvent: {
    id: string;
    at: string;
    actor: string;
    summary: string;
  };
}

export function createModuleAuditEvent(
  idPrefix: string,
  actor: string,
  summary: string,
): ModuleActionResult['auditEvent'] {
  const at = new Date().toISOString();
  return {
    id: `${idPrefix}-${Date.now()}`,
    at,
    actor,
    summary,
  };
}

const transitions: Record<ModuleAction, ArtifactStatus> = {
  generate: 'generated',
  evaluate: 'evaluated',
  rule_check: 'rule_checked',
  schema_validate: 'schema_validated',
  approve: 'approved',
  archive: 'archived',
};

const actionMessages: Record<ModuleAction, string> = {
  generate: 'Planner and Generator created a new working artifact version.',
  evaluate: 'Independent Evaluator attached review findings and confidence.',
  rule_check: 'RuleChecker completed deterministic standard and business checks.',
  schema_validate: 'SchemaValidator confirmed Module Schema and file metadata.',
  approve: 'Approver moved the artifact into an approved handover state.',
  archive: 'Archive action locked the artifact for downstream evidence use.',
};

function applyAction(moduleId: ModuleId, artifact: ArtifactSpec, action: ModuleAction): ModuleActionResult {
  const status = transitions[action];
  const at = new Date().toISOString();
  const updatedArtifact: ArtifactSpec = {
    ...artifact,
    status,
    updatedAt: at.slice(0, 16).replace('T', ' '),
    evidence: [...artifact.evidence, actionMessages[action]],
  };

  return {
    moduleId,
    artifact: updatedArtifact,
    action,
    message: actionMessages[action],
    auditEvent: {
      id: `${moduleId}-${artifact.id}-${action}-${Date.now()}`,
      at,
      actor: 'ModuleWorkbench',
      summary: `${action} -> ${updatedArtifact.name} (${status})`,
    },
  };
}

export function generateArtifact(moduleId: ModuleId, artifact: ArtifactSpec): ModuleActionResult {
  return applyAction(moduleId, artifact, 'generate');
}

export function evaluateArtifact(moduleId: ModuleId, artifact: ArtifactSpec): ModuleActionResult {
  return applyAction(moduleId, artifact, 'evaluate');
}

export function runRuleCheck(moduleId: ModuleId, artifact: ArtifactSpec): ModuleActionResult {
  return applyAction(moduleId, artifact, 'rule_check');
}

export function validateSchema(moduleId: ModuleId, artifact: ArtifactSpec): ModuleActionResult {
  return applyAction(moduleId, artifact, 'schema_validate');
}

export function approveArtifact(moduleId: ModuleId, artifact: ArtifactSpec): ModuleActionResult {
  return applyAction(moduleId, artifact, 'approve');
}

export function archiveArtifact(moduleId: ModuleId, artifact: ArtifactSpec): ModuleActionResult {
  return applyAction(moduleId, artifact, 'archive');
}

export function runModuleAction(
  moduleId: ModuleId,
  artifact: ArtifactSpec,
  action: ModuleAction,
): ModuleActionResult {
  const handlers: Record<ModuleAction, (id: ModuleId, item: ArtifactSpec) => ModuleActionResult> = {
    generate: generateArtifact,
    evaluate: evaluateArtifact,
    rule_check: runRuleCheck,
    schema_validate: validateSchema,
    approve: approveArtifact,
    archive: archiveArtifact,
  };

  return handlers[action](moduleId, artifact);
}
