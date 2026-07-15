# 玩家移动中砍树实施计划

> **供自动化执行者使用：** 必须逐项执行本计划；步骤用复选框记录完成状态。

**目标：** 允许玩家移动时继续砍伐检测范围内的树，并保持移动方向朝向。

**架构：** `PlayerController` 在移动时也执行附近树木检测；`Tree` 对玩家不再应用移动暂停条件。移动中的玩家不调用 `faceTarget()`，因此朝向仍由移动输入控制。

**技术栈：** Cocos Creator 3.8.7、TypeScript、现有 `PlayerController`、`Tree` 与 `ChopAction`。

## 全局约束

- 玩家在树木检测半径内移动时可以播放砍伐动作并累计砍伐。
- 玩家离开树木触发范围后立即停止该树的计数。
- 不改变 NPC 动画驱动计数、车辆逻辑、摄像机、掉落或场景配置。

---

### 任务 1：允许 PlayerController 移动时检测并砍树

**文件：**
- 修改：`assets/_Scripts/PlayerController.ts:336-360`

**接口：**
- 使用：已有 `handleTreeInteraction()`、`_isMoving`、`TreeManager.getNearbyTrees()` 与 `ChopAction`。
- 产出：移动时仍执行附近树木检测；仅静止时朝向树木。

- [ ] **步骤 1：移除移动状态的提前返回**

将：

```ts
if (!this.treeManager || this._isMoving) {
    return;
}
```

改为：

```ts
if (!this.treeManager) {
    return;
}
```

- [ ] **步骤 2：移动中保持移动方向**

将附近树木分支中的：

```ts
this.faceTarget(closestTree.node.position);
```

改为：

```ts
if (!this._isMoving) {
    this.faceTarget(closestTree.node.position);
}
```

砍伐动作、相机震动和 `!this.chopAction.isPlaying()` 节流逻辑保持不变。

### 任务 2：让 Tree 在玩家移动时继续累计砍伐

**文件：**
- 修改：`assets/_Scripts/Tree.ts:344-406,412-428`

**接口：**
- 使用：已有 `ChopperType.Player`、`isChopperMoving()`、`checkStartChopping()`。
- 产出：玩家视为持续可砍伐者；NPC 和车辆保持原有移动判断。

- [ ] **步骤 1：让玩家不受移动暂停影响**

在 `isChopperMoving()` 的 Player 分支返回 `false`：

```ts
case ChopperType.Player:
    return false;
```

这样 `handleChoppingLogic()` 和 `checkStartChopping()` 都会允许玩家移动时开始或继续计数。

- [ ] **步骤 2：静态验证限制已解除**

运行：

```powershell
rg -n -C 4 'handleTreeInteraction|if \(!this\.treeManager|faceTarget\(closestTree|case ChopperType\.Player|isChopperMoving' assets/_Scripts/PlayerController.ts assets/_Scripts/Tree.ts
git diff --check
```

预期：PlayerController 不再以 `_isMoving` 提前返回；移动时不调用 `faceTarget`；Tree 的 Player 分支返回 `false`；无空白错误。

- [ ] **步骤 3：手动预览验证**

在 Cocos Creator 中停止预览后重新运行，不重开项目。拖动摇杆经过树木检测范围，确认玩家持续移动并播放砍伐动作；松开摇杆后仍可正常砍树；离开树木范围后不再继续计数。

- [ ] **步骤 4：提交实现**

运行：

```powershell
git add -- assets/_Scripts/PlayerController.ts assets/_Scripts/Tree.ts
git diff --cached --check
git commit -m "Allow player to chop while moving"
git push origin main
```

预期：提交只包含两个脚本，不包含场景文件或其他未跟踪文件。
