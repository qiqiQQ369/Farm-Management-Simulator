# 玩家砍树后移动动画恢复实施计划

> **供自动化执行者使用：** 必须逐项执行本计划；步骤用复选框记录完成状态。

**目标：** 玩家砍伐动作结束后，按当前移动状态恢复跑步或待机动画。

**架构：** 在 `PlayerController` 提供统一的 `refreshMovementAnimation()`，由 `Tree.completeChop()` 在玩家砍伐等待结束后调用。动画状态与 `_isMoving` 同步，避免 `KanMuTou` 覆盖后状态仍停留在 `Run`。

**技术栈：** Cocos Creator 3.8.7、TypeScript、`SkeletalAnimation`。

## 全局约束

- 移动中恢复 `run2_FuTou`，停止时恢复 `idle1_FuTou`。
- 只恢复玩家动画；NPC、车辆、砍伐次数和镜头逻辑不改。
- 不修改场景文件。

---

### 任务 1：增加玩家移动动画刷新接口

**文件：**
- 修改：`assets/_Scripts/PlayerController.ts:428-444`

**接口：**
- 产出：`public refreshMovementAnimation(): void`。

- [ ] **步骤 1：确认现有动画枚举和移动状态**

运行：

```powershell
rg -n -C 3 'enum AnimationName|_currentAnimation|_isMoving|setJoystickInput' assets/_Scripts/PlayerController.ts
```

预期：存在 `AnimationName.Idle`、`AnimationName.Run`、`_currentAnimation` 与 `_isMoving`。

- [ ] **步骤 2：添加刷新方法**

在 `isMoving()` 方法前加入：

```ts
public refreshMovementAnimation(): void {
    if (!this.skeletonAnimation) return;

    const nextAnimation = this._isMoving ? AnimationName.Run : AnimationName.Idle;
    if (this._currentAnimation !== nextAnimation) {
        this.skeletonAnimation.play(nextAnimation);
        this._currentAnimation = nextAnimation;
    }
}
```

### 任务 2：砍伐结束后恢复玩家动画

**文件：**
- 修改：`assets/_Scripts/Tree.ts:492-500`

**接口：**
- 使用：任务 1 的 `PlayerController.refreshMovementAnimation(): void`。
- 产出：玩家砍伐动作完成后动画与移动状态一致。

- [ ] **步骤 1：在玩家砍伐等待后刷新动画**

将玩家分支调整为：

```ts
if (this._currentChopper.type === ChopperType.Player) {
    this._currentChopper.controller.chopAction.playChopAction(this.node.position);
    await new Promise(resolve => setTimeout(resolve, 500));
    this._currentChopper.controller.refreshMovementAnimation?.();
}
```

可选调用保证旧版控制器引用缺少该方法时不报错。

- [ ] **步骤 2：静态验证**

运行：

```powershell
rg -n -C 5 'refreshMovementAnimation|playChopAction\(this\.node\.position\)' assets/_Scripts/PlayerController.ts assets/_Scripts/Tree.ts
git diff --check
```

预期：接口存在且只在玩家砍伐分支调用；无空白错误。

- [ ] **步骤 3：手动预览验证**

在 Cocos Creator 中停止预览后重新运行，不重开项目。移动中砍树，确认挥斧结束后恢复跑步动画；停下砍树，确认恢复待机动画；连续移动方向和砍伐次数不变。

- [ ] **步骤 4：提交实现**

运行：

```powershell
git add -- assets/_Scripts/PlayerController.ts assets/_Scripts/Tree.ts
git diff --cached --check
git commit -m "Restore player movement animation after chopping"
git push origin main
```

预期：提交只包含两个脚本，不包含场景文件或其他未跟踪文件。
