# 玉米搬运工随身背包实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让玉米搬运工出生时身体为空，并使用与主角玉米背包一致的大容量、单列堆叠、42 个显示上限和飞入动画。

**Architecture:** 新增纯 TypeScript 库存计算模块作为可运行测试接口，新增 `CornHaulerBackpack` 负责 NPC 随身库存与显示。`CornHauler` 继续负责搬运状态机，`ResourceFieldSystem` 在 NPC 激活前清理克隆物品、创建骨骼挂点并注入独立背包。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Node.js `node:test`。

## Global Constraints

- 玉米搬运工生成时库存数量必须为 `0`，身上不能显示克隆自主角的玉米、木头或金币。
- 搬运工不能直接挂载 `MultiResourceBackpack`、`WoodBackpack`、`CoinBackpack` 或森林区存储脚本。
- 搬运工玉米挂在人物背部骨骼挂点上。
- 布局为 `1×1` 单列，行距 `0.2`、列距 `0.2`、层高 `0.2`。
- 容量与显示上限均为 `42`；装满后按森林区状态机前往销售区卸货。
- 装货动画为 `0.32` 秒 `sineOut`。
- 收集区和销售区继续使用 `CornStoragePoint`，搬运路径和转移间隔不变。
- 保留所有与本任务无关的用户改动。

---

### Task 1: 可测试的搬运工库存规则

**Files:**
- Create: `assets/_Scripts/CornHaulerBackpackInventory.ts`
- Create: `assets/_Scripts/CornHaulerBackpackInventory.ts.meta`
- Modify: `tests/corn-vehicle-hauler-parity-regression.test.mjs`

**Interfaces:**
- Consumes: 当前库存数量、容量、显示上限和堆叠索引。
- Produces: `planCornHaulerAdd()`、`planCornHaulerRemove()`、`getCornHaulerVisibleCount()`、`getCornHaulerStackPosition()`。

- [ ] **Step 1: 编写库存边界和单列坐标失败测试**

在测试文件导入纯 TypeScript 模块并加入：

```js
import {
    getCornHaulerStackPosition,
    getCornHaulerVisibleCount,
    planCornHaulerAdd,
    planCornHaulerRemove,
} from '../assets/_Scripts/CornHaulerBackpackInventory.ts';

test('corn hauler backpack matches the player corn capacity and visible stack rules', () => {
    assert.deepEqual(planCornHaulerAdd(0), {
        accepted: true,
        nextAmount: 1,
        displayIncomingNode: true,
    });
    assert.deepEqual(planCornHaulerAdd(42), {
        accepted: false,
        nextAmount: 42,
        displayIncomingNode: false,
    });
    assert.equal(getCornHaulerVisibleCount(42), 42);
    assert.deepEqual(planCornHaulerRemove(42), {
        removed: true,
        nextAmount: 41,
        createTransferNode: false,
    });
    assert.deepEqual(getCornHaulerStackPosition(0), { x: -0.2, y: 0, z: -0.2 });
    assert.deepEqual(getCornHaulerStackPosition(1), { x: -0.2, y: 0.2, z: -0.2 });
});
```

- [ ] **Step 2: 运行测试确认红灯**

Run: `node --test tests/corn-vehicle-hauler-parity-regression.test.mjs`

Expected: FAIL，提示缺少 `CornHaulerBackpackInventory.ts`。

- [ ] **Step 3: 实现最小库存计算模块**

```ts
export type CornHaulerAddPlan = {
    accepted: boolean;
    nextAmount: number;
    displayIncomingNode: boolean;
};

export type CornHaulerRemovePlan = {
    removed: boolean;
    nextAmount: number;
    createTransferNode: boolean;
};

export function planCornHaulerAdd(
    amount: number,
    capacity = 42,
    maxVisibleItems = 42,
): CornHaulerAddPlan {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount >= capacity) {
        return { accepted: false, nextAmount: safeAmount, displayIncomingNode: false };
    }
    return {
        accepted: true,
        nextAmount: safeAmount + 1,
        displayIncomingNode: safeAmount < maxVisibleItems,
    };
}

export function planCornHaulerRemove(
    amount: number,
    maxVisibleItems = 42,
): CornHaulerRemovePlan {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount === 0) {
        return { removed: false, nextAmount: 0, createTransferNode: false };
    }
    return {
        removed: true,
        nextAmount: safeAmount - 1,
        createTransferNode: safeAmount > maxVisibleItems,
    };
}

export function getCornHaulerVisibleCount(amount: number, maxVisibleItems = 42): number {
    return Math.min(Math.max(0, Math.floor(amount)), Math.max(0, Math.floor(maxVisibleItems)));
}

export function getCornHaulerStackPosition(index: number): { x: number; y: number; z: number } {
    return { x: -0.2, y: Math.max(0, Math.floor(index)) * 0.2, z: -0.2 };
}
```

