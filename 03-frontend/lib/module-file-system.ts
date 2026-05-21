// lib/module-file-system.ts - Typed module file system for ArchIToken modules
// License: Apache-2.0

import {
  activeModuleIds,
  getModuleSpec,
  type ModuleId,
} from "./module-registry";
import type {
  LocalFileMetadata,
  LocalFileViewerKind,
} from "./local-file-runtime";

export type ModuleFileNodeKind = "folder" | "file";
export type ModuleFileStatus =
  | "active"
  | "uploaded"
  | "downloading"
  | "shared"
  | "copied"
  | "moved"
  | "schema_validating"
  | "pending_approval"
  | "soft_deleted"
  | "archived";

export interface ModuleAuditEvent {
  id: string;
  at: string;
  actor: string;
  summary: string;
}

export interface ModuleFileNode {
  id: string;
  name: string;
  type: ModuleFileNodeKind;
  moduleId: ModuleId;
  parentId: string | null;
  size: number;
  mimeType: string;
  status: ModuleFileStatus;
  version: string;
  owner: string;
  updatedAt: string;
  tags: string[];
  permissions: string[];
  auditTrail: ModuleAuditEvent[];
  source?: "seed" | "session" | "backend" | "local_upload";
  localFileId?: string;
  localFile?: LocalFileMetadata;
  viewerKind?: LocalFileViewerKind;
  checksum?: string;
}

export const standardLibrarySemanticDictionaryFileId =
  "standard_library-sjg157-semantic-dictionary";

export function isStandardLibrarySemanticDictionaryNode(
  node: ModuleFileNode,
): boolean {
  return (
    node.moduleId === "standard_library" &&
    node.id === standardLibrarySemanticDictionaryFileId
  );
}

export interface ModuleDownloadJob {
  id: string;
  fileId: string;
  fileName: string;
  status: "queued" | "ready";
  createdAt: string;
}

export interface ModuleShareLink {
  id: string;
  fileId: string;
  fileName: string;
  url: string;
  createdAt: string;
}

export interface ModuleClipboard {
  sourceFileId: string;
  sourceName: string;
  mode: "copy";
}

const moduleFolders: Record<ModuleId, string[]> = {
  planning_management: [
    "项目策划",
    "立项资料",
    "WBS",
    "Project Planning Studio",
    "图表模板库",
    "进度计划",
    "资源负荷",
    "RACI矩阵",
    "风险清单",
    "版本归档",
    "审批记录",
  ],
  marketing_service: [
    "前期准备",
    "官网落地页",
    "企业微信承接",
    "0号合伙人",
    "合伙人网络",
    "合伙人工具包",
    "样板房接待",
    "标杆案例素材",
    "佣金结算证据",
    "每日复盘",
  ],
  concept_design: ["场地资料", "方案草图", "风格参考", "指标测算", "展示包"],
  standard_library: [
    "标准规范",
    "企业工法",
    "构件族库",
    "审查规则",
    "IDS规则",
    "IFC映射",
    "项目模板",
    "RAG知识库",
    "版本库",
  ],
  detailed_design: [
    "01重钢装配式钢结构专项深化",
    "02建筑土建深化",
    "03室内精装深化",
    "04机电综合深化",
    "05软装厨房景观智能化",
    "06装配式围护结构专项",
    "07消防专项深化",
    "08现场装配施工工艺",
    "平面候选与家具布置",
    "P1先行冻结包",
    "穿梁孔位双签",
    "BCF碰撞闭环",
  ],
  quantity_costing: ["工程量", "BOQ", "成本测算", "价格库", "变更估算"],
  material_logistics: [
    "库存",
    "供应商",
    "价格",
    "采购计划",
    "SS-04-08构件BOM",
    "模块运输加固",
    "包装单元",
    "装车顺序",
    "物流ETA",
    "到货签收",
    "堆场分区",
    "批次追踪",
  ],
  production_manufacturing: [
    "P1生产放行",
    "钢构件加工详图",
    "螺栓孔位坐标",
    "CNC数控数据",
    "仅工厂焊接",
    "防腐防火涂装",
    "工厂质检放行",
    "MES ERP",
    "Paperclip生产编排",
    "构件BOM",
    "构件编码",
    "包装发运",
    "返工",
  ],
  construction_management: [
    "吊装顺序",
    "调平校准",
    "螺栓紧固",
    "拼缝防渗隔声",
    "干湿作业分区",
    "样板间试装放行",
    "物料进场核对",
    "关键工序QC",
    "安全文明施工",
    "日志",
    "AR",
    "360",
    "三维扫描",
    "倾斜摄影",
    "无人机",
    "建筑机器人",
    "IoT",
    "整改",
    "竣工资料",
  ],
  digital_twin: [
    "IFC",
    "GLB",
    "点云",
    "360",
    "三维扫描",
    "倾斜摄影",
    "WebGPU 快照",
  ],
  digital_archive: [
    "项目档案",
    "图纸档案",
    "模型档案",
    "审批记录",
    "施工日志",
    "质量安全",
    "竣工资料",
    "版本链",
  ],
  finance_hr: [
    "合同台账",
    "付款发票",
    "成本台账",
    "人员班组",
    "考勤绩效",
    "结算归档",
  ],
  ai_center: [
    "模型供应商",
    "AI API网关",
    "RAG知识库",
    "MCP工具注册",
    "Agent编排",
    "OpenClaw自动化",
    "安全审计",
    "成本策略",
  ],
  settings_center: [
    "租户设置",
    "模块开关",
    "用户角色",
    "权限策略",
    "模型路由",
    "存储适配器",
    "审计策略",
  ],
};

