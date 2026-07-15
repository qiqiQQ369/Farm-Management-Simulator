# 旋转感知镜头跟随设计

## 目标

无论用户如何在 Inspector 中调整 Main Camera 的 Rotation，玩家都保持在游戏镜头正中心，并在移动时由相机持续跟随。

## 根因

当前 `CameraController` 将 `offset` 直接视为世界坐标偏移。用户改变镜头 Rotation 后，相机仍沿固定世界方向放置，因此相机前方射线不再经过玩家，玩家会偏到画面边缘。

## 设计

- 新增 `followDistance` 属性，默认值为 `17`，表示相机到玩家的距离。
- 每次计算跟随位置时，使用当前镜头节点的前向量，将相机放在玩家后方：`玩家世界坐标 - 镜头前向量 × followDistance`。
- 镜头 Rotation 完全由 Inspector 的用户手调数值控制；运行时不调用 `lookAt`、不插值旋转、不覆盖 Rotation。
- 初始化、固定跟随、平滑跟随和预测跟随共用同一套旋转感知位置计算。
- 保留 X/Z 地图边界。到达地图边缘时边界优先于绝对居中，避免看到地图外区域。

## 当前手调参数保护

用户当前 `DevScene.scene` 的 Main Camera Rotation 为 `(-45, -45, 0)`，且仍是未提交工作区改动。实现和提交时保留该变更，不用 Git 回退或重置该场景文件。

## 范围

- 修改 `assets/_Scripts/CameraController.ts`。
- 将当前用户手调的 `assets/Scenes/DevScene.scene` Rotation 一并提交，作为旋转感知跟随的起始镜头角度。
- 不修改玩家、地图、UI、资产、渲染设置或相机可见性。

## 验收

1. Rotation 为 `(-45, -45, 0)` 时，玩家位于画面中心。
2. 将 Rotation 改为其他斜视角并重新预览时，玩家仍位于画面中心。
3. 移动玩家时，镜头保持相同 Rotation 和距离跟随。
4. 到达地图边界时，镜头不显示地图外区域。
