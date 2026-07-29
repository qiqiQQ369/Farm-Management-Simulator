# Sunflower and Tulip Field Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute this plan task-by-task in the current session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sunflower field use the same worker, hauler, unlock, storage, and money flow as the tulip field while retaining its sunflower crop and product assets.

**Architecture:** Keep both fields on the existing `FieldRuntime` and `createField` pipeline. Fix the only lifecycle-dependent visual branch at the worker spawn seam, then lock left/right parity down with scene-data and source-level regression tests instead of introducing a second sunflower-only implementation.

**Tech Stack:** Cocos Creator 3.x scene JSON, TypeScript, Node.js test runner.

## Global Constraints

- Do not change crop harvesting, hauling, unlock payment, storage transfer, or customer purchase rules.
- Keep the sunflower and tulip resource prefabs distinct.
- Reuse the same customer, hauler, unlock, storage, and `moneyMod` behavior for both fields.
- Do not control the editor or the user's computer.

---

### Task 1: Lock Down Left/Right Field Parity

**Files:**
- Create: `tests/sunflower-tulip-parity-regression.test.mjs`
- Test: `tests/sunflower-tulip-parity-regression.test.mjs`

**Interfaces:**
- Consumes: serialized `ResourceFieldSystem`, both field roots, and both `CornCustomerScheduler` components from `assets/Scenes/DevScene.scene`
- Produces: deterministic assertions for worker/hauler/unlock/storage/money parity

- [ ] **Step 1: Write the failing parity test**

```js
test('sunflower field shares tulip worker, hauler, unlock, storage, and money settings', () => {
    assert.deepEqual(rightGameplaySettings, leftGameplaySettings);
    assert.equal(rightScheduler.coinPrefab.__uuid__, leftScheduler.coinPrefab.__uuid__);
    assert.equal(rightScheduler.coinReward, leftScheduler.coinReward);
    assert.equal(rightStorage.capacity, leftStorage.capacity);
});
```

- [ ] **Step 2: Run the test to verify the current lifecycle gap is detected**

Run: `node --test tests/sunflower-tulip-parity-regression.test.mjs tests/sunflower-worker-animation-regression.test.mjs`

Expected: FAIL because worker spawning does not guarantee that `WoodcutterVisual` exists before binding its animation.

- [ ] **Step 3: Keep already-equal settings unchanged**

The scene audit must confirm that both schedulers reference:

```text
moneyMod prefab UUID: 496d89d8-176e-401a-911d-76ee1450436c
coinReward: 3
collection capacity: 200
worker cost: 100
vehicle cost: 200
hauler cost: 170
```

- [ ] **Step 4: Run the parity test**

Run: `node --test tests/sunflower-tulip-parity-regression.test.mjs`

Expected: PASS for all settings that are already shared.

### Task 2: Make Worker Visual and Animation Creation Deterministic

**Files:**
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`
- Modify: `tests/sunflower-worker-animation-regression.test.mjs`

**Interfaces:**
- Consumes: `Player/PlayerVisual`, the inherited worker material, and a spawned field worker node
- Produces: `ensureProtagonistWorkerVisual(actor: Node): Node | null`

- [ ] **Step 1: Keep the animation regression test red**

```js
assert.match(spawnMethod, /this\.ensureProtagonistWorkerVisual\(actor\)/);
assert.match(fieldSource, /skeletalAnimation\.enabled = true/);
```

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/sunflower-worker-animation-regression.test.mjs`

Expected: FAIL before implementation.

- [ ] **Step 3: Ensure the protagonist visual during worker spawn**

```ts
restoreCornVisualHierarchy(actor, false);
this.ensureProtagonistWorkerVisual(actor);
controller.skeletalAnimation = this.findVisibleWorkerAnimation(actor)!;
controller.chopAction.skeletonAnimation = controller.skeletalAnimation;
```

The helper must instantiate `Player/PlayerVisual` only when missing, preserve protagonist world scale and ground height, apply the inherited worker material, hide the legacy animated sibling, and explicitly enable the selected `SkeletalAnimation`.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/sunflower-worker-animation-regression.test.mjs`

Expected: PASS.

### Task 3: Verify Shared Hauler, Unlock, Storage, and Money Behavior

**Files:**
- Verify: `assets/_Scripts/ResourceFieldSystem.ts`
- Verify: `assets/_Scripts/CornHauler.ts`
- Verify: `assets/_Scripts/CornCustomerScheduler.ts`
- Test: `tests/corn-worker-parity-regression.test.mjs`
- Test: `tests/corn-vehicle-hauler-parity-regression.test.mjs`
- Test: `tests/corn-carried-money-scale-regression.test.mjs`
- Test: `tests/corn-sell-storage-placement-regression.test.mjs`

**Interfaces:**
- Consumes: the shared `FieldRuntime` created for each side
- Produces: identical non-resource gameplay behavior for both fields

- [ ] **Step 1: Verify both fields call the same `createField` path**

```ts
const leftField = this.createField(/* left bindings */);
const rightField = this.createField(/* right bindings */);
```

- [ ] **Step 2: Verify both customer schedulers use the same money prefab**

```js
assert.equal(leftScheduler.coinPrefab.__uuid__, rightScheduler.coinPrefab.__uuid__);
assert.equal(leftScheduler.coinReward, rightScheduler.coinReward);
```

- [ ] **Step 3: Run the shared behavior suite**

Run:

```powershell
node --test tests/corn-worker-parity-regression.test.mjs tests/corn-vehicle-hauler-parity-regression.test.mjs tests/corn-carried-money-scale-regression.test.mjs tests/corn-sell-storage-placement-regression.test.mjs
```

Expected: PASS.

### Task 4: Final Scene and Formatting Verification

**Files:**
- Verify: `assets/Scenes/DevScene.scene`
- Verify: `assets/_Scripts/ResourceFieldSystem.ts`
- Verify: `tests/sunflower-worker-animation-regression.test.mjs`
- Verify: `tests/sunflower-tulip-parity-regression.test.mjs`

**Interfaces:**
- Consumes: completed field parity implementation
- Produces: a clean handoff with no unrelated scene mutations

- [ ] **Step 1: Parse the scene and compare serialized field settings**

Run: `node --test tests/sunflower-tulip-parity-regression.test.mjs`

Expected: PASS.

- [ ] **Step 2: Check edited files**

Run:

```powershell
git diff --check -- assets/_Scripts/ResourceFieldSystem.ts assets/Scenes/DevScene.scene tests/sunflower-worker-animation-regression.test.mjs tests/sunflower-tulip-parity-regression.test.mjs
```

Expected: no whitespace errors.

- [ ] **Step 3: Run all focused regressions**

Run:

```powershell
node --test tests/sunflower-worker-animation-regression.test.mjs tests/sunflower-tulip-parity-regression.test.mjs tests/corn-worker-parity-regression.test.mjs tests/corn-vehicle-hauler-parity-regression.test.mjs tests/corn-carried-money-scale-regression.test.mjs tests/corn-sell-storage-placement-regression.test.mjs
```

Expected: all tests pass.
