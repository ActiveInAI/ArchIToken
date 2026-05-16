# 12-change_order · generator

---

## 硬约束

1. 金额 / 天数 必须具体
2. 不编合同条款 · 来自 contract_clauses 查询
3. RFC 不代设计(只出骨架)· 具体图纸由设计单位补

## 输出 · rfc_draft

```json
{
  "version":"0.1.0",
  "rfc_no_suggestion":"JP-RFC-2026-0019",
  "title":"外墙色差修补 · 同色号重涂",
  "initiator":"supervisor",
  "reason_category":"design_improvement",
  "description":"竣工验收发现外墙 6 处色差 · 原涂料批次差异导致 · 建议用同色号重涂修正",
  "affected_sub_parts":["建筑装饰装修"],
  "affected_boq_items":["<boq 外墙涂装>"],
  "impact_cost_cny_estimate":4500,
  "impact_schedule_days_estimate":2,
  "suggested_signatories":["contractor 项目经理","supervisor 总监","owner"],
  "required_attachments":["色差部位照片","新涂料合格证","施工方案(简)"]
}
```

## 输出 · claim_assess

```json
{
  "version":"0.1.0",
  "claim_no":"JP-CLM-2026-0002",
  "within_notice_period":true,
  "supervisor_recommendation":{
    "verdict":"partial_granted",
    "granted_days":1.5,
    "granted_amount_cny":0,
    "reasoning":"气象局 5/30-31 暴雨红色预警属实 · 符合合同第 15 条不可抗力 · 顺延 1.5 日。金额无明显损失 · 不建议赔偿。",
    "legal_basis":"合同第 15 条 · FIDIC §8.5"
  },
  "risk_if_rejected":"施工方可能仲裁 · 气象证据强 · 胜诉概率 > 80%",
  "recommended_owner_action":"approve partial_granted · 签发 time_extension 签证"
}
```

## 输出 · certification_issue

```json
{
  "version":"0.1.0",
  "cert_no_suggestion":"JP-CRT-2026-0028",
  "cert_type":"time_extension",
  "scope":"合同工期顺延 1.5 日",
  "description":"基于索赔 JP-CLM-2026-0002 · 暴雨停工 1.5 日 · 气象局证明 · 合同第 15 条不可抗力",
  "amount_cny":0,
  "days":1.5,
  "required_signatories":["owner","contractor","supervisor"],
  "attachments_required":["气象局暴雨证明","04-daily_log 5/30-31 天气记录","03-safety 停工记录"]
}
```

---

version: 0.1.0 · 2026-04-23
