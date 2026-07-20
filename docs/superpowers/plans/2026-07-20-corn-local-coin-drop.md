# 玉米区本地金币生成与收集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让左右玉米区顾客完成四个玉米的订单后，在所属玉米区生成三枚可收集实体金币，并保持森林区金币逻辑不变。

**Architecture:** `CornCustomerScheduler` 只解析所属 `Finish` 模块中的 `CoinPlace`，在其下确保存在独立 `CornCoinDropArea`、`CornStoragePoint` 和碰撞体。新增 `CornCoinCollector` 负责把本地实体金币转入全局玩家金币背包并更新 UI，不导入森林 `CoinCollector`、`StoragePoint` 或 `ResourceManager`。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Node.js `node:test`

## Global Constraints

- 每块玉米田拥有独立的金币节点、库存和收集状态。
- 每位顾客购买满 4 个玉米后固定生成 3 枚金币，间隔 0.1 秒。
- 每枚实体金币被玩家收集后增加 5 点金币数。
- 本地金币槽容量固定为 54，满载时不得继续生成。
- 玉米金币脚本不得导入森林 `CoinCollector`、`StoragePoint`、`ResourceManager` 或 `NPCScheduler`。
- 中央森林调度器和 `LandObj/coinDropArea` 保持不变。
- 保留工作区中现有搬运工背包与 Cocos 设置改动，不纳入本计划提交。

---

### Task 1：建立本地金币区域回归测试

**Files:**

- Modify: `tests/corn-customer-purchase-animation-regression.test.mjs`
- Inspect: `assets/Scenes/DevScene.scene`
- Inspect: `assets/_Scripts/CornCustomerScheduler.ts`

**Interfaces:**

- Consumes: 场景中两个玉米 `NPCScheduler-001` 节点、各自 `CoinPlace`、中央森林 `coinDropArea`。
- Produces: 能捕获“玉米金币被送到森林区”症状的确定性测试。

- [ ] **Step 1: 写出当前会失败的场景归属测试**

```js
test('each corn scheduler owns a module-local coin anchor', () => {
    for (const rootName of ['Finish', 'Finish-001']) {
        const root = scene.find(entry => entry?.__type__ === 'cc.Node' && entry._name === rootName);
        const schedulerNode = childNamed(root, 'NPCScheduler-001');
        const scheduler = componentOf(schedulerNode);
        const coinAnchor = nodeAt(scheduler.coinDropArea);

        assert.equal(nodeAt(coinAnchor._parent), root);
        assert.equal(coinAnchor._name, 'CoinPlace');
    }
});
```

- [ ] **Step 2: 写出独立收集器与结算测试**

```js
test('corn coins use independent storage and collection logic', () => {
    assert.ok(existsSync(cornCollectorUrl));
    const collectorSource = readFileSync(cornCollectorUrl, 'utf8');
    const schedulerSource = readFileSync(schedulerUrl, 'utf8');

    assert.doesNotMatch(collectorSource, /CoinCollector|Resource\/StoragePoint|ResourceManager/);
    assert.match(collectorSource, /sourceStorage\.removeResource\(4\)/);
    assert.match(collectorSource, /parseInt\(coinAmountLabel\.string\) \+ 5/);
    assert.match(schedulerSource, /storage\.capacity = 54/);
    assert.match(schedulerSource, /for \(let i = 0; i < this\.coinReward; i\+\+\)/);
    assert.match(schedulerSource, /i \* 0\.1/);
});
```

- [ ] **Step 3: 运行测试确认红灯**

Run: `node --test tests/corn-customer-purchase-animation-regression.test.mjs`

Expected: FAIL，两个玉米调度器的 `coinDropArea` 当前父节点为 `LandObj`，且 `CornCoinCollector.ts` 不存在。

- [ ] **Step 4: 暂不提交测试**

测试与实现一起保留在工作区，避免单独提交失败状态。

### Task 2：实现独立 CornCoinCollector

**Files:**

- Create: `assets/_Scripts/CornCoinCollector.ts`
- Create: `assets/_Scripts/CornCoinCollector.ts.meta`
- Test: `tests/corn-customer-purchase-animation-regression.test.mjs`

**Interfaces:**

- Consumes: `configure(sourceStorage: CornStoragePoint, coinLoadArea: Node): void`、全局 `CoinBackpack`、`Canvas/CoinLabel/coinAmount`。
- Produces: 玩家进入触发区后逐枚收集本地金币的独立组件。

- [ ] **Step 1: 创建组件属性和显式配置接口**

```ts
@ccclass('CornCoinCollector')
export class CornCoinCollector extends Component {
    @property({ type: Node }) public coinLoadArea: Node = null!;
    @property public collectInterval = 0.05;
    @property public collectAnimationTime = 0.05;
    @property public coinFlyHeight = 2;

    private _sourceStorage: CornStoragePoint | null = null;
    private _playerCoinBackpack: CoinBackpack | null = null;
    private _isPlayerInArea = false;
    private _collectTimer = 0;

    public configure(sourceStorage: CornStoragePoint, coinLoadArea: Node): void {
        this._sourceStorage = sourceStorage;
        this.coinLoadArea = coinLoadArea;
        this._playerCoinBackpack = this.node.scene.getComponentInChildren(CoinBackpack);
    }
}
```

