// app/api/panai/host/route.ts - PanAI direct-control host bridge for ArchIToken
// License: Apache-2.0

import { NextResponse } from "next/server";
import { createModuleAuditEvent, runModuleAction } from "@/lib/module-actions";
import { moduleBackendAdapter } from "@/lib/module-backend-adapter";
import { getModuleRootId } from "@/lib/module-file-system";
import {
  activeModuleIds,
  getModuleSpec,
  moduleActionLabels,
  moduleSpecs,
  normalizeModuleId,
  type ModuleAction,
  type ModuleId,
} from "@/lib/module-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PanAIHostCommand =
  | "manifest"
  | "get_module"
  | "navigate_module"
  | "list_files"
  | "snapshot"
  | "run_artifact_action"
  | "create_audit_event";

type PanAIHostRequest = {
  command?: unknown;
  moduleId?: unknown;
  artifactId?: unknown;
  action?: unknown;
  parentId?: unknown;
  actor?: unknown;
  summary?: unknown;
};

export async function GET() {
  return NextResponse.json(buildPanAIHostManifest());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PanAIHostRequest;
  const command = normalizeCommand(body.command);

  try {
    switch (command) {
      case "manifest":
        return NextResponse.json(buildPanAIHostManifest());
      case "get_module":
        return NextResponse.json(getModulePayload(requiredModuleId(body.moduleId)));
      case "navigate_module":
        return NextResponse.json(navigateModule(requiredModuleId(body.moduleId)));
      case "list_files":
        return NextResponse.json(
          listFilesPayload(
            requiredModuleId(body.moduleId),
            typeof body.parentId === "string" && body.parentId.trim()
              ? body.parentId.trim()
              : undefined,
          ),
        );
      case "snapshot":
        return NextResponse.json(snapshotPayload(optionalModuleId(body.moduleId)));
      case "run_artifact_action":
        return NextResponse.json(
          runArtifactActionPayload(
            requiredModuleId(body.moduleId),
            requiredString(body.artifactId, "artifactId"),
            requiredModuleAction(body.action),
          ),
        );
      case "create_audit_event":
        return NextResponse.json(
          createAuditEventPayload(
            requiredModuleId(body.moduleId),
            typeof body.actor === "string" && body.actor.trim() ? body.actor.trim() : "PanAI",
            requiredString(body.summary, "summary"),
          ),
        );
      default:
        return NextResponse.json(
          {
            error: "unsupported PanAI host command",
            supportedCommands: supportedCommands(),
          },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "PanAI host command failed",
      },
      { status: 400 },
    );
  }
}

function buildPanAIHostManifest() {
  return {
    schema: "architoken.panai.host.v1",
    product: "ArchIToken",
    controller: "PanAI",
    integrationMode: "direct_api",
    embeddedUi: false,
    legacyEmbeddedControl: "removed",
    routes: {
      host: "/api/panai/host",
      modules: moduleSpecs.map((spec) => ({
        id: spec.id,
        name: spec.zhName,
        routeHref: spec.routeHref,
        status: spec.status,
        schemaRef: spec.schemaRef,
      })),
    },
    commands: supportedCommands(),
    artifactActions: Object.entries(moduleActionLabels).map(([id, label]) => ({
      id,
      label,
    })),
    routerBoundary:
      "PanAI -> ArchIToken Host Bridge -> WorkflowRouter/ToolRouter/ModelRouter/InferenceRouter -> CDE/AuditTrail -> Approver",
    professionalGate:
      "Missing professional source, rule evidence, schema validation, or approval means output remains heuristic draft only.",
  };
}

function supportedCommands(): PanAIHostCommand[] {
  return [
    "manifest",
    "get_module",
    "navigate_module",
    "list_files",
    "snapshot",
    "run_artifact_action",
    "create_audit_event",
  ];
}

function getModulePayload(moduleId: ModuleId) {
  const spec = getModuleSpec(moduleId);
  return {
    schema: "architoken.panai.module.v1",
    module: {
      id: spec.id,
      name: spec.zhName,
      enName: spec.enName,
      summary: spec.summary,
      objective: spec.objective,
      routeHref: spec.routeHref,
      schemaRef: spec.schemaRef,
      status: spec.status,
      subdomains: spec.subdomains,
      artifacts: spec.artifacts,
      workflowStates: spec.workflowStates,
      agentGates: spec.agentGates,
      approvals: spec.approvals,
      risks: spec.risks,
      standards: spec.standards,
      dataObjects: spec.dataObjects,
    },
  };
}

function navigateModule(moduleId: ModuleId) {
  const spec = getModuleSpec(moduleId);
  const auditEvent = createModuleAuditEvent(
    `panai-navigate-${moduleId}`,
    "PanAI",
    `PanAI 请求切换到 ${spec.zhName} 模块`,
  );
  return {
    schema: "architoken.panai.navigation.v1",
    action: "navigate",
    moduleId,
    href: spec.routeHref,
    label: spec.zhName,
    auditEvent,
  };
}

function listFilesPayload(moduleId: ModuleId, parentId = getModuleRootId(moduleId)) {
  return {
    schema: "architoken.panai.files.v1",
    moduleId,
    parentId,
    files: moduleBackendAdapter.listFiles(moduleId, parentId),
    uploadedFiles: moduleBackendAdapter.listUploadedFiles(moduleId),
  };
}

function snapshotPayload(moduleId: ModuleId | undefined) {
  const snapshot = moduleBackendAdapter.snapshot(moduleId);
  return {
    schema: "architoken.panai.snapshot.v1",
    moduleId: moduleId ?? null,
    snapshot,
  };
}

function runArtifactActionPayload(
  moduleId: ModuleId,
  artifactId: string,
  action: ModuleAction,
) {
  const spec = getModuleSpec(moduleId);
  const artifact = spec.artifacts.find((item) => item.id === artifactId);
  if (!artifact) {
    throw new Error(`unknown artifactId for ${moduleId}: ${artifactId}`);
  }
  const result = runModuleAction(moduleId, artifact, action);
  return {
    schema: "architoken.panai.artifact-action.v1",
    controlledBy: "PanAI",
    route:
      "PanAI -> Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver",
    result,
  };
}

function createAuditEventPayload(moduleId: ModuleId, actor: string, summary: string) {
  const auditEvent = createModuleAuditEvent(`panai-${moduleId}`, actor, summary);
  const merge = moduleBackendAdapter.mergeModuleAuditEventsFromBackend([
    {
      ...auditEvent,
      actor,
      summary: `PanAI: ${summary}`,
    },
  ]);
  return {
    schema: "architoken.panai.audit.v1",
    moduleId,
    auditEvent,
    merge,
  };
}

function normalizeCommand(value: unknown): PanAIHostCommand {
  return typeof value === "string" && value.trim()
    ? (value.trim() as PanAIHostCommand)
    : "manifest";
}

function optionalModuleId(value: unknown): ModuleId | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredModuleId(value);
}

function requiredModuleId(value: unknown): ModuleId {
  if (typeof value !== "string") {
    throw new Error("moduleId is required");
  }
  const moduleId = normalizeModuleId(value);
  if (!moduleId || !(activeModuleIds as readonly string[]).includes(moduleId)) {
    throw new Error(`unknown moduleId: ${value}`);
  }
  return moduleId;
}

function requiredModuleAction(value: unknown): ModuleAction {
  if (typeof value !== "string" || !(value in moduleActionLabels)) {
    throw new Error("action must be one of: " + Object.keys(moduleActionLabels).join(", "));
  }
  return value as ModuleAction;
}

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}
