# 玩家砍树后移动动画恢复设计

## 问题

玩家移动时砍树会播放 `KanMuTou`。砍伐结束后，`PlayerController._currentAnimation` 仍记录为 `Run`，导致后续摇杆输入不会重新播放 `run2_FuTou`，角色可能停留在砍伐动作的最后姿势。

## 目标

每次玩家砍伐动作结束后，根据当前移动状态恢复正确动画：移动中播放 `run2_FuTou`，停止时播放 `idle1_FuTou`。

## 方案

在 `PlayerController` 增加公开方法 `refreshMovementAnimation()`，按 `_isMoving` 和 `skeletonAnimation` 播放目标动画并同步 `_currentAnimation`。`Tree.completeChop()` 在等待玩家砍伐动作完成后调用该方法；NPC 与车辆不调用该恢复逻辑。

## 验证

移动中经过树木并完成砍伐，确认砍伐动作结束后立刻恢复跑步动画；停下砍树，确认恢复待机动画；连续移动和砍树时不改变移动方向或砍伐次数。