const standardLibraryStandardCategories: Record<string, string[]> = {
  中国国家标准: [
    "GB/T 50326 建设工程项目管理规范.pdf",
    "GB/T 51212 建筑信息模型应用统一标准.pdf",
    "GB 50500 建设工程工程量清单计价规范.pdf",
    "GB/T 50328 建设工程文件归档规范.pdf",
    "GB 50300 建筑工程施工质量验收统一标准.pdf",
    "GB 50205 钢结构工程施工质量验收标准.pdf",
    "GB 50661 钢结构焊接规范.pdf",
    "GB 550xx 工程建设强制性规范系列.pdf",
  ],
  中国地方标准: [
    "DB11/T 1069-2024 北京民用建筑信息模型交付标准.pdf",
    "SJG 114-2022 深圳建筑信息模型数据存储标准.pdf",
    "DG/TJ08-2201-2023 上海建筑信息模型技术应用统一标准.pdf",
  ],
  国际ISO标准: [
    "ISO 19650 BIM信息管理.pdf",
    "ISO 29481 信息交付手册IDM.pdf",
    "ISO 16739 IFC数据交换.pdf",
    "ISO 12911 BIM实施框架.pdf",
    "ISO 12006 建设信息分类.pdf",
    "ISO 9001 质量管理.pdf",
    "ISO 14001 环境管理.pdf",
    "ISO 45001 职业健康安全.pdf",
    "ISO 15489 记录管理.pdf",
    "ISO 19011 管理体系审核.pdf",
    "ISO 31000 风险管理.pdf",
    "ISO 27001 信息安全.pdf",
    "ISO 27701 隐私信息管理.pdf",
    "ISO-IEC 42001 AI管理体系.pdf",
  ],
  美国标准包: [
    "IBC 国际建筑规范.pdf",
    "NFPA 消防与生命安全标准.pdf",
    "OSHA 职业安全健康要求.pdf",
    "AISC 360 钢结构规范.pdf",
    "AWS D1.1 焊接规范.pdf",
    "CSI MasterFormat 编码体系.pdf",
    "OmniClass 分类体系.pdf",
  ],
  欧洲标准包: [
    "Eurocodes 欧洲结构设计规范.pdf",
    "EN 1993 钢结构设计.pdf",
    "EN 1090 钢结构执行标准.pdf",
    "CEN TC 442 BIM标准.pdf",
    "GDPR 数据保护要求.pdf",
    "EU AI Act 人工智能法案.pdf",
  ],
  澳新标准包: [
    "NCC BCA 澳洲国家施工规范.pdf",
    "AS NZS 5131 结构钢制造与安装.pdf",
    "WHS 职业健康安全要求.pdf",
    "Privacy Act 隐私保护要求.pdf",
    "ISO 19650 AU Adoption.pdf",
  ],
  项目管理标准: [
    "PMBOK PMP 项目管理知识体系.pdf",
    "IPMP IPMA ICB 能力基线.pdf",
    "ISO 21502 项目管理指南.pdf",
    "ISO 10006 项目质量管理指南.pdf",
    "GB/T 50326 建设工程项目管理规范.pdf",
  ],
  设计规范: [
    "GB 50016 建筑设计防火规范.pdf",
    "GB 50011 建筑抗震设计规范.pdf",
    "GB 50017 钢结构设计标准.pdf",
    "GB 50009 建筑结构荷载规范.pdf",
    "AISC 360 钢结构设计规范.pdf",
    "Eurocode 3 钢结构设计规范.pdf",
  ],
  BIM与CDE标准: [
    "ISO 19650 信息管理流程.pdf",
    "ISO 29481 信息交付手册IDM.pdf",
    "ISO 16739 IFC数据交换.pdf",
    "buildingSMART IDS规则.pdf",
    "buildingSMART BCF问题协同.pdf",
    "CDE状态机与审批规则.json",
  ],
  造价合同标准: [
    "GB 50500 建设工程工程量清单计价规范.pdf",
    "FIDIC 合同条件.pdf",
    "NEC 合同体系.pdf",
    "JCT 合同体系.pdf",
    "RICS NRM 新计量规则.pdf",
    "ICMS 国际建设计量标准.pdf",
    "AACE 成本工程体系.pdf",
  ],
  材料供应链标准: [
    "ISO 9001 质量管理.pdf",
    "ISO 14001 环境管理.pdf",
    "ISO 45001 职业健康安全.pdf",
    "ISO 28000 供应链安全.pdf",
    "材料证书与批次追溯规则.json",
  ],
  生产制造标准: [
    "ISO 3834 焊接质量要求.pdf",
    "EN 1090 钢结构执行.pdf",
    "AWS D1.1 焊接规范.pdf",
    "GB 50205 钢结构工程施工质量验收标准.pdf",
    "GB 50661 钢结构焊接规范.pdf",
    "BOM与加工单规则.json",
  ],
  施工验收标准: [
    "GB 50300 建筑工程施工质量验收统一标准.pdf",
    "GB 50205 钢结构工程施工质量验收标准.pdf",
    "ISO 45001 职业健康安全.pdf",
    "OSHA 施工安全要求.pdf",
    "WHS 施工安全要求.pdf",
    "检验批与隐蔽验收规则.json",
  ],
  档案记录标准: [
    "GB/T 50328 建设工程文件归档规范.pdf",
    "ISO 15489 记录管理.pdf",
    "ISO 30301 记录管理体系.pdf",
    "ISO 14721 OAIS长期保存.pdf",
    "PDF-A长期保存规则.pdf",
    "电子签章与版本链规则.json",
  ],
  审计内控标准: [
    "ISO 19011 管理体系审核指南.pdf",
    "ISO 31000 风险管理.pdf",
    "COSO 内控框架.pdf",
    "SOC 2 服务组织控制.pdf",
    "审计证据链规则.json",
  ],
  信息安全与AI治理: [
    "ISO 27001 信息安全管理.pdf",
    "ISO 27701 隐私信息管理.pdf",
    "ISO-IEC 42001 AI管理体系.pdf",
    "NIST AI RMF.pdf",
    "等保2.0要求.pdf",
    "PIPL DSL CSL 数据合规.pdf",
    "GDPR 数据保护.pdf",
    "EU AI Act 人工智能法案.pdf",
    "AI调用审计与RAG权限规则.json",
  ],
};

