# 镜头构图一致性修复设计

## 目标

让玩家模型稳定可见并跟随玩家移动，同时让用户在 Inspector 中调好的镜头 Rotation 作为唯一视觉角度来源。

## 根因

玩家节点、主角模型、SkinnedMeshRenderer、材质与贴图均有效，且没有脚本隐藏或销毁玩家。问题来自两套相互冲突的镜头控制：用户在 Main Camera 中调整 Position/Rotation，但运行时 `CameraController` 又使用 `Player 世界坐标 + offset` 强制写入位置，随后由边界将相机 Y 值最低钳制到 `16.8`。这会使运行时位置与用户手调 Rotation 不匹配，造成玩家落到镜头外或被场景物体遮挡。

## 设计

- `CameraController` 是运行时镜头位置的唯一管理者；其 `offset` 是运行时唯一有效的相机相对位置参数。
- Main Camera 的 Rotation 和 Fov 由用户在 Inspector 中手调，运行时跟随逻辑不修改它们。
- 将镜头边界限制为平面范围（X/Z）；不再强制钳制 Y，以免覆盖 `offset.y` 并破坏用户确定的构图高度。
- 初始化和每帧跟随均根据 `Player.worldPosition + offset` 计算相机位置。
- 到达 X/Z 地图边缘时优先保证镜头不越界；此时允许玩家略偏离画面中心。

## 范围

- 修改 `assets/_Scripts/CameraController.ts`。
- 仅在需要把最终手调的 Offset 写入场景时修改 `assets/Scenes/DevScene.scene`。
- 不修改玩家模型、地图、UI、资源、渲染层或相机可见性设置。

## 验收

1. 在用户确定的 Rotation、Fov、Offset 下，进入预览立即看到玩家。
2. 玩家移动时，镜头以相同视角跟随，不会把玩家移出画面。
3. 修改 Offset 的 Y 值后，运行时高度与该数值一致，不再被 `16.8` 强制覆盖。
4. 接近地图平面边缘时，镜头不会显示地图外区域。
