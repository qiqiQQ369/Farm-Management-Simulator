# 玩家居中镜头跟随实施计划

> **面向执行代理：** 必须按任务逐项执行并勾选复选框；每项修改后都要完成对应验证。

**目标：** 让玩家在开场及移动过程中保持在画面中心，同时保留用户手动调好的镜头角度与距离。

**架构：** `CameraController` 继续是世界镜头位置的唯一管理者。它在启动时解析 `Player` 目标，并使用世界坐标加 Offset 定位；后续每帧只更新位置，绝不改写用户在 Inspector 中设置的 Rotation。

**技术栈：** Cocos Creator 3.8.7、TypeScript、Cocos `Node`、`Vec3`、`find` API。

## 全局约束

- 只修改 `assets/_Scripts/CameraController.ts`。
- 保留用户手调的镜头 Position、Rotation、Fov 与 `offset` 数值。
- 不修改地图、UI、玩家模型、资源、可见性或渲染设置。
- 保留镜头边界；到达边界时允许玩家偏离绝对画面中心。

---

### 任务 1：可靠解析玩家跟随目标

**文件：**
- 修改：`assets/_Scripts/CameraController.ts:1,88-96`
- 测试：Cocos Creator 的 `DevScene` 预览。

**接口：**
- 输入：Inspector 配置的 `target: Node`。
- 输出：`private resolveTarget(): boolean`；返回 `true` 表示已有目标或已成功找到场景根节点 `Player`。

- [ ] **步骤 1：记录改动前失败现象**

在 Cocos Creator 3.8.7 中预览 `assets/Scenes/DevScene.scene`。记录当前现象：调整镜头后玩家可能不在画面内，且镜头位置不能稳定跟随玩家。

- [ ] **步骤 2：实现目标解析**

将导入改为包含 `find`：

```ts
import { _decorator, Component, Node, Vec3, Camera, lerp, math, find } from 'cc';
```

在 `onLoad()` 中于初始化相机之前解析目标：

```ts
protected onLoad(): void {
    this.resolveTarget();
    this.initializeCamera();
}
```

新增方法：

```ts
private resolveTarget(): boolean {
    if (this.target?.isValid) return true;

    this.target = find('Player');
    if (this.target) return true;

    console.error('CameraController: 未找到 Player 跟随目标');
    return false;
}
```

- [ ] **步骤 3：静态验证目标解析**

运行：

```powershell
git diff --check
rg -n 'resolveTarget\(\)|find\(''Player''\)' assets/_Scripts/CameraController.ts
```

预期：`git diff --check` 以退出码 `0` 结束；两个目标解析调用均可被搜索到。

### 任务 2：使用世界坐标保持玩家居中跟随

**文件：**
- 修改：`assets/_Scripts/CameraController.ts:92-128,145-228`
- 测试：Cocos Creator 的 `DevScene` 预览。

**接口：**
- 消费：已解析的 `target`、用户设置的 `offset`、`followSpeed`、`boundsMin`、`boundsMax`。
- 产出：相机以 `target.worldPosition + offset` 跟随；不调用 `setRotation`、`lookAt` 或任何旋转修改方法。

- [ ] **步骤 1：将初始化位置改为世界坐标**

在 `initializePosition()` 中使用下列代码替换位置设置和前一帧位置记录：

```ts
Vec3.add(this._targetPosition, this.target.worldPosition, this.offset);
this.node.setWorldPosition(this._targetPosition);
this._previousTargetPosition.set(this.target.worldPosition);
```

- [ ] **步骤 2：将三种跟随模式改为世界坐标**

在 `updateFixedFollow()` 中使用：

```ts
Vec3.add(this._targetPosition, this.target.worldPosition, this.offset);
this.node.setWorldPosition(this._targetPosition);
```

在 `updateSmoothFollow()` 中使用 `this.target.worldPosition`、`this.node.worldPosition` 计算目标距离和插值，并使用：

```ts
this.node.setWorldPosition(this._tempVec3);
```

在 `updatePredictionFollow()` 中将所有 `this.target.position` 替换为 `this.target.worldPosition`，将所有 `this.node.position` 替换为 `this.node.worldPosition`，并将最终写入替换为：

```ts
this.node.setWorldPosition(this._tempVec3);
```

在 `update()` 末尾使用：

```ts
this._previousTargetPosition.set(this.target.worldPosition);
```

在 `applyBounds()` 中读取 `this.node.worldPosition` 并使用 `this.node.setWorldPosition(this._tempVec3)` 写回。

- [ ] **步骤 3：保持用户 Rotation 不变**

保留 `updateLookAt()` 方法供现有组件配置兼容，但不在 `update()` 中调用它。将 `update()` 中的调用替换为注释：

```ts
// Rotation 由 Inspector 中用户手调的数值控制；跟随逻辑只更新位置。
```

- [ ] **步骤 4：静态验证**

运行：

```powershell
git diff --check
rg -n 'worldPosition|setWorldPosition|updateLookAt\(' assets/_Scripts/CameraController.ts
```

预期：`git diff --check` 以退出码 `0` 结束；相机更新路径使用 `worldPosition` / `setWorldPosition`；`update()` 中不调用 `updateLookAt()`。

- [ ] **步骤 5：在 Cocos 中验证画面与跟随**

在打开的 `DevScene` 中停止并重新运行预览，不关闭项目。拖动摇杆让 Player 依次向四个方向移动。

预期：开场玩家位于画面中心；移动时相机跟随而 Rotation、Fov 与用户手调的视角保持不变；靠近边界时相机不露出地图外区域。

- [ ] **步骤 6：提交并推送**

```powershell
git add assets/_Scripts/CameraController.ts
git commit -m "Keep player centered during camera follow"
git push origin main
```

## 自检

- 设计覆盖：任务 1 处理缺失目标；任务 2 用世界坐标初始化与持续跟随，保留用户 Rotation 并保留边界。
- 占位符检查：没有 TODO、TBD 或未说明的实现步骤。
- 类型一致性：`resolveTarget()` 返回 `boolean`，只依赖现有 Cocos `Node` 和 `find`；位置更新全部使用 `Vec3` 和 `Node` 世界坐标接口。
