# Unlock Camera Pan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为所有非田地解锁增加 0.6 秒镜头平移，并在抵达后播放对象展示动画，同时保持总锁定时间为 3 秒。

**Architecture:** `CameraController` 统一拥有镜头平移状态和接口；森林解锁入口 `CoinConsumer` 与玉米解锁入口 `ResourceFieldSystem` 通过回调延迟对象展示。`FinishNode` 不接入该接口。

**Tech Stack:** Cocos Creator 3.8、TypeScript、Cocos Tween、Node.js 回归测试

## Global Constraints

- 平移时间固定为 0.6 秒。
- 抵达后展示时间固定为 2.4 秒。
- 镜头锁定总时间固定为 3 秒。
- 田地解锁镜头不得修改。
- 不改变镜头 Rotation、FOV、正交高度和跟随距离。

---

### Task 1: 统一镜头平移接口

**Files:**
- Modify: `assets/_Scripts/CameraController.ts`
- Test: `tests/unlock-camera-duration-regression.test.mjs`

**Interfaces:**
- Produces: `panToTarget(target: Node, duration: number, onArrived?: () => void): void`
- Produces: `cancelTargetPan(): void`

- [ ] **Step 1: Write the failing test**

断言 `CameraController` 使用 Tween 从当前世界位置移动到目标跟随位置，并在结束后设置目标、恢复普通更新和调用 `onArrived`。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unlock-camera-duration-regression.test.mjs`

Expected: FAIL，因为 `panToTarget` 尚不存在。

- [ ] **Step 3: Implement the camera pan**

新增平移状态，平移期间跳过普通跟随位置覆盖。调用 `calculateFollowPosition` 获得终点，使用 `tween(this.node).to(duration, { worldPosition })`，完成后设置目标并调用回调。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unlock-camera-duration-regression.test.mjs`

Expected: PASS。

### Task 2: 接入森林区对象解锁

**Files:**
- Modify: `assets/_Scripts/CoinConsumer.ts`
- Test: `tests/unlock-camera-duration-regression.test.mjs`
- Test: `tests/forest-hauler-unlock-presentation-regression.test.mjs`

**Interfaces:**
- Consumes: `CameraController.panToTarget(target, 0.6, onArrived)`

- [ ] **Step 1: Write the failing test**

断言 LOGGER、MACHINE、HAULER 都调用 `panToTarget(..., 0.6, ...)`，对象展示逻辑位于抵达回调中，恢复主角仍在 3 秒执行。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unlock-camera-duration-regression.test.mjs tests/forest-hauler-unlock-presentation-regression.test.mjs`

Expected: FAIL，因为现有实现直接赋值 `cameraController.target`。

- [ ] **Step 3: Replace direct target switching**

保留对象创建与必要配置，将激活节点和现有解锁动画启动放入 `onArrived`。3 秒后取消平移、恢复主角目标和摇杆。

- [ ] **Step 4: Run tests**

Run: `node --test tests/unlock-camera-duration-regression.test.mjs tests/forest-hauler-unlock-presentation-regression.test.mjs`

Expected: PASS。

### Task 3: 接入玉米区对象解锁并保护田地镜头

**Files:**
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`
- Test: `tests/corn-worker-parity-regression.test.mjs`
- Test: `tests/corn-vehicle-hauler-parity-regression.test.mjs`
- Test: `tests/corn-area-placement-regression.test.mjs`

**Interfaces:**
- Consumes: `CameraController.panToTarget(target, 0.6, onArrived)`

- [ ] **Step 1: Write the failing tests**

断言 worker、vehicle、hauler 三个完成方法使用平移接口，展示动作位于抵达回调中；`FinishNode` 不出现 `panToTarget`。

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/corn-worker-parity-regression.test.mjs tests/corn-vehicle-hauler-parity-regression.test.mjs tests/corn-area-placement-regression.test.mjs`

Expected: FAIL，因为当前三个方法直接切换目标。

- [ ] **Step 3: Integrate the shared pan**

提前创建和配置对象但推迟展示激活；镜头抵达后启动现有解锁展示。3 秒后恢复主角与摇杆。保持 `FinishNode` 不变。

- [ ] **Step 4: Run focused and complete regression suites**

Run: `node --test tests/*.test.mjs`

Expected: 新增镜头测试通过；仅允许已有且与本任务无关的基线失败。
