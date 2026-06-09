# ArchIToken · 宪法 22 条

**性质**: 强约束。违反 = CI 拒绝合并。非软规范。
**哲学**: Harness Engineering — 能力优先、开源优先、源码优先; 工程自由由标准、证据、审计、隔离和可回滚性承载。
**唯一真源索引**: [`ARCHITOKEN-SOURCE-OF-TRUTH.md`](./ARCHITOKEN-SOURCE-OF-TRUTH.md)
**定位真源**: [`POSITIONING_AND_COMPETITIVE_STRATEGY.md`](./POSITIONING_AND_COMPETITIVE_STRATEGY.md)
**专业与标准合规真源**: [`PROFESSIONAL_STANDARDS_COMPLIANCE.md`](./PROFESSIONAL_STANDARDS_COMPLIANCE.md)

---

## 0. 命名

当前对外产品名只使用 `ArchIToken`。

`ArchIToken` 是当前产品名、仓库名、代码库名、路径名和包名/API 兼容标识。新用户界面、对外文档、桌面入口、发行物和新增功能命名默认使用 `ArchIToken`;不得引入其它 active 产品身份,除非先更新唯一真源、宪法、模块注册和发布材料。

---

## 0.1 定位

ArchIToken 的项目定位固定为:

```text
ArchIToken = AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS
```

ArchIToken 是 AEC 行业的 AI-Native 平台、Harness Engineering 系统、OpenBIM CDE Workflow OS、Speckle CDE 互操作运行时、IFCDB-Agent 数据库/Agent 路由和后端原生文件运行时,负责把模型、文件、标准、BIM 语义、业务对象、审批、Agent、工具、审计和交付物组织成可运行、可追踪、可回滚、可私有化部署的工程系统。

ArchIToken 不伪造私有格式内核,也不把前端派生文件当作真实格式支持。开放格式必须走原生/open runtime 路径; RVT、DWG、DGN、Tekla、Navisworks、Office、PKPM、广联达等私有或复杂格式必须通过后端 worker、授权适配器或企业服务进入,并保留真实源文件绑定、权限、审计和回滚边界。

**CI 执行**: README、PRD、架构文档、模块文档、前端页面和对外材料不得违背本定位。任何“全面替代/全面超越某大厂”的表述必须有真实项目、互操作、性能、合规和审计证据。

---

## 0.2 openBIM 标准体系为 AEC 数据底座

ArchIToken 的 CAD/BIM/CIM/GIS 工程数据底座必须基于 buildingSMART openBIM 标准体系,而不是任何单一厂商私有格式或单一工具实现。

openBIM 基线至少包括:

- IFC: 工程对象、几何、空间、构件、属性、关系、材料和分类的数据模型真源。
- IDM: 信息交付流程、参与方、里程碑、交换需求和交付物边界真源。
- bSDD: 对象、属性、分类、术语、URI 和跨语言语义映射真源。
- BCF: 模型问题、碰撞、整改、评论、责任人、视点和闭环协同真源。
- IDS: 机器可执行的信息交付要求、属性要求、分类要求和模型校验真源。
- buildingSMART Validate: IFC 语法、Schema、规范性检查、实现协议和校验报告真源。
- OpenCDE / Foundation API / BCF API / Dictionaries API: CDE、协同、字典和问题流转 API 参考合同。

任何 CAD/BIM/CIM/GIS 功能、AI 生成、模型编辑、文件转换、图纸/模型/构件输出和交付审批,必须说明其对应的 openBIM 标准锚点。私有格式如 RVT、DWG、DGN、3DM、SKP、Tekla、Navisworks 等只能作为输入/输出适配器或授权运行时,不能替代 IFC/IDM/bSDD/BCF/IDS/Validate 作为系统语义真源。

**CI 执行**: openBIM 相关 PR 必须更新标准映射、Worker/Adapter Isolation Registry、文件类型 Registry 和验证报告路径。任何 IFC/IDS/BCF/IDM/bSDD/Validate 结果不得由假数据、占位 manifest 或无源推断伪造。

---

## 0.3 重钢 AI Token 商业化工作流约束

重钢方案深化、生产制造、AI 服务额度、电子合同、电子签章、预付定金、支付适配器、财税账单和数字档案必须遵守 [`HEAVY_STEEL_AI_TOKEN_COMMERCIAL_WORKFLOW.md`](./HEAVY_STEEL_AI_TOKEN_COMMERCIAL_WORKFLOW.md)。

“Token”只允许表示 AI 服务额度、AI 调用点数、AI 算力点数或服务包额度,不得作为可交易虚拟币、收益权凭证、金融资产或升值承诺载体。

商业化 workflow 必须按 16 模块 registry 顺序串联: 个人中心 -> 市场客服 -> 计划管理 -> 方案设计 -> 标准族库 -> 深化设计 -> 计量造价 -> 材料物流 -> 生产制造 -> 施工管理 -> 数字孪生 -> 数字档案 -> 财务管理 -> 人力资源 -> AI 中心 -> 设置中心。财务管理和人力资源可以并行消费上游证据,但 active 模块顺序、module_id 和工作台入口仍以 registry 为准。全链路必须通过数据库记录、CDE 文件、审计事件、Router 和审批状态串联。任何静态页面、假数据、只前端状态或无审计链实现都不能被标记为生产完成。

---

## 0.4 Office / PDF / OCR 文档运行时边界

Office 原生在线编辑主路线固定为 Collabora Online WOPI 隔离服务。ArchIToken 必须作为 WOPI host 持有源文件真源、权限、锁、版本、审计和 PutFile 保存回写;Collabora 只作为外部编辑器运行时,不得进入核心分发边界。OnlyOffice 只允许作为显式选择的隔离 fallback 或商业授权路线,不得成为不可替换核心依赖。DOC/DOCX、XLS/XLSX/XLSM/XLSB、PPT/PPTX、ODT/ODS/ODP 等 Office 文件必须保持源文件为 source of record;PDF、HTML、截图、OCR、Markdown 或图片派生只能作为预览、索引、证据或导出结果,不得替代 Office 原生编辑和保存回写。

MinerU 是 PDF / Office 文档智能解析主 worker,用于将 PDF、DOCX、PPTX、XLSX、图片等来源转换为 Markdown、JSON、OCR、表格、公式、版面块和 RAG / Agent 结构化产物。MinerU 不得被宣传为 Office 或 PDF 在线编辑器。

PaddleOCR 是 PDF / 图片 OCR、中文与多语言文字识别、版面结构识别和扫描件解析的一等 worker/service 路线。PaddleOCR / PaddleOCR-VL / PP-StructureV3 的输出只能作为 OCR、结构化抽取、检索索引、人工复核和后续 RuleChecker 的输入;不得直接标记为“合规”“验收通过”“原文无误”“PDF 编辑完成”或“施工/报审/归档完成”。

