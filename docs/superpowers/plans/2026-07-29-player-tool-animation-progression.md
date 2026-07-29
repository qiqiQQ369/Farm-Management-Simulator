# Player Tool Animation Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute this plan inline and verify every task before continuing.

**Goal:** Replace the player's animation clips with the clips from `assets/美术资源/FBX/女主角.fbx` and advance the player from sickle to hand mower to ride mower as side fields are unlocked.

**Architecture:** `PlayerController` owns one explicit tool stage and maps movement to stage-specific animation names. `ResourceFieldSystem` advances that stage from the authoritative `_openedSideFields` count. The FBX importer metadata splits the source take into named clips used directly by the scene's `SkeletalAnimation`.

**Tech Stack:** Cocos Creator 3.8.6, TypeScript, Cocos FBX importer metadata, Node.js source-level regression tests.

## Global Constraints

- The initial player tool stage is `Sickle`; there is no empty-hand stage.
- Unlocking the first side field switches to `HandMower`.
- Unlocking the second side field switches to `RideMower`.
- Preserve the existing `Player` node, movement, collision, backpack, camera, and interaction bindings.
- Use animation data from `assets/美术资源/FBX/女主角.fbx`.

---

### Task 1: Lock down the progression and clip contract

**Files:**
- Create: `tests/player-tool-animation-progression-regression.test.mjs`

**Interfaces:**
- Consumes: `PlayerController.ts`, `ResourceFieldSystem.ts`, `女主角.fbx.meta`, and `DevScene.scene`.
- Produces: A regression command that fails if stages, field triggers, clip ranges, or scene clip UUIDs diverge.

- [ ] **Step 1: Write the failing test**

Create a Node.js test that asserts:

```js
assert.match(playerSource, /export enum PlayerToolStage/);
assert.match(playerSource, /private _toolStage = PlayerToolStage\.Sickle/);
assert.match(fieldSource, /setToolStage\(PlayerToolStage\.HandMower\)/);
assert.match(fieldSource, /setToolStage\(PlayerToolStage\.RideMower\)/);
assert.deepEqual(splitRanges, {
  idle: [0, 51 / 30],
  run: [51 / 30, 72 / 30],
  sickle_run: [73 / 30, 89 / 30],
  hand_mower_run: [90 / 30, 110 / 30],
  sickle_harvest: [111 / 30, 130 / 30],
  hand_mower_idle: [131 / 30, 151 / 30],
  ride_mower: [152 / 30, 176 / 30],
});
```

Also parse `DevScene.scene` and assert that `PlayerVisual` references all seven animation sub-assets from FBX UUID `9dd96310-acfb-4481-8e0c-80c4c0202608`.

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node tests/player-tool-animation-progression-regression.test.mjs
```

Expected: FAIL because the tool-stage enum and target FBX clip split do not exist yet.

### Task 2: Split and bind the target FBX animations

**Files:**
- Modify: `assets/美术资源/FBX/女主角.fbx.meta`
- Modify: `assets/Scenes/DevScene.scene`

**Interfaces:**
- Consumes: Frame ranges in `assets/美术资源/FBX/帧数范围.txt`.
- Produces: `idle`, `run`, `sickle_run`, `hand_mower_run`, `sickle_harvest`, `hand_mower_idle`, and `ride_mower` animation clips on `PlayerVisual`.

- [ ] **Step 1: Replace the single FBX take split**

Configure `animationImportSettings[0].splits` with these seconds at 30 FPS:

```json
[
  { "name": "idle", "from": 0, "to": 1.7, "wrapMode": 2, "previousId": "73b7f" },
  { "name": "run", "from": 1.7, "to": 2.4, "wrapMode": 2, "previousId": "a11d0" },
  { "name": "sickle_run", "from": 2.433333333333333, "to": 2.966666666666667, "wrapMode": 2, "previousId": "b22d0" },
  { "name": "hand_mower_run", "from": 3, "to": 3.666666666666667, "wrapMode": 2, "previousId": "c33d0" },
  { "name": "sickle_harvest", "from": 3.7, "to": 4.333333333333333, "wrapMode": 2, "previousId": "d44d0" },
  { "name": "hand_mower_idle", "from": 4.366666666666666, "to": 5.033333333333333, "wrapMode": 2, "previousId": "e55d0" },
  { "name": "ride_mower", "from": 5.066666666666666, "to": 5.866666666666667, "wrapMode": 2, "previousId": "f66d0" }
]
```

- [ ] **Step 2: Reimport the FBX and bind scene clips**

After Cocos regenerates the animation sub-assets, set `PlayerVisual/cc.SkeletalAnimation._clips` to:

```text
@73b7f @a11d0 @b22d0 @c33d0 @d44d0 @e55d0 @f66d0
```

All clip UUIDs must use the target FBX base UUID `9dd96310-acfb-4481-8e0c-80c4c0202608`.

### Task 3: Drive animation stage from unlocked fields

**Files:**
- Modify: `assets/_Scripts/PlayerController.ts`
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`

**Interfaces:**
- Produces: `PlayerController.setToolStage(stage: PlayerToolStage): void`.
- Consumes: `ResourceFieldSystem._openedSideFields`.

- [ ] **Step 1: Add the tool-stage state machine**

Add:

```ts
export enum PlayerToolStage {
    Sickle,
    HandMower,
    RideMower,
}

private _toolStage = PlayerToolStage.Sickle;

public setToolStage(stage: PlayerToolStage): void {
    if (this._toolStage === stage) return;
    this._toolStage = stage;
    this.syncMovementAnimation(true);
}
```

Select animations with:

```ts
switch (this._toolStage) {
    case PlayerToolStage.HandMower:
        return this._isMoving ? 'hand_mower_run' : 'hand_mower_idle';
    case PlayerToolStage.RideMower:
        return 'ride_mower';
    default:
        if (this._isHarvestingCrop || this._isChoppingTree || this.chopAction?.isPlaying()) return 'sickle_harvest';
        return this._isMoving ? 'run' : 'sickle_harvest';
}
```

- [ ] **Step 2: Advance the stage after each field reveal**

Immediately after incrementing `_openedSideFields`, call:

```ts
this._playerController?.setToolStage(
    this._openedSideFields >= 2
        ? PlayerToolStage.RideMower
        : PlayerToolStage.HandMower,
);
```

- [ ] **Step 3: Run verification**

Run:

```powershell
node tests/player-tool-animation-progression-regression.test.mjs
git diff --check
```

Expected: PASS; scene JSON parses, all target clip references exist, and no whitespace errors are reported.
