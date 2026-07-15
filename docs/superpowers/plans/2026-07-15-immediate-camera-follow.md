# 无延迟角色居中跟随实施计划

> **供自动化执行者使用：** 必须逐项执行本计划；步骤用复选框记录完成状态。

**目标：** 消除角色移动时的镜头追赶和停顿，使默认 Smooth 跟随每帧同步角色位置并保持居中。

**架构：** 保留现有“依据相机 forward 与 followDistance 计算跟随位置”的机制。将 Smooth 模式的插值替换为直接设置世界坐标，并使用 Cocos 执行顺序保证相机在角色位移后读取其最新位置。

**技术栈：** Cocos Creator 3.8.7、TypeScript、Cocos `Component` 与 `Vec3` API。

## 全局约束

- 运行时不得调用 `setRotation` 或修改镜头 Rotation。
- 保留 `followDistance`、现有 X/Z 边界限制和用户未提交的场景角度。
- 不关闭或重开 Cocos 项目；验证仅要求停止预览后重新运行。

---

### 任务 1：让 Smooth 模式无延迟跟随

**文件：**
- 修改：`assets/_Scripts/CameraController.ts:1,171-187`

**接口：**
- 使用：已有 `calculateFollowPosition(out: Vec3, targetPosition: Vec3): void`。
- 产出：`updateSmoothFollow(deltaTime: number): void` 每帧直接写入计算出的世界坐标。

- [ ] **步骤 1：确认旧的延迟来源**

运行：

```powershell
rg -n "deadZone|Vec3.lerp\(this\._tempVec3, currentPos|followSpeed" assets/_Scripts/CameraController.ts
```

预期：`updateSmoothFollow` 中能看到死区判断和 `Vec3.lerp` 插值。

- [ ] **步骤 2：替换 Smooth 跟随实现**

将 `updateSmoothFollow` 方法替换为：

```ts
private updateSmoothFollow(_deltaTime: number): void {
    this.calculateFollowPosition(this._targetPosition, this.target.worldPosition);
    this.node.setWorldPosition(this._targetPosition);
}
```

不删除 `deadZone` 与 `followSpeed` 属性，以避免现有 Inspector 数据和其他模式失效；Smooth 模式不再使用它们。

- [ ] **步骤 3：静态验证**

运行：

```powershell
git diff --check
rg -n -U "private updateSmoothFollow[\\s\\S]*?^    }" assets/_Scripts/CameraController.ts
```

预期：无空白错误；Smooth 方法只计算跟随位置并调用 `setWorldPosition`，不包含 `Vec3.lerp`、`deadZone` 或 Rotation 写入。

### 任务 2：确保相机读取角色移动后的坐标

**文件：**
- 修改：`assets/_Scripts/CameraController.ts:1,95`

**接口：**
- 使用：Cocos 的 `@executionOrder(order: number)` 类装饰器。
- 产出：`CameraController` 比默认角色控制器更晚进入 `update` 阶段。

- [ ] **步骤 1：加入执行顺序装饰器**

将装饰器解构改为：

```ts
const { ccclass, property, executionOrder } = _decorator;
```

并在类声明前加入：

```ts
@executionOrder(100)
@ccclass('CameraController')
export class CameraController extends Component {
```

`100` 使相机更新晚于未声明执行顺序的 `PlayerController`，从而读取本帧角色位置。

- [ ] **步骤 2：验证未引入旋转写入调用**

运行：

```powershell
rg -n "updateLookAt\(\);|setRotation\(" assets/_Scripts/CameraController.ts
```

预期：没有 `updateLookAt();` 调用；如保留旧私有兼容方法，`setRotation` 只能出现在该未调用的方法内部。

- [ ] **步骤 3：手动预览验证**

在 Cocos Creator 中停止当前预览后重新运行，不重开项目。

持续拖动摇杆，让角色直线、斜线与转向移动；预期镜头不追赶、不停顿，角色保持画面中心。随后调整 Main Camera Rotation 并再次预览；预期角色仍居中，运行期间 Rotation 不被改写。

- [ ] **步骤 4：提交实现**

运行：

```powershell
git add -- assets/_Scripts/CameraController.ts
git diff --cached --check
git commit -m "Remove camera follow lag"
git push origin main
```

预期：仅相机脚本进入该提交；不暂存 `assets/Scenes/DevScene.scene`，以保留用户当前编辑器中的未提交角度。