PDF 的源文件必须保持 source of record。浏览器默认只负责原生 PDF 查看和源文件流读取,不得把 Collabora/OnlyOffice 的 PDF 只读或有限批注界面宣传为完整 PDF 编辑。PDF 拆分、合并、删页、旋转、裁剪、压缩、OCR 写回、签章/验签、表单填充、展平、元数据、水印、脱敏、转换、自动化和页面级修改主路线固定为独立 Docker sidecar 调用 Stirling-PDF。ArchIToken 只能通过 worker/API 调用 `STIRLING_PDF_URL` 指向的 sidecar,不得把 Stirling-PDF 代码、open-core/proprietary 子目录或其前端 UI 混入核心分发边界。Stirling-PDF 只能调用已登记 `pdfOperation` 或经部署实例 Swagger 验证的 API path,并必须产生真实 PDF/ZIP/JSON artifact、受控本地文件版本,或明确 blocked/failed 结果。PDFium、MuPDF 或授权 PDF adapter 只作为渲染、底层解析、商业授权或能力补位路线。

Stirling-PDF 与 PaddleOCR 共同构成 PDF 生产基线:Stirling-PDF 负责真实 PDF 工具操作和派生产物;PaddleOCR/PaddleOCR-VL/PP-StructureV3 负责扫描件、图片化 PDF、中文/多语言 OCR、版面识别和文档视觉结构化。两者输出必须在工单、版本、证据链和人工复核界面中标明来源,不得互相冒充,也不得替代专业合规结论。

**CI 执行**: Office/PDF/OCR 相关 PR 必须更新 AdapterSourceRegistry、格式路由、worker contract、环境变量文档和测试。Office 检查必须覆盖 WOPI session / CheckFileInfo / contents / PutFile 保存回写边界;PDF 检查必须覆盖 `stirling_pdf` worker、`/api/local-files/:fileId/pdf-operation`、Stirling-PDF sidecar 配置、`pdfOperation` registry 和真实 artifact/blocked 结果。任何 HTML 预览、截图、OCR 文本、Markdown、PDF 派生或无源推断,不得冒充 Office/PDF 源文件原生编辑、真实保存回写或专业合规结论。

## 0.5 DWG/DXF CAD 图纸运行时固定路线

DWG/DXF CAD 图纸的浏览器端主路线固定为 **PanCAD / MLightCAD**。ArchIToken 的 OpenEngineeringEditor、数字档案、模型档案、图纸预览、属性栏和工具栏不得再回退到旧 `dxf-parser` SVG 复刻、自动 PDF 预览、截图、Canvas 重画或任何不能保持 CAD 源文件实体/图层/颜色/字体/命令边界的替代方案。

固定实现合同如下:

- DWG/DXF 源文件始终是 CDE source of record。Viewer 只负责源文件绑定打开、浏览器内图纸查看、选择、图层、命令和属性证据,不得把派生图、截图或 PDF 当作 CAD 真源。
- 浏览器端 DWG/DXF 打开固定使用 `@mlightcad/cad-simple-viewer@1.4.13` 路线,并通过 `AcApDocManager.createInstance` 绑定容器、`baseUrl=/api/mlightcad/`、`autoResize=true`、`notLoadDefaultFonts=true`、`useMainThreadDraw=false` 和 worker 文件 `dxf-parser-worker.js`、`libredwg-parser-worker.js`、`mtext-renderer-worker.js`。
- DWG 解析经 `@mlightcad/libredwg-web` / LibreDWG GPL-3.0 WASM worker 适配边界进入,只能作为外部/隔离运行时、worker、sidecar 或 licensed/isolated adapter 使用,不得把 GPL 代码静态合并到核心分发边界。
- DXF 打开前必须读取 `$DWGCODEPAGE`。`ANSI_936`、`CP936`、`GB2312`、`GBK`、`GB18030` 必须按 `gb18030` 解码并重写为 UTF-8 CAD 字节流后交给 MLightCAD;Big5、Shift-JIS、EUC-KR、Windows-874、Windows-125x 等 codepage 必须按登记映射处理。不得用浏览器默认 UTF-8 强读导致中文或 CAD 字符变成问号。
- CAD 图纸中的中文、符号、尺寸和 MText 都按 CAD 字体/SHX/字体 manifest 处理。必须优先加载 `/api/mlightcad/fonts/fonts.json` 中的 CAD 字体名,兜底字体顺序固定为 `simkai`、`simsun`、`simhei`、`gbcbig`、`hztxt`、`txt`、`simplex`、`romans`、`arial`。不得用 HarmonyOS、系统 UI 字体或 Web 字体冒充 CAD 字体。
- AutoCAD 文本转义只能按 CAD 文本语义修复,包括 `\U+XXXX`、`%%c`、`%%d`、`%%p` 等;不得用普通网页文本清洗规则破坏 CAD 原始文本、尺寸、符号或 MText 结构。
- 视口主题固定由 CAD runtime 控制:黑色 CAD 背景、CAD 源颜色、线宽显示、`COLORTHEME=0`、`LWDISPLAY=true`、`WHITEBKCOLOR=false`。显示、颜色、背景和字体问题必须优先在 CAD runtime/字体/编码层修复,不得通过截图滤镜或 SVG 重绘规避。
- 文件查看器顶部信息必须保持单行紧凑布局,不得因不同文件格式重复堆叠标题区、元数据区或占用大量垂直空间。
- CAD 算量是一等生产能力,不得被降级为“只能预览”或“只能草稿”。PanCAD / CAD rule worker 必须实现 DWG/DXF 图元级算量路线:比例校准、轴网/轴号识别、图层/颜色/线型规则、块/动态块/属性块识别、填充/闭合边界识别、房间/区域识别、尺寸线和文字证据提取、构件/清单项映射、计算式、扣减/合并规则、工程量追溯、人工复核、版本化和审批。其能力目标应对齐成熟 CAD 算量软件的工作流:自动识别和批量算量是必需能力,人工校核和规则配置是工程真实性边界,不是能力缺失借口。
- DWG/DXF 的轴网、轴号、尺寸线、图层、块和实体必须先按 CAD 源图显示,再进入图元级算量和规则映射。输出状态必须分级:未校准/未闭合/未映射/未复核时为 `draft` 或 `review_required`;完成比例、图层/块规则、闭合边界、清单映射、计算式、来源图元 ID 和专业复核证据后,可以进入 `reviewed`、`approved` 或项目约定的结算/报审状态。禁止的是“无源预览直接最终量”,不是 CAD 算量本身。
- PanCAD 是 DWG/DXF 路线的独立实现仓库和可复用能力包。ArchIToken 内部 DWG/DXF 实现必须与 PanCAD 的编码、字体、运行时、能力矩阵和失败关闭策略保持一致。

**CI 执行**: CAD/DWG/DXF 相关 PR 必须覆盖 PanCAD/MLightCAD 路线、DXF codepage 转码、CAD 文本转义、CAD 字体 manifest、MLightCAD worker 路径、失败关闭、能力矩阵、CAD 图元级算量、比例校准、闭合边界、图层/块规则、清单映射、计算式追溯、复核状态和 DWG GPL/WASM 隔离边界测试。任何回退到 SVG 复刻、自动 PDF 预览、截图、普通网页字体或无源推断的实现必须拒绝合并。

## 0.6 PanCode 代码编程文件运行时固定路线

代码、配置、标记语言、脚本和纯文本文件的在线编辑主路线固定为 **PanCode**。PanCode 是 ArchIToken CDE 内的代码编程文件运行时和独立可复用实现仓库,负责 HTML、XML、Markdown、JSON、JSONL、JSONC、TXT、YAML/YML、TOML、ENV、SQL、GraphQL、Proto、Rego、Dockerfile/Compose、Makefile、Rust、TypeScript、JavaScript、TSX/JSX、CSS/SCSS、Shell、Python、Go、Java、C/C++ 等登记格式的源码查看、编辑、保存回写和代码智能入口。

