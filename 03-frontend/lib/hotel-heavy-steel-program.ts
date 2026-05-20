// lib/hotel-heavy-steel-program.ts - 100-room Q235B bolted hotel detailing catalog
// Generated from /home/insome/下载/重钢装配式酒店深化图纸目录.docx.
// License: Apache-2.0

import type { ModuleId } from './module-registry';

export interface HeavySteelHotelProgram {
  sourceFile: string;
  projectTitle: string;
  structureSystem: string;
  precisionRule: string;
  modularRule: string;
  deliveryWindow: string;
  totalDrawings: number;
  packageCount: number;
  sectionCount: number;
  phaseCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  hardRules: string[];
}

export interface HeavySteelHotelDrawingPackage {
  mark: string;
  name: string;
  count: number;
  description: string;
  moduleIds: ModuleId[];
  sectionKeys: string[];
}

export interface HeavySteelHotelDrawingSection {
  key: string;
  name: string;
  count: number;
  packageName: string;
}

export interface HeavySteelHotelDrawingSheet {
  code: string;
  title: string;
  keyPoints: string;
  phase: string;
  role: string;
  priority: string;
  sectionKey: string;
  sectionName: string;
  packageName: string;
}

export const heavySteelHotelProgram: HeavySteelHotelProgram = {
  "sourceFile": "/home/insome/下载/重钢装配式酒店深化图纸目录.docx",
  "projectTitle": "100间精品酒店 · Q235B 全栓接重钢装配式",
  "structureSystem": "Q235B全栓接重钢 · 无现场焊接",
  "precisionRule": "0~-2mm 加工精度 · 孔洞均为圆孔",
  "modularRule": "跨度≤12m · 层高3.6m · ≤5层/18m · 模数600mm",
  "deliveryWindow": "65~75天（P1先行 D1~15 / P2同步 D15~60 / P3收口 D40~75）",
  "totalDrawings": 198,
  "packageCount": 8,
  "sectionCount": 33,
  "phaseCounts": {
    "P1·先行": 55,
    "P2·同步": 105,
    "P3·收口": 38
  },
  "priorityCounts": {
    "高": 111,
    "中": 68,
    "低": 19
  },
  "hardRules": [
    "工厂钢构件下单前，重钢装配式钢结构专项深化必须 100% 完成。",
    "螺栓孔位、耳板尺寸、预留孔洞一经确认不得变更。",
    "所有穿梁圆孔须与 SS-04-05 一一对应，穿梁孔定位确认前钢构加工图不得下单。",
    "全流程输出为专业复核草稿，结构、消防、节能、施工安全和验收结论必须由责任专业人员复核签署。"
  ]
};

export const heavySteelHotelDrawingPackages: HeavySteelHotelDrawingPackage[] = [
  {
    "mark": "①",
    "name": "重钢装配式钢结构专项深化",
    "count": 42,
    "description": "Q235B 全栓接节点、结构体系、模块拆分、钢构件加工图，是工厂下单前必须 100% 冻结的最高优先级板块。",
    "moduleIds": [
      "detailed_design",
      "production_manufacturing",
      "quantity_costing",
      "material_logistics",
      "construction_management",
      "digital_twin",
      "digital_archive"
    ],
    "sectionKeys": [
      "1-A",
      "1-B",
      "1-C",
      "1-D"
    ]
  },
  {
    "mark": "②",
    "name": "建筑土建深化（全面重构）",
    "count": 25,
    "description": "取消砌体承重和外墙抹灰逻辑，改为钢骨架围护、装配式地坪、预制钢梯和工厂天沟体系。",
    "moduleIds": [
      "detailed_design",
      "standard_library",
      "construction_management",
      "digital_archive"
    ],
    "sectionKeys": [
      "2-A",
      "2-B",
      "2-C"
    ]
  },
  {
    "mark": "③",
    "name": "室内精装深化（钢构适配版）",
    "count": 33,
    "description": "精装服从钢构模数，前置预埋、吊顶避梁、声桥切断、干挂卡扣和公差协调。",
    "moduleIds": [
      "detailed_design",
      "production_manufacturing",
      "construction_management",
      "digital_archive"
    ],
    "sectionKeys": [
      "3-A",
      "3-B",
      "3-C",
      "3-D",
      "3-E",
      "3-F"
    ]
  },
  {
    "mark": "④",
    "name": "机电综合深化（系统性改图）",
    "count": 30,
    "description": "机电管线先避让钢梁，穿梁圆孔与钢构加工图一一对应，先 BIM 碰撞后下单。",
    "moduleIds": [
      "detailed_design",
      "standard_library",
      "construction_management",
      "digital_twin",
      "digital_archive"
    ],
    "sectionKeys": [
      "4-A",
      "4-B",
      "4-C",
      "4-D",
      "4-E",
      "4-F"
    ]
  },
  {
    "mark": "⑤",
    "name": "软装·厨房·景观·智能化专项",
    "count": 16,
    "description": "重型软装、商业厨房、景观连廊和智能化设备必须前置钢基座、支架和预埋点。",
    "moduleIds": [
      "detailed_design",
      "production_manufacturing",
      "material_logistics",
      "construction_management",
      "digital_archive"
    ],
    "sectionKeys": [
      "5-A",
      "5-B",
      "5-C",
      "5-D"
    ]
  },
  {
    "mark": "⑥",
    "name": "装配式围护结构专项深化",
    "count": 20,
    "description": "ALC、外墙一体板、门窗装配、气密水密节点和热桥断桥按钢构模数协同。",
    "moduleIds": [
      "detailed_design",
      "standard_library",
      "production_manufacturing",
      "construction_management",
      "digital_archive"
    ],
    "sectionKeys": [
      "6-A",
      "6-B",
      "6-C",
      "6-D"
    ]
  },
  {
    "mark": "⑦",
    "name": "消防专项深化",
    "count": 14,
    "description": "钢构防火包覆、喷淋排烟与钢梁避让、防火分区围护配合和消防控制设备深化。",
    "moduleIds": [
      "detailed_design",
      "standard_library",
      "construction_management",
      "digital_archive"
    ],
    "sectionKeys": [
      "7-A",
      "7-B",
      "7-C"
    ]
  },
  {
    "mark": "⑧",
    "name": "现场装配施工工艺深化",
    "count": 18,
    "description": "吊装顺序、调平校准、螺栓紧固、拼缝防渗、干湿分区和质量安全验收工艺。",
    "moduleIds": [
      "construction_management",
      "material_logistics",
      "digital_twin",
      "digital_archive"
    ],
    "sectionKeys": [
      "8-A",
      "8-B",
      "8-C"
    ]
  }
] as HeavySteelHotelDrawingPackage[];

export const heavySteelHotelDrawingSections: HeavySteelHotelDrawingSection[] = [
  {
    "key": "1-A",
    "name": "结构体系与截面定型",
    "count": 12,
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "key": "1-B",
    "name": "全栓接节点深化",
    "count": 11,
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "key": "1-C",
    "name": "模块化单元拆分深化",
    "count": 8,
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "key": "1-D",
    "name": "钢构件加工深化（工厂直接使用）",
    "count": 11,
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "key": "2-A",
    "name": "建筑平面与空间（钢构版）",
    "count": 7,
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "key": "2-B",
    "name": "地坪/楼地面构造（从钢楼承板起）",
    "count": 6,
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "key": "2-C",
    "name": "外墙/屋面/楼梯/细部",
    "count": 12,
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "key": "3-A",
    "name": "精装模数与平面控制（6份）",
    "count": 6,
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "key": "3-B",
    "name": "吊顶系统与钢梁避让（6份）",
    "count": 6,
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "key": "3-C",
    "name": "固装柜体与预埋件（5份）",
    "count": 5,
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "key": "3-D",
    "name": "卫浴/防水/地面系统（6份）",
    "count": 6,
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "key": "3-E",
    "name": "墙面系统与声学（6份）",
    "count": 6,
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "key": "3-F",
    "name": "公区精装（4份）",
    "count": 4,
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "key": "4-A",
    "name": "管线综合（6份）",
    "count": 6,
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "key": "4-B",
    "name": "穿梁预留（4份）",
    "count": 4,
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "key": "4-C",
    "name": "给排水（5份）",
    "count": 5,
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "key": "4-D",
    "name": "暖通空调（5份）",
    "count": 5,
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "key": "4-E",
    "name": "强电（4份）",
    "count": 4,
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "key": "4-F",
    "name": "弱电/智能化（6份）",
    "count": 6,
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "key": "5-A",
    "name": "软装预埋（3份）",
    "count": 3,
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "key": "5-B",
    "name": "厨房/后勤（4份）",
    "count": 4,
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "key": "5-C",
    "name": "景观/室外（4份）",
    "count": 4,
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "key": "5-D",
    "name": "智能化专项（5份）",
    "count": 5,
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "key": "6-A",
    "name": "外墙围护（8份）",
    "count": 8,
    "packageName": "装配式围护结构专项深化"
  },
  {
    "key": "6-B",
    "name": "内隔墙（5份）",
    "count": 5,
    "packageName": "装配式围护结构专项深化"
  },
  {
    "key": "6-C",
    "name": "屋面（4份）",
    "count": 4,
    "packageName": "装配式围护结构专项深化"
  },
  {
    "key": "6-D",
    "name": "热工气密性（3份）",
    "count": 3,
    "packageName": "装配式围护结构专项深化"
  },
  {
    "key": "7-A",
    "name": "钢构防火（4份）",
    "count": 4,
    "packageName": "消防专项深化"
  },
  {
    "key": "7-B",
    "name": "消防水报警（5份）",
    "count": 5,
    "packageName": "消防专项深化"
  },
  {
    "key": "7-C",
    "name": "防火分区排烟（5份）",
    "count": 5,
    "packageName": "消防专项深化"
  },
  {
    "key": "8-A",
    "name": "钢构安装工艺（6份）",
    "count": 6,
    "packageName": "现场装配施工工艺深化"
  },
  {
    "key": "8-B",
    "name": "围护精装施工工艺（6份）",
    "count": 6,
    "packageName": "现场装配施工工艺深化"
  },
  {
    "key": "8-C",
    "name": "物料质量安全（6份）",
    "count": 6,
    "packageName": "现场装配施工工艺深化"
  }
];

