# NPC 挥砍间隔设计

## 问题

NPC 使用的 `ChopAction` 未绑定骨骼动画，因此其内部动作完成时间只有 0.1 秒。当前 NPC 每轮砍伐在该 Promise 返回后立即登记并开始下一轮，导致挥砍间隔过快。

## 目标

NPC 每次挥斧间隔默认约 0.8 秒，同时继续保证每次可见挥斧只登记一次砍伐、第四次后砍倒树。

## 方案

在 `Woodcutter` 增加序列化属性 `chopInterval: number = 0.8`，用于控制 NPC 单轮挥斧的最小间隔。`playAndRegisterChop()` 播放 `KanMuTou` 和 `ChopAction` 后，等待 `chopInterval` 秒才调用 `Tree.registerWoodcutterChop()`；下一轮仅在本轮登记完成后开始。

该属性可在 Cocos Inspector 针对不同 NPC 调整。主角、车辆、树木掉落与地图配置不改。

## 验证

停止预览后重新运行，观察 NPC 连续砍树：相邻挥斧约间隔 0.8 秒，可数到四次挥斧，第四次后树才砍倒。将 Inspector 中的 `chopInterval` 改为其他正数后，间隔应对应变化。
