# 玉米工人碰撞与正面收割实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让三名玉米工人具备森林工人同规格碰撞组件，只沿各自田垄直线移动，在当前玉米前方停止收割且折返时不穿过玉米。

**Architecture:** `CornFieldProduction` 继续负责有序田垄和初始站位，`CornWorker` 独立负责方向感知的收割站位、直线移动和端点折返，`ResourceFieldSystem` 只负责生成工人并配置物理组件。玉米脚本不引用森林区的 `Woodcutter` 或 `Tree`。

**实施记录：** 为了通过公开接口测试实际路线结果，方向站位与步长夹紧最终提取到独立的 `CornWorkerRoute.ts`；`CornWorker` 只负责把当前田垄和状态传入该模块。此调整不改变下述行为要求。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Node.js `node:test` 静态回归测试。

## Global Constraints

- 三名工人各自固定一条完整田垄，不能换垄。
- 工人到当前玉米前方停止，不能越过玉米中心。
- 田垄末端转身折返，站位方向必须同步翻转。
- 玉米工人使用独立脚本，不引用或修改 `Woodcutter`、`Tree`。
- 碰撞参数与森林工人一致：动态刚体、不使用重力；触发胶囊体中心 `(0, 0.3, 0)`、半径 `0.5`、圆柱高度 `1`。
- 保留工作区中所有与本任务无关的未提交改动。

---

### Task 1: 锁定碰撞和正面收割回归条件

**Files:**
- Modify: `tests/corn-worker-parity-regression.test.mjs`
- Test: `tests/corn-worker-parity-regression.test.mjs`

**Interfaces:**
- Consumes: `CornWorker` 的田垄目标、方向和移动状态；`ResourceFieldSystem.spawnWorkers()`。
- Produces: 对公开的 `getCornHarvestStandPosition()`、`moveCornWorkerToward()` 和物理组件配置的回归约束。

- [ ] **Step 1: 写出当前代码会失败的针对性测试**

在现有测试文件中新增测试，读取 `CornWorker.ts` 和 `ResourceFieldSystem.ts`，明确断言：

```js
test('corn workers stop in front of crops and keep forest-equivalent collision components', () => {
    assert.match(cornWorkerSource, /private getApproachDirection\(targetIndex: number\): Vec3/);
    assert.match(cornWorkerSource, /private getHarvestStandPosition\(targetIndex: number\): Vec3/);
    assert.match(cornWorkerSource, /Vec3\.scaleAndAdd\([\s\S]*-this\.standDistance/);
    assert.match(cornWorkerSource, /Math\.min\(this\.moveSpeed \* deltaTime, distance\)/);
    assert.match(cornWorkerSource, /this\.node\.setPosition\(newPosition\)/);

    const workerSpawn = source.match(
        /private spawnWorkers[\s\S]*?\n    private spawnVehicle/,
    )?.[0] ?? '';
    assert.match(workerSpawn, /actor\.getComponent\(RigidBody\) \?\? actor\.addComponent\(RigidBody\)/);
    assert.match(workerSpawn, /rigidBody\.useGravity = false/);
    assert.match(workerSpawn, /actor\.getComponent\(CapsuleCollider\) \?\? actor\.addComponent\(CapsuleCollider\)/);
    assert.match(workerSpawn, /collider\.isTrigger = true/);
    assert.match(workerSpawn, /collider\.center\.set\(0, 0\.3, 0\)/);
    assert.match(workerSpawn, /collider\.radius = 0\.5/);
    assert.match(workerSpawn, /collider\.cylinderHeight = 1/);
});
```

- [ ] **Step 2: 运行测试并确认它能捕获当前缺陷**

Run: `node --test tests/corn-worker-parity-regression.test.mjs`

Expected: FAIL，缺少 `getApproachDirection`、`getHarvestStandPosition` 或工人物理组件配置。

- [ ] **Step 3: 暂不提交测试**

测试必须与实现一起留在工作区，待 Task 3 全部变绿后选择性提交，避免把其他未提交文件带入。

---

### Task 2: 实现随方向翻转的前方站位和不可越界移动

**Files:**
- Create: `assets/_Scripts/CornWorkerRoute.ts`
- Create: `assets/_Scripts/CornWorkerRoute.ts.meta`
- Modify: `assets/_Scripts/CornWorker.ts`
- Modify: `assets/_Scripts/CornFieldProduction.ts`
- Test: `tests/corn-worker-parity-regression.test.mjs`

**Interfaces:**
- Consumes: `CornHarvestTarget.getPosition()` 和有序田垄目标列表。
- Produces: `getCornHarvestStandPosition(lane, targetIndex, direction, standDistance)`、`moveCornWorkerToward(current, target, maxStep)`；`CornFieldProduction.getWorkerLaneStartPosition(laneIndex: number, standDistance?: number): Vec3 | null`。

- [ ] **Step 1: 用相邻玉米计算当前行进方向**

在 `CornWorker` 中把固定偏移改为明确的站位距离，并新增方向计算：

```ts
@property({ tooltip: '工人与当前玉米中心之间的停止距离' })
public standDistance = 0.9;

private getApproachDirection(targetIndex: number): Vec3 {
    if (this._targetList.length < 2) {
        const fallback = new Vec3(0, 0, -this._direction);
        return fallback.normalize();
    }

    const neighborIndex = this._direction > 0
        ? Math.min(targetIndex + 1, this._targetList.length - 1)
        : Math.max(targetIndex - 1, 0);
    const otherIndex = neighborIndex === targetIndex
        ? targetIndex - this._direction
        : targetIndex;
    const from = this.getTargetPosition(this._targetList[otherIndex]);
    const to = this.getTargetPosition(this._targetList[neighborIndex]);
    const direction = new Vec3();
    Vec3.subtract(direction, to, from);
    direction.y = 0;
    return direction.normalize();
}

private getHarvestStandPosition(targetIndex: number): Vec3 {
    const targetPosition = this.getTargetPosition(this._targetList[targetIndex]);
    return Vec3.scaleAndAdd(
        new Vec3(),
        targetPosition,
        this.getApproachDirection(targetIndex),
        -this.standDistance,
    );
}
```