export const heavySteelHotelDrawingSheets: HeavySteelHotelDrawingSheet[] = [
  {
    "code": "SS-01-01",
    "title": "结构体系总说明",
    "keyPoints": "Q235B重钢设计依据、规范版本（GB50017）、体系定义、全栓接声明、材料复验要求",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-02",
    "title": "建筑结构平面模数定位图",
    "keyPoints": "柱网轴线（600mm模数）、间距、客房开间×进深（如3600×7200）、100间总平面布局定位",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-03",
    "title": "荷载取值与组合说明",
    "keyPoints": "客房活载2.0kN/m²、走廊3.5kN/m²、屋面0.5kN/m²、隔墙线荷载1.0kN、设备集中荷载表",
    "phase": "P1·先行",
    "role": "荷载验算顾问",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-04",
    "title": "H型钢主梁截面选用表",
    "keyPoints": "各跨主梁HN/HW型号（HN400×200/HW300×300等）、腹板翼缘尺寸、自重、跨度对照表",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-05",
    "title": "钢柱截面选用表（箱型/H型）",
    "keyPoints": "各层钢柱规格（□250×250×8 / HW200×200）、板件厚度、柱高、轴压比复核结果",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-06",
    "title": "次梁截面及间距布置图",
    "keyPoints": "次梁规格（HN200×100等）、间距≤1500mm、与主梁栓接形式示意（腹板连接板铰接）",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-07",
    "title": "各层结构平面布置图",
    "keyPoints": "每层梁柱平面定位、构件编号标注、与建筑平面重叠校核、柱位偏差标注",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-08",
    "title": "楼层标高控制图",
    "keyPoints": "各层楼面完成面标高、梁顶标高、净高验证（客房≥2.7m/走廊≥2.4m）、层高控制尺寸链",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-09",
    "title": "钢结构伸缩缝/抗震缝深化图",
    "keyPoints": "缝宽取值（按GB50011）、缝两侧构件处理方式（滑动支座/柔性连接）、与围护收口节点",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "中",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-10",
    "title": "抗侧力支撑体系布置图",
    "keyPoints": "中心支撑/偏心支撑布置位置、杆件截面（角钢∠75×6/槽钢[14a）、与框架梁柱连接索引",
    "phase": "P1·先行",
    "role": "荷载验算顾问",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-11",
    "title": "基础锚栓平面布置图",
    "keyPoints": "柱脚锚栓M24~M30平面坐标、预埋深度、锚固长度12d、定位偏差允许值±5mm",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-01-12",
    "title": "结构整体计算书指标汇总",
    "keyPoints": "周期/位移比/剪重比/刚重比/层间位移角核心指标汇总、超限判别结论",
    "phase": "P1·先行",
    "role": "荷载验算顾问",
    "priority": "高",
    "sectionKey": "1-A",
    "sectionName": "结构体系与截面定型",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-01",
    "title": "高强螺栓选用总表",
    "keyPoints": "M16/M20/M24规格、10.9S/8.8S等级、摩擦面喷砂处理Sa2.5、预拉力/抗滑移系数μ≥0.45",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-02",
    "title": "柱-柱拼接节点详图",
    "keyPoints": "拼接板规格厚度、螺栓行列排布/间距/边距、单双盖板选择，含正立面+侧立面+剖面",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-03",
    "title": "主梁-钢柱端板栓接节点详图",
    "keyPoints": "端板厚度≥20mm、加劲肋布置、螺栓行列排布（外伸/平齐式）、柱腹板/翼缘加强验算",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-04",
    "title": "次梁-主梁铰接栓接节点详图",
    "keyPoints": "腹板连接板厚度/尺寸、螺栓孔位（双排4孔/单排3孔）、次梁搁置形式（搭接/平齐/下挂）",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-05",
    "title": "柱脚栓接锚固节点详图",
    "keyPoints": "锚栓规格M24~M30、锚固长度、底板厚度≥20mm、灌浆层厚30~50mm、双螺母调平",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-06",
    "title": "水平支撑/系杆栓接节点详图",
    "keyPoints": "楼层屋面水平支撑（单角钢∠75×6/双角钢2∠63×5）、节点板厚度、螺栓M16",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "中",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-07",
    "title": "钢楼梯梯段全栓接节点详图",
    "keyPoints": "踏步槽钢[10/钢板t5、斜梁端头节点板、与主体梁柱栓接详图、休息平台梁柱",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "中",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-08",
    "title": "螺栓紧固力矩标准说明图",
    "keyPoints": "终拧扭矩值M16=178N·m / M20=311N·m / M24=542N·m、检验标准、防松标记",
    "phase": "P1·先行",
    "role": "栓接工艺顾问",
    "priority": "高",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-09",
    "title": "隅撑节点详图",
    "keyPoints": "梁下隅撑防止下翼缘侧扭失稳、与梁腹板连接、截面L75×5、布置间隔≤1500mm",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "中",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-10",
    "title": "竖向支撑与框架连接节点详图",
    "keyPoints": "竖向支撑（人字/V形/K形）与框架梁柱交接处节点板、螺栓群验算、仅工厂焊接",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-02-11",
    "title": "梁柱刚性/半刚/铰接分类总表",
    "keyPoints": "全部节点按刚度分类汇总、对应转动刚度数值Rzb、适用位置标注",
    "phase": "P1·先行",
    "role": "荷载验算顾问",
    "priority": "中",
    "sectionKey": "1-B",
    "sectionName": "全栓接节点深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-03-01",
    "title": "模块单元总拆分图",
    "keyPoints": "客房/走道/公区/后勤模块总数量统计、编号规则（M-Rxx/M-Cxx/M-Pxx）、拼装逻辑流向",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-C",
    "sectionName": "模块化单元拆分深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-03-02",
    "title": "标准客房模块单元详图",
    "keyPoints": "单间尺寸长×宽×高、全部构件组成清单、运输限界宽≤3.9m/高≤4.5m、重心位置",
    "phase": "P1·先行",
    "role": "模块化顾问",
    "priority": "高",
    "sectionKey": "1-C",
    "sectionName": "模块化单元拆分深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-03-03",
    "title": "走道/公区模块单元详图",
    "keyPoints": "走廊模块宽度、端部连接节点、公区大跨（如大堂）模块截面加强方案",
    "phase": "P1·先行",
    "role": "模块化顾问",
    "priority": "高",
    "sectionKey": "1-C",
    "sectionName": "模块化单元拆分深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-03-04",
    "title": "模块吊装点位及吊耳详图",
    "keyPoints": "吊耳位置/规格（仅工厂焊）、吊点间距、重心校核、吊装角度限制≤60°",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-C",
    "sectionName": "模块化单元拆分深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-03-05",
    "title": "模块间层间连接节点详图",
    "keyPoints": "上下层模块对位、调平连接板、水平调平装置（垫片组/调节螺栓±20mm范围）",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-C",
    "sectionName": "模块化单元拆分深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-03-06",
    "title": "模块水平对位精度控制图",
    "keyPoints": "允许偏差±2mm/对位导向销φ20/现场复测校核程序/三维扫描验收点位",
    "phase": "P1·先行",
    "role": "现场钢构代表",
    "priority": "高",
    "sectionKey": "1-C",
    "sectionName": "模块化单元拆分深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-03-07",
    "title": "模块运输加固及临时支撑详图",
    "keyPoints": "运输途中斜撑加固方案、堆放垫块/支点位置、防变形限位措施",
    "phase": "P1·先行",
    "role": "模块化顾问",
    "priority": "中",
    "sectionKey": "1-C",
    "sectionName": "模块化单元拆分深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-03-08",
    "title": "典型楼层模块拼装顺序示意图",
    "keyPoints": "从端部向中间或从核心筒向外展开的拼装逻辑、每日安装量规划、塔吊覆盖",
    "phase": "P1·先行",
    "role": "现场钢构代表",
    "priority": "中",
    "sectionKey": "1-C",
    "sectionName": "模块化单元拆分深化",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-01",
    "title": "钢柱构件加工详图（每型一张）",
    "keyPoints": "精确下料长度、端头铣平度、螺栓孔精准坐标、公差0~-2mm、坡口形式K/V",
    "phase": "P1·先行",
    "role": "制图专员",
    "priority": "高",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-02",
    "title": "主梁构件加工详图（每型一张）",
    "keyPoints": "腹板开孔（机电穿梁圆孔）坐标、端板焊接（仅工厂焊）、加劲肋位置及尺寸",
    "phase": "P1·先行",
    "role": "制图专员",
    "priority": "高",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-03",
    "title": "次梁构件加工详图（每型一张）",
    "keyPoints": "连接板位置及尺寸、螺栓孔位、穿梁圆孔、端部切口形式（45°/直口）",
    "phase": "P1·先行",
    "role": "制图专员",
    "priority": "高",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-04",
    "title": "钢构件螺栓孔位总坐标汇总表",
    "keyPoints": "全部构件孔位以统一坐标系标注、CNC数控加工基础数据、孔径公差+0.5mm",
    "phase": "P1·先行",
    "role": "制图专员",
    "priority": "高",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-05",
    "title": "机电穿梁预留圆孔汇总图",
    "keyPoints": "每根梁穿孔数量、孔径D25起（圆孔）、孔心距梁端距离、避让箍筋加密区",
    "phase": "P1·先行",
    "role": "机电+重钢主师",
    "priority": "高",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-06",
    "title": "防火涂层分区图及等级表",
    "keyPoints": "耐火极限：柱3h/梁2h/楼板1.5h；薄型/厚型涂料分区标注、设计厚度",
    "phase": "P2·同步",
    "role": "消防顾问",
    "priority": "高",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-07",
    "title": "防腐涂装工艺图",
    "keyPoints": "底漆环氧富锌70μm + 中漆环氧云铁100μm + 面漆聚氨酯60μm；施工环境温湿度",
    "phase": "P2·同步",
    "role": "重钢深化主师",
    "priority": "中",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-08",
    "title": "钢构件清单总表（BOM表）",
    "keyPoints": "构件编号/规格/单重/数量/总重/材质Q235B/出厂顺序/包装单元、对接造价组",
    "phase": "P1·先行",
    "role": "造价算量专员",
    "priority": "高",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-09",
    "title": "预埋件（精装/机电）位置汇总图",
    "keyPoints": "全部预埋件在钢构件上的坐标：吊顶吊件/固装柜体/洁具基座/管线支架",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-10",
    "title": "现场安装用临时连接件清单",
    "keyPoints": "安装调节螺栓/垫片组/临时夹具/安全缆绳挂点/测量基准点预埋件的规格数量",
    "phase": "P1·先行",
    "role": "现场钢构代表",
    "priority": "中",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "SS-04-11",
    "title": "构件运输/堆放编码标识图",
    "keyPoints": "每个构件的喷涂编号规则（构件号-方向-楼层-区域）、堆放分区示意图",
    "phase": "P1·先行",
    "role": "物料统筹人员",
    "priority": "低",
    "sectionKey": "1-D",
    "sectionName": "钢构件加工深化（工厂直接使用）",
    "packageName": "重钢装配式钢结构专项深化"
  },
  {
    "code": "AR-01-01",
    "title": "各层建筑平面图（钢构版）",
    "keyPoints": "功能区划/隔墙位置全部标注钢柱网轴线定位、无承重砌体、门洞口与钢柱避让",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "高",
    "sectionKey": "2-A",
    "sectionName": "建筑平面与空间（钢构版）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-01-02",
    "title": "装配式隔墙系统布置图（各层）",
    "keyPoints": "轻钢龙骨/ALC隔墙位置/与钢柱梁连接锚固方式/禁止承重声明/门洞加固",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "高",
    "sectionKey": "2-A",
    "sectionName": "建筑平面与空间（钢构版）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-01-03",
    "title": "客房典型单元建筑放大图",
    "keyPoints": "单间净尺寸链/门窗位置/固定家具区/管道井位置/与钢柱网对照",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "高",
    "sectionKey": "2-A",
    "sectionName": "建筑平面与空间（钢构版）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-01-04",
    "title": "走廊/楼梯间/电梯厅平面放大图",
    "keyPoints": "公共区域净宽复核/疏散宽度达标/钢柱凸出处理/扶手/消火栓位置",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "高",
    "sectionKey": "2-A",
    "sectionName": "建筑平面与空间（钢构版）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-01-05",
    "title": "首层大堂/公区平面功能细化图",
    "keyPoints": "前台接待区/休息区/后勤动线/无障碍通道/与钢柱关系",
    "phase": "P3·收口",
    "role": "建筑深化设计师",
    "priority": "中",
    "sectionKey": "2-A",
    "sectionName": "建筑平面与空间（钢构版）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-01-06",
    "title": "屋顶层平面及女儿墙布置图",
    "keyPoints": "屋顶设备区/机房/检修通道/女儿墙高度/排水组织",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "中",
    "sectionKey": "2-A",
    "sectionName": "建筑平面与空间（钢构版）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-01-07",
    "title": "建筑立面展开图（四面）",
    "keyPoints": "外立面材质分格/窗洞排列/空调机位/标识预留/与钢柱模数对齐",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "中",
    "sectionKey": "2-A",
    "sectionName": "建筑平面与空间（钢构版）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-02-01",
    "title": "钢楼承板选型及构造详图",
    "keyPoints": "压型钢板型号YX51-250-720/厚度0.8~1.2mm/混凝土叠合层厚/配筋/支座搭接50mm",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "2-B",
    "sectionName": "地坪/楼地面构造（从钢楼承板起）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-02-02",
    "title": "客房楼地面构造层次详图",
    "keyPoints": "楼承板→40mm灌浆层→30mm找平→防水层→30mm砂浆→精装面层，累计厚度标注",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "高",
    "sectionKey": "2-B",
    "sectionName": "地坪/楼地面构造（从钢楼承板起）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-02-03",
    "title": "卫生间/淋浴区防水构造详图",
    "keyPoints": "楼承板面防水卷材+涂料复合、止水坎预制钢构件、1.8m高防水翻边",
    "phase": "P2·同步",
    "role": "防水防渗顾问",
    "priority": "高",
    "sectionKey": "2-B",
    "sectionName": "地坪/楼地面构造（从钢楼承板起）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-02-04",
    "title": "走廊/公区楼地面构造详图",
    "keyPoints": "楼承板→灌浆→找平→地砖/石材铺贴、不同材质交界处收口节点",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "中",
    "sectionKey": "2-B",
    "sectionName": "地坪/楼地面构造（从钢楼承板起）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-02-05",
    "title": "厨房/后勤区防滑地坪构造详图",
    "keyPoints": "加厚找平层/耐磨地坪/排水沟与楼承板配合/设备基础独立浇筑",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "中",
    "sectionKey": "2-B",
    "sectionName": "地坪/楼地面构造（从钢楼承板起）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-02-06",
    "title": "各功能区完成面高度控制表",
    "keyPoints": "分区域（客房/卫浴/走廊/公区）从钢梁顶到完成面的完整高度链、含误差预留±5mm",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "高",
    "sectionKey": "2-B",
    "sectionName": "地坪/楼地面构造（从钢楼承板起）",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-01",
    "title": "外墙钢骨架外挂体系布置图",
    "keyPoints": "C型钢/方通骨架与主钢柱连接节点、龙骨间距≤600mm、取消抹灰找平",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "高",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-02",
    "title": "预制钢梯全栓接深化图",
    "keyPoints": "梯段/平台梁/梯柱构件详图、全栓接节点、与主体连接、踏步防滑做法",
    "phase": "P2·同步",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-03",
    "title": "屋面排水天沟预制构件详图",
    "keyPoints": "钢天沟截面□300×200/坡度i=1%/分段长度≤6m/接头栓接/与主梁连接",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "中",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-04",
    "title": "屋面构造层次详图",
    "keyPoints": "钢承板→找坡层轻集料混凝土→防水卷材→保温层XPS50→保护层→防水透汽膜",
    "phase": "P2·同步",
    "role": "防水防渗顾问",
    "priority": "高",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-05",
    "title": "门窗装配式安装节点详图",
    "keyPoints": "窗框副框与钢柱预埋件/调节螺栓/气密水密胶缝/开启扇与钢梁避让距离",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "高",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-06",
    "title": "立面阳角阴角收口深化图",
    "keyPoints": "折边件/打胶缝宽8~15mm/密封胶规格/与结构膨胀缝对应关系",
    "phase": "P3·收口",
    "role": "建筑深化设计师",
    "priority": "中",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-07",
    "title": "散水/台阶/无障碍坡道详图",
    "keyPoints": "散水与主体脱开（留缝20mm填沥青砂）、坡道钢骨架、防滑措施",
    "phase": "P3·收口",
    "role": "建筑深化设计师",
    "priority": "低",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-08",
    "title": "疏散走道净宽及净高复核图",
    "keyPoints": "疏散宽度≥1.2m(客房)/≥1.4m(公区)、钢柱占用净空扣除、消防合规性签字确认",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "高",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-09",
    "title": "变形缝/伸缩缝建筑收口详图",
    "keyPoints": "内外变形缝盖板做法/防火封堵/隔音填充/防水处理/与装修面交接收口",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "中",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-10",
    "title": "幕墙/外装预埋件布置图（如有）",
    "keyPoints": "玻璃/铝板/石材幕墙预埋件在钢柱/梁上精确位置、承载力验算≥2倍安全系数",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "中",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-11",
    "title": "雨棚/门头钢结构详图",
    "keyPoints": "入口雨棚全栓接轻钢骨架/与主体连接/排水组织/灯光预埋/标识安装点",
    "phase": "P2·同步",
    "role": "重钢深化主师",
    "priority": "中",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "AR-03-12",
    "title": "设备管井/检修口平面布置图",
    "keyPoints": "管井位置随钢柱网/检修口尺寸≥500×500/与吊顶末端配合/检修空间",
    "phase": "P2·同步",
    "role": "建筑深化设计师",
    "priority": "中",
    "sectionKey": "2-C",
    "sectionName": "外墙/屋面/楼梯/细部",
    "packageName": "建筑土建深化（全面重构）"
  },
  {
    "code": "ID-01-01",
    "title": "客房精装模数控制总图",
    "keyPoints": "开间/进深尺寸链、所有硬装定制尺寸对照钢柱网核对表、余量分配原则",
    "phase": "P2·同步",
    "role": "精装主案(客房)",
    "priority": "高",
    "sectionKey": "3-A",
    "sectionName": "精装模数与平面控制（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-01-02",
    "title": "标准间平面深化图（含家具布局）",
    "keyPoints": "床/柜/书桌/电视柜/行李架/迷你吧固装位置、钢柱可见处理方案",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "中",
    "sectionKey": "3-A",
    "sectionName": "精装模数与平面控制（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-01-03",
    "title": "标准间四向立面深化图",
    "keyPoints": "床头墙/电视墙/窗侧墙/入口墙立面材料分区/收口节点索引/与钢梁位置叠加",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "中",
    "sectionKey": "3-A",
    "sectionName": "精装模数与平面控制（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-01-04",
    "title": "套房/无障碍房特殊户型平面深化图",
    "keyPoints": "套房分区/无障房回转半径≥1500mm/扶手位置/紧急呼叫按钮",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "低",
    "sectionKey": "3-A",
    "sectionName": "精装模数与平面控制（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-01-05",
    "title": "精装材料样板确认表（附色号/型号）",
    "keyPoints": "墙面/地面/顶面材料品名/品牌/规格/色号/表面处理、与钢构基层适配性说明",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "中",
    "sectionKey": "3-A",
    "sectionName": "精装模数与平面控制（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-01-06",
    "title": "各类型房统计及差异对比表",
    "keyPoints": "标准间/大床/双床/套房/无障房的数量/面积差/材料差异/造价影响",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "低",
    "sectionKey": "3-A",
    "sectionName": "精装模数与平面控制（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-02-01",
    "title": "吊顶龙骨固定深化图——栓接吊件体系",
    "keyPoints": "吊点固定于主/次钢梁腹板/专用栓接吊件（按H300/H400/H500分类采购）/间距≤1200mm",
    "phase": "P2·同步",
    "role": "精装主案(客房)",
    "priority": "高",
    "sectionKey": "3-B",
    "sectionName": "吊顶系统与钢梁避让（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-02-02",
    "title": "钢梁下凸造型优化方案图",
    "keyPoints": "藏梁式吊顶（局部降板）/露梁式（工业风装饰）/半藏方案/净高复核≥2.4m",
    "phase": "P2·同步",
    "role": "精装主案(客房)",
    "priority": "高",
    "sectionKey": "3-B",
    "sectionName": "吊顶系统与钢梁避让（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-02-03",
    "title": "走廊吊顶与机电管线综合避让图",
    "keyPoints": "走廊走管集中区/钢梁下净高/风管/强弱电桥架避让梁排布/最低点标注",
    "phase": "P2·同步",
    "role": "精装主案(公区)",
    "priority": "高",
    "sectionKey": "3-B",
    "sectionName": "吊顶系统与钢梁避让（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-02-04",
    "title": "卫生间吊顶防潮节点详图",
    "keyPoints": "铝扣板/防水石膏板吊顶/与钢梁防腐涂层过渡/排气扇/灯具预埋",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "中",
    "sectionKey": "3-B",
    "sectionName": "吊顶系统与钢梁避让（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-02-05",
    "title": "公区大堂/餐厅吊顶深化图",
    "keyPoints": "大型异形吊顶/重型灯盘/艺术装置预埋/与钢桁架连接方式",
    "phase": "P3·收口",
    "role": "精装主案(公区)",
    "priority": "中",
    "sectionKey": "3-B",
    "sectionName": "吊顶系统与钢梁避让（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-02-06",
    "title": "吊顶检修口/检修马道布置图",
    "keyPoints": "检修口位置（避开主要视觉区）/马道承载/钢梁固定点/护栏",
    "phase": "P3·收口",
    "role": "精装主案(公区)",
    "priority": "低",
    "sectionKey": "3-B",
    "sectionName": "吊顶系统与钢梁避让（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-03-01",
    "title": "固装柜体钢骨架预埋件深化图",
    "keyPoints": "床头背景板/衣柜/书桌背板/电视柜在钢柱梁阶段预埋L形连接件/位置坐标表",
    "phase": "P1·先行",
    "role": "精装主案(客房)",
    "priority": "高",
    "sectionKey": "3-C",
    "sectionName": "固装柜体与预埋件（5份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-03-02",
    "title": "固装柜体构造节点详图",
    "keyPoints": "柜体骨架镀锌方通/饰面板干挂/与预埋件连接/背板隔音岩棉25mm",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "中",
    "sectionKey": "3-C",
    "sectionName": "固装柜体与预埋件（5份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-03-03",
    "title": "衣柜内部功能配置详图",
    "keyPoints": "挂衣区/抽屉/保险箱位/行李架/照明/插座/与墙体钢骨架固定",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "低",
    "sectionKey": "3-C",
    "sectionName": "固装柜体与预埋件（5份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-03-04",
    "title": "前台/公区固装柜台深化图",
    "keyPoints": "接待台/服务台钢骨架/大理石台面/暗藏线槽/与地面钢承板固定",
    "phase": "P3·收口",
    "role": "精装主案(公区)",
    "priority": "中",
    "sectionKey": "3-C",
    "sectionName": "固装柜体与预埋件（5份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-03-05",
    "title": "预埋件位置总汇及验收检查表",
    "keyPoints": "全部精装预埋件坐标汇总/出厂前逐一勾选确认/缺一停工闸门机制",
    "phase": "P1·先行",
    "role": "精装主案(客房)",
    "priority": "高",
    "sectionKey": "3-C",
    "sectionName": "固装柜体与预埋件（5份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-04-01",
    "title": "集成卫浴基座钢骨架深化图",
    "keyPoints": "整体卫浴底盘钢基座/与楼承板连接/同厂加工/型号锁定后不可改/P1第10天前锁定",
    "phase": "P1·先行",
    "role": "精装主案(客房)",
    "priority": "高",
    "sectionKey": "3-D",
    "sectionName": "卫浴/防水/地面系统（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-04-02",
    "title": "洁具钢骨架预埋固定件详图",
    "keyPoints": "壁挂马桶（荷载≥400N）/洗手台/毛巾架在楼承板/钢梁阶段预埋承重件",
    "phase": "P1·先行",
    "role": "精装主案(客房)",
    "priority": "高",
    "sectionKey": "3-D",
    "sectionName": "卫浴/防水/地面系统（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-04-03",
    "title": "卫浴区防水加强层构造详图",
    "keyPoints": "楼承板面聚氨酯防水涂料2.0mm厚/止水坎预制钢件/淋浴区1800mm高翻边",
    "phase": "P2·同步",
    "role": "防水防渗顾问",
    "priority": "高",
    "sectionKey": "3-D",
    "sectionName": "卫浴/防水/地面系统（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-04-04",
    "title": "地面钢承板波峰处理及找平层详图",
    "keyPoints": "波峰50~75mm高/发泡水泥填充/30mm找平/完成面高度控制/不同区域落差",
    "phase": "P2·同步",
    "role": "精装主案(客房)",
    "priority": "高",
    "sectionKey": "3-D",
    "sectionName": "卫浴/防水/地面系统（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-04-05",
    "title": "地面精装面层铺装节点详图",
    "keyPoints": "木地板/地毯/石材/瓷砖与找平层粘结/踢脚线与钢骨架墙面收口",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "中",
    "sectionKey": "3-D",
    "sectionName": "卫浴/防水/地面系统（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-04-06",
    "title": "卫生间地面排水及挡水条节点",
    "keyPoints": "长条形地漏/挡水条石材整挖或不锈钢/坡度i=1%/与楼承板防水衔接",
    "phase": "P3·收口",
    "role": "防水防渗顾问",
    "priority": "中",
    "sectionKey": "3-D",
    "sectionName": "卫浴/防水/地面系统（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-05-01",
    "title": "墙面装配式干挂/卡扣节点详图",
    "keyPoints": "墙板木饰面/硬包/软包/金属/石材干挂件/禁湿贴/与钢骨架连接件",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "中",
    "sectionKey": "3-E",
    "sectionName": "墙面系统与声学（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-05-02",
    "title": "声桥切断系统构造详图（酒店最关键）",
    "keyPoints": "弹性阻尼垫橡胶基10mm厚 + ALC板1:1同步下单/STC≥55/IIC≥55/缺一拒收",
    "phase": "P2·同步",
    "role": "隔音专项设计师",
    "priority": "高",
    "sectionKey": "3-E",
    "sectionName": "墙面系统与声学（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-05-03",
    "title": "ALC内隔墙后挂钢骨架连接节点",
    "keyPoints": "ALC板与H型钢专用L/T/U型连接卡件/按钢截面H×b×tw×tf一一匹配/建立对应表",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "高",
    "sectionKey": "3-E",
    "sectionName": "墙面系统与声学（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-05-04",
    "title": "钢柱/钢梁可视面装饰包裹节点",
    "keyPoints": "钢柱包覆做法木饰面/金属板/格栅/可拆卸检修/与消防涂层关系",
    "phase": "P3·收口",
    "role": "精装主案(客房)",
    "priority": "中",
    "sectionKey": "3-E",
    "sectionName": "墙面系统与声学（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-05-05",
    "title": "防火涂层与精装饰面过渡节点详图",
    "keyPoints": "薄型涂层直接附着饰面/厚型涂层加设次龙骨过渡/界面处理剂",
    "phase": "P2·同步",
    "role": "消防顾问",
    "priority": "高",
    "sectionKey": "3-E",
    "sectionName": "墙面系统与声学（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-05-06",
    "title": "公差补偿件应用详图",
    "keyPoints": "钢构公差0~-2mm + 精装±1mm = 叠加3~4mm偏差/补偿件使用部位及规格",
    "phase": "P2·同步",
    "role": "精装主案(客房)",
    "priority": "高",
    "sectionKey": "3-E",
    "sectionName": "墙面系统与声学（6份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-06-01",
    "title": "大堂精装平面/立面深化图",
    "keyPoints": "前台/等候/休闲区/与钢柱网关系/大型艺术品基座/地面拼花定位",
    "phase": "P3·收口",
    "role": "精装主案(公区)",
    "priority": "中",
    "sectionKey": "3-F",
    "sectionName": "公区精装（4份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-06-02",
    "title": "走廊/电梯厅精装深化图",
    "keyPoints": "墙面/地面/顶面/电梯召唤盒/消防栓暗门/筒灯与钢梁避让",
    "phase": "P3·收口",
    "role": "精装主案(公区)",
    "priority": "中",
    "sectionKey": "3-F",
    "sectionName": "公区精装（4份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-06-03",
    "title": "餐饮区（早餐厅/咖啡吧）精装深化图",
    "keyPoints": "餐桌布局/备餐台/酒柜/吊灯/与厨房动线衔接/设备用电点位",
    "phase": "P3·收口",
    "role": "精装主案(公区)",
    "priority": "低",
    "sectionKey": "3-F",
    "sectionName": "公区精装（4份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "ID-06-04",
    "title": "精装-结构接口确认书（签字文件）",
    "keyPoints": "所有精装与钢结构接口部位/尺寸/材料/双方签字确认/未签=不得批量下单",
    "phase": "P2·同步",
    "role": "精装主案+钢构",
    "priority": "高",
    "sectionKey": "3-F",
    "sectionName": "公区精装（4份）",
    "packageName": "室内精装深化（钢构适配版）"
  },
  {
    "code": "MEP-01-01",
    "title": "机电管线综合平面图（各层）",
    "keyPoints": "强弱电/给排水/暖通综合排布、沿钢梁侧边/梁间空隙/碰撞检测报告",
    "phase": "P1·先行",
    "role": "机电综合设计师",
    "priority": "高",
    "sectionKey": "4-A",
    "sectionName": "管线综合（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-01-02",
    "title": "机电管线综合剖面图（典型区域）",
    "keyPoints": "梁间净空/管线叠加高度/吊顶完成面净高/关键截面走管最密集处",
    "phase": "P1·先行",
    "role": "机电综合设计师",
    "priority": "高",
    "sectionKey": "4-A",
    "sectionName": "管线综合（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-01-03",
    "title": "管线综合BIM碰撞报告及调整记录",
    "keyPoints": "全部硬碰撞点列表/软碰撞预警/调整方案/版本迭代/最终零碰撞确认",
    "phase": "P1·先行",
    "role": "机电综合设计师",
    "priority": "高",
    "sectionKey": "4-A",
    "sectionName": "管线综合（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-01-04",
    "title": "管线支架钢骨架布置图",
    "keyPoints": "沿钢梁侧挂支架/横担/抱箍/与钢梁腹板预焊件或栓接/支架间距≤1500mm",
    "phase": "P2·同步",
    "role": "机电综合设计师",
    "priority": "高",
    "sectionKey": "4-A",
    "sectionName": "管线综合（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-01-05",
    "title": "吊顶内管线综合排布详图（典型房间）",
    "keyPoints": "单间客房吊顶内所有管线走向/标高/与吊顶龙骨避让/检修空间预留",
    "phase": "P3·收口",
    "role": "机电综合设计师",
    "priority": "中",
    "sectionKey": "4-A",
    "sectionName": "管线综合（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-01-06",
    "title": "机电管井/弱电间平面布置图",
    "keyPoints": "管井位置随钢柱网/尺寸/检修门/通风/桥架进出/与建筑平面一致",
    "phase": "P2·同步",
    "role": "机电综合设计师",
    "priority": "高",
    "sectionKey": "4-A",
    "sectionName": "管线综合（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-02-01",
    "title": "穿梁套管预留汇总图",
    "keyPoints": "每根梁穿管孔位坐标/圆孔孔径=管外径+20mm套管/孔边距≥2d",
    "phase": "P1·先行",
    "role": "机电综合设计师",
    "priority": "高",
    "sectionKey": "4-B",
    "sectionName": "穿梁预留（4份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-02-02",
    "title": "穿梁孔补强节点详图",
    "keyPoints": "孔周边环形加劲肋或补强板/孔中心距梁端≥1.5h/多孔净距≥3d",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "4-B",
    "sectionName": "穿梁预留（4份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-02-03",
    "title": "穿梁孔防水封堵做法详图",
    "keyPoints": "套管与钢梁间隙密封/防火封堵/有压管与无压管区分处理",
    "phase": "P2·同步",
    "role": "防水防渗顾问",
    "priority": "中",
    "sectionKey": "4-B",
    "sectionName": "穿梁预留（4份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-02-04",
    "title": "穿梁孔位双签确认文件",
    "keyPoints": "机电方+钢构方联合签字/日期/版本号/变更记录/锁定后不可修改",
    "phase": "P1·先行",
    "role": "机电+钢构",
    "priority": "高",
    "sectionKey": "4-B",
    "sectionName": "穿梁预留（4份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-03-01",
    "title": "给水立管/干管布置图",
    "keyPoints": "立管位置随钢柱网/预制管井钢框架/支架固定于钢梁/PPR DN25~DN50",
    "phase": "P2·同步",
    "role": "给排水工程师",
    "priority": "高",
    "sectionKey": "4-C",
    "sectionName": "给排水（5份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-03-02",
    "title": "客房给排水末端点位图",
    "keyPoints": "卫浴给水点冷热/排水预留坐标/与楼承板预留孔对应/角阀/软管",
    "phase": "P2·同步",
    "role": "给排水工程师",
    "priority": "中",
    "sectionKey": "4-C",
    "sectionName": "给排水（5份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-03-03",
    "title": "热水循环系统深化图",
    "keyPoints": "回水管布置/循环泵位置/保温/与钢梁支架固定",
    "phase": "P2·同步",
    "role": "给排水工程师",
    "priority": "中",
    "sectionKey": "4-C",
    "sectionName": "给排水（5份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-03-04",
    "title": "雨水/冷凝水排放深化图",
    "keyPoints": "屋面雨水管沿钢柱外侧/空调冷凝水管/与钢承板排水组织配合",
    "phase": "P2·同步",
    "role": "给排水工程师",
    "priority": "中",
    "sectionKey": "4-C",
    "sectionName": "给排水（5份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-03-05",
    "title": "厨房/洗衣房给排水深化图",
    "keyPoints": "商业厨具进排水接口/隔油池/污水提升泵/设备基础预留给排水",
    "phase": "P2·同步",
    "role": "给排水工程师",
    "priority": "中",
    "sectionKey": "4-C",
    "sectionName": "给排水（5份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-04-01",
    "title": "风机盘管FCU钢支座深化图",
    "keyPoints": "FCU专属钢结构加固支座/预埋于钢梁/承重复核≥500N/禁挂轻质隔墙",
    "phase": "P1·先行",
    "role": "暖通工程师",
    "priority": "高",
    "sectionKey": "4-D",
    "sectionName": "暖通空调（5份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-04-02",
    "title": "新风主管道走向及穿梁图",
    "keyPoints": "新风主管沿梁侧底排布/穿梁孔位坐标/弯头避让钢柱/风速≤3m/s",
    "phase": "P2·同步",
    "role": "暖通工程师",
    "priority": "高",
    "sectionKey": "4-D",
    "sectionName": "暖通空调（5份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-04-03",
    "title": "空调冷媒/冷凝水管路图",
    "keyPoints": "VRV多联机冷媒管/分歧管位置/冷凝水提升泵/与钢梁支架固定",
    "phase": "P2·同步",
    "role": "暖通工程师",
    "priority": "中",
    "sectionKey": "4-D",
    "sectionName": "暖通空调（5份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-04-04",
    "title": "排烟/排风系统深化图",
    "keyPoints": "排烟风管/防火阀/板式排烟口/穿梁补强/与SS-04-05穿孔坐标对应",
    "phase": "P2·同步",
    "role": "暖通工程师",
    "priority": "高",
    "sectionKey": "4-D",
    "sectionName": "暖通空调（5份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-04-05",
    "title": "室外机/新风机组基础及接管图",
    "keyPoints": "屋顶空调外机钢基座/减震/接管/检修通道/与屋面防水配合",
    "phase": "P2·同步",
    "role": "暖通工程师",
    "priority": "中",
    "sectionKey": "4-D",
    "sectionName": "暖通空调（5份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-05-01",
    "title": "强电主干桥架布置图（各层）",
    "keyPoints": "强电主桥架沿钢梁侧挂/支架固定于钢梁腹板预制焊接件/转弯半径",
    "phase": "P2·同步",
    "role": "电气工程师",
    "priority": "高",
    "sectionKey": "4-E",
    "sectionName": "强电（4份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-05-02",
    "title": "配电箱/配电柜基座深化图",
    "keyPoints": "总配电柜/层配电箱钢基座/与钢梁或楼承板连接/散热空间/检修通道",
    "phase": "P2·同步",
    "role": "电气工程师",
    "priority": "高",
    "sectionKey": "4-E",
    "sectionName": "强电（4份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-05-03",
    "title": "客房配电回路及末端点位图",
    "keyPoints": "插座/开关/空调/照明回路划分/与精装面板位置绑定/钢骨架预埋底盒",
    "phase": "P3·收口",
    "role": "电气工程师",
    "priority": "中",
    "sectionKey": "4-E",
    "sectionName": "强电（4份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-05-04",
    "title": "应急照明/疏散指示布置图",
    "keyPoints": "应急灯/疏散指示/双电源切换/与钢柱位置关系/Centralized EPS",
    "phase": "P2·同步",
    "role": "电气工程师",
    "priority": "高",
    "sectionKey": "4-E",
    "sectionName": "强电（4份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-06-01",
    "title": "弱电主干桥架及预埋接线盒布置图",
    "keyPoints": "弱电主干沿钢构预设支架/客房面板接线盒预埋位绑定钢骨架位置",
    "phase": "P2·同步",
    "role": "智能化深化设计师",
    "priority": "中",
    "sectionKey": "4-F",
    "sectionName": "弱电/智能化（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-06-02",
    "title": "客房智能面板预埋位坐标图",
    "keyPoints": "床头智能面板场景窗帘灯光/开关插座盒/与精装点位一一对应",
    "phase": "P3·收口",
    "role": "智能化深化设计师",
    "priority": "低",
    "sectionKey": "4-F",
    "sectionName": "弱电/智能化（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-06-03",
    "title": "网络/电话/TV点位布置图",
    "keyPoints": "信息点RJ45/同轴电缆/弱电箱位置/路由/与钢骨架预埋",
    "phase": "P3·收口",
    "role": "智能化深化设计师",
    "priority": "低",
    "sectionKey": "4-F",
    "sectionName": "弱电/智能化（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-06-04",
    "title": "安防监控/门锁系统深化图",
    "keyPoints": "摄像头点位避开隐私区/电子门锁/读卡器/与供电管网配合",
    "phase": "P3·收口",
    "role": "智能化深化设计师",
    "priority": "低",
    "sectionKey": "4-F",
    "sectionName": "弱电/智能化（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-06-05",
    "title": "背景音乐/消防广播扬声器布置图",
    "keyPoints": "吸顶壁挂音箱功率声压级/与吊顶墙面精装配合/线路/POE供电",
    "phase": "P3·收口",
    "role": "智能化深化设计师",
    "priority": "低",
    "sectionKey": "4-F",
    "sectionName": "弱电/智能化（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "MEP-06-06",
    "title": "楼宇自控BA传感器点位图",
    "keyPoints": "温度湿度CO₂传感器/电动阀/与暖通电气联动/线管路由",
    "phase": "P2·同步",
    "role": "智能化深化设计师",
    "priority": "中",
    "sectionKey": "4-F",
    "sectionName": "弱电/智能化（6份）",
    "packageName": "机电综合深化（系统性改图）"
  },
  {
    "code": "FF-01-01",
    "title": "重型软装/大型灯具预埋件汇总图",
    "keyPoints": "所有重型陈设≥80kg承重预埋点位大堂吊灯/艺术装置/钢梁加固必须在P1前置",
    "phase": "P1·先行",
    "role": "软装深化设计师",
    "priority": "高",
    "sectionKey": "5-A",
    "sectionName": "软装预埋（3份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "FF-01-02",
    "title": "窗帘盒/轨道钢骨架预埋件图",
    "keyPoints": "重型电动窗帘轨道/遮光帘/与钢梁或吊顶龙骨预埋连接件",
    "phase": "P2·同步",
    "role": "软装深化设计师",
    "priority": "中",
    "sectionKey": "5-A",
    "sectionName": "软装预埋（3份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "FF-01-03",
    "title": "墙面装饰画/镜子挂钩预埋件图",
    "keyPoints": "重型装饰镜/大幅画作/与钢骨架墙面龙骨预埋件/荷载分级",
    "phase": "P3·收口",
    "role": "软装深化设计师",
    "priority": "低",
    "sectionKey": "5-A",
    "sectionName": "软装预埋（3份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "FF-02-01",
    "title": "商业厨房大型厨具钢基座预制详图",
    "keyPoints": "灶台/蒸柜/炸炉/冷柜落地承重钢基座/与楼承板预埋件/荷载≥4kN/m²",
    "phase": "P1·先行",
    "role": "造价算量专员",
    "priority": "高",
    "sectionKey": "5-B",
    "sectionName": "厨房/后勤（4份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "FF-02-02",
    "title": "冷库钢基座及楼板加强深化图",
    "keyPoints": "冷库荷载≥4kN/m²区域/楼承板加强配筋φ8@150双向/预制钢基座/隔热",
    "phase": "P1·先行",
    "role": "重钢深化主师",
    "priority": "高",
    "sectionKey": "5-B",
    "sectionName": "厨房/后勤（4份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "FF-02-03",
    "title": "厨房排油烟风管及净化设备深化图",
    "keyPoints": "排烟罩/风管/静电净化器/穿越楼板/防火阀/与钢梁支架固定",
    "phase": "P2·同步",
    "role": "机电综合设计师",
    "priority": "中",
    "sectionKey": "5-B",
    "sectionName": "厨房/后勤（4份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "FF-02-04",
    "title": "洗衣房/布草间设备基础及管线图",
    "keyPoints": "洗衣机/烘干机/熨烫台/给排水/排气/与楼承板配合",
    "phase": "P2·同步",
    "role": "机电综合设计师",
    "priority": "中",
    "sectionKey": "5-B",
    "sectionName": "厨房/后勤（4份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "FF-03-01",
    "title": "室外景观连廊/雨棚钢结构详图",
    "keyPoints": "全栓接轻重钢屋盖/与主体建筑连接节点/统一Q235B体系/排水/照明预埋",
    "phase": "P2·同步",
    "role": "重钢深化主师",
    "priority": "中",
    "sectionKey": "5-C",
    "sectionName": "景观/室外（4份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "FF-03-02",
    "title": "露台/阳台栏杆钢骨架栓接节点图",
    "keyPoints": "栏杆立柱与楼承板梁预埋底板栓接/玻璃不锈钢栏板固定/高度≥1100mm",
    "phase": "P3·收口",
    "role": "建筑深化设计师",
    "priority": "低",
    "sectionKey": "5-C",
    "sectionName": "景观/室外（4份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "FF-03-03",
    "title": "室外景观照明/灌溉管线图",
    "keyPoints": "草坪灯/投光灯/滴灌管/与室外钢构埋管/防水密封",
    "phase": "P3·收口",
    "role": "景观设计师",
    "priority": "低",
    "sectionKey": "5-C",
    "sectionName": "景观/室外（4份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "FF-03-04",
    "title": "室外道路/停车场/绿化与建筑收口",
    "keyPoints": "散水台阶残疾人坡道/绿化带与钢柱脚收口/排水沟",
    "phase": "P3·收口",
    "role": "景观设计师",
    "priority": "低",
    "sectionKey": "5-C",
    "sectionName": "景观/室外（4份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "IT-01-01",
    "title": "智能化弱电主干桥架支架布置图",
    "keyPoints": "弱电桥架支架预埋于钢梁/主干路由与结构对应/BIM模型索引",
    "phase": "P2·同步",
    "role": "智能化深化设计师",
    "priority": "中",
    "sectionKey": "5-D",
    "sectionName": "智能化专项（5份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "IT-01-02",
    "title": "客房智能化末端点位综合图",
    "keyPoints": "门锁温控灯控摄像头客控面板点位/全部绑定钢骨架预埋座",
    "phase": "P3·收口",
    "role": "智能化深化设计师",
    "priority": "低",
    "sectionKey": "5-D",
    "sectionName": "智能化专项（5份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "IT-01-03",
    "title": "PMS客房控制系统RCS拓扑图",
    "keyPoints": "网络架构网关控制器传感器供电需求/与弱电井位置对应",
    "phase": "P2·同步",
    "role": "智能化深化设计师",
    "priority": "中",
    "sectionKey": "5-D",
    "sectionName": "智能化专项（5份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "IT-01-04",
    "title": "无线AP信号覆盖点位布置图",
    "keyPoints": "AP点位吸顶壁挂/与吊顶墙面精装配合/POE供电/线管路由",
    "phase": "P3·收口",
    "role": "智能化深化设计师",
    "priority": "低",
    "sectionKey": "5-D",
    "sectionName": "智能化专项（5份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "IT-01-05",
    "title": "机房弱电间设备布置图",
    "keyPoints": "服务器机柜UPS精密空调配线架/与钢骨架楼板固定/静电地板",
    "phase": "P2·同步",
    "role": "智能化深化设计师",
    "priority": "中",
    "sectionKey": "5-D",
    "sectionName": "智能化专项（5份）",
    "packageName": "软装·厨房·景观·智能化专项"
  },
  {
    "code": "ENV-01-01",
    "title": "外墙ALC/一体板排版布置图",
    "keyPoints": "分格尺寸对照钢构模数600mm/板缝位置数量汇总运输包装单位损耗率≤3%",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "高",
    "sectionKey": "6-A",
    "sectionName": "外墙围护（8份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-01-02",
    "title": "ALC外墙板与钢骨架连接节点详图",
    "keyPoints": "L型/T型/U型连接件规格/螺栓间距≤600mm/ALC板打孔定位/热桥断桥处理",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "高",
    "sectionKey": "6-A",
    "sectionName": "外墙围护（8份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-01-03",
    "title": "外墙保温层及防水隔气层构造图",
    "keyPoints": "保温板岩棉50mm/XPS30mm厚度/隔汽膜内侧/防水透气膜外侧/断桥垫片",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "高",
    "sectionKey": "6-A",
    "sectionName": "外墙围护（8份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-01-04",
    "title": "门窗装配式预埋连接件深化图",
    "keyPoints": "窗框副框与钢柱预埋件/四向调节螺栓±15mm/气密水密三元乙丙胶缝",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "高",
    "sectionKey": "6-A",
    "sectionName": "外墙围护（8份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-01-05",
    "title": "外墙阴阳角收口节点详图",
    "keyPoints": "阴角阳角折边铝合金件/打胶缝宽8~15mm耐候硅酮胶/与膨胀缝对应",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "中",
    "sectionKey": "6-A",
    "sectionName": "外墙围护（8份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-01-06",
    "title": "外墙变形缝/伸缩缝节点详图",
    "keyPoints": "缝宽25mm/内外盖板/防火封堵/隔音矿棉/适应结构位移±50mm",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "高",
    "sectionKey": "6-A",
    "sectionName": "外墙围护（8份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-01-07",
    "title": "外墙装饰一体化板安装节点如有",
    "keyPoints": "保温装饰一体板干挂/挂件/与钢骨架连接/板缝处理清洗维护",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "中",
    "sectionKey": "6-A",
    "sectionName": "外墙围护（8份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-01-08",
    "title": "空调外机位设备平台围护节点",
    "keyPoints": "百叶检修门隔声排水/与主体钢骨架连接/承载力验算≥1.5倍",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "中",
    "sectionKey": "6-A",
    "sectionName": "外墙围护（8份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-02-01",
    "title": "内隔墙ALC板排版及安装节点图",
    "keyPoints": "客房分户墙/卫生间隔墙/ALC板厚100或150mm/隔声要求Rw≥50dB",
    "phase": "P2·同步",
    "role": "隔音专项设计师",
    "priority": "高",
    "sectionKey": "6-B",
    "sectionName": "内隔墙（5份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-02-02",
    "title": "ALC隔墙与钢柱钢梁连接节点",
    "keyPoints": "专用连接卡件/弹性垫层3mm/板缝嵌缝聚合物砂浆/与钢截面匹配表/抗震滑动",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "高",
    "sectionKey": "6-B",
    "sectionName": "内隔墙（5份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-02-03",
    "title": "隔声墙构造断面详图（最高标准）",
    "keyPoints": "ALC100+50mm岩棉+轻钢龙骨+双层12mm石膏板=Rw≥55dB实测目标",
    "phase": "P2·同步",
    "role": "隔音专项设计师",
    "priority": "高",
    "sectionKey": "6-B",
    "sectionName": "内隔墙（5份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-02-04",
    "title": "管道穿墙隔音密封节点",
    "keyPoints": "电线管水管风管穿透隔声墙时密封处理弹性密封膏套管防火封堵",
    "phase": "P2·同步",
    "role": "隔音专项设计师",
    "priority": "中",
    "sectionKey": "6-B",
    "sectionName": "内隔墙（5份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-02-05",
    "title": "可拆卸可更换内隔墙系统可选",
    "keyPoints": "模块化隔墙板快拆连接/办公后勤区灵活隔断/与钢骨架通用接口",
    "phase": "P3·收口",
    "role": "围护专项设计师",
    "priority": "低",
    "sectionKey": "6-B",
    "sectionName": "内隔墙（5份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-03-01",
    "title": "屋面防水保温与主梁衔接节点图",
    "keyPoints": "钢承板→30mm找坡轻集料→防水卷材两道3+4mm→XPS50保温→钢丝网→40mmC20细石混凝土",
    "phase": "P2·同步",
    "role": "防水防渗顾问",
    "priority": "高",
    "sectionKey": "6-C",
    "sectionName": "屋面（4份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-03-02",
    "title": "檐口天沟与主梁收口节点",
    "keyPoints": "成品天沟/落水管/泛水板/滴水线/与钢梁防腐层过渡/检修通道",
    "phase": "P2·同步",
    "role": "防水防渗顾问",
    "priority": "高",
    "sectionKey": "6-C",
    "sectionName": "屋面（4份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-03-03",
    "title": "屋面出风口设备基础防水节点",
    "keyPoints": "风机冷却塔基础/防水上翻/设备震动隔离/与钢承板连接",
    "phase": "P2·同步",
    "role": "防水防渗顾问",
    "priority": "中",
    "sectionKey": "6-C",
    "sectionName": "屋面（4份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-03-04",
    "title": "屋面变形缝防水节点",
    "keyPoints": "等高不等高变形缝/防水卷材附加层/金属盖板/适应位移",
    "phase": "P2·同步",
    "role": "防水防渗顾问",
    "priority": "高",
    "sectionKey": "6-C",
    "sectionName": "屋面（4份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-04-01",
    "title": "建筑热工计算书及保温厚度验证",
    "keyPoints": "U值计算墙体屋面地面窗户/满足节能标准/冷热桥分布分析红外检测计划",
    "phase": "P2·同步",
    "role": "节能顾问",
    "priority": "高",
    "sectionKey": "6-D",
    "sectionName": "热工气密性（3份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-04-02",
    "title": "气密层连续性设计图（气密线）",
    "keyPoints": "气密膜胶带密封膏连续路径断点补救/与机电穿透处配合/压力测试500Pa方案",
    "phase": "P2·同步",
    "role": "围护专项设计师",
    "priority": "中",
    "sectionKey": "6-D",
    "sectionName": "热工气密性（3份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "ENV-04-03",
    "title": "热桥thermal bridge分布及处理详图",
    "keyPoints": "钢柱钢梁连接件阳台挑檐等热桥位置/断桥垫片15mm/外保温全面包覆",
    "phase": "P2·同步",
    "role": "节能顾问",
    "priority": "高",
    "sectionKey": "6-D",
    "sectionName": "热工气密性（3份）",
    "packageName": "装配式围护结构专项深化"
  },
  {
    "code": "FP-01-01",
    "title": "钢构防火包覆分区及做法总图",
    "keyPoints": "超薄型薄型厚型防火涂料分区示意耐火极限验算与精装面层关系",
    "phase": "P2·同步",
    "role": "消防验算顾问",
    "priority": "高",
    "sectionKey": "7-A",
    "sectionName": "钢构防火（4份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-01-02",
    "title": "超薄薄型钢结构防火涂料施工节点",
    "keyPoints": "底涂中间层面涂层道数/膜厚要求环境条件≥5℃RH≤85%/检测取样点每100㎡一处",
    "phase": "P2·同步",
    "role": "消防验算顾问",
    "priority": "高",
    "sectionKey": "7-A",
    "sectionName": "钢构防火（4份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-01-03",
    "title": "防火板包覆节点详图柱梁",
    "keyPoints": "防火板分层包裹龙骨固定方式钢骨架栓接/接缝防火密封/与饰面过渡",
    "phase": "P2·同步",
    "role": "消防验算顾问",
    "priority": "高",
    "sectionKey": "7-A",
    "sectionName": "钢构防火（4份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-01-04",
    "title": "防火涂料防火板与精装收口节点",
    "keyPoints": "涂料粗糙面打磨/防火板表面封板/与木饰面石膏板金属板交接处理",
    "phase": "P2·同步",
    "role": "消防验算顾问",
    "priority": "高",
    "sectionKey": "7-A",
    "sectionName": "钢构防火（4份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-02-01",
    "title": "消防喷淋与钢梁空间避让图",
    "keyPoints": "喷头布置K80/保护半径/钢梁下翼缘遮挡范围/偏置喷头/上下喷选择",
    "phase": "P2·同步",
    "role": "机电综合设计师",
    "priority": "高",
    "sectionKey": "7-B",
    "sectionName": "消防水报警（5份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-02-02",
    "title": "消火栓系统深化图",
    "keyPoints": "消火栓箱嵌入明装/与钢柱避让/立管沿钢柱/减压稳压",
    "phase": "P2·同步",
    "role": "机电综合设计师",
    "priority": "高",
    "sectionKey": "7-B",
    "sectionName": "消防水报警（5份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-02-03",
    "title": "火灾自动报警探测器布置图",
    "keyPoints": "感烟感温探测器/与钢梁下净高避免正下方气流死区/手报位置",
    "phase": "P2·同步",
    "role": "消防验算顾问",
    "priority": "高",
    "sectionKey": "7-B",
    "sectionName": "消防水报警（5份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-02-04",
    "title": "应急广播警铃布置图",
    "keyPoints": "扬声器功率声压级/与装修风格配合/与钢骨架预埋",
    "phase": "P2·同步",
    "role": "智能化深化设计师",
    "priority": "中",
    "sectionKey": "7-B",
    "sectionName": "消防水报警（5份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-02-05",
    "title": "消防控制室设备布置图",
    "keyPoints": "联动控制盘图形显示装置电源/与弱电机房合并/钢骨架基座",
    "phase": "P2·同步",
    "role": "消防验算顾问",
    "priority": "中",
    "sectionKey": "7-B",
    "sectionName": "消防水报警（5份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-03-01",
    "title": "防火分区平面划分图",
    "keyPoints": "分区面积≤2500㎡自喷加倍/防火墙位置/与钢柱网关系/甲级乙级防火门",
    "phase": "P2·同步",
    "role": "消防验算顾问",
    "priority": "高",
    "sectionKey": "7-C",
    "sectionName": "防火分区排烟（5份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-03-02",
    "title": "防火分区围护与钢骨架节点图",
    "keyPoints": "防火隔墙耐火≥2h/与钢梁柱缝隙防火封堵矿棉+防火板/伸缩缝处理",
    "phase": "P2·同步",
    "role": "消防验算顾问",
    "priority": "高",
    "sectionKey": "7-C",
    "sectionName": "防火分区排烟（5份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-03-03",
    "title": "排烟风管穿梁节点及防火阀深化",
    "keyPoints": "排烟风管穿梁圆孔补强SS-04-05对应/280℃防火阀/支座预埋",
    "phase": "P2·同步",
    "role": "机电综合设计师",
    "priority": "高",
    "sectionKey": "7-C",
    "sectionName": "防火分区排烟（5份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-03-04",
    "title": "自然排烟窗排烟口布置图",
    "keyPoints": "可开启外窗面积/排烟口尺寸/与钢框架配合手动联动/与幕墙统一",
    "phase": "P2·同步",
    "role": "消防验算顾问",
    "priority": "高",
    "sectionKey": "7-C",
    "sectionName": "防火分区排烟（5份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "FP-03-05",
    "title": "疏散楼梯前室正压送风系统图",
    "keyPoints": "送风口/风管/与钢构支架固定/压差传感器泄压阀",
    "phase": "P2·同步",
    "role": "暖通工程师",
    "priority": "中",
    "sectionKey": "7-C",
    "sectionName": "防火分区排烟（5份）",
    "packageName": "消防专项深化"
  },
  {
    "code": "CON-01-01",
    "title": "钢构件吊装顺序总图",
    "keyPoints": "柱→主梁→次梁→支撑方向控制先内后外先下后上每步稳定性验算",
    "phase": "P2·同步",
    "role": "现场钢构代表",
    "priority": "高",
    "sectionKey": "8-A",
    "sectionName": "钢构安装工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-01-02",
    "title": "楼层调平标高校准工艺图",
    "keyPoints": "调平螺栓操作步骤/柱顶水准仪测点/层间累积误差控制≤±5mm/复测频率每层",
    "phase": "P2·同步",
    "role": "现场钢构代表",
    "priority": "高",
    "sectionKey": "8-A",
    "sectionName": "钢构安装工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-01-03",
    "title": "高强螺栓紧固顺序及工艺图",
    "keyPoints": "初拧50%→终拧100%从中间向两端扩散扭矩扳手补拧标记检验比例10%",
    "phase": "P2·同步",
    "role": "栓接工艺顾问",
    "priority": "高",
    "sectionKey": "8-A",
    "sectionName": "钢构安装工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-01-04",
    "title": "模块拼接缝防渗隔声填充节点图",
    "keyPoints": "对接缝→防水密封胶PU→矿棉填充48kg/m³→背衬板→内饰收口工序不可逆",
    "phase": "P2·同步",
    "role": "防水防渗顾问",
    "priority": "高",
    "sectionKey": "8-A",
    "sectionName": "钢构安装工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-01-05",
    "title": "模块对位导向与固定工艺图",
    "keyPoints": "临时固定夹具导向销φ20×150正式螺栓安装前偏差核查程序三向调节",
    "phase": "P2·同步",
    "role": "现场钢构代表",
    "priority": "中",
    "sectionKey": "8-A",
    "sectionName": "钢构安装工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-01-06",
    "title": "安装精度检测及验收标准图",
    "keyPoints": "垂直度平整度标高对位偏差允许值/检测工具/三方甲方监理厂方验收签字",
    "phase": "P2·同步",
    "role": "现场钢构代表",
    "priority": "高",
    "sectionKey": "8-A",
    "sectionName": "钢构安装工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-02-01",
    "title": "现场干湿作业分区规划图",
    "keyPoints": "灌浆打胶防水湿作业区与干作业区隔离/交叉作业时间规划防护措施",
    "phase": "P2·同步",
    "role": "现场精装代表",
    "priority": "中",
    "sectionKey": "8-B",
    "sectionName": "围护精装施工工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-02-02",
    "title": "装配式墙板ALC安装顺序工艺图",
    "keyPoints": "ALC板安装先后顺序先外墙后内隔/与钢梁楼板施工面界面错缝搭接≥200mm",
    "phase": "P2·同步",
    "role": "现场精装代表",
    "priority": "中",
    "sectionKey": "8-B",
    "sectionName": "围护精装施工工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-02-03",
    "title": "楼承板上混凝土浇筑工艺图",
    "keyPoints": "浇筑顺序从低到高/振捣养护施工缝与钢梁剪力钉协同防止漏浆",
    "phase": "P2·同步",
    "role": "现场钢构代表",
    "priority": "中",
    "sectionKey": "8-B",
    "sectionName": "围护精装施工工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-02-04",
    "title": "防火涂料防火板施工工艺图",
    "keyPoints": "表面除锈Sa2.5/喷涂遍数/厚度检测环境记录/与精装穿插时间窗口",
    "phase": "P2·同步",
    "role": "消防顾问",
    "priority": "高",
    "sectionKey": "8-B",
    "sectionName": "围护精装施工工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-02-05",
    "title": "精装干法施工流程图钢构版",
    "keyPoints": "预埋验收→骨架→基层→面层纯干法流程每步检查点与传统湿法差异",
    "phase": "P3·收口",
    "role": "现场精装代表",
    "priority": "中",
    "sectionKey": "8-B",
    "sectionName": "围护精装施工工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-02-06",
    "title": "样板间试装及验收流程图",
    "keyPoints": "3间样板间标准端头转角问题清单修正方案批量施工放行闸门",
    "phase": "P3·收口",
    "role": "现场精装代表",
    "priority": "高",
    "sectionKey": "8-B",
    "sectionName": "围护精装施工工艺（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-03-01",
    "title": "构件物料进场核对清单及流程",
    "keyPoints": "钢构件预制墙板预埋配件编号核对外观尺寸资料堆放分区不合格退场",
    "phase": "P2·同步",
    "role": "物料统筹人员",
    "priority": "中",
    "sectionKey": "8-C",
    "sectionName": "物料质量安全（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-03-02",
    "title": "关键工序质量控制点QC清单",
    "keyPoints": "栓接紧固焊接仅工厂防水闭水防火涂层厚度隔声测试每项责任人",
    "phase": "P2·同步",
    "role": "质检专员",
    "priority": "高",
    "sectionKey": "8-C",
    "sectionName": "物料质量安全（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-03-03",
    "title": "现场安全文明施工策划图",
    "keyPoints": "高空作业起重安全临时用电消防个人防护与钢构安装同步安全措施",
    "phase": "P2·同步",
    "role": "安全员",
    "priority": "高",
    "sectionKey": "8-C",
    "sectionName": "物料质量安全（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-03-04",
    "title": "季节性施工措施雨季高温冬季",
    "keyPoints": "雨季防锈/高温螺栓紧固扭矩修正/冬季灌浆防冻≥5℃/工期调整预案",
    "phase": "P2·同步",
    "role": "现场钢构代表",
    "priority": "中",
    "sectionKey": "8-C",
    "sectionName": "物料质量安全（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-03-05",
    "title": "成品保护措施详图",
    "keyPoints": "钢构件防腐层ALC板门窗精装面层分阶段保护方案责任分工",
    "phase": "P3·收口",
    "role": "现场精装代表",
    "priority": "中",
    "sectionKey": "8-C",
    "sectionName": "物料质量安全（6份）",
    "packageName": "现场装配施工工艺深化"
  },
  {
    "code": "CON-03-06",
    "title": "竣工验收资料清单模板",
    "keyPoints": "竣工图检验批隐蔽验收材料合格证功能性检测报告备案要求",
    "phase": "P3·收口",
    "role": "资料员",
    "priority": "低",
    "sectionKey": "8-C",
    "sectionName": "物料质量安全（6份）",
    "packageName": "现场装配施工工艺深化"
  }
];

export function getHeavySteelHotelPackagesForModule(moduleId: ModuleId): HeavySteelHotelDrawingPackage[] {
  return heavySteelHotelDrawingPackages.filter((item) => item.moduleIds.includes(moduleId));
}

export function getHeavySteelHotelSheetsForModule(moduleId: ModuleId): HeavySteelHotelDrawingSheet[] {
  const packageNames = new Set(getHeavySteelHotelPackagesForModule(moduleId).map((item) => item.name));
  return heavySteelHotelDrawingSheets.filter((sheet) => packageNames.has(sheet.packageName));
}

export function getHeavySteelHotelPrioritySheets(priority: string): HeavySteelHotelDrawingSheet[] {
  return heavySteelHotelDrawingSheets.filter((sheet) => sheet.priority === priority);
}