- [ ] **Step 2: 实现触发区注册与玩家识别**

```ts
protected onEnable(): void {
    const collider = this.node.getComponent(Collider);
    collider?.on('onTriggerEnter', this.onPlayerEnter, this);
    collider?.on('onTriggerExit', this.onPlayerExit, this);
}

protected onDisable(): void {
    const collider = this.node.getComponent(Collider);
    collider?.off('onTriggerEnter', this.onPlayerEnter, this);
    collider?.off('onTriggerExit', this.onPlayerExit, this);
}

private isPlayerNode(node: Node): boolean {
    return node.name === 'Player'
        || node.getComponent(PlayerController) !== null
        || node.parent?.name === 'Player';
}
```

- [ ] **Step 3: 实现逐枚收集并更新玩家金币**

```ts
private collectCoin(): void {
    const sourceStorage = this._sourceStorage;
    const backpackMount = this._playerCoinBackpack?.coinBackpackMount ?? null;
    const destination = backpackMount?.components.find(component =>
        typeof (component as StorageLike).addResource === 'function'
        && typeof (component as StorageLike).amount === 'number',
    ) as StorageLike | undefined;
    if (!sourceStorage || !destination) return;

    const coin = sourceStorage.removeResource(4);
    if (!coin) return;
    if (!destination.addResource(coin, 4, new Vec3(0, 0, 360), false)) {
        sourceStorage.addResource(coin, 1);
        return;
    }

    const coinAmountLabel = find('Canvas/CoinLabel/coinAmount')?.getComponent(Label);
    if (coinAmountLabel) {
        coinAmountLabel.string = String(parseInt(coinAmountLabel.string) + 5);
    }
}
```

- [ ] **Step 4: 创建 TypeScript meta**

使用新的稳定 UUID，并保持 Cocos Creator 3.8.7 TypeScript meta 格式：

```json
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "4db37882-4bfa-4e78-b5b1-882cb68079fa",
  "files": [],
  "subMetas": {},
  "userData": {}
}
```

- [ ] **Step 5: 运行针对性测试**

Run: `node --test tests/corn-customer-purchase-animation-regression.test.mjs`

Expected: 收集器独立性与每枚增加 5 的断言通过；场景本地接线断言仍失败。

### Task 3：让 CornCustomerScheduler 创建并使用本地金币区

**Files:**

- Modify: `assets/_Scripts/CornCustomerScheduler.ts`
- Test: `tests/corn-customer-purchase-animation-regression.test.mjs`

**Interfaces:**

- Consumes: 本模块 `CoinPlace`、`CornStoragePoint`、`CornCoinCollector.configure(...)`、金币预制体。
- Produces: `ensureLocalCoinDropArea(): CornStoragePoint | null` 和只向本田生成金币的结算流程。

- [ ] **Step 1: 实现本模块 CoinPlace 解析**

```ts
private resolveModuleRoot(): Node | null {
    const scene = this.node.scene;
    let current: Node | null = this.node.parent;
    while (current && current !== scene) {
        if (current.name === 'Finish' || current.name === 'Finish-001') return current;
        current = current.parent;
    }
    return null;
}

private resolveLocalCoinAnchor(): Node | null {
    return this.resolveModuleRoot()?.getChildByName('CoinPlace') ?? null;
}
```

- [ ] **Step 2: 创建本地金币节点、库存和触发区**

```ts
private ensureLocalCoinDropArea(): CornStoragePoint | null {
    const anchor = this.resolveLocalCoinAnchor();
    if (!anchor) return null;

    const dropArea = anchor.getChildByName('CornCoinDropArea') ?? new Node('CornCoinDropArea');
    if (!dropArea.parent) dropArea.setParent(anchor);
    dropArea.setPosition(Vec3.ZERO);

    const stackArea = dropArea.getChildByName('CoinStack') ?? new Node('CoinStack');
    if (!stackArea.parent) stackArea.setParent(dropArea);
    stackArea.setPosition(0.5, 0, 0);

    const storage = dropArea.getComponent(CornStoragePoint) ?? dropArea.addComponent(CornStoragePoint);
    storage.storageName = `${this.resolveModuleRoot()?.name}_coins`;
    storage.capacity = 54;
    storage.resourcePerRow = 2;
    storage.resourcePerCol = 3;
    storage.resourceRowSpacing = 1;
    storage.resourceColSpacing = 0.5;
    storage.layerHeight = 0.2;
    storage.stackAreaNode = stackArea;

    const collider = dropArea.getComponent(BoxCollider) ?? dropArea.addComponent(BoxCollider);
    collider.isTrigger = true;
    collider.center.set(0.1, 0, -0.2);
    collider.size.set(2.3, 1, 2.4);

    const collector = dropArea.getComponent(CornCoinCollector) ?? dropArea.addComponent(CornCoinCollector);
    collector.configure(storage, stackArea);
    this.coinDropArea = dropArea;
    return storage;
}
```

