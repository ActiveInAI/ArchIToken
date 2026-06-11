# ArchIToken Open CDE Workbench 静态原型

## 文件

- `index.html`: 完整自包含静态页面,包含 HTML、CSS、JavaScript 和 16 模块演示数据。

## 打开方式

直接用浏览器打开 `index.html`。

如果在 `03-frontend` 启动 Next.js dev server,也可以访问:

```text
/prototypes/architoken-open-cde-workbench-static/index.html
```

## 前端拆分建议

- 左侧模块导航可拆为 `ModuleRegistrySidebar`。
- 顶部栏可拆为 `WorkbenchTopbar`。
- CDE 文件列表可拆为 `ModuleFileSurface`。
- 可视化与 AI 门禁链可拆为 `AgentGateAndEvidencePanel`。
- 右侧抽屉可拆为 `AuditLifecycleInspector`。

## 约束

- 默认主题保持 `wechat_light` 白/灰/绿工作台风格。
- 16 个模块使用 registry 数据驱动,不要改成硬编码 enum。
- `digital_twin` 仍在统一 `/app/modules/digital_twin` 工作台内,不要拆成独立大屏入口。
- AI 输出保持 `professional_review_required`;缺少标准来源时只能显示经验建议。
