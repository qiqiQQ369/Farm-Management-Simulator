# 顾客木头握持端挂点修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让顾客携带木头时，木头圆形截面端始终对齐 `NaHeZi` 动作的双手，而不是让木头中心落在手上。

**Architecture:** 保留现有左右手 SkeletalAnimation Socket 和顾客 `StoragePoint`。在第一根有效木头上建立运行时 `CarryGrip` 资源锚点，锚点取木头最长水平轴上靠近顾客身体的一端；每帧只将该锚点移动到双手中点，不再用整捆包围盒中心定位。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Node.js `node:test`

## Global Constraints

- 只修改携带木头的视觉挂载位置。
- 不修改顾客购买、需求提示、金币、容量、堆叠数量、动作名称和离场逻辑。
- 使用真实的 `Bip001 L Hand`、`Bip001 R Hand` 动画 Socket。
- 男女顾客和五套贴图共用同一实现。

---

### Task 1: 将木头握持端锚点挂到 NaHeZi 双手

**Files:**
- Modify: `assets/_Scripts/CustomerAppearanceRandomizer.ts`
- Modify: `tests/customer-appearance-randomization-regression.test.mjs`

**Interfaces:**
- Consumes: `MeshRenderer.model.worldBounds`、左右手 Socket 的 `worldPosition`
- Produces: `resolveCarryGrip(npc: Node, storage: Node): Node | null`

- [x] **Step 1: 写入失败回归测试**

在顾客外观回归测试中加入：

```js
assert.match(source, /private resolveCarryGrip\(npc: Node, storage: Node\): Node \| null/);
assert.match(source, /new Node\('CarryGrip'\)/);
assert.match(source, /const useX = bounds\.maxX - bounds\.minX >= bounds\.maxZ - bounds\.minZ/);
assert.match(source, /Vec3\.subtract\(this\._carryPosition, this\._handCenter, carryGrip\.worldPosition\)/);
assert.doesNotMatch(source, /this\._handCenter\.x - this\._carryCenter\.x/);
assert.doesNotMatch(source, /this\._handCenter\.z - this\._carryCenter\.z/);
```

- [x] **Step 2: 运行测试并确认失败**

运行：

```powershell
node --test tests/customer-appearance-randomization-regression.test.mjs
```

预期：新测试因 `resolveCarryGrip` 和 `CarryGrip` 尚不存在而失败。

- [x] **Step 3: 建立资源侧 CarryGrip**

在绑定结构中保存当前资源与锚点：

```ts
type CustomerHandSocketBinding = {
    npc: Node;
    storage: Node;
    leftHandSocket: Node;
    rightHandSocket: Node;
    carryResource: Node | null;
    carryGrip: Node | null;
};
```

新增 `resolveCarryGrip()`：选取 `storage` 下第一棵包含 `MeshRenderer` 的资源树；
读取该资源整体世界包围盒；比较 X/Z 长度确定木头长度轴；在长度轴两端建立候选
圆形截面中心；选择离顾客根节点更近的一端；将名为 `CarryGrip` 的节点挂到资源
根节点并保持该世界位置。资源变化或失效时重建锚点。

- [x] **Step 4: 仅以 CarryGrip 对齐双手**

在 `lateUpdate()` 中计算左右手中点，然后执行：

```ts
const carryGrip = this.resolveCarryGrip(npc, storage);
if (!carryGrip) continue;
Vec3.subtract(this._carryPosition, this._handCenter, carryGrip.worldPosition);
Vec3.add(this._carryPosition, storage.worldPosition, this._carryPosition);
storage.setWorldPosition(this._carryPosition);
```

删除整捆中心 `_carryCenter` 和 `carryHeightOffset` 的定位逻辑，不修改资源旋转、
缩放或 `StoragePoint` 参数。

- [x] **Step 5: 运行定向和完整顾客回归**

运行：

```powershell
node --test tests/customer-appearance-randomization-regression.test.mjs
node --test tests/customer-*.test.mjs
```

预期：全部通过。

- [x] **Step 6: 静态检查**

运行：

```powershell
git diff --check
npx.cmd --yes --package typescript@5.1.6 tsc --noEmit --pretty false --project tsconfig.json
```

预期：本轮修改文件无新增 TypeScript 诊断，`git diff --check` 通过。
