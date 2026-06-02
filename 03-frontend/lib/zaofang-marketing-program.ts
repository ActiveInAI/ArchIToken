// lib/zaofang-marketing-program.ts - Zaofang 60-day partner-led promotion program
// Source: /home/insome/下载/造房网｜市场推广策略 具体执行步骤(1).docx
// License: Apache-2.0

import type { ModuleId } from "./module-registry";

export interface ZaofangMarketingPreflightItem {
  id: string;
  title: string;
  standard: string;
  evidence: string[];
  moduleIds: ModuleId[];
}

export interface ZaofangMarketingStage {
  id: string;
  title: string;
  dayRange: string;
  objective: string;
  coreActions: string[];
  evidence: string[];
  moduleIds: ModuleId[];
}

export interface ZaofangMarketingBudgetItem {
  item: string;
  amountRmb: number;
  note: string;
}

export const zaofangMarketingProgram = {
  sourceFile: "/home/insome/下载/造房网｜市场推广策略 具体执行步骤(1).docx",
  title: "造房网 60 天市场推广执行程序",
  principle:
    "真实业务链路推进，杜绝形式化操作；每一步明确目标、流程、标准和可追溯证据。",
  flow: "线上冷启动挖掘0号合伙人 -> 线下合伙人破局 -> 合伙人赋能 -> 口碑引爆 -> 样板房成交 -> 口碑裂变循环",
  targetRegions: ["杭州重点乡镇", "上海重点乡镇", "宁波重点乡镇"],
  sampleHouseAnchor:
    "每个乡镇 1 个核心样板房选址；已确定濮院星旗镇体验销售中心。",
  conversionSla:
    "企业微信客户咨询 24 小时内响应；客户签约后每周至少 2 次同步施工进度。",
};

export const zaofangMarketingPreflight: ZaofangMarketingPreflightItem[] = [
  {
    id: "target-township",
    title: "确定核心目标区域",
    standard:
      "杭州、上海、宁波各 1 个重点乡镇，每个乡镇 1 个核心样板房选址，覆盖周边 2-3 个行政村镇。",
    evidence: ["目标乡镇清单", "样板房地址", "覆盖村镇范围", "交通与客流说明"],
    moduleIds: ["marketing_service", "planning_management", "digital_archive"],
  },
  {
    id: "landing-page",
    title: "官网/落地页 8 项信息收口",
    standard:
      "主标题、样板房图视频、核心优势、产品说明、全流程拆解、合伙人政策、本地案例预留、企微二维码和预约入口必须齐备。",
    evidence: ["页面版本", "样板房素材", "企微二维码", "预约按钮记录"],
    moduleIds: ["marketing_service", "ai_center", "digital_archive"],
  },
  {
    id: "partner-kit",
    title: "合伙人专属物料",
    standard:
      "合作手册、收益测算表、授权牌、单页海报和样板房体验邀请卡必须在冷启动前准备完成。",
    evidence: ["合作手册", "收益测算表", "授权牌发放记录", "物料版本"],
    moduleIds: ["marketing_service", "finance_management", "digital_archive"],
  },
  {
    id: "wechat-sop",
    title: "企业微信承接体系",
    standard: "自动欢迎语、自动回复 SOP、预约系统、客户标签体系必须可用。",
    evidence: ["欢迎语配置", "避坑手册推送记录", "预约记录", "客户标签"],
    moduleIds: ["marketing_service", "settings_center", "digital_archive"],
  },
  {
    id: "sample-house-standard",
    title: "样板房标准化布置",
    standard:
      "实景展示、AR 透视、数据看板、工艺展示区、接待区必须可看、可摸、可体验、可验证。",
    evidence: ["样板房验收清单", "AR 设备配置", "数据看板", "工艺样品照片"],
    moduleIds: [
      "marketing_service",
      "construction_management",
      "digital_twin",
      "digital_archive",
    ],
  },
];

