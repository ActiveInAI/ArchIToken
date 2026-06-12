# 注意:本目录的 usd-core 容器方案在 aarch64 宿主机上不可用
官方 usd-core 无 aarch64 轮子,qemu 模拟下 TBB 死旋/QEMU 段错误。
生产采用 scripts/panaec-usd-to-bom(three.js USDLoader,与查看器同源,Node 原生)。
此目录仅保留给未来 x86_64 worker 节点部署参考。