export const moduleMimeByExtension: Record<string, string> = {
  ".3dm": "model/vnd.3dm",
  ".aac": "audio/aac",
  ".bcf": "application/bcf",
  ".brep": "model/vnd.brep",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".dwg": "application/acad",
  ".dxf": "image/vnd.dxf",
  ".e57": "model/e57",
  ".fbx": "model/vnd.fbx",
  ".flac": "audio/flac",
  ".gif": "image/gif",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".heic": "image/heic",
  ".ifczip": "application/x-ifczip",
  ".ifc": "application/x-step",
  ".iges": "model/iges",
  ".igs": "model/iges",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".las": "application/octet-stream",
  ".m4a": "audio/mp4",
  ".md": "text/markdown",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".nc": "text/plain",
  ".obj": "model/obj",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
  ".pdfa": "application/pdf",
  ".ply": "model/ply",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".rfa": "application/vnd.autodesk.revit.family",
  ".rtf": "application/rtf",
  ".rvt": "application/vnd.autodesk.revit",
  ".skp": "model/vnd.sketchup.skp",
  ".spz": "model/vnd.gaussian-splat",
  ".stl": "model/stl",
  ".step": "model/step",
  ".stp": "model/step",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsb": "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  ".xlsm": "application/vnd.ms-excel.sheet.macroenabled.12",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".yaml": "application/yaml",
  ".zip": "application/zip",
};

export function getModuleMimeTypeForName(
  name: string,
  type: ModuleFileNodeKind = "file",
): string {
  if (type === "folder") {
    return "inode/directory";
  }
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex < 0) {
    return "application/octet-stream";
  }
  return (
    moduleMimeByExtension[name.slice(dotIndex).toLowerCase()] ??
    "application/octet-stream"
  );
}

