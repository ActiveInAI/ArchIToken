// lib/module-registry.ts - ArchIToken frontend Module Schema fixtures
// License: Apache-2.0

import {
  heavySteelHotelDrawingSheets,
  heavySteelHotelProgram,
  getHeavySteelHotelSheetsForModule,
} from "./hotel-heavy-steel-program";
import {
  zaofangMarketingProgram,
  zaofangMarketingStages,
  getZaofangMarketingStagesForModule,
} from "./zaofang-marketing-program";

export type ModuleStatus = "active" | "pilot" | "planned" | "foundation";
export type ModuleTrack =
  | "customer"
  | "design"
  | "governance"
  | "cost"
  | "supply"
  | "factory"
  | "site"
  | "twin"
  | "archive"
  | "platform";

export type ArtifactStatus =
  | "draft"
  | "generated"
  | "evaluated"
  | "rule_checked"
  | "schema_validated"
  | "approved"
  | "archived";

export type WorkflowStateStatus =
  | "queued"
  | "running"
  | "blocked"
  | "passed"
  | "approved";
export type AgentGateStatus = "pending" | "running" | "passed" | "blocked";
export type ApprovalStatus =
  | "not_started"
  | "waiting"
  | "approved"
  | "rejected";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ModuleAction =
  | "generate"
  | "evaluate"
  | "rule_check"
  | "schema_validate"
  | "approve"
  | "archive";

export interface SubdomainSpec {
  id: string;
  name: string;
  purpose: string;
  ownerRole: string;
  capabilityLevel: "foundation" | "workflow" | "automation" | "simulation";
}

export interface ArtifactSpec {
  id: string;
  name: string;
  type: string;
  status: ArtifactStatus;
  owner: string;
  updatedAt: string;
  evidence: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: WorkflowStateStatus;
  description: string;
}

export interface AgentGate {
  id: string;
  name:
    | "Planner"
    | "Generator"
    | "Evaluator"
    | "RuleChecker"
    | "SchemaValidator"
    | "Approver";
  status: AgentGateStatus;
  responsibility: string;
}

export interface ModuleTask {
  id: string;
  title: string;
  assignee: string;
  state: "todo" | "doing" | "review" | "done";
  due: string;
}

export interface ApprovalRecord {
  id: string;
  title: string;
  status: ApprovalStatus;
  approver: string;
}

export interface RiskBlocker {
  id: string;
  title: string;
  level: RiskLevel;
  mitigation: string;
}

export interface VisualizationSpec {
  mode:
    | "form"
    | "board"
    | "timeline"
    | "model"
    | "map"
    | "hmi"
    | "archive"
    | "settings";
  title: string;
  layers: string[];
  telemetry: string[];
}

export interface ModuleSpec {
  id: ModuleId;
  order: number;
  zhName: string;
  enName: string;
  track: ModuleTrack;
  status: ModuleStatus;
  summary: string;
  objective: string;
  subdomains: SubdomainSpec[];
  inputs: ModuleId[];
  outputs: ModuleId[];
  artifacts: ArtifactSpec[];
  workflowStates: WorkflowStep[];
  agentGates: AgentGate[];
  tasks: ModuleTask[];
  approvals: ApprovalRecord[];
  risks: RiskBlocker[];
  fileTypes: string[];
  visualization: VisualizationSpec;
  standards: string[];
  dataObjects: string[];
  routeHref: string;
  schemaRef: string;
}

export const activeModuleIds = [
  "personal_center",
  "marketing_service",
  "planning_management",
  "concept_design",
  "standard_library",
  "detailed_design",
  "quantity_costing",
  "material_logistics",
  "production_manufacturing",
  "construction_management",
  "digital_twin",
  "digital_archive",
  "finance_management",
  "human_resources",
  "ai_center",
  "settings_center",
] as const;

export type ModuleId = (typeof activeModuleIds)[number];

export const MODULE_TREE_GROUPS = [
  {
    id: "business_growth",
    title: "业务增长",
    modules: ["personal_center", "marketing_service", "planning_management"],
  },
  {
    id: "design_standard",
    title: "设计与标准",
    modules: ["concept_design", "standard_library", "detailed_design"],
  },
  {
    id: "cost_supply_production",
    title: "成本供应链",
    modules: [
      "quantity_costing",
      "material_logistics",
      "production_manufacturing",
    ],
  },
  {
    id: "site_delivery",
    title: "现场交付",
    modules: ["construction_management", "digital_twin", "digital_archive"],
  },
  {
    id: "enterprise_intelligence",
    title: "经营智能",
    modules: [
      "finance_management",
      "human_resources",
      "ai_center",
      "settings_center",
    ],
  },
] satisfies Array<{
  id: string;
  title: string;
  modules: ModuleId[];
}>;

export const moduleStatusLabels: Record<ModuleStatus, string> = {
  active: "运行中",
  pilot: "试点",
  planned: "编排中",
  foundation: "底座",
};

export const artifactStatusLabels: Record<ArtifactStatus, string> = {
  draft: "草稿",
  generated: "已生成",
  evaluated: "已评估",
  rule_checked: "已校核",
  schema_validated: "Schema 已验证",
  approved: "已审批",
  archived: "已归档",
};

export const moduleActionLabels: Record<ModuleAction, string> = {
  generate: "生成",
  evaluate: "评估",
  rule_check: "校核",
  schema_validate: "Schema",
  approve: "审批",
  archive: "归档",
};

const baseAgentGates: AgentGate[] = [
  {
    id: "planner",
    name: "Planner",
    status: "passed",
    responsibility: "拆解任务、选择输入、建立执行路径。",
  },
  {
    id: "generator",
    name: "Generator",
    status: "running",
    responsibility: "生成方案、模型、清单、报告或业务单据。",
  },
  {
    id: "evaluator",
    name: "Evaluator",
    status: "pending",
    responsibility: "独立评估输出质量,不得自评。",
  },
  {
    id: "rule-checker",
    name: "RuleChecker",
    status: "pending",
    responsibility: "按规范、企业规则、工程约束做确定性校核。",
  },
  {
    id: "schema-validator",
    name: "SchemaValidator",
    status: "pending",
    responsibility: "校验 JSON Schema、IFC Schema 和 Module Schema。",
  },
  {
    id: "approver",
    name: "Approver",
    status: "pending",
    responsibility: "执行人工或自动最终门禁。",
  },
];

function gates(): AgentGate[] {
  return baseAgentGates.map((gate) => ({ ...gate }));
}

function artifact(
  id: string,
  name: string,
  type: string,
  owner: string,
  evidence: string[],
): ArtifactSpec {
  return {
    id,
    name,
    type,
    status: "draft",
    owner,
    updatedAt: "2026-04-27 09:30",
    evidence,
  };
}

function workflow(moduleId: ModuleId): WorkflowStep[] {
  return [
    {
      id: `${moduleId}-intake`,
      name: "Intake",
      status: "passed",
      description: "输入资料、权限、项目上下文和模块目标已登记。",
    },
    {
      id: `${moduleId}-authoring`,
      name: "Authoring",
      status: "running",
      description: "Agent 和人工协作生成模块交付物。",
    },
    {
      id: `${moduleId}-gate`,
      name: "Gate Review",
      status: "queued",
      description: "进入评估、规则校核、Schema 校验和审批。",
    },
    {
      id: `${moduleId}-handover`,
      name: "Handover",
      status: "queued",
      description: "输出给下游模块或归档为可追溯证据。",
    },
  ];
}

function task(
  id: string,
  title: string,
  assignee: string,
  state: ModuleTask["state"],
): ModuleTask {
  return { id, title, assignee, state, due: "2026-05-06" };
}

function approval(id: string, title: string, approver: string): ApprovalRecord {
  return { id, title, approver, status: "waiting" };
}

function risk(
  id: string,
  title: string,
  level: RiskLevel,
  mitigation: string,
): RiskBlocker {
  return { id, title, level, mitigation };
}

const hotelHighPriorityDrawingCount =
  heavySteelHotelProgram.priorityCounts["高"];
const hotelProductionSheets = getHeavySteelHotelSheetsForModule(
  "production_manufacturing",
);
const hotelConstructionSheets = getHeavySteelHotelSheetsForModule(
  "construction_management",
);
const zaofangMarketingStageCount = zaofangMarketingStages.length;
const zaofangMarketingStagesForMarketing =
  getZaofangMarketingStagesForModule("marketing_service");