固定实现合同如下:

- CDE 源文件始终是 source of record。PanCode 只能编辑受控本地文件对象 `/api/local-files/{fileId}` 或由 CDE session materialize 的工作区副本;不得把浏览器状态、下载副本、sidecar workspace、派生 HTML、截图、Markdown 或缓存文本当作源文件真源。
- 默认内嵌编辑器固定使用 `monaco-editor@0.55.1`,并采用 VS Code 默认深色主题、顶部命令工具栏、左侧 Activity Bar、Explorer 树状目录、Search、Source Control、Diagnostics、Settings 和可执行菜单命令。代码/配置/文本文件默认进入编辑模式;HTML/HTM 默认可视化预览,但必须保留源码切换。
- 完整 IDE 会话固定使用 `code-server@4.121.0` 作为 Collabora-style 隔离 sidecar。code-server 只能编辑 `architoken.code_native_session.v1` 工作区副本;保存为 CDE 证据必须调用 `/api/local-files/{fileId}/code-session/commit` 写回 ArchIToken,并更新版本、checksum、审计标签和失败状态。直接把 CDE 源目录挂载给 code-server 并让其绕过 ArchIToken 保存回写,不是合格实现。
- 代码结构、语法树、搜索、诊断和后续 worker/LSP 能力固定以 `tree-sitter v0.26.9` 为源码构建路线。tree-sitter 输出只能作为语法树、索引、诊断、Schema/规则检查输入和审计证据;不得替代源文件、人工复核、专业合规、构建执行或安全扫描结论。
- JSON/JSONL/JSONC、YAML/YML、TOML、XML、HTML 等结构化文本的浏览器内检查只能作为轻量结构诊断。任何“可发布”“可部署”“安全”“合规”“构建通过”“工程可用”结论必须来自对应 worker、CI、SchemaValidator、RuleChecker、测试或人工 Approver 证据。
- PanCode 必须沿用 Registry,不得用硬编码 enum 固化支持格式。新增格式必须进入 FileTypeRegistry、code editor profile、MIME/save-back policy、测试和文档。
- PanCode 与 Office/PDF 路线完全分离。Office 继续走 Collabora WOPI 主路线,PDF 工具继续走 Stirling-PDF/PaddleOCR/PDF adapter 路线;不得把 PanCode 的 HTML/Markdown/Text 编辑器冒充 Office/PDF 原生编辑器。
- GPL/AGPL/SSPL/BUSL/商业授权代码编辑器或 LSP/IDE 运行时可以作为外部服务、sidecar、CLI 或 licensed adapter,但不得混入核心分发边界。PanCode 核心分发边界优先使用补丁级钉住的宽松许可依赖和可审计源码构建路线。
- PanCode 是代码编程文件路线的独立实现仓库和可复用能力包。ArchIToken 内部代码文件编辑器、Docker `code-editor` profile、source-build tree-sitter route、运行时 manifest、保存回写、失败关闭策略、能力矩阵和测试必须与 PanCode 保持一致。

**CI 执行**: 代码编程文件相关 PR 必须覆盖 Monaco 0.55.1 内嵌编辑、VS Code 默认主题、默认编辑模式、HTML 默认可视化与源码切换、code-server 4.121.0 sidecar manifest、`/code-session/commit` 保存回写、tree-sitter 0.26.9 source-build、Registry 格式覆盖、MIME/save-back policy、大小限制、checksum/version/audit 更新、失败关闭、Office/PDF 路线隔离和 PanCode 文档同步。任何只读预览、浏览器缓存、sidecar 目录修改、截图、派生 HTML/Markdown 或无源推断冒充源文件编辑成功的实现必须拒绝合并。

## 0.7 原生显示与派生显示边界

ArchIToken 的文件查看、模型查看、图纸查看、文档查看、媒体播放、归档浏览和代码编辑必须区分 **原生显示** 与 **转格式派生显示**。原生显示是平台能力目标,转格式派生只能作为兼容、缩略图、索引、审计、导出、批处理或明确标注的失败降级路线。任何格式不得把“先转成 PDF/图片/HTML/Markdown/GLB/IFC/Collada/文本/截图后显示”宣传、命名或标记为该格式的原生显示。

固定判定如下:

- 原生显示必须绑定 CDE source of record,直接读取源格式的文件结构、实体、页面、对象、图层、属性、材质、颜色、字体、坐标、单位、选择对象和保存/版本边界。
- 转格式派生产物必须显式标注为 `derivative`、`export`、`thumbnail`、`index`、`ocr`、`preview_fallback` 或同等状态,并保留源文件、派生来源、worker/adapter、命令、版本、checksum、审计事件和失败证据。
- 如果某格式的原生 runtime、sidecar、worker、授权适配器或浏览器内核不可用,UI 必须显示 `native_unavailable`、`adapter_required`、`blocked` 或 `failed`,不得静默改用派生文件并让用户误以为已经原生打开。
- Office/ODF 原生在线显示与编辑主路线是 Collabora Online WOPI 隔离服务,ODT/ODS/ODP/ODG/ODB 等 ODF 文件必须按 OpenDocument 源文件打开、锁定、保存回写和审计。LibreOffice CLI 只能作为后端导出/批处理 worker;不得把 LibreOffice CLI 转出的 PDF/HTML/图片冒充 ODF/Office 原生显示。
- OFD 原生显示必须按 GB/T 33190-2016 开放版式文档源包、页面、资源、签章、发票/公文/证照元数据和固定版式对象读取。OFD 转 PDF、转图片、OCR 或文本抽取只能作为派生、索引、证据或降级,不得冒充 OFD 原生显示。
- PDF 原生显示必须以 PDF 源文件页面、对象、字体、矢量、图片、批注、表单、签章和页面操作为边界。PDF 转图片、OCR 文本、Markdown 或 Office 只读视图不得冒充 PDF 原生显示或编辑。
- CAD/BIM/3D 原生显示必须优先读取源格式实体、拓扑、mesh/B-Rep、图层、构件、属性、材质、颜色、坐标和单位。IFC、DWG/DXF、STEP/IGES、USD/USDZ、3D Tiles、glTF/GLB 等开放或浏览器可直接运行格式可以形成原生视口;RVT、SKP、3DM、DGN、Tekla、Navisworks 等私有或复杂格式必须通过真实 native sidecar、授权适配器或源格式运行时打开。转 IFC/GLB/DAE/STEP 等派生只代表转换结果,不得替代源格式原生显示。
- 图片、音频、视频、SVG、RAW 和归档文件的原生显示/播放/浏览必须保留源格式语义、元数据、色彩、时间轴、轨道、页面、压缩包目录和字节来源。转码后的 MP4/PNG/JPEG/PDF/文本只能作为派生显示或降级。
- 代码和结构化文本的原生显示/编辑必须保留源代码文本、编码、换行、语法树、保存回写和版本边界。Markdown/HTML 渲染预览、AST、索引和格式化输出不得冒充源码原生编辑。

