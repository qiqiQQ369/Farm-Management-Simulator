# 旋转感知镜头跟随实施计划

> **面向执行代理：** 必须按任务逐项执行并勾选复选框；每项修改后都要完成对应验证。

**目标：** 无论用户如何调整 Main Camera 的 Rotation，运行时相机都让玩家位于画面中心，并持续跟随玩家移动。

**架构：** `CameraController` 使用 `followDistance` 代替固定世界 Offset 方向。每帧以当前镜头的前向量计算相机位置：`target.worldPosition - node.forward * followDistance`，因此玩家永远位于相机前向射线上；Rotation 保持用户在 Inspector 中的手调数值。

**技术栈：** Cocos Creator 3.8.7、TypeScript、Cocos `Node.forward`、`Vec3`、`math.clamp` API。

## 全局约束

- 保留当前工作区中 `assets/Scenes/DevScene.scene` 的 Main Camera Rotation `(-45, -45, 0)`。
- 跟随逻辑不调用 `setRotation`、`setRotationFromEuler`、`lookAt` 或 `updateLookAt()`。
- 保留 X/Z 地图边界；边界优先时允许玩家轻微偏离中心。
- 不修改玩家、地图、UI、资产、渲染设置或相机可见性。

---

### 任务 1：引入旋转感知的目标位置计算

**文件：**
- 修改：`assets/_Scripts/CameraController.ts:32-40,84-226`
- 测试：Cocos Creator 的 `DevScene` 预览。

**接口：**
- 输入：`target: Node`、`node.forward: Vec3`、`followDistance: number`。
- 输出：`private calculateFollowPosition(out: Vec3, targetPosition: Vec3): void`；将 `out` 设为玩家后方 `followDistance` 距离处的相机位置。

- [ ] **步骤 1：记录改动前失败现象**

保持当前 `DevScene.scene` 的 Rotation `(-45, -45, 0)`，停止后重新运行预览。

预期失败：玩家偏离画面中心，因为 `offset` 仍按固定世界坐标方向应用。

- [ ] **步骤 2：新增距离属性和位置计算方法**

在 `offset` 属性后新增：

```ts
@property({ tooltip: '相机到玩家的跟随距离' })
public followDistance: number = 17;
```

新增方法：

```ts
private calculateFollowPosition(out: Vec3, targetPosition: Vec3): void {
    Vec3.multiplyScalar(this._tempVec3, this.node.forward, -this.followDistance);
    Vec3.add(out, targetPosition, this._tempVec3);
}
```

- [ ] **步骤 3：让初始化和固定跟随使用旋转感知位置**

在 `initializePosition()` 中替换位置计算：

```ts
this.calculateFollowPosition(this._targetPosition, this.target.worldPosition);
this.node.setWorldPosition(this._targetPosition);
this._previousTargetPosition.set(this.target.worldPosition);
```

在 `updateFixedFollow()` 中替换为：

```ts
this.calculateFollowPosition(this._targetPosition, this.target.worldPosition);
this.node.setWorldPosition(this._targetPosition);
```

- [ ] **步骤 4：让平滑和预测跟随使用旋转感知位置**

在 `updateSmoothFollow()` 中使用：

```ts
this.calculateFollowPosition(this._targetPosition, this.target.worldPosition);
const currentPos = this.node.worldPosition;
Vec3.lerp(this._tempVec3, currentPos, this._targetPosition,
    Math.min(this.followSpeed * deltaTime * 60, 1.0));
this.node.setWorldPosition(this._tempVec3);
```

在 `updatePredictionFollow()` 中先保留现有速度计算得到预测玩家位置 `this._tempVec3_2`，随后使用：

```ts
this.calculateFollowPosition(this._targetPosition, this._tempVec3_2);
```

将预测模式中所有镜头读写改为 `this.node.worldPosition` / `this.node.setWorldPosition(...)`。

- [ ] **步骤 5：停止运行时旋转覆盖**

删除 `update()` 中对 `updateLookAt()` 的调用，并改为：

```ts
// Rotation 完全由 Inspector 中用户手调的数值控制。
```

保留 `updateLookAt()` 方法，避免现有公共配置反序列化失败，但不在任何运行路径调用它。

- [ ] **步骤 6：静态验证**

运行：

```powershell
git diff --check
rg -n 'followDistance|calculateFollowPosition|updateLookAt\(\);' assets/_Scripts/CameraController.ts
```

预期：`git diff --check` 以退出码 `0` 结束；前两个符号被找到，`updateLookAt();` 不存在。

### 任务 2：保留用户镜头角度并验证居中

**文件：**
- 修改：`assets/Scenes/DevScene.scene:137-162`
- 测试：Cocos Creator 的 `DevScene` 预览。

**接口：**
- 输入：用户已保存的 Main Camera Rotation `(-45, -45, 0)`。
- 输出：场景保存该 Rotation；脚本运行时不覆盖它。

- [ ] **步骤 1：核对并暂存用户手调的场景改动**

运行：

```powershell
git diff -- assets/Scenes/DevScene.scene
```

预期：差异包含 Main Camera 的 `_euler.y` 为 `-45`，且不使用 `git restore`、`git reset` 或场景重建命令覆盖它。

- [ ] **步骤 2：预览验证不同 Rotation**

在当前 Cocos Creator 中停止后重新运行 `DevScene` 预览，不关闭项目。依次测试 Rotation `(-45, -45, 0)` 与另一组斜视角（例如 `(-55, 30, 0)`）。每次停止预览、调整 Rotation、再运行预览。

预期：两组 Rotation 下，玩家开场都位于画面中心；拖动摇杆后相机保持当前角度和 `followDistance` 跟随。接近地图 X/Z 边界时，镜头不显示地图外区域。

- [ ] **步骤 3：提交并推送**

```powershell
git add assets/_Scripts/CameraController.ts assets/Scenes/DevScene.scene
git commit -m "Center player for any camera rotation"
git push origin main
```

## 自检

- 设计覆盖：任务 1 让位置计算随 Rotation 改变并停止旋转覆盖；任务 2 保留用户镜头参数并验证多角度居中。
- 占位符检查：没有 TODO、TBD 或未说明的实现步骤。
- 类型一致性：`calculateFollowPosition` 接收和写入 `Vec3`；`Node.forward` 为 `Vec3`；所有相机位置写入使用世界坐标接口。
