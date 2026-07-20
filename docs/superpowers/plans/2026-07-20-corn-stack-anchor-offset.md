# 玉米区堆叠锚点偏移修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让左右玉米区的金币堆居中落在白色底板上，并让玉米出售堆居中落在红色槽位中。

**Architecture:** 保留 `CornStoragePoint` 的通用堆叠算法，通过两个专用视觉锚点进行局部校正。`CornCustomerScheduler` 根据 `CoinPlace` 的提示图标中心设置金币区域；`ResourceFieldSystem` 为 `Sell1` 创建带固定几何中心补偿的 `CornSellStack`，左右区域共享相同参数。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Node.js `node:test`、Cocos 场景 JSON。

## Global Constraints

- 不修改森林区任何脚本或场景坐标。
- 不修改 `CornStoragePoint.calculateStackPosition()`。
- 不改变金币奖励数量、金币价值、玉米库存容量、排列、旋转、间距或动画。
- 不提交工作区中与本任务无关的搬运工和 Cocos Service 修改。

---

### Task 1: 锁定金币和玉米出售堆的正确锚点

**Files:**
- Modify: `tests/corn-customer-purchase-animation-regression.test.mjs`
- Modify: `tests/corn-area-placement-regression.test.mjs`

**Interfaces:**
- Consumes: `CornCustomerScheduler.ensureLocalCoinDropArea()` 和 `ResourceFieldSystem.ensureSellStorage()` 的源码及 `DevScene.scene` 中左右模块绑定。
- Produces: 可在修改前失败、修改后通过的锚点回归断言。

- [ ] **Step 1: 写入金币锚点失败测试**

在 `tests/corn-customer-purchase-animation-regression.test.mjs` 中断言金币区域使用提示图标中心和森林提示图标到实际落点的差值：

```js
const coinAreaMethod = schedulerSource.match(
    /private ensureLocalCoinDropArea[\s\S]*?\n    private resolveSellStoragePoint/,
)?.[0] ?? '';
assert.match(coinAreaMethod, /const visualCenter = this\.resolveCoinVisualCenter\(anchor\)/);
assert.match(coinAreaMethod, /dropArea\.setPosition\(visualCenter\.x - 0\.017, 0\.03, visualCenter\.z \+ 0\.086\)/);
assert.match(coinAreaMethod, /stackArea\.setPosition\(0\.5, 0, 0\)/);
```

- [ ] **Step 2: 写入出售堆几何中心失败测试**

在 `tests/corn-area-placement-regression.test.mjs` 中断言出售槽只增加专用堆叠子节点，并使用 5×2 网格中心补偿：

```js
const ensureSellStorage = resourceFieldSource.match(
    /private ensureSellStorage[\s\S]*?\n    private finishGame/,
)?.[0] ?? '';
assert.match(ensureSellStorage, /new Node\('CornSellStack'\)/);
assert.match(ensureSellStorage, /stackArea\.setPosition\(-0\.2, 0, 0\.5\)/);
assert.match(ensureSellStorage, /storage\.stackAreaNode = stackArea/);
assert.doesNotMatch(ensureSellStorage, /calculateStackPosition/);
```

- [ ] **Step 3: 运行定向测试并确认失败**

Run:

```powershell
node --test tests/corn-customer-purchase-animation-regression.test.mjs tests/corn-area-placement-regression.test.mjs
```

Expected: 两个新增断言失败，分别指出缺少 `resolveCoinVisualCenter` 和 `CornSellStack`。

- [ ] **Step 4: 提交失败测试**

```powershell
git add -- tests/corn-customer-purchase-animation-regression.test.mjs tests/corn-area-placement-regression.test.mjs
git commit -m "test: reproduce corn stack anchor offsets"
```

### Task 2: 校正金币区域整体锚点

**Files:**
- Modify: `assets/_Scripts/CornCustomerScheduler.ts`
- Test: `tests/corn-customer-purchase-animation-regression.test.mjs`

**Interfaces:**
- Consumes: `CoinPlace` 节点及其 `tubiao_02_chaopiao-001` 视觉子节点。
- Produces: `resolveCoinVisualCenter(anchor: Node): Vec3`，返回白色底板视觉中心；`ensureLocalCoinDropArea()` 将运行时金币区域设置到该中心。

- [ ] **Step 1: 增加视觉中心解析方法**

在 `resolveLocalCoinAnchor()` 后加入：

```ts
private resolveCoinVisualCenter(anchor: Node): Vec3 {
    const visual = anchor.getChildByName('tubiao_02_chaopiao-001') ?? anchor.children[0] ?? null;
    return visual?.position.clone() ?? new Vec3();
}
```

