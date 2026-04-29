// app/page.tsx — ArchIToken business-chain showcase
// React Server Component · Next.js 16.2.4
// License: Apache-2.0

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Building2,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronRight,
  CloudCog,
  Cpu,
  DatabaseZap,
  FileArchive,
  FileCheck2,
  FileText,
  GanttChartSquare,
  GitBranch,
  GitPullRequest,
  Globe2,
  HardHat,
  Layers3,
  LibraryBig,
  LockKeyhole,
  Network,
  Orbit,
  PackageCheck,
  PanelLeft,
  Radar,
  Route,
  Scale,
  SearchCheck,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Workflow,
} from 'lucide-react';
import { ArchITokenScene } from '@/components/ArchITokenScene';

const businessChain = [
  {
    step: '01',
    title: '方案设计',
    modules: ['需求到草图', '文本/图片生成', '体块推演', '投资约束'],
    output: 'Concept Token · 可编辑方案模型',
    metric: '从一句需求进入工程链',
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    step: '02',
    title: '深化设计',
    modules: ['结构/机电/幕墙', 'IFC/IDS', '碰撞检查', '出图审签'],
    output: 'Design Token · 几何属性审签链',
    metric: '图纸、模型、规范同源',
    icon: <Layers3 className="h-5 w-5" />,
  },
  {
    step: '03',
    title: '材料管理',
    modules: ['材料库', '供应商', '批次追踪', '合规证书'],
    output: 'Material Token · 材料证据包',
    metric: '从选材到到场可追溯',
    icon: <Boxes className="h-5 w-5" />,
  },
  {
    step: '04',
    title: '计量造价',
    modules: ['模型算量', '清单编码', '价格库', '变更估算'],
    output: 'BOQ Token · 成本与清单基线',
    metric: '工程量、单价、变更同链',
    icon: <Calculator className="h-5 w-5" />,
  },
  {
    step: '05',
    title: '生产制造',
    modules: ['BOM', 'CNC/加工单', '排产', '质检'],
    output: 'Manufacturing Token · 构件制造档案',
    metric: '设计意图进入工厂',
    icon: <PackageCheck className="h-5 w-5" />,
  },
  {
    step: '06',
    title: '物流运输',
    modules: ['装箱', '运输计划', '到场验收', '二维码/RFID'],
    output: 'Logistics Token · 运输与签收链',
    metric: '构件状态跨组织同步',
    icon: <Route className="h-5 w-5" />,
  },
  {
    step: '07',
    title: '施工管理',
    modules: ['进度', '质量', '安全', 'AR', '点云', '360全景影像', '倾斜摄影'],
    output: 'Evidence Token · 现场事实账本',
    metric: '进度质量安全有影像证据',
    icon: <HardHat className="h-5 w-5" />,
  },
  {
    step: '08',
    title: '数据档案',
    modules: ['合同管理', '标准族库', '图纸模型', '企业文宣', '审计留痕'],
    output: 'Archive Token · 交付与宣传素材库',
    metric: '合同、族库、图模不散落',
    icon: <FileArchive className="h-5 w-5" />,
  },
  {
    step: '09',
    title: '数字孪生',
    modules: ['WebGPU', 'Pascal Editor', 'Gaussian Splatting', 'IoT', '运维工单'],
    output: 'Twin Token · 可编辑孪生场景',
    metric: '点云、3DGS、BIM 融合',
    icon: <Orbit className="h-5 w-5" />,
  },
  {
    step: '10',
    title: '财务人力',
    modules: ['预算/付款', '成本归集', '人员排班', '绩效'],
    output: 'Enterprise Token · 成本与组织视图',
    metric: '工程履约连接经营数据',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    step: '11',
    title: '设置中心',
    modules: ['组织/角色', '权限/RLS', '模型路由', '合规策略'],
    output: 'Governance Token · 安全治理面',
    metric: '租户、权限、模型统一配置',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

const aiHarness = [
  ['OpenClaw', '项目级行动规划与工具编排'],
  ['Hermes Agent', '长期任务、记忆与执行轨迹'],
  ['MCP', '把文件、模型、数据库和工具接入智能体'],
  ['LangGraph', 'Planner → Generator → Evaluator 三角色图'],
  ['Langfuse', 'Trace、评测、提示词版本与成本观测'],
  ['Hugging Face', '模型、数据集、评测与私有推理资产'],
];

const githubReferences = [
  {
    repo: 'pascalorg/editor',
    focus: 'WebGPU / R3F 建筑编辑器',
    takeaways: ['Site > Building > Level 层级', '墙/板/房间可编辑节点', 'WebGPU Viewer', '选择、楼层和构件状态管理'],
    note: '数字孪生工作台优先参考 Pascal Editor 的可编辑建筑数据结构,不只做静态浏览器。',
  },
  {
    repo: 'PlayCanvas SuperSplat',
    focus: 'Gaussian Splatting 编辑器',
    takeaways: ['3DGS 裁剪与压缩', 'WebGPU 渲染路径', '大规模点云替代', '浏览器级实时预览'],
    note: '点云、倾斜摄影和视频重建优先落到 3DGS / SPZ / PLY 管线,再与 BIM 对齐。',
  },
  {
    repo: 'Scthe/gaussian-splatting-webgpu',
    focus: 'WebGPU 3DGS Renderer',
    takeaways: ['WGSL 渲染', 'PLY Splat 加载', '点云显示模式', 'WebGPU-first 架构'],
    note: '用于验证 ArchIToken 在浏览器中承载高斯泼溅和点云的性能边界。',
  },
  {
    repo: 'xeokit/xeokit-bim-viewer',
    focus: 'BIM/IFC/点云浏览器',
    takeaways: ['对象树与楼层树', '2D/3D 模式切换', 'X-ray / highlight / section', 'BCF viewpoint'],
    note: '适合吸收为 ArchIToken 模型审查工作台的对象级交互语言。',
  },
  {
    repo: 'opensourceBIM/BIMsurfer',
    focus: 'WebGL IFC Viewer',
    takeaways: ['WebGL2 高性能', '3D Tiles 支持', '测量与剖切', 'IFC 模型查看'],
    note: '提醒我们把视图工具做成工程师熟悉的测量、剖切、可见性控制。',
  },
];

const standardsMatrix = [
  {
    group: 'PMP / PMBOK',
    anchor: '价值交付、治理、范围、进度、财务、资源、风险',
    implementation: '项目令牌绑定 WBS、里程碑、预算、风险登记册和采购/合同事件。',
  },
  {
    group: 'IPMP / IPMA ICB4',
    anchor: 'People / Practice / Perspective 三类能力',
    implementation: '把人员、流程、组织目标和项目绩效放进同一张能力热力图。',
  },
  {
    group: 'ISO 19650 / openBIM',
    anchor: 'OIR / PIR / AIR / EIR、BEP、MIDP、TIDP、CDE',
    implementation: 'CDE 文件区按信息需求、审批状态、责任方和交付节点组织,IFC / IDS / BCF 做开放交换。',
  },
  {
    group: '中国',
    anchor: 'GB/T 50326、GB/T 51212、GB 550xx、等保 2.0、PIPL / DSL / CSL',
    implementation: '规范条款库分强制条文、推荐条文、地方规程、企业工法和数据安全策略。',
  },
  {
    group: '美国',
    anchor: 'IBC / NFPA / OSHA、AIA Digital Practice、CSI MasterFormat / OmniClass',
    implementation: '美国项目按消防生命安全、职业安全、合同交付、清单分类和设施资产编码映射。',
  },
  {
    group: '欧洲',
    anchor: 'Eurocodes、EN 标准、GDPR、EU AI Act、CEN/TC 442 BIM',
    implementation: '欧盟项目把结构设计、个人数据、AI 风险等级、CDE 和 BIM 交付状态纳入审查。',
  },
  {
    group: '澳洲 / 新西兰',
    anchor: 'NCC / BCA、AS/NZS 标准、WHS、Privacy Act、ISO 19650 AU adoption',
    implementation: '澳洲项目按国家施工规范、职业健康安全、隐私和资产交付要求配置项目模板。',
  },
  {
    group: '国际安全与审计',
    anchor: 'ISO 27001、SOC 2、SBOM、SLSA、NIST AI RMF',
    implementation: '租户隔离、最小权限、审计留痕、模型调用白名单、供应链签名和 AI 风险记录。',
  },
];

const deliveryArtifacts = [
  ['OIR', '组织信息需求', '资产管理、投资决策、运营目标'],
  ['PIR', '项目信息需求', '立项、招标、设计、施工、竣工决策'],
  ['AIR', '资产信息需求', '设备、空间、构件、维保、能耗属性'],
  ['EIR', '交换信息需求', '谁在何时交付什么模型、文件和数据'],
  ['BEP', 'BIM 执行计划', '建模标准、协同方式、职责与交付策略'],
  ['MIDP/TIDP', '信息交付计划', '主计划与任务级交付责任拆解'],
];

const qualityGates = [
  {
    title: '产品架构审查',
    body: '模块边界、权限模型、数据主线、故障隔离和可观测性必须在 RFC / ADR 中闭环。',
    icon: <ServerCog className="h-5 w-5" />,
  },
  {
    title: 'UI 体验审查',
    body: '参考 Google / Microsoft / Meta 的可用性检查: 信息密度、键盘可达、响应式、空态、错误态。',
    icon: <SearchCheck className="h-5 w-5" />,
  },
  {
    title: '安全与合规门禁',
    body: 'CodeQL、Semgrep、依赖许可证、密钥扫描、RLS 策略和审计事件进入 PR 必查项。',
    icon: <LockKeyhole className="h-5 w-5" />,
  },
  {
    title: '测试金字塔',
    body: '单元、契约、组件、Playwright E2E、视觉回归和 3D canvas 像素检查分层执行。',
    icon: <TestTube2 className="h-5 w-5" />,
  },
  {
    title: 'CI / CD / CT',
    body: 'PR 预检、main 保护、制品签名、SBOM、环境晋级、回滚演练和持续评测一条流水线。',
    icon: <GitPullRequest className="h-5 w-5" />,
  },
  {
    title: 'AI 评测闭环',
    body: 'Langfuse trace、提示词版本、离线评测集、红队样例和人审反馈持续进入模型路由。',
    icon: <Radar className="h-5 w-5" />,
  },
];

const cockpitRows = [
  ['方案体块模型', '文本生成模型', '可编辑节点 128', 'T+8m'],
  ['深化 IFC 模型', 'IDS/BCF 审查', '构件 2,418', '通过'],
  ['施工影像批次', '视频生成 3DGS', '证据 86 条', '训练中'],
  ['材料物流包', 'BOM/BOQ 联动', '批次 34 个', '到场'],
];

const moduleMap = [
  ['方案设计', '需求解析', '文本/图片生成', '体块模型', '方案比选'],
  ['深化设计', '图纸模型', 'IFC/IDS', '碰撞检查', '审签变更'],
  ['材料造价', '材料管理', '供应商', '计量造价', '价格库'],
  ['制造物流', '生产制造', 'BOM/CNC', '物流运输', '到场验收'],
  ['施工管理', '进度', '质量', '安全', 'AR', '点云', '360全景', '倾斜摄影'],
  ['数据档案', '合同管理', '标准族库', '图纸模型', '企业文宣'],
  ['数字孪生', 'WebGPU', 'Pascal Editor', 'Gaussian Splatting', 'IoT'],
  ['经营治理', '财务人力', '设置中心', '权限审计', '模型路由'],
];

const stack = [
  'Next.js',
  'React',
  'Three.js',
  'WebGPU',
  'Pascal Editor',
  'Gaussian Splatting',
  '3D Tiles',
  'IFC / IDS / BCF',
  'Rust',
  'cxx / C++',
  'Supabase',
  'K8s',
  'LangChain',
  'LangGraph',
  'Langfuse',
  'MCP',
  'OpenClaw',
  'Hermes Agent',
];

const regulatoryChecks = [
  ['方案与深化', '需求、体量、图纸、IFC 构件、IDS 规则、BCF 问题和审签责任'],
  ['材料与造价', '材料证书、供应商资质、清单编码、价格来源、变更估算和合同边界'],
  ['生产与物流', 'BOM、加工单、批次、装箱、运输计划、到场验收和追溯二维码'],
  ['施工与验评', '进度、质量、安全、AR 验评、点云、360 全景、倾斜摄影和整改闭环'],
  ['档案与孪生', '竣工模型、资产编码、WebGPU 场景、3DGS 点云、IoT 状态和运维工单'],
  ['财务与组织', '付款节点、成本归集、人员排班、绩效、权限、审计和数据留存'],
];

const generationPipelines = [
  ['文本生成图片', '需求书 / 风格 / 材料约束', '方案图、效果图、节点示意'],
  ['文本生成视频', '施工工法 / 运维脚本 / 展示叙事', '漫游视频、施工动画、宣发短片'],
  ['文本生成模型', '空间需求 / 规范参数 / 构件规则', '可编辑体块、参数化构件、IFC 草模'],
  ['图片生成视频', '效果图 / 现场照片 / 宣传图', '视角运动、工艺演示、交付汇报'],
  ['图纸生成模型', 'CAD / PDF 图纸 / 图框表格', '墙板柱梁、门窗洞口、房间和楼层结构'],
  ['图片生成模型', '现场照片 / 材料图 / 构件图', 'Mesh、Splat、构件候选和属性建议'],
  ['PDF生成模型', '规范、合同、清单、图纸合集', '条款库、清单项、构件属性和审查规则'],
  ['视频生成模型', '巡检视频 / 360 影像 / 无人机视频', 'SfM/SLAM、3DGS、点云、语义热点'],
  ['模型导出清单', 'IFC / glTF / USD / 3D Tiles / CSV', 'BOQ、BOM、BCF、IDS 结果和审计包'],
];

const modelIntegrityRules = [
  ['几何完整', '轴网、楼层、构件、洞口、空间边界、坐标系和单位必须可校验。'],
  ['属性完整', '构件编码、材料、防火、供应商、价格、施工状态和资产属性必须可追溯。'],
  ['证据完整', '原始文本、图片、PDF、视频、点云、AI trace、人工审查意见都进入证据链。'],
  ['可编辑调整', '生成结果必须回写为节点、参数、约束和版本,允许设计师继续移动、拉伸、替换、拆分和合并。'],
  ['导出一致', 'IFC / glTF / USD / 3D Tiles / BOQ / BOM / BCF 导出前做几何、属性、数量和权限一致性检查。'],
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f7f1] text-[#111817]">
      <section className="relative min-h-[88vh] border-b border-[#111817]/10">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,24,23,0.07)_1px,transparent_1px),linear-gradient(180deg,rgba(17,24,23,0.07)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#f5f7f1] to-transparent" />
        <ArchITokenScene />

        <div className="container relative mx-auto grid min-h-[88vh] items-center gap-10 px-6 py-16 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-3xl pt-10">
            <div className="mb-5 inline-flex items-center gap-2 border border-[#111817]/15 bg-[#f5f7f1]/85 px-3 py-1 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-[#18a058]" />
              ArchIToken · AEC AI Business Chain
            </div>

            <h1 className="font-serif text-5xl font-black leading-[1.02] md:text-7xl">
              ArchIToken
              <span className="mt-3 block text-3xl font-black text-[#1f6d7a] md:text-5xl">
                把建筑全链条变成可追踪的智能资产流
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#263432] md:text-xl">
              从方案设计、深化设计、材料、造价、制造、物流、施工到档案、数字孪生、财务人力和设置中心,
              每个工程对象都有自己的 Token 身份、几何属性、证据链和 AI Harness 执行轨迹。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/app/projects"
                className="inline-flex items-center gap-2 bg-[#111817] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#18a058]"
              >
                进入项目控制台
                <ChevronRight className="h-4 w-4" />
              </Link>
              <a
                href="#business-chain"
                className="inline-flex items-center gap-2 border border-[#111817] px-5 py-3 text-sm font-semibold transition-colors hover:bg-white"
              >
                查看业务链条
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-9 grid max-w-2xl grid-cols-3 border-y border-[#111817]/15 py-5 text-sm">
              <Stat value="11" label="生命期站点" />
              <Stat value="9" label="生成流水线" />
              <Stat value="4+" label="法规区域" />
            </div>
          </div>

          <Cockpit />
        </div>
      </section>

      <section id="business-chain" className="container mx-auto px-6 py-18 md:py-24">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-sm font-bold text-[#1f6d7a]">业务功能链条</p>
            <h2 className="font-serif text-4xl font-black md:text-6xl">一条链跑完整个工程生命期</h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-[#4b5a56]">
            不再把功能揉成几组,而是按工程对象真实流转做 11 个独立站点。
            每站都产出可校验 Token,下一站只接收通过审查的数据。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {businessChain.map((item, index) => (
            <ChainStep key={item.step} item={item} isLast={index === businessChain.length - 1} />
          ))}
        </div>
      </section>

      <section className="border-y border-[#111817]/10 bg-[#111817] text-white">
        <div className="container mx-auto px-6 py-18 md:py-24">
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="mb-3 text-sm font-bold text-[#74d99f]">多模态生成到可编辑工程模型</p>
              <h2 className="font-serif text-4xl font-black md:text-5xl">
                生成不是终点,可编辑、可审查、可导出才是交付
              </h2>
            </div>
            <p className="text-base leading-7 text-white/70">
              文本、图片、PDF、视频和图纸都先进入解析、生成、校核、人工调整四段流水线。
              输出必须带几何、属性、来源证据和版本差异,并能继续在 WebGPU 编辑器中调整。
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {generationPipelines.map(([name, input, output], index) => (
                <div key={name} className="border border-white/14 bg-white/[0.04] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-serif text-3xl font-black text-[#74d99f]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <Workflow className="h-5 w-5 text-[#f07836]" />
                  </div>
                  <h3 className="font-serif text-xl font-bold">{name}</h3>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                    Input
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/68">{input}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                    Output
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#74d99f]">{output}</p>
                </div>
              ))}
            </div>

            <div className="border border-[#74d99f]/30 bg-[#0b1311] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#74d99f]">Model Integrity Gate</p>
                  <h3 className="mt-2 font-serif text-3xl font-black">几何、属性、证据和编辑权必须同时完整</h3>
                </div>
                <FileCheck2 className="h-8 w-8 text-[#f07836]" />
              </div>
              <div className="space-y-3">
                {modelIntegrityRules.map(([name, body]) => (
                  <div key={name} className="border border-white/12 bg-white/[0.05] p-4">
                    <h4 className="font-serif text-xl font-bold">{name}</h4>
                    <p className="mt-2 text-sm leading-6 text-white/68">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#111817]/10 bg-white">
        <div className="container mx-auto px-6 py-18 md:py-24">
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mb-3 text-sm font-bold text-[#1f6d7a]">WebGPU 数字孪生参考</p>
              <h2 className="font-serif text-4xl font-black md:text-5xl">
                Pascal Editor 优先,3DGS 解决点云与影像重建
              </h2>
            </div>
            <p className="text-base leading-7 text-[#4b5a56]">
              数字孪生层先按 WebGPU-first 方向设计: Pascal Editor 负责可编辑建筑节点,
              Gaussian Splatting 负责点云、360 影像、倾斜摄影和视频重建的高保真表达,
              BIM/IFC Viewer 负责工程语义和审查工作流。
            </p>
            <Link
              href="/app/digital-twin"
              className="mt-5 inline-flex items-center gap-2 bg-[#111817] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#18a058]"
            >
              打开数字孪生工作台
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {githubReferences.map((item) => (
              <div key={item.repo} className="border border-[#111817]/12 bg-[#f5f7f1] p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center bg-[#111817] text-white">
                  <Globe2 className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl font-bold">{item.repo}</h3>
                <p className="mt-2 text-sm font-semibold text-[#1f6d7a]">{item.focus}</p>
                <div className="mt-4 space-y-2">
                  {item.takeaways.map((takeaway) => (
                    <div key={takeaway} className="flex items-start gap-2 text-sm text-[#35423f]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#18a058]" />
                      {takeaway}
                    </div>
                  ))}
                </div>
                <p className="mt-4 border-t border-[#111817]/10 pt-4 text-xs leading-5 text-[#5b6965]">
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 py-18 md:py-24">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-sm font-bold text-[#c85b28]">标准化管理理念</p>
            <h2 className="font-serif text-4xl font-black md:text-5xl">
              PMP、IPMP、openBIM 与中美欧澳规范一起进入产品结构
            </h2>
          </div>
          <div className="max-w-md border border-[#111817]/12 bg-white p-5">
            <div className="mb-3 flex items-center gap-2 font-serif text-xl font-bold">
              <BookOpenCheck className="h-5 w-5 text-[#18a058]" />
              标准不是说明书,是数据结构
            </div>
            <p className="text-sm leading-6 text-[#4b5a56]">
              每个模块都要知道自己产出什么交付物、接受什么审查、进入哪个审批状态、关联哪个国家或区域的法规和证据。
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {standardsMatrix.map((standard) => (
            <div key={standard.group} className="border border-[#111817]/12 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,23,0.05)]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-serif text-2xl font-bold">{standard.group}</h3>
                <Scale className="h-5 w-5 text-[#c85b28]" />
              </div>
              <p className="text-sm font-semibold leading-6 text-[#1f6d7a]">{standard.anchor}</p>
              <p className="mt-4 text-sm leading-6 text-[#4b5a56]">{standard.implementation}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border border-[#111817]/12 bg-[#111817] p-6 text-white">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-serif text-3xl font-black">ISO 19650 信息交付包</h3>
              <LibraryBig className="h-7 w-7 text-[#74d99f]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {deliveryArtifacts.map(([code, name, body]) => (
                <div key={code} className="border border-white/12 bg-white/[0.05] p-4">
                  <p className="text-xs font-bold text-[#74d99f]">{code}</p>
                  <h4 className="mt-1 font-serif text-xl font-bold">{name}</h4>
                  <p className="mt-2 text-xs leading-5 text-white/65">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[#111817]/12 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-serif text-3xl font-black">法规规范检查链</h3>
              <ShieldCheck className="h-7 w-7 text-[#18a058]" />
            </div>
            <div className="space-y-3">
              {regulatoryChecks.map(([stage, checks]) => (
                <div key={stage} className="grid gap-3 border border-[#111817]/10 bg-[#f5f7f1] p-4 md:grid-cols-[140px_1fr]">
                  <p className="font-serif text-lg font-bold">{stage}</p>
                  <p className="text-sm leading-6 text-[#4b5a56]">{checks}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#111817]/10 bg-[#111817] text-white">
        <div className="container mx-auto grid gap-10 px-6 py-18 md:py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="mb-3 text-sm font-bold text-[#74d99f]">AI Harness</p>
            <h2 className="font-serif text-4xl font-black md:text-5xl">
              AI 不直接出门,先过规划、生成、评估三道闸
            </h2>
            <p className="mt-6 text-base leading-7 text-white/72">
              ArchIToken 的智能体不是聊天窗口,而是围绕工程数据工作的执行系统。模型可以替换,
              Harness 负责权限、工具、记忆、追踪、回滚和审计。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {aiHarness.map(([name, body]) => (
              <div key={name} className="border border-white/14 bg-white/[0.04] p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center bg-[#74d99f] text-[#111817]">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl font-bold">{name}</h3>
                <p className="mt-2 text-sm leading-6 text-white/68">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#111817]/10 bg-[#f5f7f1]">
        <div className="container mx-auto px-6 py-18 md:py-24">
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="mb-3 text-sm font-bold text-[#1f6d7a]">大厂质量体系</p>
              <h2 className="font-serif text-4xl font-black md:text-5xl">
                从产品架构到 CI/CD/CT 的质量门禁
              </h2>
            </div>
            <p className="text-base leading-7 text-[#4b5a56]">
              参考 Google、Microsoft、Meta、Amazon、字节、阿里、百度的工程实践,
              ArchIToken 的 UI、架构、测试和发布都要进入可审查、可回滚、可度量的流程。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {qualityGates.map((gate) => (
              <div key={gate.title} className="border border-[#111817]/12 bg-white p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center bg-[#111817] text-white">
                  {gate.icon}
                </div>
                <h3 className="font-serif text-2xl font-bold">{gate.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#4b5a56]">{gate.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto grid gap-10 px-6 py-18 md:py-24 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="mb-3 text-sm font-bold text-[#c85b28]">模块地图</p>
          <h2 className="font-serif text-4xl font-black md:text-5xl">从左侧菜单到真实业务域</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {moduleMap.map(([group, ...modules]) => (
              <div key={group} className="border border-[#111817]/12 bg-white p-5 shadow-[0_20px_60px_rgba(17,24,23,0.06)]">
                <h3 className="mb-4 flex items-center gap-2 font-serif text-xl font-bold">
                  <PanelLeft className="h-5 w-5 text-[#18a058]" />
                  {group}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {modules.map((module) => (
                    <span key={module} className="border border-[#111817]/12 bg-[#f5f7f1] px-3 py-1 text-sm text-[#35423f]">
                      {module}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <TokenLedger />
      </section>

      <section className="border-t border-[#111817]/10 bg-white">
        <div className="container mx-auto px-6 py-14">
          <div className="mb-7 flex items-center justify-between gap-4">
            <h2 className="font-serif text-3xl font-black">技术栈落点</h2>
            <div className="hidden items-center gap-2 text-sm font-semibold text-[#4b5a56] md:flex">
              <Workflow className="h-4 w-4 text-[#18a058]" />
              Harness Engineering first
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {stack.map((item) => (
              <span key={item} className="max-w-full break-words border border-[#111817]/12 bg-[#f5f7f1] px-4 py-2 text-sm font-medium">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-serif text-3xl font-black text-[#111817]">{value}</div>
      <div className="mt-1 text-sm text-[#52615d]">{label}</div>
    </div>
  );
}

function Cockpit() {
  return (
    <div className="relative mt-4 border border-[#111817]/12 bg-[#f9fbf5]/88 p-4 shadow-[0_28px_90px_rgba(17,24,23,0.18)] backdrop-blur md:p-5">
      <div className="mb-4 flex items-center justify-between border-b border-[#111817]/10 pb-4">
        <div>
          <p className="text-xs font-bold text-[#1f6d7a]">生产环境视图</p>
          <h2 className="font-serif text-2xl font-black">ArchIToken Control Mesh</h2>
        </div>
        <div className="flex items-center gap-2 bg-[#111817] px-3 py-2 text-xs font-semibold text-white">
          <CheckCircle2 className="h-4 w-4 text-[#74d99f]" />
          Live
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.74fr_1fr]">
        <div className="border border-[#111817]/10 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-xl font-bold">资产队列</h3>
            <DatabaseZap className="h-5 w-5 text-[#18a058]" />
          </div>
          <div className="space-y-2">
            {cockpitRows.map(([name, module, signal, eta]) => (
              <div key={name} className="grid grid-cols-[1fr_auto] gap-3 border border-[#111817]/8 bg-[#f5f7f1] p-3">
                <div>
                  <p className="text-sm font-bold">{name}</p>
                  <p className="mt-1 text-xs text-[#5b6965]">{module} · {signal}</p>
                </div>
                <span className="self-start bg-white px-2 py-1 text-xs font-semibold text-[#1f6d7a]">{eta}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="border border-[#111817]/10 bg-[#111817] p-4 text-white">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-xl font-bold">三角色 Harness</h3>
              <GitBranch className="h-5 w-5 text-[#74d99f]" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
              {['Planner', 'Generator', 'Evaluator'].map((role) => (
                <div key={role} className="border border-white/14 bg-white/[0.06] px-2 py-3">
                  {role}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Metric icon={<Calculator className="h-4 w-4" />} label="BOQ 联动" value="98.7%" />
            <Metric icon={<Radar className="h-4 w-4" />} label="现场证据" value="86" />
            <Metric icon={<Network className="h-4 w-4" />} label="模型路由" value="6 engines" />
            <Metric icon={<CloudCog className="h-4 w-4" />} label="SLA 预算" value="<180s" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="border border-[#111817]/10 bg-white p-4">
      <div className="mb-3 flex h-8 w-8 items-center justify-center bg-[#e8f3eb] text-[#18a058]">
        {icon}
      </div>
      <p className="text-xs text-[#52615d]">{label}</p>
      <p className="mt-1 font-serif text-2xl font-black">{value}</p>
    </div>
  );
}

function ChainStep({
  item,
  isLast,
}: {
  item: (typeof businessChain)[number];
  isLast: boolean;
}) {
  return (
    <div className="relative border border-[#111817]/12 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,23,0.05)]">
      {!isLast && (
        <div className="absolute -right-3 top-8 z-10 hidden h-6 w-6 items-center justify-center bg-[#18a058] text-white lg:flex">
          <ArrowRight className="h-4 w-4" />
        </div>
      )}
      <div className="mb-5 flex items-center justify-between">
        <span className="font-serif text-3xl font-black text-[#1f6d7a]">{item.step}</span>
        <span className="flex h-10 w-10 items-center justify-center bg-[#111817] text-white">{item.icon}</span>
      </div>
      <h3 className="font-serif text-xl font-bold">{item.title}</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.modules.map((module) => (
          <span key={module} className="bg-[#eef2eb] px-2.5 py-1 text-xs font-medium text-[#34413e]">
            {module}
          </span>
        ))}
      </div>
      <p className="mt-5 text-sm font-semibold text-[#c85b28]">{item.output}</p>
      <p className="mt-2 text-xs text-[#5b6965]">{item.metric}</p>
    </div>
  );
}

function TokenLedger() {
  const tokens = [
    ['Concept Token', '方案叙事、体块、红线和投资约束'],
    ['Design Token', '图纸版本、IFC 构件、审签与变更'],
    ['Material Token', '材料规格、证书、供应商和批次'],
    ['BOQ Token', '工程量、价格、成本归因'],
    ['Manufacturing Token', 'BOM、CNC、排产和质检'],
    ['Logistics Token', '装箱、运输、到场和签收'],
    ['Evidence Token', '进度、质量、安全、AR、点云和影像'],
    ['Archive Token', '合同、标准族库、图纸模型和企业文宣'],
    ['Twin Token', 'WebGPU 场景、3DGS、IoT 和运维状态'],
    ['Enterprise Token', '财务、人力、权限和组织绩效'],
    ['Governance Token', '租户、RLS、模型路由和合规策略'],
  ];

  const icons = [
    FileText,
    GanttChartSquare,
    Boxes,
    Calculator,
    Cpu,
    Route,
    Camera,
    FileArchive,
    Orbit,
    Building2,
    ShieldCheck,
  ];

  return (
    <aside className="border border-[#111817]/12 bg-[#111817] p-5 text-white shadow-[0_28px_90px_rgba(17,24,23,0.2)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#74d99f]">Token Ledger</p>
          <h3 className="mt-2 font-serif text-3xl font-black">工程对象不再散落</h3>
        </div>
        <FileCheck2 className="h-7 w-7 text-[#f07836]" />
      </div>
      <div className="space-y-3">
        {tokens.map(([name, body], index) => {
          const Icon = icons[index] ?? FileText;
          return (
            <div key={name} className="grid grid-cols-[auto_1fr] gap-3 border border-white/12 bg-white/[0.05] p-3">
              <div className="flex h-9 w-9 items-center justify-center bg-white text-[#111817]">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold">{name}</p>
                <p className="mt-1 text-xs leading-5 text-white/65">{body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 border border-[#74d99f]/30 bg-[#74d99f]/10 p-4 text-sm leading-6 text-white/78">
        每个 Token 都绑定租户、权限、来源文件、模型版本、AI trace 和审计事件,
        让业务链能被检索、复盘、评测和自动化执行。
      </div>
    </aside>
  );
}