export const zaofangMarketingStages: ZaofangMarketingStage[] = [
  {
    id: "online-cold-start",
    title: "线上冷启动：挖掘0号种子合伙人",
    dayRange: "D1-D14",
    objective:
      "用朋友圈本地推和抖音本地投放，让潜在合伙人主动认知造房网并筛选高意向0号种子合伙人。",
    coreActions: [
      "每城投放预算 1000 元/月，三城合计 3000 元/月，不做全域投放。",
      "定向 30-55 岁建筑、设计、建材、施工劳务、商会和返乡创业人群，地域精准到重点乡镇。",
      "以官网停留超过 3 分钟、咨询合作问题、主动加企微且响应积极作为高意向筛选标准。",
      "每城至少锁定 1 个、总计 2-3 个最优质 0 号种子合伙人。",
    ],
    evidence: ["投放数据", "加微记录", "官网停留时长", "0号合伙人筛选表"],
    moduleIds: [
      "marketing_service",
      "planning_management",
      "ai_center",
      "digital_archive",
    ],
  },
  {
    id: "offline-partner-breakthrough",
    title: "线下破局：签约0号合伙人并搭建网络",
    dayRange: "D14-D30",
    objective:
      "通过上门洽谈和样板房体验签约0号合伙人，再由0号合伙人带入设计机构、包工头、商会负责人和乡村意见领袖。",
    coreActions: [
      "一对一拜访时携带型材样品、合作手册、收益测算表、样板房地址和体验邀请卡。",
      "洽谈聚焦产品、样板房、合作模式和 5% 佣金，禁止虚假承诺。",
      "协议约定合伙人负责推荐和信任背书，造房网负责产品、施工、售后、政策支持和物料。",
      "客户签约回款后 7 个工作日内结算佣金，合作期限 1 年，到期自动续约。",
      "截至第 20 天建成 10-15 个核心合伙人网络，每城 3-5 个。",
    ],
    evidence: [
      "拜访纪要",
      "样板房体验记录",
      "合伙人协议",
      "合伙人档案",
      "服务群记录",
    ],
    moduleIds: [
      "marketing_service",
      "finance_management",
      "digital_archive",
      "settings_center",
    ],
  },
  {
    id: "partner-enablement",
    title: "合伙人赋能：培训、考核和工具包",
    dayRange: "D30-D45",
    objective:
      "解决合伙人不会推广、不敢推广的问题，让合伙人掌握项目讲解、朋友圈社群转发、带客和佣金查询方法。",
    coreActions: [
      "集中 1 天分批培训，每批 5-8 个合伙人，地点为样板房接待区或本地会议室。",
      "培训内容覆盖通俗化项目讲解、晚间 7-9 点和周末转发、带客预约、佣金结算查询。",
      "培训后用简单提问考核；未通过者进入一对一指导。",
      "发放案例视频、样板房图片、专属预约二维码、本地政策手册和 3-5 条转发文案模板。",
    ],
    evidence: [
      "培训签到",
      "考核记录",
      "工具包版本",
      "专属二维码",
      "一对一指导记录",
    ],
    moduleIds: ["marketing_service", "ai_center", "digital_archive"],
  },
  {
    id: "word-of-mouth-blast",
    title: "口碑引爆：标杆案例和圈层传播",
    dayRange: "D45-D60",
    objective:
      "打造 1-2 个本地标杆客户，通过合伙人圈层传播，让 C 端客户主动添加企业微信咨询。",
    coreActions: [
      "优先选择 0 号合伙人或商会负责人推荐的高信任客户，客单均价约 50 万元。",
      "完整记录开工、模块生产、现场施工、验收、补贴申领、完工实景和客户采访。",
      "形成 1-2 分钟案例视频和一组案例图片，标注乡镇、建房需求、工期和补贴金额。",
      "所有合伙人每周转发 2-3 次，覆盖朋友圈、同乡会群、设计群、乡村邻里群和包工头圈子。",
      "企微顾问 24 小时内响应，先发避坑手册、案例素材和政策摘要，再做需求初筛。",
    ],
    evidence: [
      "标杆客户协议",
      "拍摄素材",
      "案例视频",
      "合伙人转发记录",
      "客户咨询标签",
    ],
    moduleIds: [
      "marketing_service",
      "construction_management",
      "digital_archive",
      "finance_management",
    ],
  },
  {
    id: "sample-house-close",
    title: "线下收口：样板房成交和裂变循环",
    dayRange: "D46-D60+",
    objective:
      "用周末样板房集中接待解决最终顾虑，促成签约，并通过签约后服务引导客户二次裂变。",
    coreActions: [
      "周末每日安排 2 名接待人员，分别负责产品流程讲解、预算测算和签约对接。",
      "执行 10 步转化流程：接待、实景参观、AR 透视、触摸型材、数据对比、工期讲解、政策解读、预算测算、案例播放、签约。",
      "现场预算必须拆解施工、材料、报建和补贴抵扣，说明无隐形消费。",
      "签约后建立客户服务群，每周至少 2 次同步施工图片和短视频。",
      "客户完工入住后邀请分享体验，客户推荐新客户可享家电礼品等合规奖励。",
    ],
    evidence: [
      "看房预约",
      "接待记录",
      "预算测算表",
      "签约合同",
      "施工进度群记录",
      "客户裂变线索",
    ],
    moduleIds: [
      "marketing_service",
      "finance_management",
      "construction_management",
      "digital_archive",
    ],
  },
];

export const zaofangMarketingBudget: ZaofangMarketingBudgetItem[] = [
  {
    item: "线上冷启动投放",
    amountRmb: 6000,
    note: "60 天三城合计小范围精准投放。",
  },
  {
    item: "合伙人拓展与体验",
    amountRmb: 20000,
    note: "拜访、体验、授权牌和本地网络建设。",
  },
  {
    item: "物料制作",
    amountRmb: 4000,
    note: "合作手册、收益测算表、单页、海报和政策手册。",
  },
  {
    item: "标杆案例打造",
    amountRmb: 550000,
    note: "样板房主体结构和硬装参考值；展示级样板房不是普通交付房。",
  },
  {
    item: "人工与杂费",
    amountRmb: 50000,
    note: "接待、拍摄、培训、交通和日常执行。",
  },
];

export const zaofangSampleHouseCostRange = {
  landAreaSquareMeter: 146,
  buildingAreaSquareMeter: 224,
  totalRangeRmb: [550000, 740000],
  breakdown: [
    "重钢别墅主体约 30 万元",
    "地基 + 基础约 5 万元",
    "水电暖通 + 设备约 5 万元",
    "展示级精装修约 15 万元",
  ],
};

export const zaofangMarketingRiskControls = [
  "不开展全域投放，不进行陌生推销，所有获客依托合伙人信任流转。",
  "0号合伙人优先筛选、重点服务，避免把精力浪费在低意向、无资源人群。",
  "样板房必须保持整洁规范，接待人员需熟练掌握产品和政策。",
  "合伙人佣金必须按协议准时结算，不得拖欠、克扣。",
  "所有推广动作突出“省心、靠谱、本地案例”，杜绝夸大宣传和虚假承诺。",
  "每日复盘合伙人签约数、客户进线数、看房数和签约数，及时优化执行动作。",
];

export function getZaofangMarketingStagesForModule(
  moduleId: ModuleId,
): ZaofangMarketingStage[] {
  return zaofangMarketingStages.filter((stage) =>
    stage.moduleIds.includes(moduleId),
  );
}