**CI 执行**: 文件格式、viewer、worker、adapter、OpenEngineeringEditor、Office/PDF/OFD/ODF/CAD/BIM/media/code 相关 PR 必须在 Registry、UI 状态、worker result、artifact role 和测试中区分 `native` 与 `derivative`。任何把派生物作为默认原生显示、隐藏 adapter 不可用状态、丢失源文件绑定、或用截图/转码/OCR/HTML/GLB/PDF 替代源格式原生打开的实现必须拒绝合并。

---

## 第 1 条 · AI 必须服从 Open CDE 和 Harness

ArchIToken 的全部价值在 Harness 层。模型是可替换组件,永远不依赖某个具体模型的能力假设。

**CI 执行**: 模型调用必须经过内部统一 Router / ModelRouter / InferenceRouter 抽象。直连外部模型 API 的业务代码 PR 自动拒绝。

---

## 第 2 条 · 模型决定下限,Harness 决定上限

任何优化先问 Harness、Router、Schema、Registry、RuleChecker 能不能做,再考虑换模型。

**CI 执行**: 架构评审清单必须要求说明“为什么这是 Harness 问题或模型问题”。

---

## 第 3 条 · 技术服务目标,不做语言或框架信仰

ArchIToken 不局限于某一种语言、框架、数据库、Agent 框架或推理引擎。

Rust / Cxx 是核心主干优先项,但 Python、Go、C++、Perl、Shell、CUDA、ROCm/HIP、DirectX 12、Metal、Triton、WASM、WebGPU、TypeScript 等都可按场景使用。

判断标准只有一个: 是否服务于以下目标:

- 高性能
- 高效率
- 强扩展
- 易维护
- 高度灵活
- 工程可控
- 长期可演进

禁止把“某语言不能用”作为默认原则。真正禁止的是低性能、低效率、难扩展、难维护、不可审计、不可回滚、不可长期演进的实现。

**CI 执行**: 新增语言、框架或运行时必须在 PR 中说明边界、收益、替代方案和维护成本。

---

## 第 4 条 · 能力优先、开源优先、源码优先,协议只决定边界

ArchIToken 的技术选型必须以实现能力、生产价值、生态成熟度、互操作能力、可维护性和长期演进空间为第一判断标准。

本条取消对协议、厂商、语言、框架、包管理器、部署形态、源码来源和运行时形态的默认限制。任何有生产价值的能力都必须进入完整落地路线,不得因为"不是当前栈""apt 没有""需要源码编译""需要外部进程""需要授权运行时""需要本地模型"而停止。

许可证、授权、商业条款和运行时形态不能作为否定强能力项目的默认理由。它们只决定该项目进入系统的方式,不决定是否实现:

- 开源项目、源码仓库和用户提供的 GitHub 链接是一等技术来源。需要能力时优先从源代码、上游文档、release tag 和可复现构建路线落地; apt、snap、系统包或二进制分发只是加速路径,不是能力边界。
- 用户明确给出的上游仓库、行业强能力仓库、标准组织仓库、厂商 SDK/API 示例仓库和运行时仓库都不是可选参考集。它们必须形成可追溯的完整能力覆盖:运行时/sidecar/worker/service/SDK/Schema/fixture/clean-room reference/授权适配器/失败证据中的一种或多种,并进入 Registry、路由、审计和测试计划。
- ArchIToken 可以按业务需要整体开源、局部开源、私有部署或混合分发。是否开源不能成为限制技术路线的理由。
- CAD/BIM/PDF/工程几何遵循矢量优先、语义优先、原生源文件优先。DWG、DXF、IFC、STEP/STP、IGES/IGS、STL、SKP、3DM、RVT、PDF 和 3D PDF 等格式必须优先读取源文件实体、图层、属性、B-Rep、mesh、材质、单位和构件关系。
- PanAEC Engine 是 ArchIToken 自研工程智能、几何、文档、媒体、归档、代码编程、属性、资产派生和协同调用引擎名称,不是第三方 viewer 名称,也不是单一前端组件名称。PanAEC Engine 能力必须覆盖 BIM、CAD、PDF、Office、音频、视频、图片、解压缩/归档、代码编程资产、OpenEngineeringEditor、AI 生成、可编辑几何、可编辑属性、构件选择、尺寸量测、坐标/单位、BOM/清单导出、worker 派生、审计、SDK 和 API 调用。OpenEngineeringViewer 只能作为兼容别名或只读模式名称,不得作为工程模型能力边界。
- PanAEC Engine 是潘永胜个人开发并持有著作权的独立开源项目。著作权人潘永胜授权 ArchIToken 使用、集成、部署和调用 PanAEC Engine 作为一等工程引擎;该授权不转移 PanAEC Engine 著作权,也不取消对外 `AGPL-3.0-only` 开源许可、运行时隔离、审计、源文件真源和许可证边界要求。
- 工程模型/数字孪生资产主链路必须优先选择 OpenUSD/USDZ/3D Tiles。OpenUSD/USDZ 负责工程资产组合、层级、变体、引用、材质、属性、BOM 绑定和跨工具交换; 3D Tiles 负责超大场景、城市/园区、点云、倾斜摄影和分块 LOD 流式交付。只有在 OpenUSD/USDZ/3D Tiles 运行时、目标平台、授权边界、worker 转换、交付对象或浏览器能力明确不可用且形成审计证据时,才允许降级到 glTF/GLB。glTF/GLB 进入宪法许可边界,但只能作为浏览器真实模型运行时、交付兜底或私有格式真实转换失败后的最后补充兜底;源 SKP/RVT/DWG/3DM/STEP/IFC 等文件仍是真源,GLB 不得替代源格式语义、属性 Schema、单位/坐标合同、审批审计或 openBIM 交付。OBJ 和 FBX 不得作为新的平台主路线、默认导出目标、默认查看派生或长期资产标准,只允许作为历史导入兼容边界,并必须尽快归一到 OpenUSD/USDZ/3D Tiles 或 glTF/GLB 兜底资产。
- GitHub / 上游源码接入基线必须完整覆盖 OpenCascade/OCCT、FreeCAD、CGAL、LibreDWG、IfcOpenShell、Bonsai、buildingSMART、Blender、OpenUSD/Pixar USD、Khronos glTF、Cesium/OGC 3D Tiles、rhino3dm、OpenNURBS、ForgeCAD、Trimble/Tekla、Speckle、ThatOpen/WebIFC、Microsoft IFC、DataDrivenConstruction、louistrue IFC/CAD、OpenCDE、PDF/Office/Image/Video workers,以及后续发现的同等强能力上游。它们必须进入 AdapterSourceRegistry、格式能力路由、AI 生成/在线编辑动作和审计链,不得只停留在口头技术选型。所谓完整覆盖不是把所有代码混入核心,而是把每个上游可提供的生产能力完整映射到对应隔离边界、运行证据和降级/失败证据。
- WebGPU 是浏览器和交互式工程视口的第一渲染/计算路线。WebGL 只能作为受审计失败恢复、缩略图或第三方遗留组件边界,不得作为 BIM、CAD、数字孪生、视频/图像 AI 编辑或工程模型在线编辑的默认核心路线。
- GPU 和平台能力必须全面覆盖 NVIDIA/CUDA/OptiX、AMD ROCm/HIP、Intel oneAPI/Level Zero/Vulkan、Apple Metal、Windows DirectX 12、Linux/Vulkan/WebGPU、Android/Vulkan/WebGPU、iOS/Metal/WebGPU、Triton AI kernel 和 CPU SIMD fallback。ARM64、x86_64、NVIDIA、AMD、Intel、Apple Silicon 都是生产目标,不是兼容性例外。
- NVIDIA 目标硬件必须使用 NVIDIA 认证 / 支持的软件栈: NGC CUDA / CUDA Deep Learning 签名镜像、NVIDIA Container Toolkit、GPU Operator / device plugin、DCGM、CUDA、OptiX、TensorRT、TensorRT-LLM 和 Triton 按能力边界接入。生产 worker 镜像必须锁定 NGC tag 或 digest,不得用 `latest`、Mesa/CPU-only/WebGL-only 路线、空 Canvas、截图或前端派生文件冒充 GPU 渲染成功。缺少 NVIDIA 驱动、设备节点、容器运行时、CUDA/OptiX smoke 或 WebGPU adapter 时,只能记录 failed/unsupported evidence 并走受审计 fallback。
- 可进入核心分发边界的依赖优先使用 Apache-2.0 / MIT / BSD / ISC / MPL-2.0 / MPL-2.0 等宽松许可。
- Copyleft、OpenCore、商业授权、桌面软件、托管服务、闭源 SDK、运行时依赖重的项目,可以成为主路线,但必须通过 HTTP / CLI / IPC / Worker / Sidecar / Licensed Adapter 隔离。
- 能力强的项目不得因为协议不明、GPL/AGPL、授权复杂或运行时重,被自动降为 `reference_only`。正确决策是 `selected_external_process`、`licensed_gated` 或明确的 sidecar/service 适配器。
- 文档编辑、PDF 渲染/编辑、CAD/BIM 几何、GIS/QGIS、ERP/CDE、工作流自动化、AI 生成等基础能力,不得因为 GPL/AGPL/运行时重而只做参考。必须形成 HTTP / CLI / IPC / Worker / Sidecar / Licensed Adapter 调用合同,产出真实 artifact、真实服务结果、真实校验报告或明确失败证据。
- `reference_only` 不是"可不做"。它只表示该上游没有直接运行时入口,或必须作为归档、组织主页、样例数据、重复项目、UI/架构、clean-room 或标准参考进入完整能力链路。只要它承载业务能力、标准合同、fixture、API 形态、UX/工作流证据或兼容性知识,就必须被同步、登记、映射、引用或转化为适配器任务。
- 任何隔离适配器不得假成功。必须返回真实 artifact、真实服务结果、真实校验报告,或明确 blocked/failed。

