# 10-bim_integration · TODO

---

## 1. 设计待决策

- [ ] **IFCX 支持时机**: IFC5 / IFCX 2025 发布 · 何时作为主版本?
  建议:2026 Q4 观察 · 2027 H1 迁移 · 本 Phase IFC4.3 主。
- [ ] **CDE 多层 ACL**: Shared 的读权限 · 五方各自?
  建议:OPA Rego 策略 · settings_center 里 bim_cde_acl 配。
- [ ] **BCF 3.0 导入导出**: 是否作为默认?
  建议:Stage 5+ 实现 · 当前只内部用 clash_reports 表。

## 2. 技术待实现

- [ ] clash_detect_engine Rust 实现 · 基于 ifc-lite-geometry
- [ ] 分块 glTF 生成 · 大模型预处理管线
- [ ] IFC Property 回写 · 写 IFC 文件而不是镜像(复杂)
- [ ] Navisworks CSV 导入路径

## 3. 数据

- [ ] IFC 元素 · 自动分类到 WBS 的规则库(IfcBeam + storey + axis → WBS code)
- [ ] 专业学科映射(IfcBeam/Column → structural · IfcPipe → mep 等)

## 4. 测试

- [ ] 1 GB IFC · 解析性能 · 浏览器加载时间 < 10s
- [ ] 大模型碰撞检测 · 10000+ elements · < 60s
- [ ] LLM triage 回归 · 10 组真实 clash 数据

---

version: 0.1.0 · 2026-04-23
