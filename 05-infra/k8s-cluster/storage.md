# InsomeOS K8s Storage · Stage 2Y

**Last updated: 2026-04-21**

## StorageClass

集群使用 Rainbond 自带的 local-path-provisioner (基于 rancher/local-path-provisioner
v0.0.30 的 goodrain 镜像版本),在 rbd-system namespace 运行。
## 路径约定

所有 PV 的物理数据目录在消费节点 `/opt/local-path-provisioner/` 下,
子目录命名格式 `pvc-<uuid>_<namespace>_<pvc-name>/`。

## 节点准备

- Spark-A (spark01): `/opt/local-path-provisioner/` 存在 (755 root:root)
- Spark-B (spark02): `/opt/local-path-provisioner/` 存在 (755 root:root)

## WaitForFirstConsumer 行为

local-path-provisioner 使用 `WaitForFirstConsumer` 绑定模式:
- 纯 PVC 创建后会永远 Pending
- 只有当真有 Pod 引用 PVC 时,provisioner 才创建 PV

正确测试方法: 同时创建 PVC + Pod,用 **nodeSelector** 而不是 nodeName
(后者绕过 scheduler,阻止 provisioner 看到 first consumer)。

## Smoke Test (2026-04-21 08:51:47Z 验证通过)

- PVC `pvc-smoke` Bound → PV `pvc-b1180bef-b44c-4851-bd11-cb6324c376ab`
- Pod `smoke-writer` Running 在 spark02
- provisioner 日志: `Successfully provisioned volume`

## 两个 provisioner 共存

1. Stage 2Y 早期在 `local-path-storage` namespace 装的 rancher 官方版
   (从 docker.io 通过 Xray proxy 拉取)
2. Rainbond 6.7.1 在 `rbd-system` namespace 又装了它自带的
   (`registry.cn-hangzhou.aliyuncs.com/goodrain/local-path-provisioner`)

两者都注册 `rancher.io/local-path`。实际只有一个被 PVC 调用。
未来清理: 删掉 `local-path-storage` namespace,只保留 Rainbond 自带。