- [ ] **Step 2: 将金币区域对齐白色底板中心**

将 `dropArea.setPosition(Vec3.ZERO)` 替换为：

```ts
const visualCenter = this.resolveCoinVisualCenter(anchor);
dropArea.setPosition(visualCenter.x - 0.017, 0.03, visualCenter.z + 0.086);
```

保留以下内部居中补偿：

```ts
stackArea.setPosition(0.5, 0, 0);
```

- [ ] **Step 3: 运行金币定向测试**

Run:

```powershell
node --test tests/corn-customer-purchase-animation-regression.test.mjs
```

Expected: 全部通过。

- [ ] **Step 4: 提交金币锚点修复**

```powershell
git add -- assets/_Scripts/CornCustomerScheduler.ts tests/corn-customer-purchase-animation-regression.test.mjs
git commit -m "fix: center corn coin stacks on their pads"
```

### Task 3: 校正玉米出售堆整体锚点

**Files:**
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`
- Test: `tests/corn-area-placement-regression.test.mjs`

**Interfaces:**
- Consumes: `ensureSellStorage(sellNode: Node, resourceId: string): CornStoragePoint` 现有出售库存创建流程。
- Produces: 每个出售库存节点下的 `CornSellStack`，本地位置为 `(-0.2, 0, 0.5)`，供 `CornStoragePoint.stackAreaNode` 使用。

- [ ] **Step 1: 创建出售堆视觉锚点**

在 `ensureSellStorage()` 配置库存后加入：

```ts
const stackArea = storageNode.getChildByName('CornSellStack') ?? new Node('CornSellStack');
if (!stackArea.parent) stackArea.setParent(storageNode);
stackArea.setPosition(-0.2, 0, 0.5);
storage.stackAreaNode = stackArea;
```

这组补偿抵消当前 5 列位置 `[-0.2, 0, 0.2, 0.4, 0.6]` 的中心 `0.2`，以及 2 行位置 `[-1, 0]` 的中心 `-0.5`。

- [ ] **Step 2: 运行出售槽定向测试**

Run:

```powershell
node --test tests/corn-area-placement-regression.test.mjs
```

Expected: 全部通过。

- [ ] **Step 3: 提交出售槽锚点修复**

```powershell
git add -- assets/_Scripts/ResourceFieldSystem.ts tests/corn-area-placement-regression.test.mjs
git commit -m "fix: center corn products in sell slots"
```

### Task 4: 全量验证

**Files:**
- Verify: `assets/Scenes/DevScene.scene`
- Verify: `assets/_Scripts/CornCustomerScheduler.ts`
- Verify: `assets/_Scripts/ResourceFieldSystem.ts`
- Verify: `tests/corn-customer-purchase-animation-regression.test.mjs`
- Verify: `tests/corn-area-placement-regression.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–3 的实现。
- Produces: 完整自动化验证结果和 Cocos Creator 目视验收清单。

- [ ] **Step 1: 运行全部回归测试**

```powershell
node --test tests/*.test.mjs
```

Expected: 现有测试与新增测试全部通过。

- [ ] **Step 2: 验证场景 JSON**

```powershell
node -e "JSON.parse(require('fs').readFileSync('assets/Scenes/DevScene.scene','utf8')); console.log('scene json ok')"
```

Expected: `scene json ok`。

- [ ] **Step 3: 检查调试残留和补丁格式**

```powershell
rg -n "\[DEBUG-|debugger" assets/_Scripts/CornCustomerScheduler.ts assets/_Scripts/ResourceFieldSystem.ts tests
git diff --check
```

Expected: 无调试残留；`git diff --check` 无错误，允许 Windows 换行警告。

- [ ] **Step 4: Cocos Creator 目视验收**

运行 `DevScene` 并确认：

1. 左右玉米区生成的金币都位于各自白色底板中央。
2. 金币仍保持 2×3 排列、掉落动画和拾取功能。
3. 左右出售槽中的玉米都位于红色槽位中央。
4. 玉米入槽动画、顾客购买和金币结算保持正常。
5. 森林区、玉米收集区、玩家背包和搬运工背包位置不变。

- [ ] **Step 5: 仅在仍有未提交的本任务文件时提交**

```powershell
git status --short
git add -- assets/_Scripts/CornCustomerScheduler.ts assets/_Scripts/ResourceFieldSystem.ts tests/corn-customer-purchase-animation-regression.test.mjs tests/corn-area-placement-regression.test.mjs
git commit -m "fix: align corn stack anchors"
```

Expected: 本任务文件已提交；搬运工和 Cocos Service 的其他工作区修改仍未暂存。
