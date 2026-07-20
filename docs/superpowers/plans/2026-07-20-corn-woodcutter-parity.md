# Corn Woodcutter Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make corn-field workers match the forest woodcutters' unlock presentation and autonomous harvesting behavior while producing corn resources instead of wood.

**Architecture:** Keep `ResourceFieldSystem` authoritative for corn resource state, but replace its nearest-target timer with a forest-style per-worker state machine. Reuse the forest worker prefab's `ChopAction`, `SkeletalAnimation`, movement timings, camera lock, pad shrink, and next-pad entrance animation without attaching the tree-specific `Woodcutter` component to corn plants.

**Tech Stack:** Cocos Creator 3.8.7, TypeScript, Cocos `Node`/`Tween`/`SkeletalAnimation`, Node.js built-in test runner.

## Global Constraints

- The first corn field remains playable after reveal; revealing the second corn field ends the game.
- Corn workers deposit corn into that field's `CornCollection`; they never write into the forest wood storage.
- Preserve all existing user changes in the dirty worktree.
- Do not stage, commit, or push until the user explicitly approves the reviewed diff and commit message.

---

### Task 1: Lock the forest behavior contract in regression tests

**Files:**
- Create: `tests/corn-worker-parity-regression.test.mjs`
- Read: `assets/_Scripts/Woodcutter.ts`
- Read: `assets/_Scripts/CoinConsumer.ts`
- Test: `tests/corn-worker-parity-regression.test.mjs`

**Interfaces:**
- Consumes: forest animation names and timings from `Woodcutter`; LOGGER completion sequence from `CoinConsumer`.
- Produces: static regression requirements for `ResourceFieldSystem` worker state, target partitioning, camera lock, pad transitions, and corn-only resource output.

- [ ] **Step 1: Write the failing parity test**

```js
assert.match(source, /type WorkerState = 'idle' \| 'moving' \| 'chopping' \| 'waiting'/);
assert.match(source, /playWorkerAnimation\(actor, 'run2_FuTou'\)/);
assert.match(source, /playWorkerAnimation\(actor, 'KanMuTou'\)/);
assert.match(source, /playWorkerAnimation\(actor, 'idle1_FuTou'\)/);
assert.match(source, /partitionPlantsAmongWorkers/);
assert.match(source, /worker\.waitTimer = field\.workerWaitAfterChop/);
assert.match(source, /cameraController\.target = .*worker/);
assert.match(source, /joystickController\._lock = true/);
assert.match(source, /tween\(currentVisual\).*scale: new Vec3\(0, 1, 0\)/s);
assert.match(source, /tween\(nextVisual\).*scale: new Vec3\(0\.72, 0\.72, 0\.72\)/s);
assert.match(source, /field\.collectionStorage\.addResource/);
```

- [ ] **Step 2: Run the test and verify the current implementation fails**

Run: `node --test tests/corn-worker-parity-regression.test.mjs`

Expected: FAIL because the corn system has no worker state machine, target partitioning, or LOGGER unlock presentation.

- [ ] **Step 3: Keep the test scoped to behavior, not exact private method formatting**

Use method-level source extraction before assertions so unrelated source text cannot satisfy a requirement:

```js
const workerUpdate = source.match(
    /private updateWorkers[\s\S]*?\n    private updateVehicle/,
)?.[0] ?? '';
```

- [ ] **Step 4: Re-run to confirm the test remains red for the intended reasons**

Run: `node --test tests/corn-worker-parity-regression.test.mjs`

Expected: FAIL messages identify missing state transitions and unlock presentation.

### Task 2: Match the forest LOGGER unlock presentation

**Files:**
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`
- Test: `tests/corn-worker-parity-regression.test.mjs`

**Interfaces:**
- Consumes: `completeUnlockStage(field, 'worker')`, `showUnlockStage(field, 'vehicle')`, `CameraController`, `JoystickController`, and the spawned worker nodes.
- Produces: `completeWorkerUnlock(field: FieldRuntime, padNode: Node): void` and `showUnlockStage(field, stage, animateEntrance): void`.

- [ ] **Step 1: Import the forest camera controller and preserve the current worker pad until its exit tween completes**

```ts
import { CameraController } from './CameraController';

private completeWorkerUnlock(field: FieldRuntime, padNode: Node): void {
    this.spawnWorkers(field);
    const currentVisual = this.resolveUnlockVisual(padNode);
    if (currentVisual) {
        tween(currentVisual)
            .to(0.5, { scale: new Vec3(0, 1, 0) }, { easing: 'linear' })
            .start();
    }
}
```

- [ ] **Step 2: Match the forest 1.5-second next-pad reveal**

```ts
this.scheduleOnce(() => {
    this.showUnlockStage(field, 'vehicle', true);
    padNode.active = false;
}, 1.5);
```

`showUnlockStage(..., true)` sets the new pad visual scale to zero, then tweens it to `(0.72, 0.72, 0.72)` over `0.5` seconds with linear easing.

- [ ] **Step 3: Match the forest six-second camera and joystick lock**

```ts
const focusWorker = field.workers[2]?.node ?? field.workers[0]?.node ?? null;
const cameraController = find('Main Camera')?.getComponent(CameraController) ?? null;
const joystickController = find('Canvas/JoystickContainer')?.getComponent(JoystickController) ?? null;
if (cameraController && focusWorker) cameraController.target = focusWorker;
if (joystickController) joystickController._lock = true;
this._playerController?.stopMovement();
cameraController?.scheduleOnce(() => {
    cameraController.target = this._player;
    if (joystickController) joystickController._lock = false;
}, 6);
```

- [ ] **Step 4: Run the unlock parity test**

Run: `node --test tests/corn-worker-parity-regression.test.mjs`

Expected: unlock animation assertions PASS; worker state assertions remain FAIL.

### Task 3: Replace nearest-target harvesting with the forest worker state machine

**Files:**
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`
- Modify: `assets/Scenes/DevScene.scene`
- Test: `tests/corn-worker-parity-regression.test.mjs`

