# ArchIToken 设计规范 · 基于行业权威标准

> 本规范不采用任何自创规则，全部锚定可引用的行业权威标准。
> 任何 UI 与本规范冲突即为缺陷，须改。

## 一、采用的权威标准（Authority）

| 领域 | 标准 | 制定方 | 用途 |
|---|---|---|---|
| 设计令牌 / 视觉系统 | **Ant Design 5**（Design Token：seed/map/alias） | 蚂蚁集团 | 间距、字阶、色板、圆角、阴影、动效、控件尺寸的真实数值基座 |
| 无障碍 | **WCAG 2.1 AA** | W3C | 对比度、焦点可见、键盘可达 |
| 动效 / 层级补充 | **Material Design 3** | Google | elevation 与 motion 曲线参考 |

选择 Ant Design 5 的理由：它是中文企业级（ERP/AEC）软件的事实标准，令牌体系完整、数值公开可引用，与本产品形态最契合。

## 二、令牌基座（已落地 `app/globals.css`）

### 色彩（Ant Design 5）
- 文本：`colorText` rgba(0,0,0,.88) / `colorTextSecondary` .65 / `colorTextTertiary` .45
- 表面：`colorBgContainer` #ffffff / `colorBgLayout` #f5f5f5 / 次面 #fafafa
- 描边：`colorBorder` #d9d9d9 / `colorBorderSecondary` #f0f0f0
- 主色：`colorPrimary` #1677ff；功能色 success #52c41a / warning #faad14 / error #ff4d4f
- 模块强调色取自 Ant 预设色板（daybreak/dust red/gold/polar green/golden purple/cyan/sunset orange）
- → CSS 变量：`--arch-surface / --arch-text / --arch-text-muted / --arch-border / --arch-primary / --arch-success / --arch-warning / --arch-danger / --module-accent`

### 间距（Ant sizeStep=4）
`--ant-space-xxs:4 / xs:8 / sm:12 / md:16 / lg:24 / xl:32 / xxl:48`

### 字阶（Ant fontSize=14 基准，1.5714 行高）
正文 14px；`--ant-font-size-sm:12 / lg:16 / xl:20`；标题 H5:16 H4:20 H3:24 H2:30 H1:38

### 圆角（Ant borderRadius=6）
`--ant-radius-xs:2 / sm:4 / 基准:6 / lg:8`

### 阴影（Ant boxShadow 三层）
`--ant-shadow-tertiary`（卡片）/ `--ant-shadow`（浮层）/ `--ant-shadow-secondary`

### 动效（Ant motionDuration）
fast .1s / mid .2s / slow .3s；缓动 `--ant-ease-in-out` cubic-bezier(.645,.045,.355,1)

### 控件高度（Ant controlHeight=32）
sm:24 / 基准:32 / lg:40

## 三、强制条款（可审计）

1. **零写死颜色**——只用上述令牌变量。出现 `#xxxxxx` / `rgb(...)` 硬编码即为缺陷（Ant Design 强约束）。
2. **颜色承载语义**（Ant 功能色语义）——正常/成功默认中性，仅 warning/error/主操作着色。
3. **对比度 ≥ WCAG 2.1 AA**——正文 ≥4.5:1，大字/UI 元素 ≥3:1。
4. **焦点可见**（WCAG 2.4.7）——`:focus-visible` 统一 2px 焦点环。
5. **8px 栅格间距**（Ant sizeStep=4）——所有 padding/margin/gap 取 `--ant-space-*`。
6. **字阶层级**（Ant 字号 token）——标题/正文/辅助严格分级，不自定字号。
7. **圆角统一**（Ant borderRadius）——卡片 lg(8)、控件基准(6)、徽标 sm(4)。
8. **阴影分层**（Ant elevation）——卡片 tertiary、浮层/弹窗 secondary。
9. **动效统一**（Ant motion）——交互过渡 mid(.2s)+ease-in-out，尊重 prefers-reduced-motion。

## 四、AI-NATIVE / HARNESS / OpenBIM（产品架构原则，来自本产品理念）

> 视觉用 Ant Design 5；产品交互范式遵循下列三理念（这是 ArchIToken 的差异化）。

- **AI-NATIVE**：AI 是主界面。人表达意图 → AI 编排 harness → 人审阅平静结果。AI 入口贯穿，而非藏于"AI中心"。
- **HARNESS 可见即信任**：产物显示来源链（Planner→Generator→Evaluator→RuleChecker→SchemaValidator→Approver）、证据、门控状态，以时间线/徽章优雅呈现。
- **OpenBIM 主轴**：数据从 IFC / SJG 157-2024 语义字典连续流出，全程血缘可追溯。

## 五、落地序列

1. ✅ 令牌基座对齐 Ant Design 5 + WCAG AA（色彩/间距/字阶/圆角/阴影/动效/焦点）
2. ⏳ 各模块组件改用 `--ant-*` 间距/字阶/圆角/阴影令牌（消除写死值）
3. ⏳ AI-NATIVE 外壳：意图/对话/harness 时间线提升为一等界面
4. ✅ OpenBIM 血缘可视化贯穿全链（`OpenBimLineageSpine`：IFC 源 → SJG157 语义 → BOM 九阶段派生链 → 造价清单 → 采购/制造/发运/安装/归档，含阶段门控就绪行，计数取自真实端点 `bom/chain-summary` + `quantity-costing/overview`，挂载于三大 BOM 模块的 `BomChainPanel`）
