# Web Release 第二关完整运行链路修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变本地预览和森林区玩法的前提下，使第二关全部动态对象及玉米购买链路在 Web Mobile Release 中稳定运行。

**Architecture:** 保留现有玉米区专用脚本和动态创建流程，通过统一的运行时节点恢复函数、严格的“绑定后激活”顺序和明确的存放点转移所有权消除 Release 时序差异。源码级回归测试锁定每个动态入口，最后用 `debug: false` Web Mobile 构建验证产物。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Node.js `node:test`、Web Mobile Release。

## Global Constraints

- 不修改森林区第一关玩法逻辑。
- 不改变本地预览中已经正确的路线、速度、容量、价格、动画节奏或场景布局。
- 不通过关闭 Release 压缩、改为 Debug 构建或复制特殊 HTML 构建脚本规避问题。
- 不提交编辑器自动修改的 `assets/Scenes/DevScene.scene`。

---

### Task 1: 锁定第二关动态对象激活顺序

**Files:**
- Create: `tests/web-release-second-stage-runtime-parity-regression.test.mjs`
- Modify: `assets/_Scripts/ResourceFieldSystem.ts:786-878,966-1019`

**Interfaces:**
- Consumes: `restoreCornVisualHierarchy(root: Node, activateRoot?: boolean): void`。
- Produces: 工人、拖拉机和搬运工在所有引用配置完成后才启用行为组件和根节点。

- [ ] **Step 1: Write the failing test**

```js
test('第二关角色在完整绑定和恢复模型后才激活', () => {
    const source = read('../assets/_Scripts/ResourceFieldSystem.ts');
    const workers = method(source, 'spawnWorkers', 'spawnVehicle');
    const vehicle = method(source, 'spawnVehicle', 'clampVehiclePath');
    const hauler = method(source, 'spawnHauler', 'clearInheritedHaulerCargo');

    assert.match(workers, /createActor\([\s\S]*?true,\s*false,\s*\)/);
    assertOrder(workers, 'controller.setHarvestTargets', 'restoreCornVisualHierarchy(actor, false)', 'controller.enabled = true', 'actor.active = true');
    assertOrder(vehicle, 'behavior.setPathPoints', 'restoreCornVisualHierarchy(actor, false)', 'behavior.enabled = true', 'actor.active = true');
    assertOrder(hauler, 'behavior.carryStorage = carryStorage', 'restoreCornVisualHierarchy(actor, false)', 'behavior.enabled = true', 'actor.active = true');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web-release-second-stage-runtime-parity-regression.test.mjs`

Expected: FAIL，因为工人克隆后立即激活，三个行为组件也早于完整可视层级恢复被启用。

- [ ] **Step 3: Implement binding-before-activation**

```ts
const actor = this.createActor(prefab, fallback, true, false);
controller.enabled = false;
// 配置移动、砍伐、动画和田垄目标。
restoreCornVisualHierarchy(actor, false);
controller.enabled = true;
actor.active = true;
```

拖拉机和搬运工采用相同顺序：先把行为组件设为 `enabled = false`，配置全部路径、存放点与动画引用，调用 `restoreCornVisualHierarchy(actor, false)`，最后启用行为组件与根节点。

- [ ] **Step 4: Run focused test**

Run: `node --test tests/web-release-second-stage-runtime-parity-regression.test.mjs`

Expected: PASS。

### Task 2: 覆盖所有玉米产物容器入口

**Files:**
- Modify: `assets/_Scripts/CornVisualState.ts`
- Modify: `assets/_Scripts/CornStoragePoint.ts`
- Modify: `assets/_Scripts/CornHaulerBackpack.ts`
- Modify: `assets/_Scripts/MultiResourceBackpack.ts`
- Test: `tests/web-release-second-stage-runtime-parity-regression.test.mjs`

**Interfaces:**
- Consumes: 动态克隆或从上一容器移出的 `Node`。
- Produces: `restoreCornVisualHierarchy(root: Node, activateRoot = true): void`，恢复渲染分支但允许角色创建时保持根节点关闭。

- [ ] **Step 1: Extend the failing test**

```js
test('每个玉米容器入口都恢复 Release 可视层级', () => {
    const helper = read('../assets/_Scripts/CornVisualState.ts');
    assert.match(helper, /activateRoot = true/);
    assert.match(helper, /if \(activateRoot\) root\.active = true/);

    for (const file of [
        'CornStoragePoint.ts',
        'CornHaulerBackpack.ts',
        'MultiResourceBackpack.ts',
        'CornCustomerScheduler.ts',
    ]) {
        assert.match(read(`../assets/_Scripts/${file}`), /restoreCornVisualHierarchy/);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web-release-second-stage-runtime-parity-regression.test.mjs`

Expected: FAIL，因为搬运工背包和玩家多资源背包尚未调用统一恢复函数，且恢复函数总会提前激活根节点。

- [ ] **Step 3: Make root activation explicit**

```ts
export function restoreCornVisualHierarchy(root: Node, activateRoot = true): void {
    // 递归恢复包含 Animation 或 Renderer 的分支。
    if (activateRoot) root.active = true;
    restoreBranch(root);
}
```

- [ ] **Step 4: Restore every transferred or cloned product**