- [ ] **Step 4: 重跑针对性测试确认绿灯**

Run: `node --test tests/corn-vehicle-hauler-parity-regression.test.mjs`

Expected: 新增库存规则测试 PASS。

---

### Task 2: 独立 CornHaulerBackpack 组件

**Files:**
- Create: `assets/_Scripts/CornHaulerBackpack.ts`
- Create: `assets/_Scripts/CornHaulerBackpack.ts.meta`
- Modify: `assets/_Scripts/CornHauler.ts`
- Modify: `tests/corn-vehicle-hauler-parity-regression.test.mjs`

**Interfaces:**
- Consumes: Task 1 的四个纯函数、玉米 `Prefab` 和背部 `Node` 挂点。
- Produces: `CornHaulerBackpack.hasSpace()`、`addResource()`、`removeResource()`、`hasMovableResource()`、`recoverInterruptedTransfers()`、`clearStorage()`。

- [ ] **Step 1: 编写独立组件接线失败测试**

```js
const cornHaulerBackpackPath = new URL('../assets/_Scripts/CornHaulerBackpack.ts', import.meta.url);
const cornHaulerBackpackSource = existsSync(cornHaulerBackpackPath)
    ? readFileSync(cornHaulerBackpackPath, 'utf8')
    : '';

test('corn hauler uses its own player-style backpack component', () => {
    assert.ok(existsSync(cornHaulerBackpackPath));
    assert.match(cornHaulerBackpackSource, /public capacity = Number\.MAX_SAFE_INTEGER/);
    assert.match(cornHaulerBackpackSource, /public maxVisibleItems = 42/);
    assert.match(cornHaulerBackpackSource, /public layerHeight = 0\.2/);
    assert.match(cornHaulerBackpackSource, /public moveAnimationDuration = 0\.32/);
    assert.match(cornHaulerBackpackSource, /public moveEasing = 'sineOut'/);
    assert.doesNotMatch(cornHaulerBackpackSource, /MultiResourceBackpack|WoodBackpack|CoinBackpack/);
    assert.match(cornHaulerSource, /type: CornHaulerBackpack/);
});
```

- [ ] **Step 2: 运行测试确认缺少独立组件**

Run: `node --test tests/corn-vehicle-hauler-parity-regression.test.mjs`

Expected: FAIL，`CornHaulerBackpack.ts` 不存在且 `CornHauler.carryStorage` 仍为 `CornStoragePoint`。

- [ ] **Step 3: 创建背包组件并使用库存计划**

组件实现必须包含以下核心逻辑：

```ts
@ccclass('CornHaulerBackpack')
export class CornHaulerBackpack extends Component {
    @property({ type: Prefab }) public resourcePrefab: Prefab = null!;
    @property({ type: Node }) public stackAreaNode: Node = null!;
    @property public capacity = 42;
    @property public amount = 0;
    @property public maxVisibleItems = 42;
    @property public layerHeight = 0.2;
    @property public moveAnimationDuration = 0.32;
    @property public moveEasing = 'sineOut';
    private readonly _items: Node[] = [];

    public hasSpace(requiredCapacity: number): boolean {
        return this.amount + requiredCapacity <= this.capacity;
    }

    public addResource(resource: Node, animationType = 1, rotation: Vec3 = Vec3.ZERO): boolean {
        if (!resource?.isValid) return false;
        const plan = planCornHaulerAdd(this.amount, this.capacity, this.maxVisibleItems);
        if (!plan.accepted || (!plan.displayIncomingNode && !this.resourcePrefab)) return false;
        this.amount = plan.nextAmount;
        if (!plan.displayIncomingNode) {
            resource.destroy();
            return true;
        }
        const startWorldPosition = resource.worldPosition.clone();
        resource.setParent(this.stackAreaNode);
        resource.setWorldPosition(startWorldPosition);
        const position = getCornHaulerStackPosition(this._items.length);
        const target = new Vec3(position.x, position.y, position.z);
        tween(resource).to(this.moveAnimationDuration, { position: target }, { easing: this.moveEasing }).start();
        this._items.push(resource);
        return true;
    }

    public removeResource(animationType = 1): Node | null {
        const plan = planCornHaulerRemove(this.amount, this.maxVisibleItems);
        if (!plan.removed) return null;
        if (plan.createTransferNode && !this.resourcePrefab) return null;
        this.amount = plan.nextAmount;
        if (!plan.createTransferNode) return this._items.pop() ?? null;
        const item = instantiate(this.resourcePrefab);
        item.setParent(this.stackAreaNode);
        const top = getCornHaulerStackPosition(Math.max(0, this.maxVisibleItems - 1));
        item.setPosition(top.x, top.y, top.z);
        return item;
    }

    public hasMovableResource(): boolean {
        return this.amount > 0 && (this._items.length > 0 || !!this.resourcePrefab);
    }

    public clearStorage(): void {
        for (const item of [...this.stackAreaNode.children]) item.destroy();
        this._items.length = 0;
        this.amount = 0;
    }
}
```

