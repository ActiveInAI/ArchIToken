// lib/ai-assistant-profile.ts - Floating AI assistant profile fixture
// License: Apache-2.0

import type { ModuleId } from "./module-registry";

export interface AssistantWork {
  id: string;
  title: string;
  kind: string;
  metric: string;
}

export interface AssistantProfile {
  name: string;
  level: string;
  certification: string;
  role: string;
  unread: number;
  followers: string;
  works: AssistantWork[];
  capabilityTags: string[];
  quickActions: string[];
}

export const architokenAssistantProfile: AssistantProfile = {
  name: "ArchIToken AI",
  level: "Lv.7 工程智能体",
  certification: "已认证",
  role: "AEC 全流程工程助手",
  unread: 4,
  followers: "12.8k",
  works: [
    {
      id: "scheme-pack",
      title: "方案包",
      kind: "Concept Pack",
      metric: "38 个模板",
    },
    { id: "boq", title: "BOQ", kind: "Costing", metric: "96% 口径绑定" },
    {
      id: "detail-model",
      title: "深化模型",
      kind: "IFC/GLB",
      metric: "2,418 构件",
    },
    { id: "work-order", title: "生产工单", kind: "MES", metric: "12 批次" },
    { id: "site-log", title: "施工日志", kind: "Evidence", metric: "128 篇" },
    {
      id: "twin-snapshot",
      title: "数字孪生快照",
      kind: "Twin",
      metric: "WebGPU ready",
    },
    {
      id: "archive-pack",
      title: "归档包",
      kind: "Archive",
      metric: "7 年留存",
    },
  ],
  capabilityTags: [
    "BIM",
    "WebGPU",
    "IFC",
    "造价",
    "施工管理",
    "材料物流",
    "生产制造",
    "数字档案",
  ],
  quickActions: ["生成", "校核", "审批建议", "查看风险", "联系客服"],
};

export const moduleAssistantSuggestions: Record<ModuleId, string[]> = {
  personal_center: [
    "整理我的待办和最近文件",
    "核对个人资料与岗位权限",
    "配置通知、主题和目录偏好",
  ],
  marketing_service: [
    "筛选0号合伙人并生成跟进清单",
    "生成企微欢迎语和客户标签SOP",
    "排周末样板房10步接待流程",
  ],
  planning_management: [
    "生成60天推广甘特和责任矩阵",
    "识别65-75天深化交付关键路径",
    "生成计划风险台账",
  ],
  concept_design: [
    "生成三套重钢结构概念方案",
    "校核柱网、吊装和投资边界",
    "生成客户展示包",
  ],
  standard_library: [
    "检索 GB/AISC/Eurocode/AS 条文",
    "生成 Q355B 构件族",
    "发布规则库版本",
  ],
  detailed_design: [
    "生成钢平台2D平面",
    "派生柱梁构造柱和屋面BOM",
    "归档待复核STEP/GLTF任务",
  ],
  quantity_costing: [
    "从 IFC 抽取 MTO",
    "生成 BOQ 和价格快照",
    "评估变更成本影响",
  ],
  material_logistics: [
    "按SS-04-08生成采购和包装计划",
    "校核模块运输限界和临时支撑",
    "安排物流ETA并签收批次",
  ],
  production_manufacturing: [
    "校核P1生产放行闸门",
    "生成螺栓孔位CNC包",
    "运行防腐防火和孔位质检",
  ],
  construction_management: [
    "生成吊装和调平校准工艺记录",
    "登记高强螺栓初终拧证据",
    "校核3间样板间放行闸门",
  ],
  digital_twin: [
    "切换质量/安全/成本图层",
    "选择构件并查看属性",
    "导出数字孪生快照",
  ],
  digital_archive: ["生成竣工归档包", "校验签章和版本链", "导出长期留存索引"],
  finance_management: [
    "校核智能会计系统参数",
    "生成凭证报告与凭证列表",
    "执行财务核对和差异分析",
  ],
  human_resources: [
    "同步项目人员和班组清单",
    "校核资质证书和到期风险",
    "分析考勤工时与绩效依据",
  ],
  ai_center: [
    "生成模型路由与 fallback 策略",
    "为项目文档构建 RAG 索引",
    "编排 Planner 到 Approver 的 Agent 流程",
  ],
  settings_center: ["新建人员账号", "重置账号密码", "复核岗位权限矩阵"],
};
