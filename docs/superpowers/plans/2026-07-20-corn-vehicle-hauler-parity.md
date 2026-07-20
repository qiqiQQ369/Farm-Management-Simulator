# Corn Vehicle and Hauler Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make corn tractors and haulers use the forest upgrade presentation and runtime behavior while keeping each corn field's inventory isolated.

**Architecture:** Implement a crop-aware version of the forest `LoggingTruck` path loop because the original component only recognizes `Tree` colliders. Reuse the actual forest `HaulerNPC` component for corn transport by configuring it with each field's collection, carry, and sell `StoragePoint` instances.

**Tech Stack:** Cocos Creator 3.8.7, TypeScript, Cocos Tween/Node/StoragePoint APIs, Node.js test runner.

## Global Constraints

- Tractor and hauler unlocks must use the forest animation timings and camera behavior.
- Corn resources stay inside the corresponding corn collection/carry/sell storages.
- The second corn field reveal still ends the game.
- Preserve the dirty worktree and existing local commit `9d5fcc5`.
- Do not stage, commit, or push without explicit user approval.

---

### Task 1: Add failing forest-parity regression tests

**Files:**
- Create: `tests/corn-vehicle-hauler-parity-regression.test.mjs`
- Read: `assets/_Scripts/LoggingTruck.ts`
- Read: `assets/_Scripts/HaulerNPC.ts`
- Read: `assets/_Scripts/CoinConsumer.ts`
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`

**Interfaces:**
- Consumes: forest MACHINE/HAULER unlock sequences and the forest runtime state names.
- Produces: regression assertions for tractor path states, unlock timing, and `HaulerNPC` reuse.

- [ ] **Step 1: Assert the tractor contract**

```js
assert.match(source, /type VehicleState = 'idle' \| 'moving_to_start' \| 'moving_to_end' \| 'turning' \| 'waiting'/);
assert.match(source, /completeVehicleUnlock/);
assert.match(source, /cameraController\.target = field\.vehicle\.node/);
assert.match(source, /}, 4\)/);
assert.match(source, /scale: new Vec3\(0, 0, 0\)/);
assert.match(source, /showUnlockStage\(field, 'hauler', true\)/);
```

- [ ] **Step 2: Assert the hauler contract**

```js
assert.match(source, /completeHaulerUnlock/);
assert.match(source, /actor\.addComponent\(HaulerNPC\)/);
assert.match(source, /behavior\.collectionStorage = field\.collectionStorage/);
assert.match(source, /behavior\.sellStorage = field\.sellStorage/);
assert.match(source, /behavior\.carryStorage = carryStorage/);
assert.match(source, /transferInterval = 0\.15/);
```

- [ ] **Step 3: Run and confirm red**

Run: `node --test tests/corn-vehicle-hauler-parity-regression.test.mjs`

Expected: FAIL because both parity controllers are absent.

### Task 2: Match the forest tractor unlock and path loop

**Files:**
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`
- Modify: `assets/Scenes/DevScene.scene`
- Test: `tests/corn-vehicle-hauler-parity-regression.test.mjs`

**Interfaces:**
- Produces: `completeVehicleUnlock(field, padNode)`, `VehicleRuntime`, `createVehiclePath(field)`, and `harvestPlantsInVehicleRange(field)`.

- [ ] **Step 1: Replace generic vehicle runtime with path state**

```ts
type VehicleState = 'idle' | 'moving_to_start' | 'moving_to_end' | 'turning' | 'waiting';
type VehicleRuntime = ActorRuntime & {
    state: VehicleState;
    startPoint: Vec3;
    endPoint: Vec3;
    movingToEnd: boolean;
    waitTimer: number;
    startDelay: number;
};
```

- [ ] **Step 2: Derive the corn path from active plant bounds**

```ts
const positions = field.plants.map(plant => plant.node.worldPosition);
const x = positions.reduce((sum, position) => sum + position.x, 0) / positions.length;
const startPoint = new Vec3(x, actor.worldPosition.y, Math.max(...positions.map(position => position.z)));
const endPoint = new Vec3(x, actor.worldPosition.y, Math.min(...positions.map(position => position.z)));
```

