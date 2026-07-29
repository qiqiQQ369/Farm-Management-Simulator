# Sunflower Carry and Mower Visual Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sunflower bouquets stack and travel in the same authored pose as tulip bouquets, show the hand mower after the second field is unlocked, retain the ride-mower progression, and match bouquet display size without non-uniform scaling.

**Architecture:** Keep the existing field production, inventory, storage, and transfer systems unchanged. Correct the sunflower prefab's visual transform, author both mower meshes under the player in `DevScene.scene`, and let `PlayerController` toggle the three tool visuals from the existing `PlayerToolStage`.

**Tech Stack:** Cocos Creator scene/prefab JSON, TypeScript, Node.js `node:test`.

## Global Constraints

- Preserve all existing crop production, storage, collection, selling, and unlock behavior.
- Use only uniform XYZ scaling for the sunflower bouquet.
- Author mower visuals in the scene; do not instantiate them at runtime.
- Preserve the existing progression: sickle → hand mower → ride mower.

---

### Task 1: Lock down sunflower pose and mower visibility

**Files:**
- Modify: `tests/three-zone-crop-replacement-regression.test.mjs`
- Modify: `tests/player-tool-animation-progression-regression.test.mjs`

**Interfaces:**
- Consumes: `DevScene.scene`, sunflower product prefab, tulip product prefab.
- Produces: Regression assertions for uniform bouquet sizing/orientation and authored mower meshes.

- [ ] **Step 1: Assert the sunflower bouquet uses a uniform enlarged scale**

Keep the root-scale equality assertions and require the new scale to be greater than the undersized `5.7`.

- [ ] **Step 2: Assert the sunflower carry pose matches the tulip pose**

Assert the sunflower visual child uses Euler rotation `(90, 0, 0)` and a mesh-centering local position of approximately `(-0.004412, 0.002544, -0.00136)`.

- [ ] **Step 3: Assert both mower assets are authored in the player scene**

Require mesh UUID prefixes:

```text
87306553-b1a8-41b9-bb96-f965d9351f40@  hand mower
a30bd112-0794-40da-9b76-6626c38d2c33@  ride mower
```

- [ ] **Step 4: Run the focused red tests**

Run:

```powershell
node --test --test-name-pattern="right field plants|both mower models" tests/three-zone-crop-replacement-regression.test.mjs tests/player-tool-animation-progression-regression.test.mjs
```

Expected before implementation: two failures for the `5.7` sunflower scale and missing hand-mower scene mesh.

### Task 2: Match sunflower product size and pose to tulip

**Files:**
- Modify: `assets/Prefab/产物_向日葵花束.prefab`

**Interfaces:**
- Consumes: Sunflower mesh bounds `0.095502 × 0.146722 × 0.089830` and tulip displayed bounds.
- Produces: A uniformly scaled, centered, horizontal sunflower bouquet prefab.

- [ ] **Step 1: Set the root to uniform scale `6.1`**

```json
"_lscale": {
  "__type__": "cc.Vec3",
  "x": 6.1,
  "y": 6.1,
  "z": 6.1
}
```

- [ ] **Step 2: Rotate and center the mesh child**

```json
"_lpos": {
  "__type__": "cc.Vec3",
  "x": -0.004412,
  "y": 0.002544,
  "z": -0.00136
},
"_euler": {
  "__type__": "cc.Vec3",
  "x": 90,
  "y": 0,
  "z": 0
}
```

The `6.1` uniform factor matches the tulip bouquet's displayed bounding-box diagonal without distorting the sunflower mesh.

- [ ] **Step 3: Run the focused sunflower test**

Run:

```powershell
node --test --test-name-pattern="right field plants" tests/three-zone-crop-replacement-regression.test.mjs
```

Expected: PASS.

### Task 3: Author mower visuals and bind stage visibility

**Files:**
- Modify: `assets/Scenes/DevScene.scene`
- Modify: `assets/_Scripts/PlayerController.ts`

**Interfaces:**
- Consumes: Existing `PlayerToolStage`, player node, hand-mower and ride-mower meshes.
- Produces: `handMowerNode: Node`, `rideMowerNode: Node`, and stage-based visibility.

- [ ] **Step 1: Add serialized mower references**

```ts
@property({ type: Node, tooltip: 'Hand mower visual shown after the first side-field reveal.' })
public handMowerNode: Node = null!;

@property({ type: Node, tooltip: 'Ride mower visual shown after the second side-field reveal.' })
public rideMowerNode: Node = null!;
```

- [ ] **Step 2: Toggle all three tool visuals**

```ts
private syncToolVisibility(): void {
    const sickleNode = this.chopAction?.futouNode;
    if (sickleNode?.isValid) sickleNode.active = this._toolStage === PlayerToolStage.Sickle;
    if (this.handMowerNode?.isValid) {
        this.handMowerNode.active = this._toolStage === PlayerToolStage.HandMower;
    }
    if (this.rideMowerNode?.isValid) {
        this.rideMowerNode.active = this._toolStage === PlayerToolStage.RideMower;
    }
}
```

- [ ] **Step 3: Add disabled mower nodes under `Player`**

Author:

```text
Player/SM_割草机_Player
Player/SM_割草机_Player/SM_割草机刀片_Player
Player/SM_大型割草机_Player
```

Use the imported mesh/material UUIDs from `assets/_Assets/mode`, keep both root nodes inactive initially, and assign them to `PlayerController`.

- [ ] **Step 4: Run the focused mower test**

Run:

```powershell
node --test --test-name-pattern="both mower models|opening side fields" tests/player-tool-animation-progression-regression.test.mjs
```

Expected: PASS.

### Task 4: Verify the integrated change

**Files:**
- Verify: all files above.

**Interfaces:**
- Consumes: completed prefab, scene, controller, and regression tests.
- Produces: parseable Cocos assets with no changed field gameplay logic.

- [ ] **Step 1: Parse modified Cocos JSON**

Run a Node or Python JSON parse over `DevScene.scene` and the sunflower prefab.

- [ ] **Step 2: Run focused regressions**

```powershell
node --test --test-name-pattern="right field plants|both mower models|opening side fields" tests/three-zone-crop-replacement-regression.test.mjs tests/player-tool-animation-progression-regression.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run relevant suites**

```powershell
node --test tests/three-zone-crop-replacement-regression.test.mjs tests/player-tool-animation-progression-regression.test.mjs
```

Expected: New sunflower/mower assertions pass. Report any unrelated pre-existing animation-import assertions separately.

- [ ] **Step 4: Check patch formatting**

```powershell
git diff --check -- assets/Prefab/产物_向日葵花束.prefab assets/Scenes/DevScene.scene assets/_Scripts/PlayerController.ts tests/three-zone-crop-replacement-regression.test.mjs tests/player-tool-animation-progression-regression.test.mjs
```

Expected: no whitespace errors.