在 `CornStoragePoint.addResource/removeResource/releaseStalledResource/recoverInterruptedTransfers`、`CornHaulerBackpack.addResource/removeResource/recoverInterruptedTransfers` 以及 `MultiResourceBackpack.addResource/takeResource` 的真实节点入口调用：

```ts
Tween.stopAllByTarget(resource);
restoreCornVisualHierarchy(resource);
```

调用发生在重新设置父节点和目标局部变换之前，避免上一容器的补间回调覆盖新容器状态。

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/web-release-second-stage-runtime-parity-regression.test.mjs tests/web-release-visual-reactivation-regression.test.mjs`

Expected: PASS。

### Task 3: 完成售卖与顾客购买的转移所有权

**Files:**
- Modify: `assets/_Scripts/CornStoragePoint.ts`
- Modify: `assets/_Scripts/CornHauler.ts`
- Modify: `assets/_Scripts/CornPickupDetector.ts`
- Modify: `assets/_Scripts/CornCustomerScheduler.ts`
- Test: `tests/web-release-second-stage-runtime-parity-regression.test.mjs`

**Interfaces:**
- Produces: `CornStoragePoint.finalizeResourceTransfer(resource: Node): void`，由源存放点在目标接收成功后释放对该节点的暂存引用。
- Consumes: `removeResource()` 返回的真实节点以及目标容器 `addResource()` 的布尔结果。

- [ ] **Step 1: Add the failing ownership test**

```js
test('成功转移后源存放点释放节点所有权', () => {
    const storage = read('../assets/_Scripts/CornStoragePoint.ts');
    const hauler = read('../assets/_Scripts/CornHauler.ts');
    const pickup = read('../assets/_Scripts/CornPickupDetector.ts');
    const customer = read('../assets/_Scripts/CornCustomerScheduler.ts');

    assert.match(storage, /public finalizeResourceTransfer\(resource: Node\): void/);
    assert.match(hauler, /from instanceof CornStoragePoint[\s\S]*?from\.finalizeResourceTransfer\(resource\)/);
    assert.match(pickup, /collectionStorage\.finalizeResourceTransfer\(item\)/);
    assert.match(customer, /targetStoragePoint\.finalizeResourceTransfer\(resource\)/);
    assert.match(customer, /if \(moved\)[\s\S]*?dropCoins/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web-release-second-stage-runtime-parity-regression.test.mjs`

Expected: FAIL，因为成功转移后源存放点的 `_removed` 仍持有已经属于目标容器的节点。

- [ ] **Step 3: Implement transfer finalization**

```ts
public finalizeResourceTransfer(resource: Node): void {
    for (const [key, stored] of this._removed) {
        if (stored.node === resource) {
            this._removed.delete(key);
            return;
        }
    }
}
```

搬运、玩家取货和顾客购买只在目标 `addResource()` 返回 `true` 后调用该方法；目标失败时仍将节点放回源存放点。

- [ ] **Step 4: Keep purchase and coins atomic**

```ts
if (moved && resource) {
    targetStoragePoint.finalizeResourceTransfer(resource);
    this.updateFillTip(npcStoragePoint.amount, npcStoragePoint.capacity);
}
```

顾客装满四件后继续沿用现有 `loadComplete(npc)` 与 `dropCoins()`，确保只有成功购买的完整批次产生原有数量的金币。

- [ ] **Step 5: Run corn chain regressions**

Run: `node --test tests/web-release-second-stage-runtime-parity-regression.test.mjs tests/corn-customer-purchase-animation-regression.test.mjs tests/corn-worker-parity-regression.test.mjs tests/corn-vehicle-hauler-parity-regression.test.mjs`

Expected: PASS。

### Task 4: 完整回归与 Web Mobile Release 验证

**Files:**
- Verify: `tests/*.test.mjs`
- Verify: `build/web-mobile`

**Interfaces:**
- Consumes: Tasks 1-3 的第二关动态运行时实现。
- Produces: 可通过 HTTP 打开的 `debug: false` Web Mobile Release 构建。

- [ ] **Step 1: Run all Node regressions**

Run: `node --test tests/*.test.mjs`

Expected: 所有测试通过，失败数为 0。

- [ ] **Step 2: Run TypeScript validation**

Run: `npx.cmd --yes --package typescript@5.1.6 tsc --noEmit --pretty false --project tsconfig.json`

Expected: 本次修改文件没有新增错误；Cocos 引擎声明或既有脚本错误单独记录。

- [ ] **Step 3: Build Web Mobile Release**

使用项目当前 Cocos Creator CLI 与 `profiles/v2/packages/builder.json` 中的 Web Mobile 任务构建，保持 `debug: false`。

Expected: Cocos 命令行返回其成功退出状态，`build/web-mobile/index.html` 与 `src/import-map.json` 被重新生成。

- [ ] **Step 4: Inspect output and serve it over HTTP**

Run: `rg -n "constructor\.name" build/web-mobile/assets build/web-mobile/src`

Expected: 第二关组件筛选中匹配数为 0。随后通过本地 HTTP 服务访问构建，确认启动控制台没有第二关组件初始化错误。

- [ ] **Step 5: Commit implementation without the editor scene**

```powershell
git add -- assets/_Scripts tests docs/superpowers/plans/2026-07-22-web-release-second-stage-runtime-parity.md
git restore --staged -- assets/Scenes/DevScene.scene
git commit -m "fix: stabilize full stage two web release chain"
```