- [ ] **Step 3: Match forest path settings**

Use start delay `1`, move speed `2`, chop range `3`, endpoint wait `0.1`, and instantaneous direction reversal matching the scene's forest truck settings.

- [ ] **Step 4: Harvest crops on contact**

For every active plant within `vehicleChopRange`, reduce its remaining hit points to one and call `damagePlant(field, plant, false)` once, matching forest vehicle collider behavior that finishes a tree immediately.

- [ ] **Step 5: Implement MACHINE unlock presentation**

Shrink the vehicle pad visual to `(0,0,0)` over `0.5` seconds, hide workers, spawn the tractor, display the hauler pad with its `0.72` entrance tween, hide the old pad after `1` second, and lock the camera/joystick to the tractor for `4` seconds.

- [ ] **Step 6: Run the tractor test**

Run: `node --test tests/corn-vehicle-hauler-parity-regression.test.mjs`

Expected: tractor assertions PASS.

### Task 3: Reuse forest HaulerNPC for corn transport

**Files:**
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`
- Test: `tests/corn-vehicle-hauler-parity-regression.test.mjs`

**Interfaces:**
- Consumes: `HaulerNPC`, `field.collectionStorage`, `field.sellStorage`, and the completed hauler pad.
- Produces: `createHaulerCarryStorage(actor)` and a configured `HaulerNPC` component.

- [ ] **Step 1: Implement HAULER unlock presentation**

Shrink the current pad visual to `(0,0,0)` over `0.5` seconds, instantiate the hauler immediately, and deactivate the pad after the tween.

- [ ] **Step 2: Create the carry storage**

```ts
const carryNode = new Node('CornCarryStorage');
carryNode.setParent(actor);
carryNode.setPosition(0, 1.2, -0.6);
const carryStorage = this.configureStorage(carryNode, `${field.id}_hauler_carry`, 4);
carryStorage.resourcePerRow = 2;
carryStorage.resourcePerCol = 2;
carryStorage.layerHeight = 0.18;
```

- [ ] **Step 3: Configure the actual forest component**

```ts
const behavior = actor.addComponent(HaulerNPC);
behavior.collectionPoint = field.collectionStorage.node;
behavior.sellPoint = field.sellNode;
behavior.idlePoint = padNode;
behavior.collectionStorage = field.collectionStorage;
behavior.sellStorage = field.sellStorage;
behavior.carryStorage = carryStorage;
behavior.moveSpeed = 3;
behavior.transferInterval = 0.15;
behavior.collectionStopDistance = 1.1;
behavior.sellStopDistance = 0.2;
```

- [ ] **Step 4: Remove the corn teleport-transfer loop**

When `field.haulerBehavior` exists, `ResourceFieldSystem` must not run its legacy direct collection-to-sell transfer. All movement, loading, unloading, animations, and recovery come from `HaulerNPC`.

- [ ] **Step 5: Run parity tests**

Run: `node --test tests/corn-vehicle-hauler-parity-regression.test.mjs tests/hauler-background-recovery.test.mjs`

Expected: all assertions PASS.

### Task 4: Full verification and Git approval gate

**Files:**
- Verify: `assets/_Scripts/ResourceFieldSystem.ts`
- Verify: `assets/Scenes/DevScene.scene`
- Verify: `tests/*.test.mjs`

**Interfaces:**
- Produces: validation results and an uncommitted diff for user review.

- [ ] **Step 1: Run all tests**

Run: `node --test tests/*.test.mjs`

Expected: zero failures.

- [ ] **Step 2: Validate scene JSON and TypeScript transpilation**

Parse `DevScene.scene` and transpile `ResourceFieldSystem.ts` plus `FinishNode.ts` with the Cocos Creator 3.8.7 bundled TypeScript.

- [ ] **Step 3: Run `git diff --check` and scan for temporary debug markers**

Expected: no whitespace errors and no new debug markers.

- [ ] **Step 4: Present changes without staging**

Proposed message: `fix: align corn vehicles with forest behavior`

Wait for explicit approval before `git add`, `git commit`, or `git push`.
