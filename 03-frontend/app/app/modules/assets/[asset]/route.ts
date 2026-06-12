// app/app/modules/assets/[asset]/route.ts - MLightCAD 相对路径 worker 资产别名
// License: Apache-2.0
//
// @mlightcad 的 MText 编辑器内部会用默认相对路径 "./assets/mtext-renderer-worker.js"
// 再建一个渲染 worker 池(独立于 webworkerFileUrls 配置的全局单例);相对路径按
// 页面 URL(/app/modules/<moduleId>)解析到 /app/modules/assets/*。此路由让该
// 路径直达与 /api/mlightcad/assets/[asset] 相同的真实 worker 文件,修复 DXF/DWG
// 查看器 worker 全部 404 导致的黑屏。

export { GET } from "@/app/api/mlightcad/assets/[asset]/route";

export const runtime = "nodejs";
