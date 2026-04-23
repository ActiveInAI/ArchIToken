# ADR-0018 · Secrets 管理政策

日期: 2026-04-23
状态: ACCEPTED
上下文: 2026-04-23 Phase A 审计发现 05-infra/k8s-manifests/
      含 Rainbond 默认弱口令 admin/admin1234 和明文
      POSTGRES_PASSWORD=insomeos_dev_2026 入仓库 ·
      违反宪法 §16。

## 决策

1. **任何 git-tracked 文件都不得含明文密码**(含弱口令 ·
   含"仅本地"的口令 · 含 base64 编码后的密码)
2. **K8s Secret manifest 只存结构和占位符** ·
   stringData 必须是 ${VAR} 形式
3. **本地开发**: .env + .env.example 模式 · .env 被 gitignore
4. **生产部署**: sealed-secrets(bitnami) 或 ExternalSecrets
   Operator · K8s 集群里的密钥从外部 KMS 渲染
5. **凭证轮换**: 新的 Rainbond admin 密码由 openssl rand
   生成 · AIA 手动应用到 Rainbond 控制台和运行中的容器
6. **历史遗留**: 保留 git 历史中的弱口令(2f67dcd 及后续)·
   不做 filter-repo rewrite · 因:
   - 无 remote · 未外泄
   - rainbond 默认口令全网可搜 · 非机密
   - rewrite 会改所有 commit hash 导致今日 4 commit
     (C0/C1/C2/C3) hash 变 · 审计链断
   未来 push 到 remote 前若有需要再做 filter-repo(另立 ADR)。

## 后果

- 新增 .env.example 模板 · 新增 .gitignore 规则 ·
  新增 05-infra/k8s-manifests/ 的 sealed-secrets 文档
- Rainbond admin 密码已换 · goodrain.me pull secret 需重建
- Postgres 密码仍为 insomeos_dev_2026(本地 baseline)·
  Sprint 01 Supabase 升级时随 v1.26.04 生成新密码

## 后续行动(docs/TODO.md 已登记)

- [ ] 装 sealed-secrets controller(05-infra/k8s-cluster/)
- [ ] Rainbond 手动改 admin 密码(AIA 动作)
- [ ] 生产 secret 迁移到 SealedSecret 或 ExternalSecrets