同时补齐 `onLoad()`、`recoverInterruptedTransfers()` 和对补建预制件的旧逻辑组件禁用；恢复时只读取 `stackAreaNode.children`，并保留大于可见数量的逻辑 `amount`。

- [ ] **Step 4: 将 CornHauler 的 carryStorage 改为独立类型**

```ts
import { CornHaulerBackpack } from './CornHaulerBackpack';

type CornTransferStorage = CornStoragePoint | CornHaulerBackpack;

@property({ type: CornHaulerBackpack })
public carryStorage: CornHaulerBackpack = null!;
```

将 `_blockedStorage`、`transferCorn()` 和 `monitorTransferProgress()` 中的临时 `from/to` 类型改为 `CornTransferStorage`。两种组件继续通过同名公开接口完成装卸。

- [ ] **Step 5: 运行测试确认组件和类型接线通过**

Run: `node --test tests/corn-vehicle-hauler-parity-regression.test.mjs`

Expected: 独立背包测试 PASS，既有搬运状态机测试保持 PASS。

---

### Task 3: 出生清空、骨骼挂点和大容量配置

**Files:**
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`
- Modify: `tests/corn-vehicle-hauler-parity-regression.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 `CornHaulerBackpack` 和克隆人物组件上的可选 `backpackMount`、`coinBackpackMount`。
- Produces: `clearInheritedHaulerCargo(actor: Node): Node | null`、出生为空的 `CornHaulerCarryMount`。

- [ ] **Step 1: 编写出生清理和挂点配置失败测试**

```js
test('corn hauler is empty before activation and mounts corn like the player', () => {
    const spawnMethod = source.match(
        /private spawnHauler[\s\S]*?\n    private createActor/,
    )?.[0] ?? '';
    assert.match(source, /private clearInheritedHaulerCargo\(actor: Node\): Node \| null/);
    assert.match(source, /node\.name\.startsWith\('ResourceBackpack_'\)/);
    assert.match(spawnMethod, /const mountTemplate = this\.clearInheritedHaulerCargo\(actor\)/);
    assert.ok(spawnMethod.indexOf('clearInheritedHaulerCargo') < spawnMethod.indexOf('actor.active = true'));
    assert.match(spawnMethod, /new Node\('CornHaulerCarryMount'\)/);
    assert.match(spawnMethod, /carryNode\.setParent\(mountTemplate\.parent\)/);
    assert.match(spawnMethod, /carryNode\.setRotation\(mountTemplate\.rotation\)/);
    assert.match(spawnMethod, /carryNode\.setScale\(mountTemplate\.scale\)/);
    assert.match(spawnMethod, /carryStorage\.capacity = Number\.MAX_SAFE_INTEGER/);
    assert.match(spawnMethod, /carryStorage\.maxVisibleItems = 42/);
    assert.match(spawnMethod, /carryStorage\.clearStorage\(\)/);
});
```

- [ ] **Step 2: 运行测试确认当前 2×2 容量 4 实现失败**

Run: `node --test tests/corn-vehicle-hauler-parity-regression.test.mjs`

Expected: FAIL，当前仍创建 `CornCarryStorage`、容量 4 且没有继承物清理方法。

- [ ] **Step 3: 实现继承携带物清理**

`clearInheritedHaulerCargo()` 递归检查克隆节点组件，记录第一个有效 `backpackMount` 作为骨骼模板，清空 `backpackMount` 和 `coinBackpackMount` 的子节点；遍历子节点时删除所有 `ResourceBackpack_*` 运行时挂点。方法只使用结构化可选属性，不导入主角或森林背包类型。

