# NPC 挥斧动画恢复实施计划

> **供自动化执行者使用：** 必须逐项执行本计划；步骤用复选框记录完成状态。

**目标：** 恢复 NPC 每次砍伐的可见挥斧动画，并保持动画完成后才登记一次砍伐。

**架构：** `Woodcutter.playAndRegisterChop()` 是每一轮 NPC 砍伐的唯一入口。在该方法开始时使用 `Woodcutter.skeletalAnimation` 播放 `KanMuTou`，随后继续等待 `ChopAction` 完成并登记树木砍伐。

**技术栈：** Cocos Creator 3.8.7、TypeScript、Cocos `SkeletalAnimation`。

## 全局约束

- 每轮 NPC 砍伐只播放一次 `KanMuTou`，随后登记一次砍伐。
- 不恢复旧的、到达树木时额外播放但不登记的动画调用。
- 不修改场景、主角、车辆、掉落或镜头。

---

### 任务 1：在登记循环中播放 NPC 骨骼动画

**文件：**
- 修改：`assets/_Scripts/Woodcutter.ts:326-342`

**接口：**
- 使用：已有 `skeletalAnimation: SkeletalAnimation`、`playAndRegisterChop(): Promise<void>` 与 `ChopAction.playChopAction(): Promise<void>`。
- 产出：每次 `playAndRegisterChop()` 都在登记前播放一次 `KanMuTou`。

- [ ] **步骤 1：确认未登记的旧播放调用不存在**

运行：

```powershell
rg -n -C 3 'skeletalAnimation\.play\("KanMuTou"\)|playAndRegisterChop' assets/_Scripts/Woodcutter.ts
```

预期：`handleMovingState()` 不再直接播放 `KanMuTou`；存在 `playAndRegisterChop()`。

- [ ] **步骤 2：在单次循环入口播放动画**

在 `playAndRegisterChop()` 的 `_isChopCycleRunning = true;` 后、等待 `chopAction.playChopAction()` 前加入：

```ts
if (this.skeletalAnimation) {
    this.skeletalAnimation.play("KanMuTou");
}
```

最终核心顺序必须为：

```ts
this._isChopCycleRunning = true;
if (this.skeletalAnimation) {
    this.skeletalAnimation.play("KanMuTou");
}
await this.chopAction.playChopAction(target.node.position.clone().add(this.offsetVec3));
target.registerWoodcutterChop(this.node);
```

- [ ] **步骤 3：静态验证**

运行：

```powershell
rg -n -C 5 'private async playAndRegisterChop|skeletalAnimation\.play\("KanMuTou"\)|registerWoodcutterChop' assets/_Scripts/Woodcutter.ts
git diff --check
```

预期：`KanMuTou` 只在 `playAndRegisterChop()` 内播放，并且位于 `registerWoodcutterChop()` 调用之前；无空白错误。

- [ ] **步骤 4：手动预览验证**

在 Cocos Creator 中停止预览后重新运行，不重开项目。观察 NPC 砍完整树：应清楚显示四次挥斧，第四次结束后树才砍倒；没有额外的起手动画。

- [ ] **步骤 5：提交实现**

运行：

```powershell
git add -- assets/_Scripts/Woodcutter.ts
git diff --cached --check
git commit -m "Restore woodcutter chop animation"
git push origin main
```

预期：提交只包含 `assets/_Scripts/Woodcutter.ts`，不包含场景文件。
