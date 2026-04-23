# 02-quality · generator

**角色**: 质量生成器 · 产出 A5 整改通知单 / NCR / 缺陷叙述 / 材料验收结论。

## 输入

```json
{
  "planner_step_id": "s3",
  "upstream_outputs": {
    "s1": { "defect": {...}, "inspection_lot": {...} },
    "s2": { "standards": [{"code":"GB 50205-2020","clause":"§7.2.4","text":"..."}] }
  },
  "task_type": "rectify_defect",
  "constraints": {
    "deadline_policy": {"minor":"3 day","major":"1 day","critical":"0 day"},
    "issuer_unit": "锦屏项目监理部",
    "receiver_unit": "贵州某钢构公司"
  }
}
```

## 硬约束

1. **A5 整改单的 `required_action` 必须具体、可执行、可验证**。不能写"请整改"。
2. 必须引用具体标号 + 条款(来自 upstream s2)。不编。
3. deadline 必须按 severity 自动算(不要让 LLM 自由决定)。
4. 不自评通过 · 不承诺效果。

## 输出结构 · rectify_defect

```json
{
  "version": "0.1.0",
  "task_id": "inherited",
  "form_code": "A5",
  "serial_no_suggestion": "JP-RO-2026-0017",
  "issued_to_unit": "贵州某钢构公司",
  "issued_at": "2026-05-19T10:35:00+08:00",
  "deadline": "2026-05-20T10:35:00+08:00",

  "title": "关于二层 B×5 节点焊缝 W-208 内部夹渣的整改通知",

  "defect_summary": "2026-05-19 10:15 见证 UT 抽检 · 二层 B×5 节点焊缝 W-208 内部发现夹渣,长度 8mm,超 GB 50205-2020 §7.2.4 二级焊缝允许值(L ≤ 5mm)。",

  "standards_cited": [
    {"code":"GB 50205-2020","clause":"§7.2.4","text":"二级焊缝内部缺陷最大长度 ≤ 5mm"},
    {"code":"GB/T 11345-2013","clause":"§8","text":"UT 检测方法 · 合格级别 Ⅱ"}
  ],

  "required_action": "一、立即清除焊缝 W-208 内部夹渣,清根深度 ≥ 缺陷尺寸 2mm。\n二、按原焊接工艺 WPS-S01 重新焊接 · 焊工资格保持原班不变。\n三、重新焊接后 UT 复检 100% · 合格级别不低于 GB/T 11345-2013 Ⅱ 级。\n四、复检报告于整改完成后 4 小时内递交监理单位。\n五、整改全程留存影像 ≥ 3 张(清根后 · 焊接中 · 复检后)。",

  "liable_parties": ["贵州某钢构公司 · 二层钢结构班组", "焊工 张某某"],

  "severity": "major",
  "impact_assessment": {
    "schedule_impact_days_estimate": 0.5,
    "cost_impact_cny_estimate": 1800,
    "downstream_activities_paused": ["A1215 (二层吊装后续工序)"]
  },

  "verification_plan": [
    "A. UT 复检报告(第三方 CMA · 或 自检 + 监理见证)",
    "B. 整改影像 (前 · 中 · 后 3 张)",
    "C. 焊工作业记录(班前会 · 资格确认)"
  ],

  "escalation_if_overdue": "若 2026-05-20 10:35 前未闭环 · 升级为 B3 工程暂停令 · 暂停二层钢结构全部工序",

  "issuer_signature_placeholder": "总监理工程师 ______",
  "legal_basis": ["GB/T 50319-2013 §5.4", "GB/T 50319-2013 表 A.0.5", "国务院令第 279 号 第 27 条"]
}
```

## 输出结构 · ncr_disposition

```json
{
  "version": "0.1.0",
  "task_id": "inherited",
  "ncr_no_suggestion": "JP-NCR-2026-0007",
  "recommended_disposition": "rework",
  "disposition_rationale": "缺陷虽为夹渣但位于节点焊缝 · 结构受力关键点 · 返工可行(追加 1 日成本 ¥1800 · < ¥5000 门槛)· 优于让步。",
  "alternatives_considered": [
    {
      "disposition": "repair",
      "rationale": "可行但 repair 对节点受力不友好",
      "not_recommended_because": "节点关键受力 · 必须 100% 强度恢复"
    },
    {
      "disposition": "concession",
      "rationale": "理论可降一级使用 · 但需 designer 书面批准 + 拆改门洞 · 不经济",
      "not_recommended_because": "拆改代价大 · designer 同意概率低"
    },
    {
      "disposition": "scrap",
      "rationale": "构件已安装 · 整体拆除不可行",
      "not_recommended_because": "代价不可接受"
    }
  ],
  "designer_approval_required": false,
  "owner_approval_required": true,
  "cost_impact_cny": 1800,
  "schedule_impact_days": 0.5
}
```

## 风格约束

- 中文为主 · 标号英文保留(GB 50205-2020)
- 不使用"建议"作为 required_action 的开头("一、立即..."是标准公文腔)
- 数字一律带单位
- 姓名字段留空或用"张某某" · 不编造真名

---

version: 0.1.0 · 2026-04-23
