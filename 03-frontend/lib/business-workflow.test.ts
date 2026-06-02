// lib/business-workflow.test.ts - Module workflow action contract tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  activeModuleIds,
  getModuleDependencyIssues,
  getModuleSpec,
  moduleSpecs,
} from "./module-registry";
import {
  applyWorkbenchAction,
  createWorkbenchRuntime,
  describeAction,
} from "./business-workflow";
import {
  generateArtifact,
  runRuleCheck,
  validateSchema,
} from "./module-actions";
import { SessionModuleBackendAdapter } from "./module-backend-adapter";
import { getModuleRootId, type ModuleFileNode } from "./module-file-system";
import { getAllowedLifecycleEvents } from "./module-lifecycle";
import { getModuleOperationalProfile } from "./module-operations";
import { moduleAssistantSuggestions } from "./ai-assistant-profile";
import type { LocalFileMetadata } from "./local-file-runtime";
import {
  aiCommercializationCapabilities,
  aiServiceTokenRules,
  steelSourceDocuments,
  steelComponentStates,
  steelLifecycleStages,
  steelWorkflowChains,
} from "./steel-business-blueprint";
import {
  heavySteelHotelDrawingPackages,
  heavySteelHotelDrawingSheets,
  heavySteelHotelProgram,
  getHeavySteelHotelPrioritySheets,
} from "./hotel-heavy-steel-program";
import {
  zaofangMarketingPreflight,
  zaofangMarketingStages,
  zaofangMarketingBudget,
} from "./zaofang-marketing-program";

