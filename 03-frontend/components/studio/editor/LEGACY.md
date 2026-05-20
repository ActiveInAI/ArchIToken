# Studio Editor · LEGACY 归档说明（Phase 4.0）

本目录 + `apps/web/lib/command/commands/` + `apps/web/hooks/studio/` 有一批
**Phase 2.5 / 2.5.1 / 2.5.2 / 2.5.3 真编辑能力代码**，在 Phase 4.0 架构纠偏后
被隐藏（UI 入口移除），但**代码保留**。

## 为什么隐藏

Phase 4.0 产品定位转为「装配式建筑 AI 设计漏斗」：
- AI 用预定义构件秒级出方案 → 用户留资 → 人工深化
- Studio 提供"参数微调"而非"从零创建"
- 业主（Home）完全不做几何编辑

因此 Build 面板的 8 个工具砍到 3 个：
- ✅ **保留**：`select` / `move-wall` / `move-room`
- ❌ **隐藏**：`draw-wall` / `draw-room-rect` / `place-door` / `place-window` / `place-opening`

## 归档的代码（LEGACY 注释标识）

### Commands（仅"创建"类归档；"修改/删除"类保留）
- `apps/web/lib/command/commands/create-wall.ts` ❌ LEGACY
- `apps/web/lib/command/commands/create-room-rectangle.ts` ❌ LEGACY
- `apps/web/lib/command/commands/create-opening.ts` ❌ LEGACY
- `apps/web/lib/command/commands/move-wall-endpoint.ts` ✅ 保留（Properties 改参数）
- `apps/web/lib/command/commands/translate-wall.ts` ✅ 保留（move-wall 工具）
- `apps/web/lib/command/commands/translate-room.ts` ✅ 保留（move-room 工具）
- `apps/web/lib/command/commands/set-wall-thickness.ts` ✅ 保留（Wall Properties）
- `apps/web/lib/command/commands/update-opening.ts` ✅ 保留（Opening Properties）
- `apps/web/lib/command/commands/delete-wall.ts` ✅ 保留（Wall Properties Delete）
- `apps/web/lib/command/commands/delete-opening.ts` ✅ 保留（Opening Properties Delete）
- `apps/web/lib/command/commands/delete-room.ts` ✅ 保留（Phase 2.75 做的）

### Hooks
- `apps/web/hooks/studio/use-creation-gesture.ts` ❌ LEGACY
- `apps/web/hooks/studio/creation-commits.ts` ❌ LEGACY
- `apps/web/hooks/studio/use-drag-gesture.ts` ✅ 保留（move-wall / move-room 工具依赖）
- `apps/web/hooks/studio/build-drag-command.ts` ✅ 保留（drag 后验工具）
- `apps/web/hooks/studio/use-snap-solver.ts` ✅ 保留（drag / Properties 改参数都用）
- `apps/web/hooks/studio/use-editor-keyboard.ts` ✅ 保留（Ctrl+Z/Esc 等）

### 不动（纯"编辑"逻辑）
- `packages@/lib/insome/floorplan/src/edit/` — hit-test / SelectionRef / overlay-previews 全部保留
- `packages@/lib/insome/floorplan/src/editor-overlay.tsx` — overlay 保留（move 工具仍需要）
- `@/lib/insome/canvas` / `@/lib/insome/scene` 零变化

## 重启方法

Phase 5+ 深化阶段需要恢复创建工具时：
1. `build-panel.tsx` 的 `SUB_TOOLS` 数组补回 5 个条目
2. 清理所有 `LEGACY(phase-4.0)` 注释标记
3. 删除本 LEGACY.md
4. Build 面板的 hint 文案已在 i18n 中保留（`studio.build.hint.draw-wall` 等），零 i18n 迁移

## 为什么不删

1. **深化阶段需要**：真正交付客户时需要精细编辑，砍了就要重写
2. **测试覆盖**：Phase 2.5 做了大量 JSON roundtrip 自检 + 原子性测试，删了测试基础也丢了
3. **代码体量可接受**：所有 LEGACY 文件加起来 < 1500 行，bundle 里 tree-shake 掉未引用部分