- [ ] **Step 2: 把移动限制为沿田垄且不能越过停止点**

在 `handleMovingState()` 中用方向站位替代固定偏移，并夹紧单帧步长：

```ts
const targetPosition = this.getHarvestStandPosition(this._currentTargetIndex);
const currentPosition = this.node.position;
const distance = Vec3.distance(currentPosition, targetPosition);
if (distance <= this.chopRange) {
    this._currentState = CornWorkerState.Chopping;
    this.startChopping();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return;
}

const direction = new Vec3();
Vec3.subtract(direction, targetPosition, currentPosition);
direction.y = 0;
direction.normalize();
const step = Math.min(this.moveSpeed * deltaTime, distance);
const newPosition = new Vec3();
Vec3.scaleAndAdd(newPosition, currentPosition, direction, step);
this.node.setPosition(newPosition);
this.faceTarget(this.getTargetPosition(this._currentTarget));
```

`playAndRegisterChop()` 的动作目标改为当前玉米位置，不再叠加固定站位偏移：

```ts
await this.chopAction.playChopAction(this.getTargetPosition(target));
```

- [ ] **Step 3: 让工人出生在第一株玉米前方**

在 `CornFieldProduction` 中根据第一、第二株玉米计算世界坐标起点：

```ts
public getWorkerLaneStartPosition(laneIndex: number, standDistance = 0.9): Vec3 | null {
    const lane = this.getWorkerLanes()[laneIndex] ?? [];
    if (lane.length === 0) return null;
    if (lane.length === 1) return lane[0].node.worldPosition.clone();

    const direction = new Vec3();
    Vec3.subtract(direction, lane[1].node.worldPosition, lane[0].node.worldPosition);
    direction.y = 0;
    direction.normalize();
    return Vec3.scaleAndAdd(
        new Vec3(),
        lane[0].node.worldPosition,
        direction,
        -standDistance,
    );
}
```

`ResourceFieldSystem.spawnWorkers()` 调用时传入 `controller.standDistance`。

- [ ] **Step 4: 运行针对性测试**

Run: `node --test tests/corn-worker-parity-regression.test.mjs`

Expected: 站位与移动断言通过；碰撞组件断言仍失败，证明 Task 1 的两个缺陷信号相互独立。

---

### Task 3: 恢复玉米工人物理组件并完成验证

**Files:**
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`
- Test: `tests/corn-worker-parity-regression.test.mjs`
- Test: `tests/*.test.mjs`

**Interfaces:**
- Consumes: 工人根节点、`CornWorker.standDistance`。
- Produces: 启用的 `RigidBody` 和 `CapsuleCollider`，参数与森林区一致。

- [ ] **Step 1: 导入并配置玉米工人的碰撞组件**

从 `cc` 导入 `CapsuleCollider` 和 `RigidBody`。在 `spawnWorkers()` 创建控制器后配置：

```ts
const rigidBody = actor.getComponent(RigidBody) ?? actor.addComponent(RigidBody);
rigidBody.enabled = true;
rigidBody.useGravity = false;

const collider = actor.getComponent(CapsuleCollider) ?? actor.addComponent(CapsuleCollider);
collider.enabled = true;
collider.isTrigger = true;
collider.center.set(0, 0.3, 0);
collider.radius = 0.5;
collider.cylinderHeight = 1;
```

删除 `controller.offsetVec3.set(0, 0, -0.9)`，改为：

```ts
controller.standDistance = 0.9;
```

获取出生位置时使用：

```ts
const laneStart = field.production.getWorkerLaneStartPosition(index, controller.standDistance);
```

- [ ] **Step 2: 运行针对性测试并确认修复**

Run: `node --test tests/corn-worker-parity-regression.test.mjs`

Expected: PASS，玉米工人碰撞、前方站位、直线折返断言全部通过。

- [ ] **Step 3: 运行全部 Node 回归测试**

Run: `node --test tests/*.test.mjs`

Expected: 全部 PASS，且无森林区逻辑回归。

- [ ] **Step 4: 检查场景和差异完整性**

Run: `node -e "JSON.parse(require('fs').readFileSync('assets/Scenes/DevScene.scene','utf8')); console.log('scene json ok')"`

Expected: 输出 `scene json ok`。

Run: `git diff --check -- assets/_Scripts/CornWorker.ts assets/_Scripts/CornFieldProduction.ts assets/_Scripts/ResourceFieldSystem.ts tests/corn-worker-parity-regression.test.mjs`

Expected: 无空白错误；Windows 行尾转换警告可以保留。

- [ ] **Step 5: 人工运行时验收**

在 Cocos Creator 3.8.7 中运行 `DevScene`，解锁三名玉米工人并确认：每人只跑一条直线田垄；每次停在玉米前挥砍；不穿过当前玉米；到田垄尽头转身后沿原路折返。

- [ ] **Step 6: 选择性提交本任务文件**

```bash
git add assets/_Scripts/CornWorker.ts assets/_Scripts/CornFieldProduction.ts assets/_Scripts/ResourceFieldSystem.ts tests/corn-worker-parity-regression.test.mjs docs/superpowers/plans/2026-07-20-corn-worker-collision-front-harvest.md
git commit -m "fix: keep corn workers in front of crops"
```

提交前运行 `git diff --cached --name-only`，确保没有包含 `DevScene.scene`、`FinishNode.ts` 或其他既有未提交改动。
