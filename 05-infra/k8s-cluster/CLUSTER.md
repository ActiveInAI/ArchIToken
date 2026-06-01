# ArchIToken Kubernetes 集群 · 生产拓扑

**Stage 2B 达成 · 2026-04-20**

## 节点

| 节点 | Hostname | 内网 IP (DGX 200GbE 直连) | 角色 | K8s 版本 |
|------|----------|---------------------------|------|---------|
| Spark-A | spark01 / spark-insome001 | 192.168.100.1 | control-plane | v1.35.4 |
| Spark-B | spark02 / spark-insome002 | 192.168.100.2 | worker | v1.35.4 |

## 网络

- **Pod CIDR**: `10.244.0.0/16`
- **Service CIDR**: `10.96.0.0/12`
- **API Server**: `https://192.168.100.1:6443`
- **CNI**: Cilium **1.19.3** (eBPF datapath, auto-detected)
- **Envoy**: v1.36.6 (L7 proxy)

## 容器运行时

两节点统一:
- containerd **v2.2.1** (containerd.io)
- SystemdCgroup = true
- sandbox image: `registry.k8s.io/pause:3.10.1`

## 防火墙 (UFW)

**Spark-B** (其他机器上无启用 UFW):
- 192.168.100.0/24 全开 (DGX 直连背板)
- 10.244.0.0/16 全开 (Pod CIDR)
- 10.96.0.0/12 全开 (Service CIDR)

## Node labels

- `spark01`: `node-role.kubernetes.io/control-plane=`
- `spark02`: `node-role.kubernetes.io/worker=worker`

## kubeconfig 分发

两台机均有 `~/.kube/config`,可从任一机 `kubectl`。
kubeconfig 的 context 名是 `kubernetes-admin@kubernetes`。

## Stage 2A 数据层 (待迁移到 K8s, 在 Stage 2C 之后)

当前运行在 Spark-B docker:
- `architoken-postgres` (pgvector/pg16) @ `127.0.0.1:5433`
- `architoken-valkey`   (valkey:8)     @ `127.0.0.1:6381`

Stage 2C 装 Rainbond 后,会迁入 K8s StatefulSet。

## Token 管理

首次 init token 已用于 spark02 join,24h 后过期。
如需扩集群:
```bash
ssh spark01
sudo kubeadm token create --print-join-command
```

## 常用运维命令

```bash
kubectl get nodes -o wide
kubectl get pods -A -o wide
cilium status
cilium connectivity test  # 跨节点网络全量测试 (~10min)
```

## 已知警告 (无害)

- kubelet 在 spark02 上周期输出 `Nameserver limits exceeded`:系统 `/etc/resolv.conf` 有 4 个 nameserver,K8s 默认只传 3 个给 pod。不影响 DNS 解析,只是某个 IPv6 nameserver 被省略。