export function getModuleRootId(moduleId: ModuleId): string {
  return `${moduleId}-root`;
}

export function getModuleFolderNames(moduleId: ModuleId): string[] {
  return moduleFolders[moduleId];
}

export function formatModuleFileSize(size: number): string {
  if (size <= 0) {
    return "-";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
}

function audit(summary: string): ModuleAuditEvent {
  const at = new Date().toISOString();
  return {
    id: `seed-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at,
    actor: "SessionModuleBackendAdapter",
    summary,
  };
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function node(
  input: Omit<
    ModuleFileNode,
    "auditTrail" | "permissions" | "updatedAt" | "version"
  > & {
    version?: string;
    updatedAt?: string;
    permissions?: string[];
  },
): ModuleFileNode {
  return {
    ...input,
    version: input.version ?? "v1.0",
    updatedAt: input.updatedAt ?? "2026-04-28 09:00",
    permissions: input.permissions ?? ["read", "write", "share", "approve"],
    source: "seed",
    auditTrail: [audit(`seed ${input.type} ${input.name}`)],
  };
}

export function createInitialModuleFileNodes(): ModuleFileNode[] {
  return activeModuleIds.flatMap((moduleId) => {
    const spec = getModuleSpec(moduleId);
    const rootId = getModuleRootId(moduleId);
    const root = node({
      id: rootId,
      name: spec.zhName,
      type: "folder",
      moduleId,
      parentId: null,
      size: 0,
      mimeType: "inode/directory",
      status: "active",
      owner: "ArchIToken 平台",
      tags: ["root", spec.track],
    });

    const fallbackFolders = [
      "工作区根",
      "业务对象",
      "输入资料",
      "过程文件",
      "交付物",
      "审批记录",
      "审计归档",
    ];
    const folderNames = moduleFolders[moduleId] ?? fallbackFolders;

    const children = folderNames.flatMap((folderName, folderIndex) => {
      const folderId = `${moduleId}-${slug(folderName) || `folder-${folderIndex}`}`;
      const folder = node({
        id: folderId,
        name: folderName,
        type: "folder",
        moduleId,
        parentId: rootId,
        size: 0,
        mimeType: "inode/directory",
        status: "active",
        owner: spec.zhName,
        tags: ["folder", spec.track],
      });

      if (moduleId === "standard_library" && folderName === "标准规范") {
        const standardCategoryNodes = Object.entries(
          standardLibraryStandardCategories,
        ).flatMap(([categoryName, standardFiles], categoryIndex) => {
          const categoryId = `${folderId}-${slug(categoryName) || `standard-${categoryIndex}`}`;
          const categoryFolder = node({
            id: categoryId,
            name: categoryName,
            type: "folder",
            moduleId,
            parentId: folderId,
            size: 0,
            mimeType: "inode/directory",
            status: "active",
            owner: spec.zhName,
            tags: ["standard-category", folderName, spec.track],
          });

          const categoryFiles = standardFiles.map((fileName, fileIndex) => {
            const extension = fileName.slice(fileName.lastIndexOf("."));
            return node({
              id: `${categoryId}-file-${fileIndex + 1}`,
              name: fileName,
              type: "file",
              moduleId,
              parentId: categoryId,
              size: 480_000 + categoryIndex * 63_000 + fileIndex * 127_000,
              mimeType:
                moduleMimeByExtension[extension] ?? "application/octet-stream",
              status: fileIndex === 0 ? "active" : "uploaded",
              owner: spec.zhName,
              tags: [
                "标准规范",
                categoryName,
                spec.track,
                extension.replace(".", ""),
              ],
            });
          });

          return [categoryFolder, ...categoryFiles];
        });

        return [folder, ...standardCategoryNodes];
      }

      return [folder];
    });

    const businessObjects =
      moduleId === "standard_library"
        ? [
            node({
              id: standardLibrarySemanticDictionaryFileId,
              name: "建筑工程信息模型语义字典",
              type: "file",
              moduleId,
              parentId: rootId,
              size: 5_679,
              mimeType: "application/vnd.architoken.semantic-dictionary+json",
              status: "active",
              owner: "深圳市住房和建设局",
              tags: [
                "standard-library",
                "semantic-dictionary",
                "SJG 157-2024",
                "szbd",
                spec.track,
              ],
              version: "SJG 157-2024",
              updatedAt: "2024-04-01 00:00",
              permissions: ["read", "share", "approve"],
            }),
          ]
        : [];

    return [root, ...businessObjects, ...children];
  });
}