禁止 AGPL / GPL / LGPL / SSPL / BUSL / Commons Clause 进入分发边界。

GPL / AGPL / LGPL / SSPL / BUSL / Commons Clause 类工具可作为独立外部服务、外部进程或授权适配器通过 HTTP / CLI / IPC 调用,但不得静态链接、源码合并或作为内嵌库分发。

取消限制不等于取消工程真实性、专业合规、隐私安全、审计溯源、许可证隔离、合同/支付/电子签章监管边界。这些不是技术选择限制,而是生产系统成立条件。

**CI 执行**: `cargo-deny check` + npm license checker + Python license checker + SBOM 扫描 + Adapter Isolation Registry 检查。新增强能力项目的 PR 必须说明"为什么选它"和"采用何种隔离边界",不能只用许可证理由拒绝。

### GitHub 源码优先接入规则

用户提供的每一个 GitHub 链接都必须先登记到 `docs/ADAPTER_SOURCE_MAP.md`,再进入技术决策或实现。登记不是选择性收藏,而是完整实现义务的入口。需要运行时能力时,首选从上游 GitHub 源码编译为可审计 sidecar/worker/CLI/service;apt、snap、系统包或二进制分发不可用、安装失败、GUI 运行受限,不能作为停止理由,必须进入源码编译、容器化、远程 sidecar 或 licensed adapter 方案。源码编译是首选路径,不是最后兜底。

源码编译必须通过 `06-workers/architoken_workers/source_build.py` 暴露的 `architoken-source-build` CLI 或等价 CI job 执行。CPython 3.13、sse2neon、OpenColorIO、WebGPU runtime smoke、NVIDIA CUDA workstation smoke、Intel oneAPI system smoke、Intel LLVM DPC++/SYCL source toolchain(`https://github.com/intel/llvm.git`)、AMD ROCm/HIP smoke、DirectX 12 smoke、Metal smoke、Vulkan/oneAPI/Level Zero smoke、Triton kernel smoke、Blender、Bonsai、IfcOpenShell、OCCT/OpenCascade 当前版本和兼容版本、LibreDWG、FreeCAD、rhino3dm、OpenNURBS、CGAL(`https://github.com/CGAL/cgal`)、CGAL SWIG、Emscripten/WebIFC、ThatOpen web-ifc-three/viewer、Microsoft IFC、buildingSMART 标准源、Open-Cascade-SAS/CGAL/Speckle/Impertio-Studio 组织级源码同步、ForgeCAD、IFCDB-Agent、Cesium、Speckle .NET SDK、DataDrivenConstruction、louistrue IFC/CAD 和 Trimble/Tekla 授权 SDK 都必须有 manifest、构建命令、安装前缀和 smoke evidence。公共仓库只有示例/技能/文档而没有可编译 CLI 时,必须按真实源码同步记录,不得伪造成二进制构建成功。

Python 不是唯一运行时边界。若 Python 绑定、SWIG、wheel 或包管理路线失败,必须优先保留并接入真实 C++/CLI/Rust/Go/WASM/sidecar 能力,再把绑定失败作为独立问题修复; 不得因为某一种语言绑定失败而否定已经完成的核心源码编译。

GPU 路线遵循 WebGPU 优先、平台原生加速并行的原则。浏览器/交互式视口必须先实现 WebGPU,再按平台启用 CUDA/OptiX、ROCm/HIP、DirectX 12、Metal、Vulkan、Triton 或 CPU SIMD。WebGL 只允许作为明确记录的受审计失败恢复。NVIDIA CUDA 是设计师和开发工程师工作站的一等运行时能力,但不是唯一 GPU 路线。NVIDIA 路线必须优先采用 NGC CUDA / CUDA Deep Learning 签名镜像、NVIDIA Container Toolkit、GPU Operator / device plugin、DCGM、CUDA、OptiX、TensorRT / TensorRT-LLM 和 Triton 等认证 / 支持软件栈;生产 worker 镜像必须锁定 tag 或 digest,并在 k8s 里声明 `nvidia.com/gpu` 资源,不得用 Mesa、CPU-only、WebGL-only 或截图兼容绕过冒充 GPU 渲染。CUDA 证据必须来自真实 `nvidia-smi`、真实 `nvcc` 编译和 CUDA kernel smoke; OptiX / Blender / 图形渲染证据必须来自真实 NVIDIA device 可见的运行时 smoke; ROCm/HIP、DirectX 12、Metal、Vulkan、Triton 和 WebGPU 证据也必须来自对应平台/驱动/运行时的真实 build 或 smoke,不能用版本号、截图或包列表冒充。若当前进程看不到对应设备或平台运行时,必须记录 failed GPU evidence,同时继续推进其它 CPU/C++/Rust/Go/WASM/sidecar 源码编译。

