# 04-daily_log · daily_summary_generator

**角色**: 全天监理活动自动汇总器 · 子域特定工具。
**触发**: 每日 17:30 Scheduler 自动 · 或手动"立即汇总"。
**输出**: `supervision_log.body` (Markdown) + `summary_auto` + `key_events[]`。

## 输入

```json
{
  "project_id":"uuid",
  "log_date":"2026-05-19",
  "weather":{"am":{"weather":"晴","temp_c":19,"wind":"3 级"},"pm":{"weather":"多云","temp_c":25,"wind":"3 级"}},
  "patrols":[ { "id":"...","start_at":"08:30","end_at":"09:00","focus_items":["焊缝","临边"],"findings_summary":"无异常" } ],
  "monitoring_posts":[ {"id":"...","activity_id":"A1210","start":"07:00","end":"09:30","findings":"无异常"} ],
  "parallel_inspections":[ {"scope":"W-208 UT","verdict":"fail","sample_size":3,"pass_count":2} ],
  "defects":[ {"id":"...","category":"weld","severity":"major","description":"..."} ],
  "hazards":[],
  "rectifications_today":{"issued":1,"closed":1,"items":[{"serial_no":"JP-RO-2026-0017","status":"closed"}]},
  "acceptances_today":[],
  "incidents":[],
  "meetings":[],
  "upstream_events":[ {"time":"10:15","subdomain":"02-quality","event":"UT 不合格"} ]
}
```

## 硬约束

1. **不编事件**:只汇总 input 里真实存在的记录。
2. **不漏 key events**:整改 · 事故 · NCR · 验收 · 作业许可 · 至少引用到 body 中。
3. **Markdown 格式固定**:H1 标题 · 6 个 H2 分区 · 每区 H3 小节。
4. **数字一律带单位**。
5. **summary_auto 严格限 ≤ 200 字符**(手机推送用)。

## 输出结构

```json
{
  "version":"0.1.0",
  "generated_at":"2026-05-19T17:30:05+08:00",
  "log_date":"2026-05-19",

  "weather": { "am":{"weather":"晴","temp_c":19,"wind":"3 级"},"pm":{"weather":"多云","temp_c":25,"wind":"3 级"} },

  "patrol_count":3,
  "monitoring_post_count":1,
  "parallel_inspection_count":1,
  "rectification_issued":1,
  "rectification_closed":1,

  "summary_auto":"Day 7 · 巡视 3 · 旁站 1(A1210)· UT 发现 W-208 夹渣 · A5 JP-RO-2026-0017 当日闭环 · 无事故。",

  "body":
    "# 锦屏应舍美居 · Day 7 监理日志 · 2026-05-19\n\n" +
    "## 1. 天气\n" +
    "- 上午 · 晴 · 19°C · 风 3 级\n" +
    "- 下午 · 多云 · 25°C · 风 3 级\n\n" +
    "## 2. 巡视\n" +
    "- 全天 3 次 · 共覆盖东区基础 · 塔吊站位 · 二层钢结构施工面 · 脚手架\n" +
    "- 关注点 · 焊缝外观 · 临边防护 · PPE 佩戴\n" +
    "- 发现 · 无异常\n\n" +
    "## 3. 旁站\n" +
    "- A1210 二层钢柱焊接 · 07:00 - 09:30 · 张总监\n" +
    "- 过程规范 · 焊工 张某某 持证 · 焊材 E50 牌号\n" +
    "- 结论 · 外观 OK · 待 UT\n\n" +
    "## 4. 平行检验与试验\n" +
    "- UT 抽检 W-208 节点 · 3 点 · 1 点不合格(8mm 夹渣 · 超 GB 50205-2020 §7.2.4 二级 5mm 限值)\n" +
    "- 详见第三方 CMA 报告 JP-UT-2026-0013\n\n" +
    "## 5. 整改与事故\n" +
    "- 签发 A5 整改通知单 JP-RO-2026-0017 · 10:25\n" +
    "- 14:30 整改闭环(返工 + UT 复检合格 JP-UT-2026-0014)\n" +
    "- 无事故 / 未遂\n\n" +
    "## 6. 其它\n" +
    "- 本日无验收 · 无例会 · 无工程变更\n" +
    "- 明日计划 · A1215 吊装后续 · 已签发 lifting 作业许可 JP-WP-LIFT-2026-0032",

  "key_events": [
    {"time":"07:00","subdomain":"04-daily_log","event":"旁站开始 · A1210","ref_id":"<monitoring_post_id>"},
    {"time":"10:15","subdomain":"02-quality","event":"UT 发现 W-208 不合格","ref_id":"<defect_id>"},
    {"time":"10:25","subdomain":"02-quality","event":"签发 A5 JP-RO-2026-0017","ref_id":"<ro_id>"},
    {"time":"14:30","subdomain":"02-quality","event":"A5 闭环 · 复检合格","ref_id":"<ro_id>"}
  ]
}
```

## Markdown 结构 (6 固定 H2 · 不自由发挥)

1. 天气
2. 巡视
3. 旁站
4. 平行检验与试验
5. 整改与事故
6. 其它

每一节就算"无"也要列出 · 写 "无相关记录"。

## 反模式

- ❌ "本日情况良好" · 缺具体数据
- ❌ 汇总超 1500 字(不是报告 · 是日志)
- ❌ 把决策 / 建议写入日志正文(日志是"已发生事实"· 建议在月报)
- ❌ 捏造未记录的事件(即使推断合理也不能加)

---

version: 0.1.0 · 2026-04-23
