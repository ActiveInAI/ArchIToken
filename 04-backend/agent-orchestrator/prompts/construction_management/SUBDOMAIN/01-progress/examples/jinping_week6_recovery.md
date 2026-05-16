# Example · 锦屏应舍美居 · 第 6 周纠偏

**场景**: 2026-06-11 周四 16:30 · 项目进入第 6 周(剩 4 天到合同竣工日 2026-06-14)。
下午监理巡视后 · supervisor 打开进度看板 · SPI = 0.84 · 预测工期再延 3 日。

---

## 1. 背景

- 项目: 锦屏应舍美居 · 520 ㎡ 三层重钢别墅 · 合同 45 日 · ¥680,000
- 当前进度: 整体 88% · 主体结构 100% · 围护 95% · 装饰 78% · 机电 65%
- 合同竣工日: 2026-06-14(本周六) · 违约金 ¥2,000/日
- 上周发生: 连续 2 日雷暴(5/30, 5/31)暂停外部作业

## 2. 触发器

Supervisor 在 `<EVMDashboard />` 看到:
- SPI = 0.84 (警戒线 0.95 以下持续 3 日)
- 前 3 延期工序:
  1. `A2310` 外墙纤维水泥板 · 延 2 日
  2. `A2415` 机电管线综合 · 延 3 日
  3. `A2520` 地面瓷砖铺贴 · 延 1.5 日

点击 `<RecoveryWizard />` · 前端 POST `/v1/csr/progress/recovery/analyze` · SSE 流式接收。

## 3. LangGraph 执行记录

### 3.1 Planner 输出

```json
{
  "version": "0.1.0",
  "task_id": "recovery-2026-06-11-jp",
  "task_type": "recovery_analysis",
  "rationale": "SPI 持续低位 3 日 · 距合同 4 日 · 必须立即分析根因并给出多方案。",
  "expected_sla_s": 240,
  "steps": [
    {"id":"s1","tool":"sql_query","params":{"template":"last_14_snapshots","project_id":"..."}},
    {"id":"s2","tool":"sql_query","params":{"template":"top_delays","project_id":"...","limit":10}},
    {"id":"s3","tool":"sql_query","params":{"template":"daily_weather_14d","project_id":"..."}},
    {"id":"s4","tool":"sql_query","params":{"template":"quality_events_14d","project_id":"..."}},
    {"id":"s5","tool":"llm_generate","prompt_ref":"SUBDOMAIN/01-progress/prompts/delay_root_cause_analyzer.md","depends_on":["s1","s2","s3","s4"]},
    {"id":"s6","tool":"llm_generate","prompt_ref":"SUBDOMAIN/01-progress/prompts/generator.md","depends_on":["s5"]},
    {"id":"s7","tool":"llm_generate","prompt_ref":"SUBDOMAIN/01-progress/prompts/evaluator.md","depends_on":["s6"]}
  ]
}
```

### 3.2 Root Cause Analyzer 输出 (摘要)

```json
{
  "spi_trend": {"latest":0.84,"avg_14d":0.88,"worst":0.82,"worst_date":"2026-06-08"},
  "root_causes": [
    {
      "rank":1,"category":"weather","affected_activities":["A2310"],
      "contribution_days":1.5,"confidence":0.92,
      "narrative":"5/30-5/31 雷暴停工 1.5 日 · 外墙板作业延后 · 波及下游机电走线"
    },
    {
      "rank":2,"category":"material_delay","affected_activities":["A2415"],
      "contribution_days":2.0,"confidence":0.88,
      "evidence_refs":[{"source":"material_logistics.shipments","id":"SHP-0421"}],
      "narrative":"机电桥架批次 SHP-0421 预计 6/3 到场 · 实际 6/5 · 延误 2 日"
    },
    {
      "rank":3,"category":"quality_rework","affected_activities":["A2520"],
      "contribution_days":0.8,"confidence":0.75,
      "narrative":"地面瓷砖空鼓返工 · 08-acceptance 隐蔽验收发现 · 延 0.8 日"
    }
  ],
  "residual_unexplained_days":0.2,
  "confidence_overall":0.88
}
```

### 3.3 Generator 输出 · 3 个纠偏选项

**opt_1 · 局部赶工** (¥16,500 · 回收 3 日 · 中风险)
- 外墙板 + 机电 双班倒
- 瓷砖返工班组追加 2 人

**opt_2 · 工期顺延申请** (¥0 · 回收 0 日 · 低风险)
- 基于雷暴天气 · 申请 1.5 日工期顺延 (FIDIC §8.5 / 合同第 15 条)
- 天气佐证: 04-daily_log 的 weather_14d 记录

**opt_3 · 结构调整 · 简化装饰** (¥-5,000 · 回收 2 日 · 中风险)
- 二楼次卧瓷砖改瓷砖墙纸(甲方此前口头接受过)
- 需走 12-change_order 变更流程

**推荐**: opt_1 + opt_2 组合 · 物理赶工 3 日 + 工期顺延 1.5 日 · 合计覆盖所有延误且留 0.5 日缓冲。

### 3.4 Evaluator 结论

```json
{
  "evaluator_verdict": "pass_with_flags",
  "overall_score": 0.88,
  "checks": [
    {"check_id":"references_valid","result":"pass"},
    {"check_id":"numeric_consistency","result":"pass"},
    {"check_id":"option_feasibility","result":"pass_with_flags",
      "details":"opt_3 的甲方口头接受无书面证据 · 建议先取得书面确认"},
    {"check_id":"contract_boundary","result":"pass"},
    {"check_id":"impact_chain","result":"pass",
      "details":"opt_2 follow_up_task 已指向 12-change_order · 正确"}
  ],
  "final_note": "pass_with_flags · 供监理签发。opt_3 执行前必须补书面甲方确认。"
}
```

## 4. 落地动作(监理工程师签发后 30 分钟内)

1. `csr.schedules` · 新建 version_no=2 · is_baseline=FALSE · name="v2 · 第 6 周赶工方案"
2. `csr.activities` · `A2310` 双班 · `A2415` 双班 · `A2520` 追加工人
3. `csr.engineering_changes` · 新建"工期顺延 1.5 日"变更单 · 走 12-change_order
4. `csr.supervision_logs` · 当日日志自动追加本次纠偏决策
5. 通知甲方: 前端推送 + 监理例会 (6/12 早 8:00)

## 5. 观察结果 (本场景假想)

- 6/14 实际竣工: **按期** (靠 opt_1 物理赶工 + opt_2 顺延 1.5 日)
- 违约金: ¥0 (顺延批复 · 合同不触发 LD)
- 额外成本: ¥16,500 (< 预算 ¥30,000 · 可接受)
- SPI 在 6/12 回升到 0.94 · 6/13 到 0.98

---

version: 0.1.0 · 2026-04-23
