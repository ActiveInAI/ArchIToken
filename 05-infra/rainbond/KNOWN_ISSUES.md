# Rainbond 6.7.1 Known Issues

**Updated: 2026-04-21**

## Issue 1 · rbd-chaos 无法在 proxy 环境拉取 docker.io 镜像

### 现象
通过 Rainbond UI "从镜像构建" 部署 docker.io/* 镜像 (如 pgvector/pgvector:pg16)
时,rbd-chaos 报 `dial tcp 198.18.0.250:443: i/o timeout`。

### 原因
- rbd-chaos 使用自己的 Go HTTP client 直接拉 docker.io,不复用宿主机 containerd 的镜像缓存
- rbd-chaos pod 不走 containerd 的 systemd HTTP_PROXY (containerd 配置的 proxy 只对 containerd daemon 自身生效,不影响 CRI 的 PullImage)
- rbd-chaos 的 RbdComponent CRD 虽然支持 env 字段,但注入 HTTP_PROXY 会污染集群内部 gRPC 通信 (rbd-chaos 连 rbd-api-api-inner:6366 也被代理),导致 CrashLoopBackOff
- Go gRPC 库不遵循 NO_PROXY 环境变量

### 绕行方案 (适用 Stage 2C)
直接 kubectl apply 创建业务组件 (postgres / valkey) 的 StatefulSet,kubelet 从
containerd 本地缓存拉镜像 (已用 ctr pull 预拉)。然后在 Rainbond UI 以"第三方组件"
方式引用 Service,Rainbond 负责监控 / 集成,不负责构建。

### 长期方案
1. 把业务镜像推到 Rainbond 内置 rbd-hub,让 Rainbond 从自己 hub 拉
2. 或 fork Rainbond 加 proxy 配置
3. 或在集群内部署 HTTP proxy (squid) 到 NodePort,让 rbd-chaos 走集群内 proxy

## Issue 2 · 应用市场 (grapps.cn) 不可达

### 现象
UI 显示 "外部市场暂时不可用"。

### 原因
grapps.cn 被墙或网络质量差。

### 影响
不影响核心功能。本地创建组件仍可用。