```ts
type CarryMountOwner = {
    backpackMount?: Node;
    coinBackpackMount?: Node;
};

private clearInheritedHaulerCargo(actor: Node): Node | null {
    let mountTemplate: Node | null = null;
    const inheritedMounts = new Set<Node>();
    const visit = (node: Node): void => {
        for (const component of node.components) {
            const owner = component as unknown as CarryMountOwner;
            if (owner.backpackMount?.isValid) {
                mountTemplate ??= owner.backpackMount;
                inheritedMounts.add(owner.backpackMount);
            }
            if (owner.coinBackpackMount?.isValid) inheritedMounts.add(owner.coinBackpackMount);
        }
        for (const child of [...node.children]) {
            if (child.name.startsWith('ResourceBackpack_')) child.destroy();
            else visit(child);
        }
    };
    visit(actor);
    for (const mount of inheritedMounts) {
        for (const item of [...mount.children]) item.destroy();
    }
    return mountTemplate;
}
```

- [ ] **Step 4: 替换 2×2 CornStoragePoint 为独立背包**

```ts
const mountTemplate = this.clearInheritedHaulerCargo(actor);
const carryNode = new Node('CornHaulerCarryMount');
if (mountTemplate?.parent) {
    carryNode.setParent(mountTemplate.parent);
    carryNode.setPosition(mountTemplate.position);
    carryNode.setRotation(mountTemplate.rotation);
    carryNode.setScale(mountTemplate.scale);
} else {
    carryNode.setParent(actor);
    carryNode.setPosition(0, 1.45, -0.48);
}

const carryStorage = actor.getComponent(CornHaulerBackpack) ?? actor.addComponent(CornHaulerBackpack);
carryStorage.enabled = true;
carryStorage.resourcePrefab = field.resourcePrefab;
carryStorage.stackAreaNode = carryNode;
carryStorage.capacity = 42;
carryStorage.maxVisibleItems = 42;
carryStorage.layerHeight = 0.2;
carryStorage.moveAnimationDuration = 0.32;
carryStorage.moveEasing = 'sineOut';
carryStorage.clearStorage();
```

删除原有 `CornCarryStorage`、容量 4、`resourcePerRow = 2`、`resourcePerCol = 2` 配置。完成 `CornHauler` 注入后才执行 `actor.active = true`。

- [ ] **Step 5: 运行针对性测试确认出生和布局修复**

Run: `node --test tests/corn-vehicle-hauler-parity-regression.test.mjs`

Expected: 全部 PASS。

---

### Task 4: 全量验证和人工验收

**Files:**
- Test: `tests/*.test.mjs`
- Verify: `assets/_Scripts/CornHaulerBackpack.ts`
- Verify: `assets/_Scripts/CornHauler.ts`
- Verify: `assets/_Scripts/ResourceFieldSystem.ts`

**Interfaces:**
- Consumes: Task 1 至 Task 3 的完整实现。
- Produces: 可交付的玉米搬运工背包功能。

- [ ] **Step 1: 运行全部 Node 回归测试**

Run: `node --test tests/*.test.mjs`

Expected: 全部 PASS。

- [ ] **Step 2: 运行 TypeScript 检查并筛选本轮文件**

Run: `npx.cmd --yes --package typescript@5.1.6 tsc --noEmit --pretty false --project tsconfig.json`

Expected: 项目可能继续报告 Cocos 3.8.7 引擎声明历史错误，但 `CornHaulerBackpackInventory.ts`、`CornHaulerBackpack.ts`、`CornHauler.ts`、`ResourceFieldSystem.ts` 不得出现错误。

- [ ] **Step 3: 检查场景和差异**

Run: `node -e "JSON.parse(require('fs').readFileSync('assets/Scenes/DevScene.scene','utf8')); console.log('scene json ok')"`

Expected: 输出 `scene json ok`。

Run: `git diff --check -- assets/_Scripts/CornHaulerBackpackInventory.ts assets/_Scripts/CornHaulerBackpack.ts assets/_Scripts/CornHauler.ts assets/_Scripts/ResourceFieldSystem.ts tests/corn-vehicle-hauler-parity-regression.test.mjs`

Expected: 无空白错误；Windows 行尾转换警告可保留。

- [ ] **Step 4: 人工运行时验收**

主角先携带玉米、木头和金币，再解锁玉米搬运工。确认搬运工出现时身体为空；装货后玉米在背部单列堆叠；库存超过 4 仍继续装货；装满 42 个后立即前往所属玉米销售区卸货。

- [ ] **Step 5: 保留未提交实现供用户检查**

不自动提交实现文件。若用户要求提交，再使用 `git diff --cached --name-only` 确认只包含本任务文件。
