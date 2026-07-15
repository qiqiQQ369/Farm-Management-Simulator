# 镜头构图一致性修复实施计划

> **面向执行代理：** 必须按任务逐项执行并勾选复选框；每项修改后都要完成对应验证。

**目标：** 让运行时相机高度准确遵循用户设置的 Offset，保持用户手调 Rotation，并避免玩家因镜头构图冲突而不可见。

**架构：** `CameraController` 已使用 `Player.worldPosition + offset` 更新位置。此计划将边界限制从三维位置钳制改为只钳制地图平面的 X/Z，使 `offset.y` 成为唯一控制运行时高度的参数；Rotation 和 Fov 不由跟随脚本修改。

**技术栈：** Cocos Creator 3.8.7、TypeScript、Cocos `Vec3`、`math.clamp` API。

## 全局约束

- 仅修改 `assets/_Scripts/CameraController.ts`。
- 不修改用户在 Inspector 手调的 Main Camera Rotation、Fov 或 Offset。
- 保留 X/Z 边界，移除 Y 位置钳制。
- 不修改玩家模型、地图、UI、资源、相机可见性或渲染设置。

---

### 任务 1：解除运行时高度覆盖

**文件：**
- 修改：`assets/_Scripts/CameraController.ts:230-242`
- 测试：Cocos Creator 的 `DevScene` 预览。

**接口：**
- 输入：相机的 `node.worldPosition`、`boundsMin`、`boundsMax`。
- 输出：`applyBounds(): void`，仅将世界位置的 X/Z 限制在地图边界内，保留原 Y 值。

- [ ] **步骤 1：记录改动前失败现象**

在 Cocos Creator 3.8.7 中预览 `assets/Scenes/DevScene.scene`。将 CameraController 的 `offset.y` 改为一个明显不同于 `16.8` 的测试值并运行。

预期失败：运行时相机高度仍被边界钳制为 `16.8`，与 Offset 的 Y 值不一致，导致构图不可控。

- [ ] **步骤 2：将边界改为仅限制 X/Z**

在 `applyBounds()` 中保留当前世界位置的 Y 值：

```ts
private applyBounds(): void {
    const currentPos = this.node.worldPosition;

    this._tempVec3.set(
        math.clamp(currentPos.x, this.boundsMin.x, this.boundsMax.x),
        currentPos.y,
        math.clamp(currentPos.z, this.boundsMin.z, this.boundsMax.z),
    );

    this.node.setWorldPosition(this._tempVec3);
}
```

- [ ] **步骤 3：静态验证**

运行：

```powershell
git diff --check
rg -n -C 6 'private applyBounds|currentPos\.y|boundsMin\.x|boundsMax\.z' assets/_Scripts/CameraController.ts
```

预期：`git diff --check` 以退出码 `0` 结束；`applyBounds()` 使用 `currentPos.y`，不包含 `math.clamp(currentPos.y, ...)`。

- [ ] **步骤 4：预览验证构图和跟随**

在当前已打开的 Cocos Creator 中停止后重新运行 `DevScene` 预览，不关闭项目。使用用户已调好的 Rotation、Fov 和 Offset 值，拖动摇杆移动玩家。

预期：玩家开场可见且随镜头移动保持在构图中心；镜头高度与 Offset 的 Y 值一致；靠近地图边缘时仅 X/Z 受限制，画面不显示地图外区域。

- [ ] **步骤 5：提交并推送**

```powershell
git add assets/_Scripts/CameraController.ts
git commit -m "Keep camera height aligned with offset"
git push origin main
```

## 自检

- 设计覆盖：任务解除 Y 高度覆盖，保留用户 Rotation/Fov/Offset 和 X/Z 平面边界。
- 占位符检查：没有 TODO、TBD 或未说明的实现步骤。
- 类型一致性：`currentPos` 和 `_tempVec3` 均为 `Vec3`；写回使用现有 `setWorldPosition` 接口。