Blender 主线在 Linux 上要求 Python 3.13 时,必须从 `https://github.com/python/cpython.git` 的已验证 tag 源码编译 CPython 3.13,并通过 `ARCHITOKEN_PYTHON313_PREFIX` 接入 Blender CMake; 不得把系统 Python 3.12 当作 Blender main 完成证据。Linux arm64 缺少 sse2neon 包时,必须从 `https://github.com/DLTcollab/sse2neon.git` 源码同步 header,通过 `SSE2NEON_INCLUDE_DIR` 接入 Blender CMake。系统 OpenColorIO CMake target 无效时,必须从 `https://github.com/AcademySoftwareFoundation/OpenColorIO.git` 源码编译 OpenColorIO,通过 `OPENCOLORIO_DIR` 接入 Blender CMake。

`--dry-run`、计划输出、README 扫描、包清单扫描、假设成功、截图或口头声明不得作为源码编译完成证据。完成证据只能来自真实 clone/fetch、真实 build/install、真实 smoke command 和可追溯 evidence JSON。

真实源码编译是默认路径。重型 CMake/Make/NPM/.NET/Emscripten 构建必须默认支持续编和增量构建,不得在正常 CLI 路径里反复清空 build 目录导致多小时构建从零开始。清理 build 目录只能作为显式修复动作,并必须保留失败证据。

真实源码编译失败也必须写入 evidence JSON,记录失败命令、返回码、已完成步骤和下一轮修复依据。失败证据不是完成证据,但禁止用 dry-run、计划或截图覆盖失败证据。

源码编译记录必须包含仓库 URL、commit/tag、构建参数、安装前缀、运行命令、smoke evidence 和许可证隔离方式。GPL/AGPL/LGPL/SSPL/BUSL/商业授权项目默认走外部进程、容器、HTTP 服务、IPC 或 licensed adapter,不得混入分发核心。buildingSMART 组织仓库属于标准/Schema/验证合同源,执行源码同步和校验合同钉住,不得伪装成单一可编译运行时。Trimble/Tekla 只能通过授权源码 URL、许可证确认和 licensed adapter 边界构建,不得假装公开 GitHub 组织页就是可编译 SDK。

当当前上游版本破坏必要适配器时,必须建立独立兼容源码构建,例如 OCCT 8+ 与 IfcOpenShell/FreeCAD API 不兼容时必须同时构建并记录 OCCT 7.9.1。兼容构建不是降低要求,而是保证真实格式能力连续性的生产证据。

禁止用截图、空 Canvas、水印 PDF、外部广告页或模拟结果冒充原生格式支持。真实路线只能是:源文件流、源文件实体级派生、授权适配器、独立 sidecar/service 输出,或明确失败。

---

## 第 5 条 · 版本补丁级钉住

所有生产依赖必须补丁级钉住,禁止 `latest`、随意 `^`、随意 `~`。

**CI 执行**: lockfile 全部提交,构建使用 frozen lockfile。

---

## 第 6 条 · Registry 替代 Enum

所有可扩展对象必须采用 Registry 机制,而不是 enum 固化边界。

适用对象包括:

- 业务模块
- Agent
- Tool
- Model
- Router
- Schema
- Geometry Kernel
- Renderer
- Workflow
- Rule

禁止用 Rust enum、Python Enum、PostgreSQL ENUM 固化业务模块集合。

**CI 执行**: 禁止用业务 enum 表达模块扩展点。模块必须走 `ModuleRegistry` / `modules` 表 / Module Schema。

---

## 第 7 条 · 多 Schema 协同真源

ArchIToken 的接口与数据合同不只依赖 OpenAPI,必须升级为:

```text
OpenAPI + AsyncAPI + JSON Schema + IFC Schema + Module Schema
```

| Schema        | 作用                                               |
| ------------- | -------------------------------------------------- |
| OpenAPI       | REST / HTTP API 合同、SDK 生成、接口文档           |
| AsyncAPI      | 事件流、消息队列、异步任务、实时通知合同           |
| JSON Schema   | Agent 输入输出、配置、结构化结果校验               |
| IFC Schema    | BIM / AEC 模型语义、构件、属性、关系校验           |
| Module Schema | 模块注册、模块输入输出、能力、SLA、权限、UI 元数据 |

PanAEC Engine 对外能力必须通过 OpenAPI、AsyncAPI、JSON Schema 和生成 SDK 暴露,不得只通过前端组件或临时代码调用。PanAEC Engine SDK/API 的最小能力边界包括: BIM/CAD/工程模型导入、PDF/Office 文档导入、音频/视频/图片导入、解压缩/归档清单、代码仓库/源码/Notebook/脚本导入、AI 模型/构件/文档/媒体/代码生成、可编辑几何操作、可编辑属性写回、构件选择与高亮、尺寸/坐标/单位读取、BOM/清单导出、格式派生、异步 worker 任务、受控代码执行、审计事件和审批状态。所有资产 API 必须声明源文件真源、目标格式优先级、OpenUSD/USDZ/3D Tiles 优先策略、glTF/GLB 降级理由、属性 Schema、元素 ID 映射、单位/坐标系、文档页码/媒体时间码/归档路径/代码提交或文件路径和审计 ID。

**CI 执行**: Schema 变更必须有 diff 检查、生成物检查、兼容性检查。

---

## 第 8 条 · 层间依赖单向

架构层级必须单向依赖。底层不得反向依赖上层。

**CI 执行**: cargo workspace 拓扑检查、前端 boundaries lint、Python import linter。

---

## 第 9 条 · 内部统一 Router,OpenRouter 只是外部适配器

ArchIToken 必须有内部统一 Router 架构。

OpenRouter 可以作为外部模型聚合适配器之一,但不能替代内部 ModelRouter / InferenceRouter。

内部 Router 至少包括:

- ModelRouter
- InferenceRouter
- ToolRouter
- WorkflowRouter
- GeometryRouter
- RenderRouter
- StorageRouter

**CI 执行**: 业务模块不得直接绑定某个模型供应商、推理引擎、渲染后端或工具实现。必须通过 Router / Registry。

---

## 第 10 条 · 推理引擎统一协议

所有推理引擎必须通过统一协议接入。优先兼容 OpenAI ChatCompletion 形态,但内部不得把 OpenAI 供应商等同于协议本身。

本地与私有推理必须是一等公民,包括 Ollama、LM Studio、Hugging Face local cache / TGI / endpoint、vLLM、SGLang、TensorRT-LLM、LMDeploy、llama.cpp 等。

OpenAI 公开仓库、`openai/symphony` 和 OpenAI SDK / eval / agent / media 源码可以作为适配器、编排、评测和 worker 的上游输入,但不得让业务模块直接绑定 OpenAI 供应商。`symphony` 只能进入 WorkflowRouter / ToolRouter / Approver / Audit 边界;SDK/API 示例只能进入 ModelRouter / InferenceRouter 适配层;评测与 model spec 只能作为 Evaluator / RuleChecker 输入,不能替代专业规范、审查意见或合规结论。

Hugging Face 数据集和本地 cache 也是数据源适配器,不是自动可用的生产知识库。`opencsg/CIMD` 等 `license:other` 或自定义协议数据集必须先通过 DataRouter / KnowledgeRouter 的许可、来源权利、个人信息、跨境、网络安全、租户隔离和再分发审计。未通过审计前,不得进入生产 RAG、训练、微调、向量库发布、API 服务或商业交付。