export const moduleSpecs: ModuleSpec[] = [
  {
    id: "personal_center",
    order: 1,
    zhName: "个人中心",
    enName: "Personal Center",
    track: "platform",
    status: "foundation",
    summary:
      "统一承载个人资料、账号安全、消息通知、最近工作、个人审批、收藏和偏好设置,作为进入业务模块前的个人工作入口。",
    objective:
      "让每个用户在同一 Open CDE 壳中管理身份、权限可见性、个人待办、最近文件、通知偏好和会话安全,并把个人操作写入审计链。",
    subdomains: [
      {
        id: "profile",
        name: "个人资料",
        purpose: "维护姓名、岗位、执业资质、联系方式和默认项目身份。",
        ownerRole: "当前用户",
        capabilityLevel: "foundation",
      },
      {
        id: "account-security",
        name: "账号安全",
        purpose: "管理登录会话、设备、二次验证、密钥和异常访问提醒。",
        ownerRole: "当前用户",
        capabilityLevel: "workflow",
      },
      {
        id: "notifications",
        name: "消息通知",
        purpose: "汇总审批、任务、文件、AI 运行和系统通知的个人提醒。",
        ownerRole: "当前用户",
        capabilityLevel: "workflow",
      },
      {
        id: "recent-work",
        name: "最近工作",
        purpose: "快速返回最近项目、模块、文件、图纸、模型和审计记录。",
        ownerRole: "当前用户",
        capabilityLevel: "automation",
      },
      {
        id: "personal-approvals",
        name: "个人审批",
        purpose: "列出由当前用户处理的待审、已审、抄送和退回事项。",
        ownerRole: "审批人",
        capabilityLevel: "workflow",
      },
      {
        id: "preferences",
        name: "偏好设置",
        purpose: "配置主题、字号、目录状态、默认模块和本地工作台偏好。",
        ownerRole: "当前用户",
        capabilityLevel: "foundation",
      },
    ],
    inputs: ["settings_center"],
    outputs: [
      "marketing_service",
      "planning_management",
      "digital_archive",
      "settings_center",
    ],
    artifacts: [
      artifact("personal-profile-token", "个人资料 Token", "JSON", "当前用户", [
        "岗位",
        "资质",
        "联系方式",
      ]),
      artifact("personal-workspace-index", "个人工作索引", "JSON", "当前用户", [
        "最近模块",
        "最近文件",
        "收藏",
      ]),
      artifact(
        "notification-preference-policy",
        "通知偏好策略",
        "JSON",
        "当前用户",
        ["审批提醒", "任务提醒", "AI运行提醒"],
      ),
    ],
    workflowStates: workflow("personal_center"),
    agentGates: gates(),
    tasks: [
      task("pc-t1", "核对个人资料、岗位和执业资质", "当前用户", "doing"),
      task("pc-t2", "整理个人待办、审批和最近文件", "当前用户", "todo"),
      task("pc-t3", "确认通知、主题和目录偏好", "当前用户", "todo"),
    ],
    approvals: [approval("pc-a1", "个人资料与权限可见性确认", "当前用户")],
    risks: [
      risk(
        "pc-r1",
        "个人身份、权限或通知偏好与组织策略不一致",
        "high",
        "个人中心只能配置用户可见范围内的偏好,权限边界必须由 settings_center 和 IAM 策略约束。",
      ),
    ],
    fileTypes: [".json", ".pdf", ".png", ".docx"],
    visualization: {
      mode: "settings",
      title: "个人资料、待办、通知和最近工作入口",
      layers: ["资料", "安全", "通知", "最近工作", "审批", "偏好"],
      telemetry: [
        "personal_task_count",
        "approval_pending_count",
        "recent_file_count",
        "session_security_score",
      ],
    },
    standards: [
      "PIPL personal information protection",
      "ISO 27001 access control",
      "SOC 2 identity audit",
      "enterprise IAM policy",
    ],
    dataObjects: [
      "user_profiles",
      "personal_preferences",
      "notification_settings",
      "recent_work_items",
      "personal_approval_tasks",
      "security_sessions",
    ],
    routeHref: "/app/modules/personal_center",
    schemaRef: "module.schema/personal_center.v1",
  },
  {
    id: "marketing_service",
    order: 2,
    zhName: "市场客服",
    enName: "Marketing Service",
    track: "customer",
    status: "planned",
    summary: `${zaofangMarketingProgram.title}: 按 ${zaofangMarketingStageCount} 段闭环执行线上冷启动、0号合伙人、合伙人赋能、标杆案例、样板房成交和裂变复盘。`,
    objective:
      "把官网/落地页、企微承接、合伙人档案、样板房体验、标杆案例和签约后服务沉淀为可追溯 Lead Token,不得用虚假承诺替代证据。",
    subdomains: [
      {
        id: "landing-page",
        name: "官网/落地页",
        purpose: "承载8项核心内容、企微二维码和预约看房入口。",
        ownerRole: "增长负责人",
        capabilityLevel: "workflow",
      },
      {
        id: "wechat-intake",
        name: "企业微信承接",
        purpose: "自动欢迎语、避坑手册、预约系统和客户标签体系。",
        ownerRole: "企微顾问",
        capabilityLevel: "automation",
      },
      {
        id: "zero-partner",
        name: "0号合伙人",
        purpose: "筛选每城至少1个高信任本地种子合伙人并签约。",
        ownerRole: "合伙人经理",
        capabilityLevel: "workflow",
      },
      {
        id: "partner-network",
        name: "合伙人网络",
        purpose: "拓展设计机构、包工头、商会负责人和乡村意见领袖。",
        ownerRole: "渠道负责人",
        capabilityLevel: "workflow",
      },
      {
        id: "sample-house",
        name: "样板房体验",
        purpose: "用实景、AR透视、型材样品、数据看板和工艺展示完成转化。",
        ownerRole: "样板房接待",
        capabilityLevel: "simulation",
      },
      {
        id: "case-spread",
        name: "标杆案例传播",
        purpose: "形成本地案例视频、图片和合伙人圈层转发证据。",
        ownerRole: "内容运营",
        capabilityLevel: "automation",
      },
      {
        id: "after-sign-service",
        name: "签约后服务",
        purpose: "每周同步施工进度并引导客户二次裂变。",
        ownerRole: "客户成功",
        capabilityLevel: "workflow",
      },
    ],
    inputs: [],
    outputs: [
      "planning_management",
      "concept_design",
      "finance_management",
      "digital_archive",
    ],
    artifacts: [
      artifact(
        "zaofang-lead-token",
        "造房网 Lead Token",
        "JSON + PDF",
        "合伙人经理",
        ["企微加微记录", "客户标签", "预约看房"],
      ),
      artifact(
        "partner-network-register",
        "10-15个合伙人网络档案",
        "XLSX + JSON",
        "渠道负责人",
        ["合伙人协议", "资源类型", "签约时间"],
      ),
      artifact(
        "sample-house-conversion-pack",
        "样板房10步转化包",
        "PDF + Video + JSON",
        "样板房接待",
        ["AR透视记录", "预算测算表", "签约记录"],
      ),
      artifact(
        "benchmark-case-media-pack",
        "本地标杆案例传播包",
        "MP4 + JPG + Copy",
        "内容运营",
        ["客户采访", "施工过程素材", "转发记录"],
      ),
    ],
    workflowStates: workflow("marketing_service"),
    agentGates: gates(),
    tasks: [
      task("ms-t1", "完成三城重点乡镇和样板房选址核验", "增长负责人", "doing"),
      task(
        "ms-t2",
        `锁定 ${zaofangMarketingStagesForMarketing.length} 段推广执行证据字段`,
        "Planner Agent",
        "todo",
      ),
      task(
        "ms-t3",
        "建立合伙人服务群、档案和佣金结算追踪",
        "渠道负责人",
        "todo",
      ),
    ],
    approvals: [
      approval("ms-a1", "客户资料与企微承接授权", "客户代表"),
      approval("ms-a2", "合伙人协议和5%佣金政策复核", "商务负责人"),
    ],
    risks: [
      risk(
        "ms-r1",
        "夸大宣传或虚假承诺",
        "critical",
        "页面、口播、合伙人话术和接待话术必须保留证据,不得承诺超出政策范围的补贴、工期或收益。",
      ),
      risk(
        "ms-r2",
        "合伙人佣金拖欠影响信任链",
        "high",
        "佣金规则必须进入 finance_management 结算台账,客户签约回款后 7 个工作日内跟踪。",
      ),
    ],
    fileTypes: [".pdf", ".docx", ".jpg", ".mp4", ".xlsx", ".json", ".qr"],
    visualization: {
      mode: "timeline",
      title: "造房网 60 天合伙人推广漏斗",
      layers: [
        "前期准备",
        "线上冷启动",
        "0号合伙人",
        "合伙人赋能",
        "标杆案例",
        "样板房成交",
        "裂变复盘",
      ],
      telemetry: [
        "partner_signed_count",
        "wechat_leads",
        "sample_house_visits",
        "contract_signed_count",
        "commission_settlement_sla",
      ],
    },
    standards: [
      "PIPL consent record",
      "广告宣传真实性审查",
      "合同授权与电子签章",
      "PMBOK stakeholder register",
      "佣金结算内控",
    ],
    dataObjects: [
      "leads",
      "contacts",
      "wechat_intakes",
      "partner_profiles",
      "partner_agreements",
      "sample_house_visits",
      "case_media_assets",
      "commission_records",
    ],
    routeHref: "/app/modules/marketing_service",
    schemaRef: "module.schema/marketing_service.v1",
  },
  {
    id: "planning_management",
    order: 3,
    zhName: "计划管理",
    enName: "Planning Management",
    track: "governance",
    status: "pilot",
    summary:
      "把市场线索、合同边界、设计任务和施工目标转成项目立项、WBS、里程碑、资源计划、风险、RACI 和项目管理图表。",
    objective:
      "形成可被方案设计、造价、生产、施工和财务共同消费的 Project Plan Token,并支持在线编制、任务拆解、进度反馈、图表分析、进度预警、进度调整、任务状态、保存版本、审批归档和导出。",
    subdomains: [
      {
        id: "project-initiation",
        name: "项目立项",
        purpose: "管理机会转项目、项目编码、合同边界和责任矩阵。",
        ownerRole: "项目经理",
        capabilityLevel: "workflow",
      },
      {
        id: "wbs-cbs",
        name: "WBS / CBS",
        purpose: "建立工作分解、成本分解、责任分解和交付物分解。",
        ownerRole: "计划工程师",
        capabilityLevel: "automation",
      },
      {
        id: "milestone-plan",
        name: "里程碑计划",
        purpose: "管理设计、采购、制造、物流、施工和竣工关键节点。",
        ownerRole: "项目控制经理",
        capabilityLevel: "workflow",
      },
      {
        id: "schedule-control",
        name: "进度控制",
        purpose:
          "承载人工计划编制、反馈采集、偏差预警、调整记录和任务状态闭环。",
        ownerRole: "计划工程师",
        capabilityLevel: "automation",
      },
      {
        id: "resource-plan",
        name: "资源计划",
        purpose: "统筹人、机、料、资金、设备和外协资源。",
        ownerRole: "资源经理",
        capabilityLevel: "simulation",
      },
      {
        id: "approval-plan",
        name: "审批计划",
        purpose: "配置方案、模型、清单、采购、生产、施工、付款和归档审批路径。",
        ownerRole: "流程管理员",
        capabilityLevel: "workflow",
      },
    ],
    inputs: ["marketing_service", "standard_library"],
    outputs: [
      "concept_design",
      "quantity_costing",
      "production_manufacturing",
      "construction_management",
      "finance_management",
      "human_resources",
    ],
    artifacts: [
      artifact(
        "project-plan-token",
        "Project Plan Token",
        "JSON + CDE",
        "项目经理",
        ["立项资料", "责任矩阵", "图表模板"],
      ),
      artifact("wbs-baseline", "WBS/CBS 基线", "XLSX + JSON", "计划工程师", [
        "里程碑",
        "资源约束",
      ]),
      artifact(
        "schedule-control-log",
        "进度反馈与调整台账",
        "JSON + XLSX",
        "计划工程师",
        ["进度反馈", "偏差预警", "调整记录"],
      ),
      artifact(
        "planning-diagrams",
        "计划图表包",
        "ARCHIPLAN + SVG + CSV + MMD",
        "计划工程师",
        ["甘特", "WBS", "RACI", "风险矩阵"],
      ),
      artifact("approval-plan", "审批计划", "YAML", "流程管理员", [
        "审批矩阵",
        "权限边界",
      ]),
    ],
    workflowStates: workflow("planning_management"),
    agentGates: gates(),
    tasks: [
      task("pl-t1", "建立项目 WBS、里程碑和责任矩阵", "项目经理", "doing"),
      task("pl-t2", "同步设计、采购、制造、施工关键窗口", "计划工程师", "todo"),
      task("pl-t3", "登记本周进度反馈并生成偏差预警", "计划工程师", "review"),
    ],
    approvals: [approval("pl-a1", "项目计划基线审批", "项目负责人")],
    risks: [
      risk(
        "pl-r1",
        "计划与资源、成本、现场窗口不一致",
        "high",
        "计划基线必须绑定 WBS、CBS、资源和审批路径。",
      ),
    ],
    fileTypes: [
      ".archiplan.json",
      ".mpp",
      ".xer",
      ".xlsx",
      ".csv",
      ".pdf",
      ".json",
      ".yaml",
      ".mmd",
      ".bpmn",
      ".svg",
    ],
    visualization: {
      mode: "timeline",
      title: "Project Planning Studio · 项目计划、WBS、图表和里程碑总控",
      layers: [
        "立项",
        "WBS",
        "CBS",
        "甘特",
        "PERT",
        "RACI",
        "看板",
        "资源",
        "审批",
        "风险",
      ],
      telemetry: [
        "milestone_readiness",
        "resource_conflict_count",
        "approval_delay",
        "critical_path_length",
        "diagram_version_count",
        "schedule_performance_index",
        "schedule_alert_count",
      ],
    },
    standards: [
      "PMBOK schedule baseline",
      "ISO 21502",
      "ISO 19650 MIDP/TIDP",
      "GB/T 50326",
    ],
    dataObjects: [
      "projects",
      "wbs_items",
      "cbs_items",
      "milestones",
      "resource_plans",
      "approval_routes",
      "plan_baselines",
      "progress_feedback",
      "schedule_alerts",
      "schedule_adjustments",
      "task_status_events",
    ],
    routeHref: "/app/modules/planning_management",
    schemaRef: "module.schema/planning_management.v1",
  },
  {
    id: "concept_design",
    order: 4,
    zhName: "方案设计",
    enName: "Concept Design",
    track: "design",
    status: "pilot",
    summary: "把需求转成多方案、概念模型、风格图、投资边界和可建造性判断。",
    objective: "生成可比选、可审查、可深化的 Concept Token。",
    subdomains: [
      {
        id: "scheme-generation",
        name: "多方案生成",
        purpose: "生成平面、体量、风格和功能组合。",
        ownerRole: "建筑设计师",
        capabilityLevel: "automation",
      },
      {
        id: "visual-option",
        name: "效果表达",
        purpose: "文本生成图片、图片生成视频和概念模型。",
        ownerRole: "视觉设计师",
        capabilityLevel: "automation",
      },
      {
        id: "feasibility",
        name: "可建造性初筛",
        purpose: "初筛结构、造价和规范风险。",
        ownerRole: "技术负责人",
        capabilityLevel: "workflow",
      },
    ],
    inputs: ["marketing_service", "standard_library"],
    outputs: ["detailed_design", "quantity_costing"],
    artifacts: [
      artifact("concept-token", "Concept Token", "JSON", "方案设计师", [
        "需求边界",
        "方案评分",
      ]),
      artifact("scheme-pack", "三方案比选包", "PDF + GLB", "Generator Agent", [
        "概念图",
        "体块模型",
      ]),
    ],
    workflowStates: workflow("concept_design"),
    agentGates: gates(),
    tasks: [
      task("cd-t1", "生成三套可比选空间方案", "Generator Agent", "doing"),
      task("cd-t2", "校核预算、工期、场地限制", "Evaluator Agent", "todo"),
    ],
    approvals: [approval("cd-a1", "概念方案客户确认", "业主代表")],
    risks: [
      risk(
        "cd-r1",
        "概念表现与可建造性脱节",
        "high",
        "方案输出必须附结构和成本初筛。",
      ),
    ],
    fileTypes: [".png", ".mp4", ".ifc", ".glb", ".pdf", ".json"],
    visualization: {
      mode: "model",
      title: "多方案体块对比",
      layers: ["体块", "日照", "交通", "投资热力", "风险标注"],
      telemetry: ["scheme_score", "cost_delta", "constructability_score"],
    },
    standards: ["PMBOK scope baseline", "ISO 19650 OIR/PIR", "GB/T 50326"],
    dataObjects: [
      "concepts",
      "concept_variants",
      "scheme_scores",
      "style_tags",
    ],
    routeHref: "/app/modules/concept_design",
    schemaRef: "module.schema/concept_design.v1",
  },
  {
    id: "standard_library",
    order: 5,
    zhName: "标准族库",
    enName: "Standard Library",
    track: "governance",
    status: "foundation",
    summary:
      "工程全生命周期标准规范中心,统一管理项目管理、设计、BIM/CDE、造价合同、材料供应链、生产制造、施工质量安全、档案记录、审计内控、信息安全与AI治理标准。",
    objective:
      "把国内外标准、地方规范、企业工法、构件族库、编码体系和审查规则转成可搜索、可引用、可校验、可审计的 Standard Token。",
    subdomains: [
      {
        id: "standard-packs",
        name: "标准总库",
        purpose:
          "管理国内外项目管理、设计、造价、生产、施工、档案、审计、信息安全、AI治理与BIM标准包。",
        ownerRole: "标准工程师",
        capabilityLevel: "automation",
      },
      {
        id: "design-codes",
        name: "设计规范",
        purpose:
          "管理建筑、结构、消防、抗震、钢结构、强制性条文和地方设计要求。",
        ownerRole: "设计总工",
        capabilityLevel: "workflow",
      },
      {
        id: "bim-cde",
        name: "BIM与CDE标准",
        purpose:
          "管理 ISO 19650、IFC、IDS、BCF、IDM、信息交付计划和CDE状态规则。",
        ownerRole: "BIM 经理",
        capabilityLevel: "automation",
      },
      {
        id: "cost-contract",
        name: "造价合同标准",
        purpose:
          "管理清单计价、工程量、合同体系、变更、签证、索赔、付款和结算规则。",
        ownerRole: "成本经理",
        capabilityLevel: "workflow",
      },
      {
        id: "material-supply",
        name: "材料供应链标准",
        purpose:
          "管理材料证书、供应商资质、采购、批次、物流、到场验收和追溯要求。",
        ownerRole: "供应链经理",
        capabilityLevel: "workflow",
      },
      {
        id: "production-quality",
        name: "生产制造标准",
        purpose:
          "管理BOM、加工单、焊接、涂装、防火、防腐、质检、包装和发运标准。",
        ownerRole: "制造负责人",
        capabilityLevel: "automation",
      },
      {
        id: "construction-acceptance",
        name: "施工验收标准",
        purpose:
          "管理施工方案、技术交底、检验批、隐蔽验收、质量安全和整改闭环。",
        ownerRole: "项目总工",
        capabilityLevel: "workflow",
      },
      {
        id: "archive-audit",
        name: "档案审计标准",
        purpose:
          "管理工程档案、电子签章、版本链、长期保存、审计证据和数据留存策略。",
        ownerRole: "文控经理",
        capabilityLevel: "foundation",
      },
      {
        id: "ai-governance",
        name: "信息安全与AI治理",
        purpose:
          "管理权限、隐私、等保、AI风险、模型调用审计、RAG知识库和Agent边界。",
        ownerRole: "安全管理员",
        capabilityLevel: "automation",
      },
    ],
    inputs: [],
    outputs: [
      "concept_design",
      "detailed_design",
      "quantity_costing",
      "material_logistics",
      "production_manufacturing",
      "construction_management",
      "digital_twin",
      "digital_archive",
      "finance_management",
      "human_resources",
      "ai_center",
      "settings_center",
    ],
    artifacts: [
      artifact("standard-token", "Standard Token", "JSON", "标准工程师", [
        "标准来源",
        "法域映射",
        "版本状态",
      ]),
      artifact(
        "clause-control-pack",
        "条文控制点包",
        "JSON Schema",
        "规则工程师",
        ["条文编号", "控制点", "证据要求"],
      ),
      artifact("family-pack", "族库构件包", "IFC + GLB", "BIM 经理", [
        "属性集",
        "版本记录",
      ]),
      artifact("rule-pack", "规则库发布包", "JSON Schema", "规则工程师", [
        "规则单元测试",
        "适用范围",
      ]),
    ],
    workflowStates: workflow("standard_library"),
    agentGates: gates(),
    tasks: [
      task(
        "sl-t1",
        "建立项目管理、设计、BIM、造价、生产、施工、档案和审计标准包",
        "标准工程师",
        "doing",
      ),
      task("sl-t2", "发布IFC/IDS/BCF与构件族库规则映射", "BIM 经理", "review"),
      task(
        "sl-t3",
        "补齐造价合同、生产制造、施工验收和数字档案控制点",
        "规则工程师",
        "todo",
      ),
    ],
    approvals: [approval("sl-a1", "企业标准族库版本发布", "技术总监")],
    risks: [
      risk(
        "sl-r1",
        "条文版本、项目法域和业务模块错配",
        "critical",
        "所有标准规则必须带 jurisdiction、version、effective_date、module_scope 和 evidence_required。",
      ),
    ],
    fileTypes: [
      ".pdf",
      ".docx",
      ".xlsx",
      ".json",
      ".yaml",
      ".ifc",
      ".ids",
      ".bcf",
      ".csv",
      ".md",
    ],
    visualization: {
      mode: "board",
      title: "工程标准知识图谱与规则版本库",
      layers: [
        "标准包",
        "条文控制点",
        "设计规范",
        "BIM/CDE",
        "造价合同",
        "材料供应链",
        "生产制造",
        "施工验收",
        "档案审计",
        "AI治理",
      ],
      telemetry: [
        "coverage_rate",
        "deprecated_items",
        "rule_pass_rate",
        "jurisdiction_conflicts",
      ],
    },
    standards: [
      "PMBOK / PMP 项目管理",
      "IPMP / IPMA ICB 能力基线",
      "ISO 21502 项目管理",
      "ISO 10006 项目质量管理指南",
      "GB/T 50326 建设工程项目管理规范",
      "GB 50016 建筑设计防火规范",
      "GB 50011 建筑抗震设计规范",
      "GB 50017 钢结构设计标准",
      "GB 550xx 工程建设强制性规范",
      "ISO 19650 BIM 信息管理",
      "ISO 29481 信息交付手册 IDM",
      "ISO 16739 IFC 数据交换",
      "ISO 12911 BIM 实施框架",
      "ISO 12006 建设信息分类",
      "GB/T 51212 建筑信息模型应用统一标准",
      "SJG 157-2024 建筑工程信息模型语义字典标准",
      "DB11/T 1069-2024 北京民用建筑信息模型交付标准",
      "SJG 114-2022 深圳建筑信息模型数据存储标准",
      "DG/TJ08-2201-2023 上海建筑信息模型技术应用统一标准",
      "GB 50500 建设工程工程量清单计价规范",
      "FIDIC / NEC / JCT 合同体系",
      "RICS NRM / ICMS / AACE 成本工程体系",
      "ISO 9001 质量管理",
      "ISO 14001 环境管理",
      "ISO 45001 职业健康安全",
      "ISO 3834 焊接质量要求",
      "EN 1090 钢结构执行",
      "AWS D1.1 焊接规范",
      "GB 50205 钢结构工程施工质量验收标准",
      "GB 50661 钢结构焊接规范",
      "GB 50300 建筑工程施工质量验收统一标准",
      "GB/T 50328 建设工程文件归档规范",
      "ISO 15489 记录管理",
      "ISO 30301 记录管理体系",
      "ISO 14721 OAIS 长期保存",
      "ISO 19011 管理体系审核",
      "ISO 31000 风险管理",
      "COSO 内控框架",
      "ISO 27001 信息安全",
      "ISO 27701 隐私信息管理",
      "ISO/IEC 42001 AI 管理体系",
      "NIST AI RMF",
      "等保 2.0 / PIPL / DSL / CSL / GDPR / EU AI Act",
    ],
    dataObjects: [
      "standard_packs",
      "standard_clauses",
      "control_points",
      "design_rules",
      "bim_cde_requirements",
      "semantic_dictionary_standards",
      "semantic_dictionary_categories",
      "semantic_dictionary_classification_mappings",
      "semantic_dictionary_term_projections",
      "bim_model_unit_semantic_bindings",
      "ifc_ids_mappings",
      "cost_contract_rules",
      "material_certification_rules",
      "production_quality_rules",
      "construction_acceptance_rules",
      "archive_retention_rules",
      "audit_controls",
      "risk_controls",
      "security_privacy_controls",
      "ai_governance_controls",
      "enterprise_methods",
      "project_templates",
    ],
    routeHref: "/app/modules/standard_library",
    schemaRef: "module.schema/standard_library.v1",
  },
  {
    id: "detailed_design",
    order: 6,
    zhName: "深化设计",
    enName: "Detailed Design",
    track: "design",
    status: "pilot",
    summary:
      "装配式钢结构 2D→3D 深化工作台: 从需求参数和户型平面生成钢柱网、梁、构造柱、内墙龙骨、门窗、屋面、BOM 和可归档 CDE 深化包。",
    objective:
      "把方案设计输入转换为 architoken.steel_platform_design_package.v1 和 architoken.steel_platform_bom.v1；STEP/GLTF 派生必须经 steel_platform worker 和 build123d/OCP 隔离适配器，所有结果保持 professional_review_required。",
    subdomains: [
      {
        id: "steel-platform-intent",
        name: "需求参数与户型生成",
        purpose:
          "解析自然语言、面积、楼层、房间数量和面积区间，生成 300mm 模数化 2D 平面块。",
        ownerRole: "深化设计师",
        capabilityLevel: "automation",
      },
      {
        id: "steel-platform-plan-edit",
        name: "2D 平面与外轮廓编辑",
        purpose:
          "在网格中编辑房间、外轮廓、楼层、内墙删除和房间尺寸，形成可审计平面真源。",
        ownerRole: "深化设计师",
        capabilityLevel: "workflow",
      },
      {
        id: "steel-platform-structure",
        name: "钢柱网与主梁布置",
        purpose:
          "按柱跨上限、层高、截面和外轮廓派生钢柱、X/Y 向主梁、楼板和结构层。",
        ownerRole: "结构深化工程师",
        capabilityLevel: "automation",
      },
      {
        id: "steel-platform-envelope",
        name: "围护、门窗与构造柱",
        purpose:
          "按外墙 bay 布置门窗洞口、三/四边框、外墙构造柱组和屋面檩条参数。",
        ownerRole: "建筑/结构深化工程师",
        capabilityLevel: "automation",
      },
      {
        id: "steel-platform-interior-wall",
        name: "内墙龙骨与内门",
        purpose: "根据房间边界生成内墙龙骨、内门位置、开向翻转和撞窗复核提示。",
        ownerRole: "深化设计师",
        capabilityLevel: "workflow",
      },
      {
        id: "steel-platform-3d",
        name: "同步 3D 模型视口",
        purpose:
          "在 Three.js 视口中同步显示完整模型、骨架、围护开关和可检查构件层。",
        ownerRole: "BIM 工程师",
        capabilityLevel: "automation",
      },
      {
        id: "steel-platform-bom",
        name: "BOM 与工程量",
        purpose:
          "计算钢柱、主梁、构造柱、围护面积、内墙、门窗洞口、屋面和檩条工程量。",
        ownerRole: "造价/生产准备工程师",
        capabilityLevel: "automation",
      },
      {
        id: "steel-platform-evidence-gates",
        name: "CDE 证据与审批",
        purpose:
          "归档钢平台深化 JSON、BOM、worker 派生任务、规则检查、Schema 校验和专业复核意见。",
        ownerRole: "深化设计负责人",
        capabilityLevel: "workflow",
      },
    ],
    inputs: ["concept_design", "standard_library"],
    outputs: [
      "quantity_costing",
      "production_manufacturing",
      "construction_management",
      "digital_twin",
    ],
    artifacts: [
      artifact(
        "steel-platform-design-package",
        "钢平台深化设计包",
        "JSON",
        "深化设计师",
        [
          "architoken.steel_platform_design_package.v1",
          "2D平面",
          "结构布置",
          "专业复核状态",
        ],
      ),
      artifact(
        "steel-platform-bom",
        "钢平台 BOM 工程量",
        "JSON + XLSX",
        "深化设计师",
        ["architoken.steel_platform_bom.v1", "钢量", "围护", "屋面"],
      ),
      artifact(
        "steel-platform-step",
        "STEP 几何派生",
        "STEP/STP",
        "steel_platform worker",
        ["build123d/OCP", "真实几何", "blocked evidence"],
      ),
      artifact(
        "steel-platform-gltf",
        "GLTF/GLB 交互模型",
        "GLTF/GLB",
        "BIM 工程师",
        ["完整模型", "骨架模型", "围护开关"],
      ),
      artifact(
        "steel-platform-opening-schedule",
        "门窗洞口与内门表",
        "JSON + CSV",
        "深化设计师",
        ["外墙 bay", "门窗", "内门开向", "撞窗提示"],
      ),
      artifact(
        "steel-platform-review-report",
        "深化复核与交付门禁",
        "PDF + JSON",
        "深化设计负责人",
        ["RuleChecker", "SchemaValidator", "Approver"],
      ),
    ],
    workflowStates: workflow("detailed_design"),
    agentGates: gates(),
    tasks: [
      task(
        "dd-t1",
        "把 steel-platform-full.zip 的 2D→3D/BOM 能力登记到钢平台深化集成边界",
        "架构负责人",
        "doing",
      ),
      task(
        "dd-t2",
        "完成需求参数、2D 平面、房间编辑和外轮廓编辑的 CDE 工作台交互",
        "深化设计师",
        "doing",
      ),
      task(
        "dd-t3",
        "生成钢柱网、主梁、构造柱、内墙龙骨、门窗和屋面布置",
        "结构深化工程师",
        "todo",
      ),
      task(
        "dd-t4",
        "计算 BOM 并归档 steel_platform_design_package.json 与 steel_platform_bom.json",
        "造价/生产准备工程师",
        "todo",
      ),
      task(
        "dd-t5",
        "把 STEP/GLTF 派生任务交给 steel_platform worker 并保留 blocked/failed evidence",
        "深化设计负责人",
        "todo",
      ),
    ],
    approvals: [
      approval("dd-a1", "钢平台深化设计包复核", "深化设计负责人"),
      approval("dd-a2", "结构与生产放行前复核", "注册结构工程师"),
    ],
    risks: [
      risk(
        "dd-r1",
        "钢平台深化包被误用为施工、报审或生产放行成果",
        "critical",
        "所有钢平台输出保持 professional_review_required；结构、消防、节能、施工和生产用途必须另走专业校核和 Approver 签审。",
      ),
      risk(
        "dd-r2",
        "前端 3D 视口被误认为真实 STEP/GLTF worker 证据",
        "critical",
        "浏览器 Three.js 视口只作为交互预览；STEP/GLTF/GLB 交付必须来自 steel_platform worker、build123d/OCP 或明确 blocked evidence。",
      ),
      risk(
        "dd-r3",
        "压缩包内任意 Python 或历史助手文件进入分发边界",
        "high",
        "只迁移 typed contract、算法和 fixture；`.git`、`.claude`、任意脚本执行和二进制缓存不得混入前端分发。",
      ),
      risk(
        "dd-r4",
        "构件规格、规范条文或连接校核来源不足",
        "medium",
        "来源不足时只能输出经验建议和待复核清单，不得标记为可施工、可报审、可生产或可验收。",
      ),
    ],
    fileTypes: [
      ".ifc",
      ".ids",
      ".bcf",
      ".json",
      ".csv",
      ".xlsx",
      ".step",
      ".stp",
      ".stl",
      ".glb",
      ".gltf",
      ".usd",
      ".usdz",
      ".pdf",
    ],
    visualization: {
      mode: "model",
      title: "装配式钢结构 · 2D 平面到 3D/BOM 的深化视口",
      layers: [
        "需求参数",
        "2D房间块",
        "外轮廓",
        "钢柱网",
        "X/Y向主梁",
        "外墙构造柱",
        "内墙龙骨",
        "门窗洞口",
        "屋面檩条",
        "BOM工程量",
        "worker派生证据",
        "专业复核状态",
      ],
      telemetry: [
        "steel_platform_block_count",
        "steel_platform_column_count",
        "steel_platform_beam_count",
        "steel_platform_opening_count",
        "steel_platform_total_steel_t",
        "steel_platform_worker_job_count",
        "professional_review_open_count",
      ],
    },
    standards: [
      "OpenCDE",
      "IFC4.3",
      "IDS",
      "BCF",
      "ISO 19650",
      "GB 50017 钢结构设计标准",
      "GB 50009 建筑结构荷载规范",
      "GB 50205 钢结构工程施工质量验收标准",
      "GB 50661 钢结构焊接规范",
      "steel_platform worker isolation",
    ],
    dataObjects: [
      "steel_platform_design_packages",
      "steel_platform_boms",
      "steel_platform_plan_blocks",
      "steel_platform_structural_layouts",
      "structural_member_schedules",
      "steel_platform_opening_schedules",
      "steel_platform_worker_jobs",
      "step_gltf_derivative_artifacts",
      "professional_review_records",
    ],
    routeHref: "/app/modules/detailed_design",
    schemaRef: "module.schema/detailed_design.v1",
  },
  {
    id: "quantity_costing",
    order: 7,
    zhName: "计量造价",
    enName: "Quantity & Costing",
    track: "cost",
    status: "pilot",
    summary:
      "按编制、审核、送审/审定对比、核增核减、分析报告和审定转预算组织完整计量造价流程。",
    objective:
      "确保清单、定额、价格、送审/审定版本、核增核减和审核报告可计算、可复核、可审计。",
    subdomains: [
      {
        id: "project-tree",
        name: "项目结构树",
        purpose: "组织项目、单项、单位和专业工程结构。",
        ownerRole: "造价工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "compile-bill",
        name: "编制",
        purpose: "编制分部分项、措施项目、其他项目和费用汇总。",
        ownerRole: "造价工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "review-integration",
        name: "编审一体化",
        purpose: "管理送审版、审定版、多审版本和数据转换。",
        ownerRole: "注册造价工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "delta-analysis",
        name: "送审/审定对比",
        purpose: "计算工程量差、增减金额、增删改临标识和详细对比。",
        ownerRole: "造价工程师",
        capabilityLevel: "automation",
      },
      {
        id: "increase-decrease",
        name: "核增核减",
        purpose: "执行代码型、费用代号型和常数型核增核减计算。",
        ownerRole: "造价工程师",
        capabilityLevel: "automation",
      },
      {
        id: "analysis-report",
        name: "分析与报告",
        purpose: "生成费用分析、清单分析、审核报告和报表归档。",
        ownerRole: "造价负责人",
        capabilityLevel: "workflow",
      },
    ],
    inputs: ["concept_design", "detailed_design", "standard_library"],
    outputs: [
      "material_logistics",
      "production_manufacturing",
      "finance_management",
    ],
    artifacts: [
      artifact(
        "submitted-approved-diff",
        "送审审定差异表",
        "XLSX + JSON",
        "造价工程师",
        ["送审版本", "审定版本"],
      ),
      artifact(
        "increase-decrease-ledger",
        "核增核减台账",
        "XLSX",
        "注册造价工程师",
        ["核增金额", "核减金额"],
      ),
      artifact("review-report", "审核报告", "DOCX + PDF", "造价负责人", [
        "清单分析勾选项",
        "专业复核状态",
      ]),
    ],
    workflowStates: workflow("quantity_costing"),
    agentGates: gates(),
    tasks: [
      task(
        "qc-t1",
        "建立送审/审定双版本并完成第一轮差异计算",
        "Generator Agent",
        "doing",
      ),
      task("qc-t2", "核对核增核减台账和地方定额来源", "造价工程师", "todo"),
    ],
    approvals: [approval("qc-a1", "审核报告专业复核", "注册造价工程师")],
    risks: [
      risk(
        "qc-r1",
        "地方定额或价格来源未完整绑定",
        "high",
        "来源缺失时只能输出经验测算,不得标记为审定或结算结论。",
      ),
    ],
    fileTypes: [".xlsx", ".csv", ".json", ".ifc", ".dwg", ".dxf", ".pdf"],
    visualization: {
      mode: "board",
      title: "编审一体化差异与核增核减看板",
      layers: [
        "项目结构",
        "分部分项",
        "措施项目",
        "其他项目",
        "费用汇总",
        "审核报告",
      ],
      telemetry: [
        "submitted_total",
        "approved_total",
        "increase_amount",
        "decrease_amount",
      ],
    },
    standards: [
      "GB/T 50500-2024",
      "地方消耗量定额",
      "地方费用定额",
      "项目合同",
    ],
    dataObjects: [
      "cost_projects",
      "cost_project_tree_nodes",
      "cost_review_versions",
      "boq_items",
      "cost_quota_subitems",
      "cost_resource_items",
      "cost_unit_price_components",
      "cost_quantity_details",
      "cost_delta_analysis_items",
      "price_snapshots",
      "cost_review_reports",
    ],
    routeHref: "/app/modules/quantity_costing",
    schemaRef: "module.schema/quantity_costing.v1",
  },
  {
    id: "material_logistics",
    order: 8,
    zhName: "材料物流",
    enName: "Material Logistics",
    track: "supply",
    status: "pilot",
    summary:
      "覆盖材料库存、供应商、价格、询比价、采购、下料、包装、运输、到货和批次追踪。",
    objective: "把成本清单和生产需求转成可追踪的供应链闭环。",
    subdomains: [
      {
        id: "inventory",
        name: "材料库存",
        purpose: "维护钢材、焊材、涂料和连接件库存。",
        ownerRole: "仓储经理",
        capabilityLevel: "workflow",
      },
      {
        id: "supplier-price",
        name: "供应商与价格",
        purpose: "管理供应商、价格、询价和比价。",
        ownerRole: "采购经理",
        capabilityLevel: "automation",
      },
      {
        id: "purchase-plan",
        name: "采购计划",
        purpose: "生成采购、补料和 DDMRP 缓冲计划。",
        ownerRole: "计划工程师",
        capabilityLevel: "simulation",
      },
      {
        id: "cutting-bom",
        name: "下料单 / 加工 BOM",
        purpose: "将清单转成可生产和可发运的构件包。",
        ownerRole: "工艺工程师",
        capabilityLevel: "automation",
      },
      {
        id: "packing-loading",
        name: "包装与装车",
        purpose: "按吊装顺序组织包装、装车和批次。",
        ownerRole: "物流经理",
        capabilityLevel: "workflow",
      },
      {
        id: "delivery-receiving",
        name: "物流 / 到货 / 签收",
        purpose: "跟踪运输、现场堆放、到货验收和签收。",
        ownerRole: "现场材料员",
        capabilityLevel: "workflow",
      },
      {
        id: "batch-trace",
        name: "批次追踪",
        purpose: "通过炉批号、二维码和 RFID 追踪材料证据。",
        ownerRole: "质保工程师",
        capabilityLevel: "automation",
      },
    ],
    inputs: ["quantity_costing", "production_manufacturing"],
    outputs: ["construction_management", "digital_twin"],
    artifacts: [
      artifact("material-token", "Material Token", "JSON", "采购经理", [
        "炉批号",
        "供应商",
      ]),
      artifact("purchase-plan", "采购计划", "XLSX", "采购经理", [
        "询价记录",
        "比价表",
      ]),
      artifact("logistics-pack", "包装装车物流包", "PDF + CSV", "物流经理", [
        "装车顺序",
        "签收单",
      ]),
    ],
    workflowStates: workflow("material_logistics"),
    agentGates: gates(),
    tasks: [
      task("ml-t1", "生成 Q355B 钢材采购计划和询价包", "采购经理", "doing"),
      task("ml-t2", "绑定构件批次、装车和现场堆放区域", "物流经理", "todo"),
    ],
    approvals: [approval("ml-a1", "供应商比价与采购审批", "采购负责人")],
    risks: [
      risk(
        "ml-r1",
        "构件到场顺序与吊装计划冲突",
        "high",
        "装车计划必须读取施工吊装窗口。",
      ),
    ],
    fileTypes: [".xlsx", ".csv", ".pdf", ".jpg", ".json", ".qr"],
    visualization: {
      mode: "map",
      title: "供应链和堆场追踪地图",
      layers: [
        "库存",
        "供应商",
        "价格",
        "采购计划",
        "物流 ETA",
        "堆场",
        "批次",
      ],
      telemetry: ["buffer_status", "eta_variance", "batch_trace_rate"],
    },
    standards: [
      "DDMRP",
      "ISO 9001 traceability",
      "ISO 55000",
      "PMBOK procurement",
    ],
    dataObjects: [
      "inventory_items",
      "suppliers",
      "price_quotes",
      "purchase_plans",
      "cutting_lists",
      "production_boms",
      "packing_lists",
      "shipments",
      "receipts",
      "batch_traces",
    ],
    routeHref: "/app/modules/material_logistics",
    schemaRef: "module.schema/material_logistics.v1",
  },
  {
    id: "production_manufacturing",
    order: 9,
    zhName: "生产制造",
    enName: "Production Manufacturing",
    track: "factory",
    status: "pilot",
    summary: `承接100间精品酒店 Q235B 全栓接深化模型，重点把 ${hotelProductionSheets.length} 份制造相关图纸转成工单、孔位、CNC、涂装、质检和发运证据。`,
    objective:
      "把 SS-04 钢构件加工图、SS-04-04 孔位坐标、SS-04-08 BOM、SS-04-11 构件运输编码和防火防腐工艺转成可制造、可追溯、可质检、可发运的生产系统；当前阶段由 Paperclip v2026.517.0 完整接管主工作区和模块内 Agent 组织、任务、心跳、预算、治理编排。",
    subdomains: [
      {
        id: "p1-manufacturing-freeze",
        name: "P1生产下单闸门",
        purpose: "钢构专项、螺栓孔位、耳板尺寸和预留孔洞未冻结不得下单。",
        ownerRole: "生产负责人",
        capabilityLevel: "workflow",
      },
      {
        id: "component-shop-drawings",
        name: "构件加工详图",
        purpose:
          "钢柱、主梁、次梁每型下料长度、孔位坐标、公差0~-2mm和端头处理。",
        ownerRole: "制图专员",
        capabilityLevel: "automation",
      },
      {
        id: "bolt-hole-cnc",
        name: "CNC/数控文件",
        purpose: "统一坐标系输出圆孔孔位、孔径公差+0.5mm和数控钻孔数据。",
        ownerRole: "数控工程师",
        capabilityLevel: "automation",
      },
      {
        id: "factory-welding-only",
        name: "仅工厂焊接",
        purpose: "端板、加劲肋、吊耳和节点板在工厂完成，现场只允许栓接。",
        ownerRole: "焊接工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "coating-fireproofing",
        name: "防腐防火涂装",
        purpose:
          "底漆环氧富锌70μm、中漆环氧云铁100μm、面漆聚氨酯60μm和耐火极限分区。",
        ownerRole: "涂装工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "bom-package-code",
        name: "BOM与包装编码",
        purpose:
          "构件编号、规格、单重、Q235B材质、出厂顺序、包装单元和二维码追溯。",
        ownerRole: "物料统筹人员",
        capabilityLevel: "workflow",
      },
      {
        id: "factory-qc",
        name: "工厂质检放行",
        purpose: "尺寸、孔位、栓接件、涂层、防火和出厂资料齐套后放行。",
        ownerRole: "质检工程师",
        capabilityLevel: "automation",
      },
      {
        id: "mes-erp",
        name: "MES/ERP 对接",
        purpose: "同步工单、排产、库存和成本。",
        ownerRole: "系统集成工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "paperclip-agent-control-plane",
        name: "Paperclip Agent编排",
        purpose:
          "把工单、CNC、质检和发运任务映射到 Paperclip 组织、issue、heartbeat、预算和审批事件，再回写 ArchIToken 审计链。",
        ownerRole: "AI治理 / 生产负责人",
        capabilityLevel: "workflow",
      },
      {
        id: "coding-shipping",
        name: "构件编码 / 包装发运 / 返工",
        purpose:
          "按构件号-方向-楼层-区域喷涂编号并绑定包装、装车、到场签收和返工处理。",
        ownerRole: "车间主任",
        capabilityLevel: "workflow",
      },
    ],
    inputs: ["detailed_design", "quantity_costing", "standard_library"],
    outputs: ["material_logistics", "construction_management", "digital_twin"],
    artifacts: [
      artifact(
        "hotel-production-release-token",
        "酒店重钢生产放行 Token",
        "JSON",
        "生产负责人",
        ["P1冻结记录", "模型版本", "BOM"],
      ),
      artifact(
        "paperclip-factory-agent-control-plane",
        "Paperclip v2026.517.0 生产编排记录",
        "JSON + AUDIT",
        "AI治理 / 生产负责人",
        ["Agent组织", "Heartbeat", "预算", "审批"],
      ),
      artifact(
        "bolt-hole-cnc-package",
        "螺栓孔位CNC包",
        "NC + DXF + CSV",
        "数控工程师",
        ["SS-04-04", "圆孔孔径", "孔径公差+0.5mm"],
      ),
      artifact(
        "q235b-bom-package",
        "Q235B构件BOM与包装单",
        "XLSX + QR",
        "物料统筹人员",
        ["SS-04-08", "SS-04-11", "出厂顺序"],
      ),
      artifact(
        "coating-fireproof-qc-pack",
        "防腐防火质检包",
        "PDF + JSON",
        "质检工程师",
        ["膜厚记录", "耐火极限", "环境温湿度"],
      ),
    ],
    workflowStates: workflow("production_manufacturing"),
    agentGates: gates(),
    tasks: [
      task(
        "pm-t1",
        "按SS-04-01~SS-04-11生成加工、孔位、BOM和包装工单",
        "工艺工程师",
        "doing",
      ),
      task(
        "pm-t2",
        "校核CNC孔位与IFC构件GUID、SS-04-05穿梁孔一致性",
        "RuleChecker",
        "todo",
      ),
      task(
        "pm-t3",
        "建立无现场焊接的工厂焊接和现场栓接放行清单",
        "焊接工程师",
        "todo",
      ),
      task(
        "pm-t4",
        "把工单、CNC、质检和发运任务同步到 Paperclip v2026.517.0 编排面板",
        "AI治理 / 系统集成工程师",
        "doing",
      ),
    ],
    approvals: [
      approval("pm-a1", "工厂生产放行审批", "生产负责人"),
      approval("pm-a2", "Paperclip生产Agent运行策略审批", "AI治理负责人"),
    ],
    risks: [
      risk(
        "pm-r1",
        "CNC 文件与模型版本或孔位锁定不一致",
        "critical",
        "每个 NC/DXF 文件必须绑定 model_revision、element_guid、SS-04-04孔位坐标和审批版本。",
      ),
      risk(
        "pm-r2",
        "现场误焊破坏全栓接体系",
        "critical",
        "生产包必须声明仅工厂焊接，现场安装按螺栓紧固工艺验收。",
      ),
      risk(
        "pm-r3",
        "Paperclip Agent 越权生成或放行生产结论",
        "high",
        "Paperclip 只能编排 issue、heartbeat、预算和任务状态；CNC、QC、MES/ERP、合规结论必须回到 ArchIToken Planner→Generator→Evaluator→RuleChecker→SchemaValidator→Approver 门禁。",
      ),
    ],
    fileTypes: [
      ".ifc",
      ".nc",
      ".dxf",
      ".step",
      ".xlsx",
      ".pdf",
      ".json",
      ".paperclip.json",
    ],
    visualization: {
      mode: "timeline",
      title: "Q235B全栓接构件生产 HMI",
      layers: [
        "P1冻结",
        "SS-04加工图",
        "孔位CNC",
        "工厂焊接",
        "防腐防火",
        "包装编码",
        "质检放行",
        "Paperclip编排",
      ],
      telemetry: [
        "p1_release_rate",
        "hole_coordinate_conflict",
        "cnc_package_count",
        "qc_pass_rate",
        "shipment_ready_count",
        "paperclip_heartbeat_lag",
        "agent_budget_burn_rate",
      ],
    },
    standards: ["AWS D1.1", "EN 1090", "AS/NZS 5131", "GB 50205", "GB 50661"],
    dataObjects: [
      "production_plans",
      "shop_drawing_items",
      "bolt_hole_coordinates",
      "process_routes",
      "cutting_optimizations",
      "cnc_files",
      "factory_weld_records",
      "coating_records",
      "fireproofing_records",
      "factory_qc",
      "paperclip_companies",
      "paperclip_issues",
      "paperclip_heartbeats",
      "paperclip_budget_events",
      "mes_sync_jobs",
      "component_codes",
      "packing_units",
      "shipment_batches",
      "rework_orders",
    ],
    routeHref: "/app/modules/production_manufacturing",
    schemaRef: "module.schema/production_manufacturing.v1",
  },
  {
    id: "construction_management",
    order: 10,
    zhName: "施工管理",
    enName: "Construction Management",
    track: "site",
    status: "active",
    summary: `按100间精品酒店现场装配施工工艺执行，承接 ${hotelConstructionSheets.length} 份施工相关图纸，其中 ${hotelHighPriorityDrawingCount} 份高优先级图纸进入现场闸门。`,
    objective:
      "把吊装顺序、调平校准、高强螺栓紧固、模块拼缝防渗、干湿分区、样板间试装、物料进场和QC安全记录转为可审计 Evidence Token。",
    subdomains: [
      {
        id: "hoisting-sequence",
        name: "钢构吊装顺序",
        purpose: "柱→主梁→次梁→支撑，先内后外、先下后上，每步稳定性验算。",
        ownerRole: "现场钢构代表",
        capabilityLevel: "automation",
      },
      {
        id: "leveling-calibration",
        name: "调平标高校准",
        purpose: "调平螺栓、柱顶水准仪测点、层间累积误差≤±5mm和每层复测。",
        ownerRole: "测量工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "bolt-tightening",
        name: "高强螺栓紧固",
        purpose: "初拧50%→终拧100%，从中间向两端扩散，扭矩扳手补拧标记。",
        ownerRole: "栓接工艺顾问",
        capabilityLevel: "workflow",
      },
      {
        id: "module-seam-control",
        name: "模块拼缝防渗隔声",
        purpose: "PU密封胶、48kg/m³矿棉、背衬板和内饰收口按不可逆工序执行。",
        ownerRole: "防水防渗顾问",
        capabilityLevel: "workflow",
      },
      {
        id: "dry-wet-zone",
        name: "干湿作业分区",
        purpose: "灌浆、打胶、防水湿作业区与干作业区隔离，控制交叉作业窗口。",
        ownerRole: "现场精装代表",
        capabilityLevel: "workflow",
      },
      {
        id: "mockup-release",
        name: "样板间试装放行",
        purpose: "3间样板间端头转角问题清单修正后，作为批量施工放行闸门。",
        ownerRole: "项目总工",
        capabilityLevel: "workflow",
      },
      {
        id: "material-qc-safety",
        name: "物料质量安全",
        purpose:
          "进场核对、关键工序QC、现场安全文明施工、季节性措施和成品保护。",
        ownerRole: "质检/安全负责人",
        capabilityLevel: "automation",
      },
      {
        id: "daily-log",
        name: "日志",
        purpose: "施工日志、监理日志和旁站记录。",
        ownerRole: "监理工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "ar-field",
        name: "AR",
        purpose: "AR 辅助安装、复核和定位。",
        ownerRole: "现场工程师",
        capabilityLevel: "simulation",
      },
      {
        id: "panorama-360",
        name: "360 全景",
        purpose: "现场全景巡检和进度影像。",
        ownerRole: "资料员",
        capabilityLevel: "workflow",
      },
      {
        id: "scan-3d",
        name: "三维扫描",
        purpose: "LiDAR/E57 控制点和残差校核。",
        ownerRole: "测量工程师",
        capabilityLevel: "automation",
      },
      {
        id: "oblique-drone",
        name: "倾斜摄影 / 无人机",
        purpose: "无人机影像和倾斜摄影测量。",
        ownerRole: "无人机飞手",
        capabilityLevel: "simulation",
      },
      {
        id: "robot-iot",
        name: "建筑机器人 / IoT",
        purpose: "机器人、传感器和设备状态接入。",
        ownerRole: "智能建造工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "visual-compare",
        name: "影像对比",
        purpose: "影像、模型、计划进度对齐。",
        ownerRole: "BIM 工程师",
        capabilityLevel: "automation",
      },
      {
        id: "rectification",
        name: "整改闭环",
        purpose: "NCR、RFI、整改通知和复验。",
        ownerRole: "监理工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "completion-docs",
        name: "竣工资料",
        purpose: "汇总验收、检测、签章和归档资料。",
        ownerRole: "资料负责人",
        capabilityLevel: "workflow",
      },
    ],
    inputs: [
      "detailed_design",
      "production_manufacturing",
      "material_logistics",
      "standard_library",
    ],
    outputs: ["digital_twin", "digital_archive"],
    artifacts: [
      artifact(
        "hotel-assembly-evidence-token",
        "酒店装配施工 Evidence Token",
        "JSON",
        "监理工程师",
        ["吊装顺序", "调平校准", "螺栓紧固"],
      ),
      artifact(
        "bolt-tightening-qc-pack",
        "高强螺栓紧固QC包",
        "PDF + JSON",
        "栓接工艺顾问",
        ["初拧/终拧", "扭矩扳手记录", "10%抽检"],
      ),
      artifact(
        "mockup-release-pack",
        "3间样板间试装放行包",
        "PDF + BCF",
        "项目总工",
        ["问题清单", "修正方案", "批量放行"],
      ),
      artifact(
        "site-completion-list",
        "竣工验收资料清单模板",
        "PDF + XLSX",
        "资料员",
        ["竣工图", "检验批", "隐蔽验收", "材料合格证"],
      ),
    ],
    workflowStates: workflow("construction_management"),
    agentGates: gates(),
    tasks: [
      task(
        "cs-t1",
        "生成CON-01钢构安装工艺执行和复测记录",
        "现场钢构代表",
        "doing",
      ),
      task(
        "cs-t2",
        "建立CON-02围护精装施工穿插和样板间放行闸门",
        "现场精装代表",
        "todo",
      ),
      task(
        "cs-t3",
        "把CON-03物料进场、QC、安全文明和竣工资料清单归档",
        "资料员",
        "todo",
      ),
    ],
    approvals: [approval("cs-a1", "隐蔽工程和关键工序验收", "总监理工程师")],
    risks: [
      risk(
        "cs-r1",
        "现场证据缺少时间/位置/构件绑定",
        "critical",
        "影像和记录必须绑定 element_id、geo、time、责任人和图纸编号。",
      ),
      risk(
        "cs-r2",
        "螺栓紧固或调平复测缺失",
        "critical",
        "CON-01-02、CON-01-03和CON-01-06必须形成可签字验收记录。",
      ),
    ],
    fileTypes: [
      ".pdf",
      ".jpg",
      ".mp4",
      ".e57",
      ".las",
      ".ply",
      ".bcf",
      ".ifc",
      ".json",
    ],
    visualization: {
      mode: "hmi",
      title: "装配式酒店现场安装与验收 HMI",
      layers: [
        "吊装顺序",
        "调平校准",
        "螺栓紧固",
        "拼缝防渗",
        "样板间放行",
        "QC清单",
        "安全文明",
        "竣工资料",
      ],
      telemetry: [
        "bolt_torque_pass_rate",
        "leveling_deviation_mm",
        "mockup_release_status",
        "qc_blocker_count",
        "evidence_completeness",
      ],
    },
    standards: [
      "GB 55006",
      "GB 50205",
      "GB 50300",
      "ISO 45001",
      "ISO 19650 CDE",
    ],
    dataObjects: [
      "hoisting_sequences",
      "leveling_checks",
      "bolt_torque_records",
      "module_seam_checks",
      "dry_wet_zone_plans",
      "mockup_release_records",
      "material_receipts",
      "qc_checkpoints",
      "safety_hazards",
      "daily_logs",
      "completion_documents",
    ],
    routeHref: "/app/modules/construction_management",
    schemaRef: "module.schema/construction_management.v1",
  },
  {
    id: "digital_twin",
    order: 11,
    zhName: "数字孪生",
    enName: "Digital Twin",
    track: "twin",
    status: "active",
    summary:
      "WebGPU/WGSL 原生主视口、openBIM 语义、glTF 运行资产、3D Tiles/OpenUSD 场景组合和 3DGS/E57 实景校核的重钢数字孪生。",
    objective:
      "将 BIM 语义、现场实景、IoT/SCADA、FEA/ROM、进度、质量、安全和成本叠加为可审计、可回放、可归档的 Twin Token。",
    subdomains: [
      {
        id: "webgpu-render",
        name: "WebGPU 原生渲染状态",
        purpose: "检测 GPU Adapter 并运行 WGSL/WebGPU 数字孪生主视口。",
        ownerRole: "前端图形工程师",
        capabilityLevel: "simulation",
      },
      {
        id: "three-fallback",
        name: "Three.js fallback 状态",
        purpose: "WebGPU 不可用时保留稳定兼容层。",
        ownerRole: "前端工程师",
        capabilityLevel: "foundation",
      },
      {
        id: "source-assets",
        name: "IFC/GLB/3D Tiles/OpenUSD/点云/3DGS数据源",
        purpose: "登记 openBIM、运行时模型、地理空间、实景和测量控制来源。",
        ownerRole: "BIM 经理",
        capabilityLevel: "workflow",
      },
      {
        id: "component-tree",
        name: "构件树",
        purpose: "提供 Site / Building / Level / Zone / Element 可编辑层级。",
        ownerRole: "BIM 工程师",
        capabilityLevel: "automation",
      },
      {
        id: "progress-compare",
        name: "进度对比",
        purpose: "对齐计划进度、现场影像和模型状态。",
        ownerRole: "计划工程师",
        capabilityLevel: "simulation",
      },
      {
        id: "overlays",
        name: "质量/安全/成本叠加图层",
        purpose: "叠加缺陷、风险、成本和整改状态。",
        ownerRole: "项目经理",
        capabilityLevel: "simulation",
      },
    ],
    inputs: [
      "construction_management",
      "detailed_design",
      "material_logistics",
      "production_manufacturing",
    ],
    outputs: ["digital_archive", "settings_center"],
    artifacts: [
      artifact("twin-token", "Twin Token", "JSON + GLB", "孪生工程师", [
        "构件树",
        "图层状态",
      ]),
      artifact(
        "reality-layer",
        "3DGS/点云现实捕捉层",
        "SPZ + PLY + E57",
        "测量工程师",
        ["360 影像", "LiDAR 控制点"],
      ),
      artifact("overlay-pack", "质量/安全/成本叠加图层", "JSON", "项目经理", [
        "风险热区",
        "进度偏差",
      ]),
    ],
    workflowStates: workflow("digital_twin"),
    agentGates: gates(),
    tasks: [
      task(
        "dt-t1",
        "运行 WebGPU 主视口、Three.js fallback 和构件树选择",
        "前端图形工程师",
        "doing",
      ),
      task("dt-t2", "绑定 IFC/GLB/点云/360 数据源", "BIM 经理", "review"),
    ],
    approvals: [approval("dt-a1", "Twin Token 发布审批", "项目总工")],
    risks: [
      risk(
        "dt-r1",
        "3DGS 与 LiDAR 点云语义混淆",
        "high",
        "3DGS 作为影像实景层,点云作为测量控制和残差校核。",
      ),
    ],
    fileTypes: [
      ".ifc",
      ".glb",
      ".gltf",
      ".spz",
      ".ply",
      ".e57",
      ".las",
      ".mp4",
      ".jpg",
      ".json",
    ],
    visualization: {
      mode: "hmi",
      title: "WebGPU 数字孪生主视口",
      layers: [
        "WebGPU-ready",
        "Three.js fallback",
        "IFC",
        "GLB",
        "点云",
        "360",
        "三维扫描",
        "倾斜摄影",
        "进度",
        "质量",
        "安全",
        "成本",
      ],
      telemetry: [
        "webgpu_status",
        "fallback_status",
        "component_count",
        "overlay_count",
      ],
    },
    standards: [
      "IFC4.3",
      "ISO 23247",
      "OpenUSD",
      "ISO 19650",
      "AISC/EN/GB/AS mapping",
    ],
    dataObjects: [
      "twin_models",
      "component_tree",
      "reality_captures",
      "scan_batches",
      "panorama_assets",
      "oblique_photo_sets",
      "iot_streams",
      "progress_overlays",
      "quality_overlays",
      "safety_overlays",
      "cost_overlays",
    ],
    routeHref: "/app/modules/digital_twin",
    schemaRef: "module.schema/digital_twin.v1",
  },
  {
    id: "digital_archive",
    order: 12,
    zhName: "数字档案",
    enName: "Digital Archive",
    track: "archive",
    status: "planned",
    summary: `把造房网推广证据、合伙人协议、样板房素材、${heavySteelHotelDrawingSheets.length} 份重钢酒店深化图纸、生产质检、施工验收和竣工资料统一长期留存。`,
    objective:
      "将市场获客、合同佣金、深化图纸、模型版本、孔位锁定、工厂放行、现场验收和客户裂变证据归档为可检索、可审计、可长期保存的 Archive Token。",
    subdomains: [
      {
        id: "contracts",
        name: "合同管理",
        purpose: "合同、补充协议、签章和履约证据。",
        ownerRole: "商务经理",
        capabilityLevel: "workflow",
      },
      {
        id: "drawings-models",
        name: "图纸模型",
        purpose: "归档施工图、IFC、GLB、BCF 和模型版本。",
        ownerRole: "资料负责人",
        capabilityLevel: "workflow",
      },
      {
        id: "quality-docs",
        name: "检测与验收",
        purpose: "归档检测报告、验收记录和整改闭环。",
        ownerRole: "质量负责人",
        capabilityLevel: "workflow",
      },
      {
        id: "enterprise-media",
        name: "企业文宣",
        purpose: "沉淀案例、宣传图文和视频素材。",
        ownerRole: "品牌负责人",
        capabilityLevel: "automation",
      },
    ],
    inputs: ["construction_management", "digital_twin", "standard_library"],
    outputs: [],
    artifacts: [
      artifact("archive-token", "Archive Token", "JSON", "资料负责人", [
        "归档清单",
        "签章记录",
      ]),
      artifact(
        "hotel-drawing-archive-pack",
        "198份深化图纸归档包",
        "ZIP + PDF/A + XLSX",
        "文控经理",
        ["8大专项", "33个分组", "图纸编号"],
      ),
      artifact(
        "zaofang-marketing-archive-pack",
        "造房网推广证据归档包",
        "ZIP + JSON",
        "品牌负责人",
        ["投放记录", "合伙人协议", "样板房接待", "案例传播"],
      ),
      artifact("handover-package", "竣工移交包", "ZIP + PDF/A", "项目经理", [
        "验收报告",
        "模型版本",
      ]),
    ],
    workflowStates: workflow("digital_archive"),
    agentGates: gates(),
    tasks: [
      task("da-t1", "生成竣工资料目录和缺失项清单", "Archive Agent", "doing"),
      task("da-t2", "归档合同、模型和检测报告版本", "资料负责人", "todo"),
    ],
    approvals: [approval("da-a1", "竣工档案移交审批", "业主代表")],
    risks: [
      risk(
        "da-r1",
        "签章和版本链不完整",
        "high",
        "归档前执行不可篡改哈希和签章完整性检查。",
      ),
    ],
    fileTypes: [
      ".pdf",
      ".pdfa",
      ".ifc",
      ".glb",
      ".zip",
      ".xlsx",
      ".mp4",
      ".json",
    ],
    visualization: {
      mode: "archive",
      title: "证据链和长期留存目录",
      layers: ["合同", "图纸", "模型", "检测", "签章", "文宣", "保留期限"],
      telemetry: ["archive_completeness", "signature_rate", "retention_risk"],
    },
    standards: [
      "ISO 19650 CDE",
      "OAIS",
      "CJJ/T 117",
      "GB/T 50328",
      "e-signature audit",
      "广告与合同证据留存",
    ],
    dataObjects: [
      "contracts",
      "archive_items",
      "drawing_catalog_items",
      "partner_agreements",
      "commission_records",
      "marketing_media_assets",
      "retention_policies",
      "signature_events",
      "handover_packages",
    ],
    routeHref: "/app/modules/digital_archive",
    schemaRef: "module.schema/digital_archive.v1",
  },
  {
    id: "finance_management",
    order: 13,
    zhName: "财务管理",
    enName: "Finance Management",
    track: "cost",
    status: "pilot",
    summary:
      "按 K2617《金蝶云系统操作手册_智能会计平台 V1.0》重建智能会计平台:系统参数、分录类型、凭证模板、凭证生成和财务核对。",
    objective:
      "把上游业务单据、账簿、科目表、业务分类和对账方案转成可审计的凭证生成报告、凭证列表、对账结果和差异分析;缺少来源或人工复核时不得标记为可入账、可支付或可发布。",
    subdomains: [
      {
        id: "accounting-parameters",
        name: "系统参数",
        purpose: "维护尾差调整方式、凭证顺序生成方式和凭证生成结果展示方式。",
        ownerRole: "财务负责人",
        capabilityLevel: "foundation",
      },
      {
        id: "entry-types",
        name: "分录类型",
        purpose:
          "按业务抽象会计科目,维护 38 种参考分录类型、科目取值和科目影响因素。",
        ownerRole: "财务会计",
        capabilityLevel: "workflow",
      },
      {
        id: "voucher-templates",
        name: "凭证模板",
        purpose:
          "配置来源单据、适用账簿、核算组织来源、凭证字、凭证日期、业务分类、分录生成条件和核算维度取源。",
        ownerRole: "总账会计",
        capabilityLevel: "workflow",
      },
      {
        id: "voucher-generation",
        name: "凭证生成",
        purpose:
          "支持多账簿、多来源单据批量生成凭证,并按参数展示生成报告、凭证列表或两者。",
        ownerRole: "总账会计",
        capabilityLevel: "automation",
      },
      {
        id: "financial-reconciliation",
        name: "财务核对",
        purpose:
          "维护总账科目与业务报表的对账方案,执行期初余额、本期增加、本期减少、期末余额核对并生成差异分析。",
        ownerRole: "财务负责人",
        capabilityLevel: "automation",
      },
    ],
    inputs: [
      "planning_management",
      "quantity_costing",
      "material_logistics",
      "production_manufacturing",
      "construction_management",
    ],
    outputs: ["human_resources", "digital_archive"],
    artifacts: [
      artifact(
        "accounting-parameter-policy",
        "智能会计系统参数策略",
        "JSON",
        "财务负责人",
        ["尾差调整方式", "凭证顺序", "结果展示"],
      ),
      artifact(
        "entry-type-catalog",
        "分录类型参考目录",
        "JSON + XLSX",
        "财务会计",
        ["38种参考类型", "科目取值", "影响因素"],
      ),
      artifact("voucher-template-pack", "凭证模板包", "JSON", "总账会计", [
        "业务分类",
        "分录生成条件",
        "核算维度取源",
      ]),
      artifact(
        "voucher-generation-report",
        "凭证生成报告与凭证列表",
        "JSON + XLSX",
        "总账会计",
        ["账簿选择", "单据选择", "已生成/未生成"],
      ),
      artifact(
        "reconciliation-analysis-report",
        "对账与差异分析报告",
        "JSON + XLSX",
        "财务负责人",
        ["总账科目", "业务报表", "四类差异检查"],
      ),
    ],
    workflowStates: workflow("finance_management"),
    agentGates: gates(),
    tasks: [
      task(
        "fm-t1",
        "按 K2617 手册登记智能会计系统参数和 38 种分录类型参考口径",
        "财务负责人",
        "doing",
      ),
      task(
        "fm-t2",
        "配置付款单、采购入库单等来源单据的凭证模板、业务分类和分录生成条件",
        "总账会计",
        "todo",
      ),
      task(
        "fm-t3",
        "执行多账簿凭证生成并输出报告/凭证列表",
        "总账会计",
        "todo",
      ),
      task("fm-t4", "建立对账方案并运行差异分析四项检查", "财务负责人", "todo"),
    ],
    approvals: [
      approval(
        "fm-a1",
        "智能会计参数、凭证模板与对账方案发布审批",
        "财务负责人",
      ),
    ],
    risks: [
      risk(
        "fm-r1",
        "凭证模板、业务分类或对账方案来源缺失导致错误入账",
        "critical",
        "未命中业务分类的单据不得生成凭证;差异分析存在不通过项时只能输出待复核建议,不得标记为可入账、可支付或可发布。",
      ),
    ],
    fileTypes: [".xlsx", ".csv", ".pdf", ".docx", ".json"],
    visualization: {
      mode: "board",
      title: "智能会计参数、凭证模板、凭证生成和对账看板",
      layers: [
        "系统参数",
        "分录类型",
        "凭证模板",
        "账簿",
        "来源单据",
        "生成报告",
        "对账",
      ],
      telemetry: [
        "voucher_generated_count",
        "voucher_blocked_count",
        "reconciliation_unbalanced_count",
        "difference_check_failed_count",
      ],
    },
    standards: [
      "K2617 金蝶云系统操作手册_智能会计平台 V1.0",
      "新会计准则科目表",
      "财务会计核算体系",
      "local accounting and tax review rules",
      "SOC 2 audit trail",
    ],
    dataObjects: [
      "finance_accounting_parameters",
      "finance_entry_types",
      "voucher_templates",
      "voucher_business_categories",
      "voucher_template_entries",
      "voucher_generation_runs",
      "reconciliation_plans",
      "reconciliation_runs",
      "reconciliation_difference_checks",
    ],
    routeHref: "/app/modules/finance_management",
    schemaRef: "module.schema/finance_management.v1",
  },
  {
    id: "human_resources",
    order: 14,
    zhName: "人力资源",
    enName: "Human Resources",
    track: "governance",
    status: "planned",
    summary:
      "覆盖组织岗位、人员班组、资质证书、考勤工时、培训、安全准入、绩效和劳动合规。",
    objective:
      "把项目人员、班组、岗位权限、资质、考勤、培训和绩效转成可审计、可结算、可归档的人力资源业务对象。",
    subdomains: [
      {
        id: "organization-roster",
        name: "组织与岗位",
        purpose: "维护组织架构、岗位、项目角色、RACI 和岗位权限。",
        ownerRole: "人力资源负责人",
        capabilityLevel: "foundation",
      },
      {
        id: "crew-management",
        name: "人员班组",
        purpose: "管理设计、采购、工厂、施工、监理、分包和外协班组人员。",
        ownerRole: "人力资源经理",
        capabilityLevel: "workflow",
      },
      {
        id: "qualification-certificates",
        name: "资质证书",
        purpose: "管理执业资格、特种作业证、安全培训证和到期提醒。",
        ownerRole: "资质管理员",
        capabilityLevel: "workflow",
      },
      {
        id: "attendance-hours",
        name: "考勤工时",
        purpose: "采集工厂、现场、远程协作和外协班组的考勤与工时。",
        ownerRole: "考勤管理员",
        capabilityLevel: "automation",
      },
      {
        id: "performance",
        name: "绩效与结算依据",
        purpose: "按进度、质量、安全、成本和交付物完成度形成绩效依据。",
        ownerRole: "项目负责人",
        capabilityLevel: "simulation",
      },
      {
        id: "labor-compliance",
        name: "劳动合规",
        purpose: "管理劳动合同、用工合规、社保、培训和人员审计归档。",
        ownerRole: "人力合规负责人",
        capabilityLevel: "workflow",
      },
    ],
    inputs: [
      "planning_management",
      "production_manufacturing",
      "construction_management",
      "finance_management",
      "settings_center",
    ],
    outputs: ["finance_management", "digital_archive", "settings_center"],
    artifacts: [
      artifact("hr-roster-token", "HR Roster Token", "JSON", "人力资源经理", [
        "岗位",
        "项目角色",
        "RACI",
      ]),
      artifact(
        "crew-qualification-pack",
        "班组资质包",
        "PDF + JSON",
        "资质管理员",
        ["人员清单", "证书", "到期提醒"],
      ),
      artifact(
        "attendance-performance-pack",
        "考勤绩效包",
        "XLSX + JSON",
        "项目经理",
        ["考勤", "工时", "质量安全记录"],
      ),
      artifact(
        "labor-compliance-ledger",
        "劳动合规台账",
        "XLSX + PDF",
        "人力合规负责人",
        ["劳动合同", "社保", "培训记录"],
      ),
    ],
    workflowStates: workflow("human_resources"),
    agentGates: gates(),
    tasks: [
      task("hr-t1", "同步项目人员、班组和岗位权限", "人力资源经理", "doing"),
      task("hr-t2", "核对资质证书、安全培训和到期提醒", "资质管理员", "todo"),
      task("hr-t3", "生成考勤、工时和绩效结算依据", "项目负责人", "todo"),
    ],
    approvals: [approval("hr-a1", "人员资质与绩效结算依据复核", "人力负责人")],
    risks: [
      risk(
        "hr-r1",
        "人员资质、工时或绩效证据缺失",
        "high",
        "人员上岗、绩效和结算必须绑定岗位、资质、考勤、质量安全记录和审批证据。",
      ),
    ],
    fileTypes: [".xlsx", ".csv", ".pdf", ".docx", ".json"],
    visualization: {
      mode: "board",
      title: "组织、班组、资质、考勤和绩效看板",
      layers: ["组织", "岗位", "人员", "班组", "资质", "考勤", "绩效"],
      telemetry: [
        "crew_capacity",
        "certificate_expiry_count",
        "attendance_exception_count",
        "performance_review_pending",
      ],
    },
    standards: [
      "ISO 45001 occupational health and safety",
      "ISO 9001 training records",
      "local labor compliance rules",
      "enterprise IAM policy",
      "SOC 2 audit trail",
    ],
    dataObjects: [
      "employees",
      "crews",
      "roles",
      "position_permissions",
      "qualification_certificates",
      "attendance_records",
      "timesheets",
      "training_records",
      "performance_scores",
      "labor_contracts",
    ],
    routeHref: "/app/modules/human_resources",
    schemaRef: "module.schema/human_resources.v1",
  },
  {
    id: "ai_center",
    order: 15,
    zhName: "AI中心",
    enName: "AI Capability Center",
    track: "platform",
    status: "foundation",
    summary:
      "统一配置企业 AI、API、RAG、MCP、Agent、PanAI、模型路由、提示词、安全审计和成本策略。",
    objective:
      "AI中心只负责能力配置、工具注册、模型路由、知识库、Agent 编排、PanAI 自动化和安全治理；AI任务、图纸解析、模型生成、清单生成、审查助手下沉到各业务模块执行。",
    subdomains: [
      {
        id: "model-provider-registry",
        name: "模型供应商配置",
        purpose:
          "配置本地模型、私有端点、视觉/多模态模型和外部兼容 provider adapter 白名单。",
        ownerRole: "AI平台管理员",
        capabilityLevel: "foundation",
      },
      {
        id: "channel-provider-registry",
        name: "通道供应商配置",
        purpose:
          "登记 IM、协作平台、官方消息接口和外部 Agent channel provider adapter 白名单。",
        ownerRole: "AI平台管理员",
        capabilityLevel: "foundation",
      },
      {
        id: "api-gateway",
        name: "AI API 网关",
        purpose:
          "统一管理 API Key、调用限额、租户隔离、成本统计、熔断和审计日志。",
        ownerRole: "平台管理员",
        capabilityLevel: "workflow",
      },
      {
        id: "interface-management",
        name: "接口管理",
        purpose:
          "登记 OpenAPI、内部 Gateway、PanAI、RAG 和 MCP 工具接口合同、权限边界、限流和审计绑定。",
        ownerRole: "平台集成工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "database-management",
        name: "数据库管理",
        purpose:
          "管理 AI 调用账本、运行时执行、RAG 来源、工具权限、成本事件和审计日志的数据对象与 RLS 边界。",
        ownerRole: "数据平台管理员",
        capabilityLevel: "workflow",
      },
      {
        id: "visualization-panel",
        name: "可视化面板",
        purpose:
          "发布模型路由拓扑、RAG 检索质量、MCP 工具调用、安全审计和成本治理运行视图。",
        ownerRole: "AI 运营负责人",
        capabilityLevel: "workflow",
      },
      {
        id: "rag-knowledge-base",
        name: "RAG 知识库",
        purpose:
          "管理规范、合同、图纸、BIM 资料、企业标准、施工方案和历史项目语料。",
        ownerRole: "知识库管理员",
        capabilityLevel: "automation",
      },
      {
        id: "mcp-tool-registry",
        name: "MCP 工具注册",
        purpose:
          "注册文件、数据库、BIM、造价、进度、文档、ERP 和外部系统工具。",
        ownerRole: "集成工程师",
        capabilityLevel: "workflow",
      },
      {
        id: "agent-orchestration",
        name: "Agent 编排",
        purpose:
          "配置市场、计划、设计、造价、材料、施工、档案等业务 Agent 的职责、工具、权限和审批边界。",
        ownerRole: "AI应用负责人",
        capabilityLevel: "automation",
      },
      {
        id: "panai-runtime",
        name: "PanAI 自动化",
        purpose:
          "配置浏览器自动化、桌面自动化、任务执行沙箱、人工确认和操作回放。",
        ownerRole: "自动化管理员",
        capabilityLevel: "automation",
      },
      {
        id: "ai-safety-audit",
        name: "AI 安全与审计",
        purpose:
          "管理提示词审计、输出校验、权限控制、敏感数据脱敏、人工审批和责任追踪。",
        ownerRole: "安全审计员",
        capabilityLevel: "workflow",
      },
    ],
    inputs: ["standard_library", "settings_center"],
    outputs: [
      "personal_center",
      "marketing_service",
      "planning_management",
      "concept_design",
      "standard_library",
      "detailed_design",
      "quantity_costing",
      "material_logistics",
      "production_manufacturing",
      "construction_management",
      "digital_twin",
      "digital_archive",
      "finance_management",
      "human_resources",
    ],
    artifacts: [
      artifact(
        "ai-capability-token",
        "AI Capability Token",
        "JSON",
        "AI平台管理员",
        ["模型配置", "工具权限"],
      ),
      artifact(
        "ai-interface-register",
        "AI 接口合同注册表",
        "OpenAPI + JSON",
        "平台集成工程师",
        ["接口边界", "鉴权策略", "审计字段"],
      ),
      artifact(
        "ai-database-binding-ledger",
        "AI 数据库绑定账本",
        "SQL + JSON",
        "数据平台管理员",
        ["数据对象", "RLS", "生命周期"],
      ),
      artifact(
        "ai-visualization-panel-pack",
        "AI 可视化面板包",
        "JSON",
        "AI 运营负责人",
        ["数据集", "刷新策略", "发布门禁"],
      ),
      artifact(
        "rag-collection-pack",
        "RAG 知识库配置包",
        "JSON + Index",
        "知识库管理员",
        ["语料版本", "向量索引"],
      ),
      artifact("agent-policy-pack", "Agent 策略包", "YAML", "AI应用负责人", [
        "工具边界",
        "审批策略",
      ]),
    ],
    workflowStates: workflow("ai_center"),
    agentGates: gates(),
    tasks: [
      task(
        "ai-t1",
        "配置模型供应商、RAG 知识库和 MCP 工具注册表",
        "AI平台管理员",
        "doing",
      ),
      task(
        "ai-t2",
        "发布业务 Agent 权限、审批和成本策略",
        "AI应用负责人",
        "todo",
      ),
    ],
    approvals: [approval("ai-a1", "AI 能力与工具权限发布审批", "平台负责人")],
    risks: [
      risk(
        "ai-r1",
        "AI 工具越权调用或输出不可追溯",
        "critical",
        "所有 Agent 工具调用必须绑定租户、模块、审批边界和审计事件。",
      ),
    ],
    fileTypes: [".json", ".yaml", ".md", ".csv", ".sqlite", ".parquet"],
    visualization: {
      mode: "settings",
      title: "AI 能力、接口、数据库、可视化、RAG、MCP、Agent 与 PanAI 控制台",
      layers: [
        "模型供应商",
        "API网关",
        "接口合同",
        "数据库对象",
        "可视化面板",
        "RAG",
        "MCP",
        "Agent",
        "PanAI",
        "安全审计",
        "成本",
      ],
      telemetry: [
        "interface_contract_status",
        "database_binding_status",
        "visual_panel_readiness",
        "token_cost",
        "rag_hit_rate",
        "tool_call_count",
        "guardrail_block_count",
      ],
    },
    standards: [
      "NIST AI RMF",
      "ISO 27001",
      "SOC 2",
      "PIPL/GDPR privacy controls",
      "MCP tool governance",
    ],
    dataObjects: [
      "model_providers",
      "api_keys",
      "api_routes",
      "interface_contracts",
      "database_bindings",
      "schema_migrations",
      "visualization_panels",
      "telemetry_dashboards",
      "rag_collections",
      "mcp_servers",
      "agent_profiles",
      "tool_permissions",
      "panai_jobs",
      "prompt_templates",
      "guardrails",
      "ai_audit_logs",
      "cost_policies",
    ],
    routeHref: "/app/modules/ai_center",
    schemaRef: "module.schema/ai_center.v1",
  },
  {
    id: "settings_center",
    order: 16,
    zhName: "设置中心",
    enName: "Settings Center",
    track: "platform",
    status: "foundation",
    summary:
      "人员、账号、密码、头像、单位、岗位、角色和权限的组织管理控制中心。",
    objective:
      "让人员身份、账号安全、组织归属、岗位职责和授权边界都可增删改查、可审计、可回滚。",
    subdomains: [
      {
        id: "person-account",
        name: "人员账号",
        purpose: "管理人员资料、登录账号、联系方式、账号状态和头像标识。",
        ownerRole: "账号管理员",
        capabilityLevel: "foundation",
      },
      {
        id: "password-security",
        name: "密码安全",
        purpose: "维护密码重置、账号锁定、停用和账号安全审计。",
        ownerRole: "安全管理员",
        capabilityLevel: "workflow",
      },
      {
        id: "unit-position",
        name: "单位与岗位",
        purpose: "维护组织单位、岗位、岗位等级和人员归属。",
        ownerRole: "人力资源负责人",
        capabilityLevel: "workflow",
      },
      {
        id: "role-permission",
        name: "角色与权限",
        purpose: "维护角色模板、账号权限和高危授权边界。",
        ownerRole: "IAM 管理员",
        capabilityLevel: "foundation",
      },
      {
        id: "database-operations",
        name: "数据库运维",
        purpose:
          "可视化管理 ArchIToken data-plane、真实数据库/存储服务、同机数据库容器、连接状态、fallback 和巡检审计。",
        ownerRole: "数据平台管理员",
        capabilityLevel: "workflow",
      },
    ],
    inputs: [],
    outputs: [],
    artifacts: [
      artifact("identity-directory", "人员账号目录", "JSON", "账号管理员", [
        "账号状态",
        "头像标识",
      ]),
      artifact("permission-matrix", "角色权限矩阵", "CSV", "IAM 管理员", [
        "角色模板",
        "高危权限",
      ]),
    ],
    workflowStates: workflow("settings_center"),
    agentGates: gates(),
    tasks: [
      task("sc-t1", "整理人员账号和岗位归属", "账号管理员", "doing"),
      task("sc-t2", "复核高危权限和密码重置记录", "IAM 管理员", "todo"),
    ],
    approvals: [approval("sc-a1", "账号与权限变更发布", "平台负责人")],
    risks: [
      risk(
        "sc-r1",
        "账号、岗位或权限边界不一致导致越权访问",
        "critical",
        "所有人员、密码、单位、岗位和授权变更必须产生审计事件和版本回滚点。",
      ),
    ],
    fileTypes: [".json", ".csv", ".md"],
    visualization: {
      mode: "settings",
      title: "人员账号、单位岗位、权限和数据库运维控制台",
      layers: [
        "人员",
        "账号",
        "密码",
        "头像",
        "单位",
        "岗位",
        "权限",
        "数据库",
        "存储",
        "审计",
      ],
      telemetry: [
        "account_count",
        "locked_account_count",
        "permission_change_count",
        "database_provider_status",
        "database_runtime_probe_error_count",
      ],
    },
    standards: [
      "SOC 2",
      "ISO 27001",
      "NIST AI RMF",
      "PIPL/GDPR privacy controls",
    ],
    dataObjects: [
      "people",
      "accounts",
      "password_reset_events",
      "avatars",
      "org_units",
      "positions",
      "roles",
      "permissions",
      "data_plane_bindings",
      "database_runtime_inventory",
      "database_runtime_probe_events",
      "audit_events",
    ],
    routeHref: "/app/modules/settings_center",
    schemaRef: "module.schema/settings_center.v1",
  },
];

