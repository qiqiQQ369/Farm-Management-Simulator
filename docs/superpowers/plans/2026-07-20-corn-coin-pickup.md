# 玉米金币拾取修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 玩家进入左右玉米金币区域后，金币可靠地逐枚飞入真实玩家背包并每枚增加 5。

**Architecture:** `CornCustomerScheduler` 显式把真实玩家和 `CoinBackpack` 传给独立 `CornCoinCollector`。收集器保留森林碰撞触发，并使用 `BoxCollider` 的本地 X/Z 范围检测作为运行时碰撞漏事件的兜底。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Node.js `node:test`。

## Global Constraints

- 不导入或复用森林区 `CoinCollector`、`StoragePoint`、`ResourceManager`。
- 金币仍进入真实玩家现有实体金币背包。
- 每枚成功拾取的金币增加 5；背包拒绝时恢复金币且不增加金额。
- 左右玉米区保持独立金币库存。

---

### Task 1: 显式绑定真实玩家

**Files:**
- Modify: `tests/corn-customer-purchase-animation-regression.test.mjs`
- Modify: `assets/_Scripts/CornCustomerScheduler.ts`
- Modify: `assets/_Scripts/CornCoinCollector.ts`

**Interfaces:**
- Consumes: 场景中带 `PlayerController` 的真实玩家节点及其 `CoinBackpack`。
- Produces: `CornCoinCollector.configure(sourceStorage, coinLoadArea, playerNode, playerCoinBackpack): void`。

- [ ] **Step 1: 写入显式绑定失败测试**

```js
assert.match(collectorSource, /public configure\([\s\S]*playerNode: Node,[\s\S]*playerCoinBackpack: CoinBackpack/);
assert.match(collectorSource, /this\._playerNode = playerNode/);
assert.match(collectorSource, /this\._playerCoinBackpack = playerCoinBackpack/);
assert.match(schedulerSource, /const playerController = this\.node\.scene\?\.getComponentInChildren\(PlayerController\)/);
assert.match(schedulerSource, /collector\.configure\(storage, stackArea, playerController\?\.node \?\? null, playerCoinBackpack\)/);
```

- [ ] **Step 2: 运行定向测试并确认失败**

```powershell
node --test tests/corn-customer-purchase-animation-regression.test.mjs
```

Expected: FAIL，指出 `configure()` 缺少玩家参数。

- [ ] **Step 3: 扩展调度器显式绑定**

在 `CornCustomerScheduler.ts` 导入：

```ts
import { CoinBackpack } from './CoinBackpack';
import { PlayerController } from './PlayerController';
```

在创建收集器后配置：

```ts
const playerController = this.node.scene?.getComponentInChildren(PlayerController) ?? null;
const playerCoinBackpack = playerController?.node.getComponent(CoinBackpack) ?? null;
collector.configure(storage, stackArea, playerController?.node ?? null, playerCoinBackpack);
```

- [ ] **Step 4: 扩展收集器配置接口**

在 `CornCoinCollector` 中增加字段并替换配置方法：

```ts
private _playerNode: Node | null = null;

public configure(
    sourceStorage: CornStoragePoint,
    coinLoadArea: Node,
    playerNode: Node | null,
    playerCoinBackpack: CoinBackpack | null,
): void {
    this._sourceStorage = sourceStorage;
    this.coinLoadArea = coinLoadArea;
    this._playerNode = playerNode;
    this._playerCoinBackpack = playerCoinBackpack;
    this.resolvePlayerBindings();
}
```

将自动回退限制为真实玩家：

```ts
private resolvePlayerBindings(): void {
    if (!this._playerNode?.isValid) {
        this._playerNode = this.node.scene?.getComponentInChildren(PlayerController)?.node ?? null;
    }
    if (!this._playerCoinBackpack?.node?.isValid) {
        this._playerCoinBackpack = this._playerNode?.getComponent(CoinBackpack) ?? null;
    }
}
```

同时把 `onLoad()` 和 `findPlayerStorage()` 中原有的 `resolvePlayerCoinBackpack()` 调用替换为：

```ts
this.resolvePlayerBindings();
```

- [ ] **Step 5: 运行定向测试并确认通过**

```powershell
node --test tests/corn-customer-purchase-animation-regression.test.mjs
```

Expected: 显式绑定测试通过。

### Task 2: 增加金币区域范围兜底

**Files:**
- Modify: `tests/corn-customer-purchase-animation-regression.test.mjs`
- Modify: `assets/_Scripts/CornCoinCollector.ts`

**Interfaces:**
- Consumes: `BoxCollider.center`、`BoxCollider.size`、真实玩家世界坐标。
- Produces: `refreshPlayerProximity(): void`，更新 `_isPlayerWithinBounds`；碰撞或范围任一成立时允许收集。

- [ ] **Step 1: 写入范围兜底失败测试**