**CI 执行**: 所有新推理后端必须通过 compat suite 与 fallback 测试。

---

## 第 11 条 · 生成 SLA 强制

生成类调用必须有 SLA 预算,按能力类型和模块登记,不得硬编码到 enum。

SLA 预算以 `module_id` / `capability_id` 为 key,由 `settings_center` 或配置中心统一管理。

**CI 执行**: `RollbackGuard` / timeout guard / fallback guard 必须覆盖生成链路。每个启用模块必须存在 SLA 配置。

---

## 第 12 条 · AI 不自评: Generator 与 Evaluator 分离

Generator 不能评价自己的输出。

Evaluator 必须是独立 Agent、独立提示词、独立上下文,推荐使用独立模型。

ArchIToken 增强后的工程门禁链为:

```text
Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver
```

工程关键输出必须经过 Evaluator + RuleChecker + SchemaValidator,包括 BIM / IFC、施工图、BOQ、报价、结构计算书、生产制造文件、下料单、施工方案、质量安全报告、数字档案包等。

**CI 执行**: prompt tree 完整性扫描、角色模型差异检查、Schema 校验测试、规则校核测试。

---

## 第 13 条 · LLM 白名单与模型注册表

所有模型必须进入 Model Registry,记录供应商、上下文长度、能力、成本、许可、部署方式、适用模块、禁用条件。

模型列表可演进,但不得散落在业务代码中。

**CI 执行**: 未注册模型不得被调用。

---

## 第 14 条 · AI 缺陷防御必须系统化

幻觉、偏见、越权、隐私泄露、提示注入、工具滥用、Schema 逃逸、规范误用都必须有独立防御机制。

**CI 执行**: security-suite、prompt-injection suite、tool sandbox tests、privacy tests 定期运行。

---

## 第 15 条 · GPU 优先、WebGPU 优先的跨平台图形与计算路线

ArchIToken 可以使用 Next.js 16.2.6 + React 19.2.5 + TypeScript 6.0.3 + WASM + WebGPU + Three.js r184。

原则是:

```text
Next.js + React + TypeScript = 应用工程基座
GPU-first = 默认执行策略
WebGPU + WASM = 浏览器高性能计算与渲染核心
PanAEC Engine = ArchIToken 自研 BIM/CAD/PDF/Office/音频/视频/图片/解压缩/代码编程资产智能、几何、属性、资产派生与 SDK/API 调用引擎
OpenUSD/USDZ = AI 生成、可编辑几何、可编辑属性、BOM、工程场景与数字孪生资产主派生/交换路线
3D Tiles = 超大场景、城市/园区、点云、倾斜摄影与分块 LOD 主流式路线
glTF / GLB = OpenUSD/USDZ/3D Tiles 不可用时的 Web 运行时、交付兜底与私有格式最后补充兜底
OBJ / FBX = 废弃兼容输入,不得作为新主链路
CUDA / OptiX / TensorRT / ROCm / DirectX 12 / Metal / Vulkan / Triton = 平台原生 GPU 加速路线
Three.js = WebGPU 承载层 / 生态层 / 受审计失败恢复层
WebGL = 受审计失败恢复,非默认核心
CPU = 有证据的失败恢复,非默认热路径
```

WebGPU 是 CAD/BIM/IFC/STEP/STL/IGES/3DM/SKP/PDF 图形层、数字孪生、图片/视频 AI 编辑和在线工程编辑的默认交互式渲染与浏览器计算路线。Three.js 可以作为 WebGPU renderer、场景组织、loader 生态和受审计 fallback 承载层,但禁止把 Three.js/WebGL 当作唯一渲染路线,也禁止为了“纯 WebGPU”放弃成熟工程框架。

浏览器客户端、设计师工作站、演示环境、私有化部署镜像和受管终端必须启用 WebGPU 与 WebGL 硬件加速能力。WebGPU 是首选路径; WebGL 只作为 WebGPU 不可用、第三方遗留组件或缩略图/失败恢复时的受审计硬件加速 fallback。任何 profile、启动参数、容器策略、远程桌面策略或安全基线不得默认设置 `dom.webgpu.enabled=false`、`webgl.disabled=true`、禁用硬件加速或禁用 GPU 进程。确因驱动、浏览器、沙箱、远程会话或合规策略无法启用时,必须写入 failed/unsupported GPU evidence,并在 UI 中明确降级原因;不得静默退回 CPU、空 Canvas、截图或伪渲染。

PanAEC Engine 是 ArchIToken 自研 BIM、CAD、PDF、Office、音频、视频、图片、解压缩/归档、代码编程资产智能、几何、文档、媒体、属性、资产派生和 SDK/API 调用引擎。PanAEC Engine 不是单一 viewer,其能力边界必须覆盖 AI 生成、在线几何编辑、属性编辑、构件选择/高亮、尺寸量测、坐标/单位处理、文档解析、媒体解析、归档安全解压、代码解析/生成/测试/受控执行、BOM/清单导出、worker 派生、审计、审批和外部 SDK/API 调用。

工程模型和数字孪生派生格式的优先级为 OpenUSD/USDZ/3D Tiles -> glTF/GLB。OpenUSD/USDZ 承担 AI 生成结果、长期资产组合、层级、变体、引用、材质、属性、BOM 绑定和跨工具交换; 3D Tiles 承担超大场景、园区、城市、点云、倾斜摄影和分块 LOD 主流式交付; glTF/GLB 只有在 OpenUSD/USDZ/3D Tiles 不可用并写入审计理由时,才承担浏览器交互运行时和交付兜底。对 SKP 等私有模型,GLB 可以作为真实 SKP 转 GLB 命令、授权适配器或显式同源绑定后的最后查看兜底,但必须保留原源文件为 source of record,不得把 GLB 说成原生格式解析成功。OBJ/FBX 不得作为新功能默认 viewer、默认 export、默认 worker artifact 或长期资产标准。

GPU-first 是默认执行策略。只要目标设备、浏览器、驱动、运行时或集群节点具备可用 GPU,以下能力必须优先选择 GPU 路线: CAD/BIM/数字孪生视口、点云/mesh/IFC/STEP/STL/IGES/3DM/SKP 几何处理、PDF/Office 图形层编辑、图片/视频 AI 生成与在线编辑、模型推理、向量/矩阵/栅格/几何 kernel、渲染、转码和批量派生。CPU-only、WebGL-only 或纯前端 Canvas 路线只能作为明确记录的受审计 fallback、无 GPU 环境的离线模式、缩略图生成或失败恢复路径,不得成为生产默认热路径。

平台 GPU 路线必须覆盖:

- NVIDIA: NGC CUDA / CUDA Deep Learning 镜像、NVIDIA Container Toolkit、GPU Operator / device plugin、DCGM、CUDA、OptiX、TensorRT、TensorRT-LLM、Triton、WebGPU/Vulkan。
- AMD: ROCm/HIP、Vulkan、WebGPU。
- Intel: oneAPI/Level Zero、Vulkan、WebGPU。
- Apple: Metal、WebGPU、Apple Silicon ARM64。
- Windows: DirectX 12、WebGPU、CUDA/ROCm/oneAPI 按硬件启用。
- Linux: Vulkan、WebGPU、CUDA/ROCm/oneAPI。
- macOS/iOS: Metal、WebGPU。
- Android: Vulkan、WebGPU。
- CPU failed-recovery: ARM64/x86_64 SIMD、WASM、Rust/C++ worker。

