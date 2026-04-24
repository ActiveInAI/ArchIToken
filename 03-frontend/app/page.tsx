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
    title: '商机与项目资产',
    modules: ['项目管理', '投资管理', 'AI招投标', '合同管理'],
    output: 'Project Token · 合同与预算基线',
    metric: '线索到项目 1 条主链',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    step: '02',
    title: '设计与标准族库',
    modules: ['方案设计', '深化设计', '标准族库', '图纸管理'],
    output: 'Drawing Token · BIM Token · 标准构件引用',
    metric: '图纸 / 模型 / 规范同源',
    icon: <Layers3 className="h-5 w-5" />,
  },
  {
    step: '03',
    title: '计量造价与供应制造',
    modules: ['计量造价', '生产制造', '材料物流', '进度管理'],
    output: 'BOQ Token · BOM · CNC · 到场批次',
    metric: '成本、排产、物流联动',
    icon: <PackageCheck className="h-5 w-5" />,
  },
  {
    step: '04',
    title: '现场施工与空间采集',
    modules: ['施工管理', 'AR验评', '点云模型', '倾斜摄影', '全景影像'],
    output: 'Evidence Token · 质量安全闭环',
    metric: '现场事实可追溯',
    icon: <HardHat className="h-5 w-5" />,
  },
  {
    step: '05',
    title: '数字孪生与运营归档',
    modules: ['数字孪生', '运维管理', '档案数据', '企业文宣'],
    output: 'Twin Token · Archive Token · 运营知识库',
    metric: '交付后仍可运营',
    icon: <Orbit className="h-5 w-5" />,
  },
  {
    step: '06',
    title: '企业中台与治理',
    modules: ['财务管理', '人力资源', '设置中心', '联系我们'],
    output: 'RBAC · 模型路由 · 审计日志 · SLA',
    metric: '组织、权限、成本统一治理',
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
  {
    repo: 'leia-project/viewer',
    focus: '通用数字孪生 3D Viewer',
    takeaways: ['3D Tiles 图层', '属性主题渲染', '过滤器', '图层管理器'],
    note: '可映射为风险、能耗、进度、质量等专题图层。',
  },
  {
    repo: 'geosolutions-it/digital-twin-toolbox',
    focus: '城市级 3D Tiles 生成管线',
    takeaways: ['Shapefile 转 3D Tiles', 'LAS 点云处理', 'CRS / resample', '城市环境数据管线'],
    note: '用于规划 ArchIToken 的点云、倾斜摄影、GIS 数据入库链。',
  },
  {
    repo: 'Meteor3DEditor',
    focus: 'Three.js 低代码数字孪生编辑器',
    takeaways: ['IoT 数据大屏', '低代码场景编辑', '组件化 3D 引擎', '运行态配置'],
    note: '适合借鉴组件面板、运行态配置和场景编排体验。',
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
    group: 'ISO 19650',
    anchor: 'OIR / PIR / AIR / EIR、BEP、MIDP、TIDP、CDE',
    implementation: 'CDE 文件区按信息需求、审批状态、责任方和交付节点组织。',
  },
  {
    group: 'openBIM',
    anchor: 'IFC / IDS / BCF / bSDD / openCDE',
    implementation: '模型属性用 IDS 做交付校验,问题协作用 BCF 视点与整改单串联。',
  },
  {
    group: '中国工程规范',
    anchor: 'GB/T 50326、GB/T 51212、GB 550xx 强制性工程规范体系',
    implementation: '规范条款库分强制条文、推荐条文、地方规程和企业工法四级。',
  },
  {
    group: '数据与网络安全',
    anchor: 'PIPL / DSL / CSL、GDPR、ISO 27001、SOC 2、等保 2.0',
    implementation: '租户隔离、最小权限、审计留痕、模型调用白名单和数据出境标记。',
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
  ['锦屏重钢别墅', '方案设计', '预算 ¥680k', '45d'],
  ['EPC 招投标包', 'AI审查', '风险 3 项', 'T+2h'],
  ['IFC4 结构模型', '碰撞复核', '构件 2,418', '通过'],
  ['施工周计划', '现场验评', '证据 86 条', '闭环'],
];

const moduleMap = [
  ['项目入口', '项目管理', '投资管理', 'AI招投标', '合同管理'],
  ['设计数据', '方案设计', '深化设计', '标准族库', '图纸模型'],
  ['工程履约', '进度管理', '计量造价', '生产制造', '材料物流'],
  ['现场事实', '施工管理', 'AR验评', '点云模型', '倾斜摄影', '全景影像'],
  ['运营沉淀', '数字孪生', '运维管理', '档案数据', '企业文宣'],
  ['组织治理', '财务管理', '人力资源', '设置中心', '权限审计'],
];

const stack = [
  'Next.js',
  'React',
  'Three.js',
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
  ['立项与合同', '投资估算、招采方式、合同边界、付款节点、变更索赔条款'],
  ['设计与模型', 'IFC 属性完整性、IDS 校验、碰撞检查、消防/节能/结构规范引用'],
  ['施工与验评', '隐蔽工程、质量检验批、安全风险、旁站记录、影像证据链'],
  ['数据与隐私', '租户隔离、个人信息最小化、日志留存、数据出境、供应商访问审计'],
  ['交付与运维', '竣工模型、资产编码、维保计划、能耗监测、档案馆交付包'],
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
              从商机、图纸、BIM、清单、合同、制造、物流、施工验评到数字孪生与档案,
              每个工程对象都有自己的 Token 身份、证据链和 AI Harness 执行轨迹。
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
              <Stat value="25+" label="业务模块" />
              <Stat value="7" label="资产 Token" />
              <Stat value="3-role" label="Harness 审核" />
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
            HTML 原型里的模块很多,这里把它们按真实工程流转重排为 6 个闭环节点。
            前端展示清楚链路,后端继续由模块注册表和 Harness 执行。
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-6">
          {businessChain.map((item, index) => (
            <ChainStep key={item.step} item={item} isLast={index === businessChain.length - 1} />
          ))}
        </div>
      </section>

      <section className="border-y border-[#111817]/10 bg-white">
        <div className="container mx-auto px-6 py-18 md:py-24">
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mb-3 text-sm font-bold text-[#1f6d7a]">GitHub 数字孪生参考</p>
              <h2 className="font-serif text-4xl font-black md:text-5xl">
                从 BIM Viewer 到城市级 3D Tiles 管线
              </h2>
            </div>
            <p className="text-base leading-7 text-[#4b5a56]">
              参考近期活跃和行业经典开源项目后,ArchIToken 前端不只做一个模型窗口,
              而是把图层、主题、过滤、BCF 视点、点云、CDE 文件和 AI 审查结果放进同一套工作台。
            </p>
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
              PMP、IPMP、openBIM 与法规规范一起进入产品结构
            </h2>
          </div>
          <div className="max-w-md border border-[#111817]/12 bg-white p-5">
            <div className="mb-3 flex items-center gap-2 font-serif text-xl font-bold">
              <BookOpenCheck className="h-5 w-5 text-[#18a058]" />
              标准不是说明书,是数据结构
            </div>
            <p className="text-sm leading-6 text-[#4b5a56]">
              每个模块都要知道自己产出什么交付物、接受什么审查、进入哪个审批状态、关联哪些法规和证据。
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
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
    ['Project Token', '商机、投资、合同与项目基线'],
    ['Drawing Token', '图纸版本、标注、审签与变更'],
    ['BIM Token', 'IFC 构件、属性、空间关系'],
    ['BOQ Token', '工程量、价格、成本归因'],
    ['Evidence Token', '照片、点云、AR 验评与整改'],
    ['Twin Token', '竣工模型、IoT、运维状态'],
    ['Archive Token', '档案包、审计日志、交付凭证'],
  ];

  const icons = [
    FileText,
    GanttChartSquare,
    Boxes,
    Calculator,
    Camera,
    Route,
    FileArchive,
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