```js
assert.match(collectorSource, /private _isPlayerInTrigger = false/);
assert.match(collectorSource, /private _isPlayerWithinBounds = false/);
assert.match(collectorSource, /this\.refreshPlayerProximity\(\)/);
assert.match(collectorSource, /if \(!this\._isPlayerInTrigger && !this\._isPlayerWithinBounds\) return/);
assert.match(collectorSource, /this\.node\.inverseTransformPoint\(localPlayerPosition, player\.worldPosition\)/);
assert.match(collectorSource, /Math\.abs\(localPlayerPosition\.x - center\.x\) <= size\.x \* 0\.5/);
assert.match(collectorSource, /Math\.abs\(localPlayerPosition\.z - center\.z\) <= size\.z \* 0\.5/);
```

- [ ] **Step 2: 运行测试并确认失败**

```powershell
node --test tests/corn-customer-purchase-animation-regression.test.mjs
```

Expected: FAIL，指出缺少范围检测状态。

- [ ] **Step 3: 实现碰撞与范围双通道状态**

从 `cc` 导入 `BoxCollider`，并加入：

```ts
private _isPlayerInTrigger = false;
private _isPlayerWithinBounds = false;
private readonly _localPlayerPosition = new Vec3();
```

更新循环：

```ts
protected update(deltaTime: number): void {
    this.refreshPlayerProximity();
    if (!this._isPlayerInTrigger && !this._isPlayerWithinBounds) return;
    this._collectTimer += deltaTime;
    if (this._collectTimer < this.collectInterval) return;
    this._collectTimer = 0;
    this.collectCoin();
}
```

范围检测：

```ts
private refreshPlayerProximity(): void {
    this.resolvePlayerBindings();
    const player = this._playerNode;
    const collider = this.node.getComponent(BoxCollider);
    if (!player?.isValid || !collider) {
        this._isPlayerWithinBounds = false;
        return;
    }

    const localPlayerPosition = this._localPlayerPosition;
    this.node.inverseTransformPoint(localPlayerPosition, player.worldPosition);
    const center = collider.center;
    const size = collider.size;
    this._isPlayerWithinBounds =
        Math.abs(localPlayerPosition.x - center.x) <= size.x * 0.5
        && Math.abs(localPlayerPosition.z - center.z) <= size.z * 0.5;
}
```

碰撞回调只更新 `_isPlayerInTrigger`；`onDisable()` 同时清空两个状态。

- [ ] **Step 4: 保留成功和失败转移语义**

确认 `collectCoin()` 仍包含：

```ts
const coin = sourceStorage.removeResource(4);
if (!coin) return;
if (!destination.addResource(coin, 4, new Vec3(0, 0, 360), false)) {
    sourceStorage.addResource(coin, 1);
    return;
}
coinAmountLabel.string = String(currentAmount + 5);
```

- [ ] **Step 5: 运行定向测试并确认通过**

```powershell
node --test tests/corn-customer-purchase-animation-regression.test.mjs
```

Expected: 全部通过。

- [ ] **Step 6: 提交金币拾取修复**

```powershell
git add -- assets/_Scripts/CornCustomerScheduler.ts assets/_Scripts/CornCoinCollector.ts tests/corn-customer-purchase-animation-regression.test.mjs
git commit -m "fix: make corn coins reliably collectible"
```

### Task 3: 全量验证

**Files:**
- Verify: `assets/_Scripts/ResourceFieldSystem.ts`
- Verify: `assets/_Scripts/CornCoinCollector.ts`
- Verify: `assets/_Scripts/CornCustomerScheduler.ts`
- Verify: `assets/Scenes/DevScene.scene`

**Interfaces:**
- Consumes: 两份计划的完成提交。
- Produces: 自动化验证结果与 Creator 目视验收清单。

- [ ] **Step 1: 运行全部回归测试**

```powershell
node --test tests/*.test.mjs
```

Expected: 全部通过。

- [ ] **Step 2: 验证场景 JSON 与定向 TypeScript 诊断**

```powershell
node -e "JSON.parse(require('fs').readFileSync('assets/Scenes/DevScene.scene','utf8')); console.log('scene json ok')"
npx.cmd --yes --package typescript@5.1.6 tsc --noEmit --pretty false --project tsconfig.json
```

Expected: 场景解析成功；输出中不包含 `CornCoinCollector.ts`、`CornCustomerScheduler.ts` 或 `ResourceFieldSystem.ts` 的新增错误。

- [ ] **Step 3: 清理检查**

```powershell
rg -n "\[DEBUG-|debugger" assets/_Scripts/CornCoinCollector.ts assets/_Scripts/CornCustomerScheduler.ts assets/_Scripts/ResourceFieldSystem.ts tests
git diff --check
```

Expected: 无调试残留；无补丁格式错误。

- [ ] **Step 4: Cocos Creator 目视验收**

1. 左右玉米区搬运工解锁后脚底位于地面。
2. 玩家进入左右金币底板范围后，金币逐枚飞入真实玩家背包。
3. 每枚金币使 UI 金额增加 5。
4. 玩家离开范围后停止拾取；背包满时金币留在本地。
5. 森林区行为保持不变。
