# NPC 动画驱动砍伐计数实施计划

> **供自动化执行者使用：** 必须逐项执行本计划；步骤用复选框记录完成状态。

**目标：** 使伐木 NPC 的每次可见挥斧与树木的一次砍伐计数一一对应，稳定挥斧四次后砍倒树。

**架构：** `Tree` 继续是树木状态、掉落和完成判定的唯一来源，但停止用定时器为 `Woodcutter` 加次数。`Woodcutter` 串行等待每个 `ChopAction` 完成，再调用 `Tree.registerWoodcutterChop()` 登记一次；主角和车辆保留原有定时流程。

**技术栈：** Cocos Creator 3.8.7、TypeScript、Cocos `Node` 与 `Component` API。

## 全局约束

- NPC 可见挥斧 4 次，第四次后才进入 `TreeState.Chopped`。
- 主角 1 刀、车辆 1 刀的运行时规则不变。
- 不修改场景文件、掉落数量、树木重生、镜头或主角砍伐动作。

---

### 任务 1：将 Tree 的 NPC 计数改为显式登记

**文件：**
- 修改：`assets/_Scripts/Tree.ts:319-353,459-522`

**接口：**
- 新增：`public registerWoodcutterChop(chopperNode: Node): boolean`。
- 使用：已有 `_choppersInRange: Map<Node, ChopperInfo>`、`completeChop(): Promise<void>` 与 `ChopperType.Woodcutter`。
- 产出：只有 `Woodcutter` 显式调用时，树才增加一次 NPC 砍伐计数。

- [ ] **步骤 1：阻止 Tree 定时器自动计数 NPC**

在 `handleChoppingLogic()` 完成 `selectPriorityChopper()` 和空值检查后，插入：

```ts
if (this._currentChopper.type === ChopperType.Woodcutter) {
    return;
}
```

该分支必须位于 `this._choppingSince += deltaTime` 之前，确保只有主角和车辆继续使用现有定时器。

- [ ] **步骤 2：增加 NPC 砍伐登记接口**

在 `completeChop()` 前添加：

```ts
public registerWoodcutterChop(chopperNode: Node): boolean {
    const chopper = this._choppersInRange.get(chopperNode);
    const canChop = chopper?.type === ChopperType.Woodcutter &&
        (this._currentState === TreeState.Full ||
            this._currentState === TreeState.Half ||
            this._currentState === TreeState.Half2);

    if (!canChop) {
        return false;
    }

    this._currentChopper = chopper;
    this._isChopping = true;
    void this.completeChop();
    return true;
}
```

- [ ] **步骤 3：移除第二次 NPC 的硬编码暂停**

从 `completeChop()` 删除：

```ts
if (this._currentChopper.type == ChopperType.Woodcutter && this._currentChopCount == 2) {
    this._choppingSince = -600;
    await new Promise(resolve => setTimeout(resolve, 600));
}
```

- [ ] **步骤 4：静态验证 Tree 路径**

运行：

```powershell
rg -n -C 3 'registerWoodcutterChop|ChopperType\.Woodcutter|_choppingSince = -600' assets/_Scripts/Tree.ts
git diff --check
```

预期：存在公开登记接口和 `handleChoppingLogic()` 的 Woodcutter 提前返回；不再存在 `_choppingSince = -600`；无空白错误。

### 任务 2：让 Woodcutter 每次动画完成后登记一次砍伐

**文件：**
- 修改：`assets/_Scripts/Woodcutter.ts:44-49,168-179,200-219,324-340`

**接口：**
- 使用：任务 1 提供的 `Tree.registerWoodcutterChop(chopperNode: Node): boolean` 与已有 `ChopAction.playChopAction(targetPosition: Vec3): Promise<void>`。
- 产出：`Woodcutter` 的一次 `ChopAction` 完成后恰好登记一次树木砍伐。

- [ ] **步骤 1：增加串行挥斧状态**

在现有私有状态字段旁添加：

```ts
private _isChopCycleRunning: boolean = false;
```

- [ ] **步骤 2：添加单次挥斧并登记的方法**

在 `startChopping()` 前添加：

```ts
private async playAndRegisterChop(): Promise<void> {
    if (this._isChopCycleRunning || !this._currentTarget || !this.chopAction) {
        return;
    }

    const target = this._currentTarget;
    this._isChopCycleRunning = true;
    await this.chopAction.playChopAction(target.node.position.clone().add(this.offsetVec3));

    if (this._currentTarget === target && target.node.isValid &&
        target.getCurrentState() !== TreeState.Chopped) {
        target.registerWoodcutterChop(this.node);
    }

    this._isChopCycleRunning = false;
}
```

- [ ] **步骤 3：删除未登记的动画启动并调用串行方法**

在 `handleMovingState()` 抵达树木的分支中，删除：

```ts
this.skeletalAnimation.play("KanMuTou");
```

将 `startChopping()` 中的播放动作代码替换为：

```ts
this._isChopping = true;
void this.playAndRegisterChop();
```

将 `handleChoppingState()` 的继续砍伐分支替换为：

```ts
if (!this._isChopCycleRunning) {
    void this.playAndRegisterChop();
}
```

- [ ] **步骤 4：手动预览验证**

在 Cocos Creator 中停止预览后重新运行，不重开项目。观察一个 NPC 从靠近完整树到砍倒树：应可数到四次挥斧；前三次树保持未砍倒，第四次完成后树才消失。再验证主角一次、车辆一次仍可完成砍伐。

- [ ] **步骤 5：提交实现**

运行：

```powershell
git add -- assets/_Scripts/Tree.ts assets/_Scripts/Woodcutter.ts
git diff --cached --check
git commit -m "Sync woodcutter chops with animations"
git push origin main
```

预期：提交仅包含两个脚本，不包含 `assets/Scenes/DevScene.scene`。