describe("module registry contract", () => {
  it("uses the current production module id", () => {
    expect(activeModuleIds).toContain("production_manufacturing");
  });

  it("covers all 14 modules with operational details", () => {
    expect(moduleSpecs).toHaveLength(14);
    expect(getModuleDependencyIssues()).toEqual([]);

    for (const spec of moduleSpecs) {
      expect(spec.subdomains.length).toBeGreaterThan(0);
      expect(spec.artifacts.length).toBeGreaterThan(0);
      expect(spec.workflowStates.length).toBeGreaterThanOrEqual(4);
      expect(spec.agentGates.map((gate) => gate.name)).toEqual([
        "Planner",
        "Generator",
        "Evaluator",
        "RuleChecker",
        "SchemaValidator",
        "Approver",
      ]);
      expect(spec.tasks.length).toBeGreaterThan(0);
      expect(spec.approvals.length).toBeGreaterThan(0);
      expect(spec.risks.length).toBeGreaterThan(0);
      expect(spec.fileTypes.length).toBeGreaterThan(0);
      expect(spec.visualization.layers.length).toBeGreaterThan(0);
      expect(spec.routeHref).toBe(`/app/modules/${spec.id}`);
    }
  });

  it("keeps required deep modules expanded", () => {
    expect(
      getModuleSpec("standard_library").subdomains.map((item) => item.name),
    ).toEqual([
      "标准总库",
      "设计规范",
      "BIM与CDE标准",
      "造价合同标准",
      "材料供应链标准",
      "生产制造标准",
      "施工验收标准",
      "档案审计标准",
      "信息安全与AI治理",
    ]);
    expect(
      getModuleSpec("material_logistics").subdomains.map((item) => item.name),
    ).toContain("批次追踪");
    expect(
      getModuleSpec("production_manufacturing").subdomains.map(
        (item) => item.name,
      ),
    ).toContain("CNC/数控文件");
    expect(
      getModuleSpec("construction_management").subdomains.map(
        (item) => item.name,
      ),
    ).toContain("建筑机器人 / IoT");
    expect(getModuleSpec("digital_twin").visualization.layers).toEqual(
      expect.arrayContaining([
        "WebGPU-ready",
        "Three.js fallback",
        "IFC",
        "GLB",
        "点云",
        "360",
      ]),
    );
  });

  it("has interactive operation profiles and AI suggestions for every module", () => {
    for (const moduleId of activeModuleIds) {
      const profile = getModuleOperationalProfile(moduleId);
      expect(profile.features.length).toBeGreaterThanOrEqual(3);
      expect(profile.operations.length).toBeGreaterThanOrEqual(3);
      expect(
        moduleAssistantSuggestions[moduleId].length,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("integrates heavy-steel workflow, AI commercialization, and Token compliance anchors", () => {
    expect(steelSourceDocuments.map((doc) => doc.id)).toEqual([
      "BIM-WF-STEEL-001",
      "HS-AI-FULLCHAIN-001",
      "HS-AI-GLOBAL-CN-001",
      "HS-HOTEL-DRAWING-CATALOG-198",
      "ZFW-MKT-60D-PARTNER-001",
    ]);
    expect(steelLifecycleStages.map((stage) => stage.gate)).toEqual([
      "G0",
      "G1",
      "G2",
      "G3",
      "G4",
      "G5",
      "G6",
    ]);
    expect(steelComponentStates.map((state) => state.code)).toEqual([
      "S01",
      "S02",
      "S03",
      "S04",
      "S05",
      "S06",
      "S07",
      "S08",
      "S09",
      "S10",
    ]);
    for (const moduleId of activeModuleIds) {
      expect(
        aiCommercializationCapabilities.some(
          (capability) => capability.moduleId === moduleId,
        ),
      ).toBe(true);
    }
    expect(
      aiServiceTokenRules.find((rule) => rule.title === "红线")?.items,
    ).toContain("不得现金退出");
    expect(steelWorkflowChains.map((chain) => chain.sourceDocumentId)).toEqual(
      expect.arrayContaining([
        "HS-HOTEL-DRAWING-CATALOG-198",
        "ZFW-MKT-60D-PARTNER-001",
      ]),
    );
  });

  it("loads the complete 100-room Q235B hotel drawing catalog into module data", () => {
    expect(heavySteelHotelProgram.totalDrawings).toBe(198);
    expect(heavySteelHotelProgram.packageCount).toBe(8);
    expect(heavySteelHotelProgram.sectionCount).toBe(33);
    expect(heavySteelHotelDrawingPackages.map((pack) => pack.count)).toEqual([
      42, 25, 33, 30, 16, 20, 14, 18,
    ]);
    expect(heavySteelHotelDrawingSheets).toHaveLength(198);
    expect(getHeavySteelHotelPrioritySheets("高")).toHaveLength(111);
    expect(getModuleSpec("detailed_design").summary).toContain("198 份图纸");
    expect(getModuleSpec("production_manufacturing").dataObjects).toContain(
      "bolt_hole_coordinates",
    );
    expect(
      getModuleSpec("construction_management").visualization.layers,
    ).toContain("螺栓紧固");
  });

  it("loads the Zaofang 60-day partner promotion SOP into business modules", () => {
    expect(zaofangMarketingPreflight).toHaveLength(5);
    expect(zaofangMarketingStages.map((stage) => stage.id)).toEqual([
      "online-cold-start",
      "offline-partner-breakthrough",
      "partner-enablement",
      "word-of-mouth-blast",
      "sample-house-close",
    ]);
    expect(
      zaofangMarketingBudget.find((item) => item.item === "标杆案例打造")
        ?.amountRmb,
    ).toBe(550000);
    expect(
      getModuleSpec("marketing_service").subdomains.map((item) => item.name),
    ).toEqual(
      expect.arrayContaining(["0号合伙人", "样板房体验", "标杆案例传播"]),
    );
    expect(getModuleSpec("finance_hr").dataObjects).toContain(
      "partner_commission_ledgers",
    );
  });
});

describe("module action handlers", () => {
  it("changes artifact state for each workbench action", () => {
    const spec = getModuleSpec("digital_twin");
    const artifact = spec.artifacts[0];
    expect(artifact).toBeDefined();

    const generated = generateArtifact(spec.id, artifact!);
    expect(generated.artifact.status).toBe("generated");

    const checked = runRuleCheck(spec.id, generated.artifact);
    expect(checked.artifact.status).toBe("rule_checked");

    const validated = validateSchema(spec.id, checked.artifact);
    expect(validated.artifact.status).toBe("schema_validated");
  });

  it("updates runtime state and audit trail", () => {
    const state = createWorkbenchRuntime("construction_management");
    const firstArtifact = state.artifacts[0];
    expect(firstArtifact).toBeDefined();

    const generated = applyWorkbenchAction(
      state,
      firstArtifact!.id,
      "generate",
    );
    expect(generated.artifacts[0]?.status).toBe("generated");
    expect(generated.auditTrail).toHaveLength(1);
    expect(describeAction("approve")).toBe("审批");
  });
});

describe("session backend adapter contract", () => {
  it("supports all required file context operations with state changes", () => {
    const adapter = new SessionModuleBackendAdapter();
    const moduleId = "standard_library";
    const rootId = getModuleRootId(moduleId);
    const folder = adapter
      .listFiles(moduleId, rootId)
      .find((node) => node.type === "folder");
    expect(folder).toBeDefined();

    const openedFolder = adapter.openFile(folder!.id);
    expect(openedFolder.node.type).toBe("folder");

    const created = adapter.createFile({
      moduleId,
      parentId: folder!.id,
      name: "右键新建资料夹",
      type: "folder",
    });
    expect(created.node.name).toBe("右键新建资料夹");

    const uploaded = adapter.uploadFile({
      moduleId,
      parentId: folder!.id,
      name: "上传规范.pdf",
    });
    expect(uploaded.node.status).toBe("uploaded");

    const viewed = adapter.openFile(uploaded.node.id);
    expect(viewed.node.name).toBe("上传规范.pdf");

    const downloaded = adapter.downloadFile(uploaded.node.id);
    expect(downloaded.job.status).toBe("ready");

    const copied = adapter.copyFile(uploaded.node.id);
    expect(copied.clipboard.sourceFileId).toBe(uploaded.node.id);

    const pasted = adapter.pasteFile(moduleId, rootId);
    expect(pasted.nodes[0]?.status).toBe("copied");

    const renamed = adapter.renameFile(uploaded.node.id, "已重命名规范.pdf");
    expect(renamed.node.name).toBe("已重命名规范.pdf");

    const moved = adapter.moveFile(uploaded.node.id, rootId);
    expect(moved.node.parentId).toBe(rootId);

    const shared = adapter.shareFile(uploaded.node.id);
    expect(shared.link.url).toContain("/share/");

    const properties = adapter.getProperties(uploaded.node.id);
    expect(properties.node.permissions.length).toBeGreaterThan(0);

    const deleted = adapter.deleteFile(uploaded.node.id);
    expect(deleted.node.status).toBe("soft_deleted");
  });

  it("deduplicates local uploads when backend CDE metadata arrives", () => {
    const adapter = new SessionModuleBackendAdapter();
    const moduleId = "digital_twin";
    const rootId = getModuleRootId(moduleId);
    const metadata: LocalFileMetadata = {
      fileId: "local-test-ifc",
      originalName: "结构模型.ifc",
      moduleId,
      parentId: rootId,
      size: 2048,
      mimeType: "application/x-step",
      ext: ".ifc",
      storagePath: "/tmp/architoken/结构模型.ifc",
      createdAt: "2026-05-18T01:00:00Z",
      owner: "当前用户",
      status: "schema_validating",
      version: "v1.0",
      tags: ["local-upload", "openbim"],
      checksum: "sha256:local-ifc",
    };
    const local = adapter.uploadLocalFile(metadata, rootId);
    expect(local.node.source).toBe("local_upload");

    const backendNode: ModuleFileNode = {
      id: "11111111-1111-4111-8111-111111111111",
      name: metadata.originalName,
      type: "file",
      moduleId,
      parentId: rootId,
      size: metadata.size,
      mimeType: metadata.mimeType,
      status: "uploaded",
      version: "v1.0",
      owner: metadata.owner,
      updatedAt: "2026-05-18T01:01:00Z",
      tags: ["backend-cde", "local-upload"],
      permissions: ["read", "write", "share", "approve"],
      source: "backend",
      auditTrail: [],
      checksum: metadata.checksum,
    };
    const upserted = adapter.upsertModuleFileFromBackend(backendNode);
    const matching = adapter
      .listFiles(moduleId, rootId)
      .filter((node) => node.name === metadata.originalName);

    expect(upserted.node.source).toBe("backend");
    expect(upserted.node.localFileId).toBe(metadata.fileId);
    expect(upserted.node.localFile?.checksum).toBe(metadata.checksum);
    expect(matching).toHaveLength(1);
    expect(matching[0]?.id).toBe(backendNode.id);
  });

  it("binds local preview metadata when backend CDE nodes hydrate first", () => {
    const adapter = new SessionModuleBackendAdapter();
    const moduleId = "digital_twin";
    const rootId = getModuleRootId(moduleId);
    const metadata: LocalFileMetadata = {
      fileId: "local-refresh-ifc",
      originalName: "刷新后模型.ifc",
      moduleId,
      parentId: rootId,
      size: 4096,
      mimeType: "application/x-step",
      ext: ".ifc",
      storagePath: "/tmp/architoken/刷新后模型.ifc",
      createdAt: "2026-05-18T01:05:00Z",
      owner: "当前用户",
      status: "schema_validating",
      version: "v1.0",
      tags: ["local-upload", "openbim"],
      checksum: "sha256:refresh-ifc",
    };
    const backendNode: ModuleFileNode = {
      id: "22222222-2222-4222-8222-222222222222",
      name: metadata.originalName,
      type: "file",
      moduleId,
      parentId: rootId,
      size: metadata.size,
      mimeType: metadata.mimeType,
      status: "uploaded",
      version: "v1.0",
      owner: metadata.owner,
      updatedAt: "2026-05-18T01:06:00Z",
      tags: ["backend-cde", "local-upload"],
      permissions: ["read", "write", "share", "approve"],
      source: "backend",
      auditTrail: [],
      checksum: metadata.checksum,
    };

    adapter.upsertModuleFileFromBackend(backendNode);
    const local = adapter.uploadLocalFile(metadata, rootId);
    const matching = adapter
      .listFiles(moduleId, rootId)
      .filter((node) => node.name === metadata.originalName);

    expect(local.node.id).toBe(backendNode.id);
    expect(local.node.source).toBe("backend");
    expect(local.node.localFileId).toBe(metadata.fileId);
    expect(local.node.localFile?.storagePath).toBe(metadata.storagePath);
    expect(matching).toHaveLength(1);
  });

  it("drives lifecycle transactions through the state machine and approvals", () => {
    const adapter = new SessionModuleBackendAdapter();
    const moduleId = "production_manufacturing";
    const created = adapter.createTransaction({
      moduleId,
      type: "生产工单审批事务",
    });
    expect(created.transaction.currentState).toBe("draft");
    expect(
      getAllowedLifecycleEvents(created.transaction.currentState),
    ).toContain("submit");

    const submitted = adapter.transitionTransaction(
      created.transaction.id,
      "submit",
    );
    expect(submitted.transaction.currentState).toBe("submitted");

    const generated = adapter.transitionTransaction(
      created.transaction.id,
      "generate",
    );
    expect(generated.transaction.currentState).toBe("generating");

    const evaluated = adapter.transitionTransaction(
      created.transaction.id,
      "evaluate",
    );
    expect(evaluated.transaction.currentState).toBe("evaluating");

    const checked = adapter.transitionTransaction(
      created.transaction.id,
      "rule_check",
    );
    expect(checked.transaction.currentState).toBe("rule_checking");

    const validated = adapter.transitionTransaction(
      created.transaction.id,
      "validate_schema",
    );
    expect(validated.transaction.currentState).toBe("schema_validating");

    const approval = adapter.transitionTransaction(
      created.transaction.id,
      "request_approval",
    );
    expect(approval.transaction.currentState).toBe("pending_approval");

    const approved = adapter.approveTransaction(
      created.transaction.id,
      "生产负责人",
      "通过",
    );
    expect(approved.transaction.currentState).toBe("approved");

    const archived = adapter.transitionTransaction(
      created.transaction.id,
      "archive",
    );
    expect(archived.transaction.currentState).toBe("archived");
  });
});
