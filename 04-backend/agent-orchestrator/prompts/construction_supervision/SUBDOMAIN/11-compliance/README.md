# SUBDOMAIN · 11-compliance · 合规审查

## 定位
强条库 + 报建审批 + 消防 / 人防 / 节能 / 防雷 / 环保 多项专项验收 + 归档合规对接 digital_archive。
合规是"守门员" · 不合规即不能进下一阶段。

## 核心实体
- `mandatory_clause` · 强条库 (GB / JGJ 强制条文合集)
- `compliance_check` · 合规检查记录 (一次条款-主体的绑定评估)
- `permit_approval` · 报建审批 (施工许可 / 质监 / 安监 / 消防等)
- `archive_package` · 归档包 (对接 digital_archive 模块)

## 主要标准
- GB 50300-2013 (质量强条入口)
- GB 50411-2019 节能强条
- GB 50057-2010 防雷强条
- GB/T 50328-2019 文件归档规范
- 工程建设标准强制性条文汇编 (住建部)
- 建质〔2017〕214 号 工程质量安全手册
- 国务院令第 279 号 建设工程质量管理条例

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 按项目类型(锦屏 = 乡村自建 + 重钢)拉取适用强条集
- [ ] `generator.md` · 生成: 合规自检报告 · 报建清单 · 归档目录
- [ ] `evaluator.md` · 评估: 强条覆盖率 · 审批链完整性
- [ ] `SCHEMA.sql` · mandatory_clauses / compliance_checks / permit_approvals / archive_packages
- [ ] `CHECKS.md` · 任何验收结论必引强条 · 归档包结构符合 GB/T 50328

## 不变量
- 违反强条的条款 · `verdict = violated` 即阻断继续施工(CI 层强制拦截)
- 消防 / 人防 / 防雷 三项未通过 · 竣工验收必失败
- 归档包 · 文件清单 100% 列齐 + 格式 (PDF/A-3) 符合 GB/T 50328-2019

## 现状
Stage 1 骨架占位 · 强条库灌数据留 Phase 4 (SQL seed) · prompt 留 Stage 2。

---

version: 0.1.0 · 2026-04-23