任何平台专属 GPU 能力必须在真实目标平台或 CI runner 上产生 build/smoke evidence。Linux 机器不得伪造 DirectX 12、Metal、iOS 或 Windows GPU evidence; Windows/macOS/iOS/Android 节点必须通过同一 Adapter Registry 和 evidence JSON 汇总。NVIDIA 节点必须通过 `nvidia-smi`、`nvcc` CUDA kernel smoke、容器内 `/dev/nvidia*` 可见性、GPU Operator / device plugin 状态和渲染/推理 runtime smoke 形成证据。缺少 GPU、驱动、设备节点、平台 SDK 或浏览器 WebGPU capability 时,必须写入 failed/unsupported evidence,再回退 CPU/WASM/sidecar; 禁止静默降级。

**CI 执行**: BIM / CAD / 数字孪生 / 图像 / 视频 / 在线编辑 / AI kernel 核心路线必须说明 GPU-first 决策、WebGPU 优先策略、WebGPU/WebGL 硬件加速启用状态、平台 GPU 后端、NVIDIA 认证 / 支持栈证据、CPU/WebGL fallback 条件和真实 smoke evidence。没有 GPU evidence 的 PR 不得声称“GPU 加速完成”。新增浏览器 profile、启动脚本、容器镜像、远程桌面或安全策略时,不得默认禁用 WebGPU、WebGL、硬件加速或 GPU 进程。

---

## 第 16 条 · 数据库是能力组合,不是单一产品信仰

ArchIToken 数据体系必须覆盖:

- 结构化数据
- 非结构化数据
- 向量数据
- 时序数据
- 图关系数据
- 文件与对象存储
- 缓存与任务状态
- 审计与版本历史
- 多租户权限隔离

Zedis 是核心缓存、状态与任务队列优先项,但系统仍需要 PostgreSQL / 对象存储 / 向量检索 / 时序能力 / 审计日志等组合能力。

**CI 执行**: 数据模型变更必须说明数据类型、存储层、索引策略、备份策略、迁移策略。

---

## 第 17 条 · 多租户强制隔离

甲方、设计、施工、监理、供应商、工厂、运维等数据必须逻辑隔离,关键场景支持物理隔离。

**CI 执行**: PostgreSQL RLS / tenant_id / audit log / permission tests 必须覆盖租户域。

---

## 第 18 条 · 部署基线: k8s + Docker + 本地私有化

ArchIToken 必须支持 Kubernetes 正式部署、Docker 标准化交付、Docker Compose 本地开发、本地私有化部署、GPU 节点调度、离线或弱网环境部署。

K3s 可作为极端资源受限环境可选适配,但不是正式部署基线。

**CI 执行**: 镜像构建、Helm/Kustomize、k8s manifest、健康检查、可观测、回滚测试必须通过。

---

## 第 19 条 · 文档即环境,仓库文档是唯一真源

ArchIToken 的工程治理以 GitHub 仓库文档为唯一真源。聊天上下文、临时讨论、图片、口头说明只能作为输入,不能替代仓库文档。

核心原则入口为:

- `ARCHITOKEN-SOURCE-OF-TRUTH.md`
- `CONSTITUTION.md`
- `POSITIONING_AND_COMPETITIVE_STRATEGY.md`
- `PROFESSIONAL_STANDARDS_COMPLIANCE.md`
- `MODULES.md`
- `MODULE-REGISTRY.md`
- `ARCHITECTURE.md`
- `PRD.md`

**CI 执行**: 关键文档大小、链接、术语一致性、Schema 引用必须 lint。

---

## 第 20 条 · 模块必须全面定义输入、输出、规则、Schema 与审计

每个模块必须定义:

- 输入
- 输出
- 子域能力
- 数据表
- 文件类型
- Agent 角色
- 工具调用
- 规则约束
- Schema
- SLA
- 权限
- 审计
- 可视化
- 与上下游模块关系

标准族库必须包括标准规范、族库构件、样板文件、材质库、图纸、模型、做法库、规则库、版本库。

材料物流必须包括材料库存、价格、供应商、采购、下料单、加工 BOM、包装、装车、物流、到货、现场堆放、签收、批次追踪。

生产制造模块 id 为 `production_manufacturing`,中文名为“生产制造”。

施工管理必须包括方案、进度、质量、安全、日志、AR、360 全景、三维扫描、倾斜摄影、无人机巡检、建筑机器人、IoT、整改闭环、竣工资料等。

**CI 执行**: Module Schema 校验必须阻止缺字段模块进入主干。

---

## 第 21 条 · 专业资格、监管体系、国家标准、行业标准和技术规程优先

ArchIToken 的整个平台、每个模块、每个名词、每个业务逻辑和每个 AI 输出,必须符合对应专业资格、监管体系、执业责任和授权边界。基础覆盖 IPMP / IPMA、一级注册建筑师、一级注册结构工程师、一级注册建造师、注册造价工程师、注册监理工程师,并扩展到生产制造、运输物流、海关贸易、税务、金融、财务会计、人力资源、组织治理、AI、数据安全、网络安全和软件工程。

系统必须服从对应国家标准、行业标准、地方标准、国外标准体系、技术规程、监管规则、强制性条文、项目合同、组织制度和企业内控。系统不得把 AI 草稿、RAG 检索、经验规则、外部 skill 输出或未签章结果包装成专业结论、报审成果、可施工依据、结算依据、税务结论、清关结论、金融合规结论、财务审计结论或监理验收结论。

任何专业输出必须至少携带:

- 专业角色。
- 适用法域。
- 标准/规范/规程/监管来源。
- 条文或规则引用。
- 证据链。
- AI 输出状态。
- 人工复核或审批要求。
- 审计记录。

详细治理基线见 [`PROFESSIONAL_STANDARDS_COMPLIANCE.md`](./PROFESSIONAL_STANDARDS_COMPLIANCE.md)。

**CI 执行**: 术语、规则、Schema、Prompt、报告模板和模块输出不得缺少专业角色、监管/标准来源、证据要求和审批状态。来源缺失时只能输出“经验建议”,不能输出“合规/不合规/可施工/可报审/可验收/可申报/可清关/可入账/可支付/可发布”。

---

## 第 22 条 · AIA 是骑手不是执行者

AIA 定方向、定边界、定验收; 系统自己找路。

ArchIToken 的目标是让一个人也能驾驭工业级 AI + AEC 系统,而不是让一个人陷入无穷执行细节。

**CI 执行**: 设计评审必须回答: 这个改动是否减少 AIA 的人工执行负担,是否增强系统自运行能力。

---

## 修正程序

宪法修正需:

1. 在 `02-architecture/` 或 `docs/amendments/` 提交 RFC Markdown。
2. 明确影响范围: 代码、Schema、CI、部署、文档、迁移。
3. 更新 `ARCHITOKEN-SOURCE-OF-TRUTH.md`。
4. 同步更新相关 CI 规则。
5. 记录在 `CONSTITUTION_HISTORY.md` 或 CHANGELOG。

---

**版本**: ArchIToken Constitution · 22 条 · v2.3 · 由 ArchIToken v2.0 宪法演进而来。
