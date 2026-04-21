# Containerd Registry Proxy · Stage 2Y 网络方案

**Last updated: 2026-04-21**

## 背景

DGX Spark 所在网络对 `docker.io` (Docker Hub) 的 IPv4 路由被墙,IPv6 没有公网出口。
任何从 `docker.io/*` 拉取镜像的请求会 `dial tcp timeout`。

## 解决方案

在 Spark-B 节点上配置 `containerd` 的 systemd drop-in,让它的 HTTPS 请求通过
本机 Xray VPN 的 HTTP proxy (127.0.0.1:10809) 走 VPS 出口。

内网流量 (K8s API、Pod CIDR、Service CIDR、DGX 直连网段、本机) 通过 `NO_PROXY`
绕过代理,避免把集群内部流量错误地发给 VPN。

## 配置文件

`/etc/systemd/system/containerd.service.d/http-proxy.conf`:

```ini
[Service]
Environment="HTTP_PROXY=http://127.0.0.1:10809"
Environment="HTTPS_PROXY=http://127.0.0.1:10809"
Environment="NO_PROXY=localhost,127.0.0.1,::1,192.168.100.0/24,192.168.1.0/24,10.244.0.0/16,10.96.0.0/12,10.0.0.0/8,172.16.0.0/12,fd7a:115c:a1e0::/48,.svc,.cluster.local"
```

## 节点覆盖

- **Spark-B (spark02)**: 配置完成 · containerd 走 VPN
- **Spark-A (spark01)**: 未配置 · 因 Xray 仅监听 127.0.0.1 (安全策略)
  不对 DGX 直连网段开放 0.0.0.0

## 结果

- Spark-B 上 kubelet 可以拉取任何 `docker.io/*` 镜像
- Rainbond 6.7.1 所有镜像均来自 `registry.cn-hangzhou.aliyuncs.com/goodrain/*`,
  阿里云镜像 Spark-B 直连可达,不经过 VPN
- local-path-provisioner 的 helper pod 启动时会拉 `busybox` (docker.io),
  这里真正使用 VPN proxy,已验证工作

## 已知限制

- Spark-A 如果未来需要调度应用,必须使用不依赖 docker.io 的镜像
  (registry.k8s.io / ghcr.io / quay.io / 阿里云)
- Rainbond 所有 workload 在 values.yaml 中显式绑定到 spark02
  (nodesForGateway, nodesForChaos)

## 长期方案 (未来 PR)

- 给 Xray 配置 Tailscale 隧道规则,通过 Tailscale 网段 fd7a:115c:a1e0::/48
  白名单允许 Spark-A 访问 Spark-B 的 Xray,比 0.0.0.0 更安全