export const moduleRegistry = Object.fromEntries(
  moduleSpecs.map((spec) => [spec.id, spec]),
) as Record<ModuleId, ModuleSpec>;

export function normalizeModuleId(moduleId: string): ModuleId | null {
  const normalized = moduleId.trim().toLowerCase().replaceAll("-", "_");
  if (normalized === "finance_hr") {
    return "finance_management";
  }
  // Module baseline rename (#3): retired ids alias to the canonical id.
  if (normalized === "manufacturing" || normalized === "fabrication") {
    return "production_manufacturing";
  }
  if ((activeModuleIds as readonly string[]).includes(normalized)) {
    return normalized as ModuleId;
  }
  return null;
}

export function getModuleSpec(moduleId: string): ModuleSpec {
  const normalized = normalizeModuleId(moduleId);
  if (!normalized) {
    throw new Error(`Unknown module: ${moduleId}`);
  }
  return moduleRegistry[normalized];
}

export function getModuleDependencyIssues(): string[] {
  const ids = new Set<ModuleId>(activeModuleIds);
  return moduleSpecs.flatMap((spec) =>
    [...spec.inputs, ...spec.outputs]
      .filter((moduleId) => !ids.has(moduleId))
      .map((moduleId) => `${spec.id} references missing module ${moduleId}`),
  );
}

export function getModuleReadinessScore(): number {
  const weights: Record<ModuleStatus, number> = {
    active: 1,
    pilot: 0.74,
    foundation: 0.68,
    planned: 0.42,
  };
  const total = moduleSpecs.reduce(
    (sum, spec) => sum + weights[spec.status],
    0,
  );
  return Math.round((total / moduleSpecs.length) * 1000) / 10;
}

export function getPlatformStats() {
  return {
    modules: moduleSpecs.length,
    artifacts: moduleSpecs.reduce(
      (sum, spec) => sum + spec.artifacts.length,
      0,
    ),
    subdomains: moduleSpecs.reduce(
      (sum, spec) => sum + spec.subdomains.length,
      0,
    ),
    risks: moduleSpecs.reduce((sum, spec) => sum + spec.risks.length, 0),
    readiness: getModuleReadinessScore(),
  };
}