- [ ] **Step 3: 让金币创建进入 CornStoragePoint 的真实资源表**

```ts
private createCoin(storage: CornStoragePoint): boolean {
    if (!this.coinPrefab) return false;
    const coin = instantiate(this.coinPrefab);
    coin.setScale(Vec3.ZERO);
    if (!storage.addResource(coin, 1)) {
        coin.destroy();
        return false;
    }
    tween(coin)
        .to(0.3, { scale: new Vec3(1.17, 1.17, 1.17) }, { easing: 'bounceOut' })
        .to(0.2, { scale: Vec3.ONE }, { easing: 'bounceOut' })
        .start();
    return true;
}
```

- [ ] **Step 4: 修改三枚金币结算循环**

```ts
private dropCoins(): void {
    const storage = this.ensureLocalCoinDropArea();
    if (!storage || !this.coinPrefab) return;
    for (let i = 0; i < this.coinReward; i++) {
        this.scheduleOnce(() => {
            if (!storage.hasSpace(1)) return;
            this.createCoin(storage);
        }, i * 0.1);
    }
}
```

- [ ] **Step 5: 运行针对性测试**

Run: `node --test tests/corn-customer-purchase-animation-regression.test.mjs`

Expected: 独立实现、三枚金币、容量、间隔和本地解析源码断言通过；场景序列化接线断言仍失败。

### Task 4：迁移场景引用并完成验证

**Files:**

- Modify: `assets/Scenes/DevScene.scene`
- Modify: `tests/corn-customer-purchase-animation-regression.test.mjs`
- Test: `tests/*.test.mjs`

**Interfaces:**

- Consumes: 左右 `CoinPlace` 节点、两个 `CornCustomerScheduler.coinDropArea` 序列化字段。
- Produces: 场景加载时每个玉米调度器只持有所属本地金币锚点。

- [ ] **Step 1: 迁移两个场景引用**

将左侧玉米调度组件的 `coinDropArea` 从中央节点 `170` 改为左侧 `CoinPlace` 节点 `1986`；将右侧从 `170` 改为右侧 `CoinPlace` 节点 `2307`。中央森林调度器继续引用 `170`。

- [ ] **Step 2: 加强场景回归测试**

```js
assert.notEqual(leftScheduler.coinDropArea.__id__, rightScheduler.coinDropArea.__id__);
assert.equal(nodeAt(leftScheduler.coinDropArea)._parent.__id__, leftRootIndex);
assert.equal(nodeAt(rightScheduler.coinDropArea)._parent.__id__, rightRootIndex);
assert.equal(forestScheduler.coinDropArea.__id__, 170);
```

- [ ] **Step 3: 运行针对性与全量测试**

Run: `node --test tests/corn-customer-purchase-animation-regression.test.mjs`

Expected: PASS。

Run: `node --test tests/*.test.mjs`

Expected: 全部 PASS。

- [ ] **Step 4: 验证场景和 TypeScript 诊断**

Run: `node -e "JSON.parse(require('fs').readFileSync('assets/Scenes/DevScene.scene','utf8')); console.log('scene json ok')"`

Expected: `scene json ok`。

Run: `npx.cmd --yes --package typescript@5.1.6 tsc --noEmit --pretty false --project tsconfig.json`

Expected: `CornCoinCollector.ts`、`CornCustomerScheduler.ts`、`CornStoragePoint.ts` 无新增错误；现有 Cocos 3.8.7 引擎声明错误可单独记录。

- [ ] **Step 5: 检查差异并选择性提交**

```powershell
git diff --check -- assets/Scenes/DevScene.scene assets/_Scripts/CornCoinCollector.ts assets/_Scripts/CornCustomerScheduler.ts tests/corn-customer-purchase-animation-regression.test.mjs
git add assets/Scenes/DevScene.scene assets/_Scripts/CornCoinCollector.ts assets/_Scripts/CornCoinCollector.ts.meta assets/_Scripts/CornCustomerScheduler.ts tests/corn-customer-purchase-animation-regression.test.mjs docs/superpowers/plans/2026-07-20-corn-local-coin-drop.md
git diff --cached --name-only
git commit -m "fix: generate corn customer coins locally"
```

Expected: 暂存区不包含 `CornHaulerBackpack*`、`CornHauler.ts`、`settings/v2/packages/cocos-service.json` 或搬运工背包测试改动。

- [ ] **Step 6: Creator 运行验收**

运行 `DevScene`，分别验证左右玉米区：顾客拿满 4 个玉米后在本田 `CoinPlace` 生成 3 枚金币；玩家靠近后每枚金币增加 5；左右金币不串用；森林区不出现玉米订单金币。