**Interfaces:**
- Consumes: `FieldRuntime.plants`, `damagePlant(field, plant, false)`, cloned forest worker `ChopAction` and `SkeletalAnimation` components.
- Produces: forest-equivalent worker states and scene-configured timings: speed `2`, range `0.7`, wait `0.2`, chop interval `0.8`, start delay `1`.

- [ ] **Step 1: Expand worker runtime state**

```ts
type WorkerState = 'idle' | 'moving' | 'chopping' | 'waiting';

type ActorRuntime = {
    node: Node;
    target: PlantRuntime | null;
    assignedPlants: PlantRuntime[];
    currentPlantIndex: number;
    direction: 1 | -1;
    state: WorkerState;
    waitTimer: number;
    actionTimer: number;
    startDelay: number;
    lastAnimation: string;
    chopAction: ChopAction | null;
    skeletalAnimation: SkeletalAnimation | null;
};
```

- [ ] **Step 2: Partition plants into three non-overlapping contiguous groups**

```ts
private partitionPlantsAmongWorkers(plants: PlantRuntime[], workerCount: number): PlantRuntime[][] {
    return Array.from({ length: workerCount }, (_, index) => {
        const start = Math.floor(index * plants.length / workerCount);
        const end = Math.floor((index + 1) * plants.length / workerCount);
        return plants.slice(start, end);
    });
}
```

- [ ] **Step 3: Initialize each corn worker from the forest worker settings**

Clone the forest logger child, retain `ChopAction`, `SkeletalAnimation`, renderer, and animation components, disable only tree-specific `Woodcutter` and unrelated gameplay components, then initialize:

```ts
state: 'idle',
startDelay: 1,
waitTimer: 0,
actionTimer: 0,
direction: 1,
currentPlantIndex: 0,
lastAnimation: '',
```

- [ ] **Step 4: Implement the four forest-equivalent state transitions**

```ts
idle -> choose next valid assigned plant -> moving
moving -> approach target at speed 2 and play run2_FuTou -> chopping within 0.7
chopping -> play KanMuTou, wait for ChopAction, then wait 0.8 and call damagePlant once
waiting -> wait 0.2, clear target, play idle1_FuTou, return to idle
```

When reaching either end of the assigned group, reverse `direction`, matching `Woodcutter.findNextValidTree()`.

- [ ] **Step 5: Preserve corn output semantics**

On the final hit, keep using:

```ts
const item = this.createResourceVisual(field, sourcePosition);
if (item) field.collectionStorage.addResource(item, 1);
```

Do not call `Tree.registerWoodcutterChop`, `WoodBackpack`, or the forest `woodStackArea`.

- [ ] **Step 6: Update scene worker tuning**

Set both left and right field values in `DevScene.scene`:

```json
"leftWorkerSpeed": 2,
"rightWorkerSpeed": 2,
"leftWorkerActionInterval": 0.8,
"rightWorkerActionInterval": 0.8
```

Add serialized values for worker range `0.7`, post-chop wait `0.2`, and start delay `1` if exposed as properties.

- [ ] **Step 7: Run worker parity and existing corn tests**

Run: `node --test tests/corn-worker-parity-regression.test.mjs tests/corn-area-placement-regression.test.mjs`

Expected: all assertions PASS.

### Task 4: Validate the integrated scene without committing

**Files:**
- Verify: `assets/_Scripts/ResourceFieldSystem.ts`
- Verify: `assets/_Scripts/FinishNode.ts`
- Verify: `assets/Scenes/DevScene.scene`
- Verify: `tests/*.test.mjs`

**Interfaces:**
- Consumes: completed unlock and worker behavior changes.
- Produces: test and compile evidence for user review.

- [ ] **Step 1: Run all regression tests**

Run: `node --test tests/*.test.mjs`

Expected: zero failures.

- [ ] **Step 2: Parse the scene JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('assets/Scenes/DevScene.scene','utf8'))"`

Expected: exit code `0`.

- [ ] **Step 3: Transpile changed TypeScript with Cocos Creator 3.8.7 TypeScript**

Transpile `ResourceFieldSystem.ts` and `FinishNode.ts` with the bundled TypeScript module and fail on diagnostics with category `Error`.

Expected: both files report valid transpilation.

- [ ] **Step 4: Check whitespace and debug residue**

Run: `git diff --check` and search changed files for temporary debug markers.

Expected: no whitespace errors and no new debug markers.

- [ ] **Step 5: Present the diff and proposed commit message without staging**

Proposed message: `fix: align corn workers with forest behavior`

Wait for explicit user approval before any `git add`, `git commit`, or `git push`.
