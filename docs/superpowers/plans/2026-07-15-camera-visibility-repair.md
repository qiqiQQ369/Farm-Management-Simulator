# Camera Visibility Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the 3D map and player on the first rendered frame while retaining the diagonal farm camera view.

**Architecture:** Keep `CameraController` as the sole owner of camera position and rotation. Its existing look-at logic will accept an immediate mode used after startup placement, while normal frames retain smooth rotation toward the player's forward look-at offset.

**Tech Stack:** Cocos Creator 3.8.7, TypeScript, Cocos `Vec3` and `math.Quat` APIs.

## Global Constraints

- Keep the diagonal camera offset `(8, 16.8, 10)`.
- Do not modify map assets, player assets, UI camera settings, rendering layers, or interaction logic.
- Keep normal follow rotation smooth after initialization.
- Target Cocos Creator version `3.8.7`.

---

### Task 1: Make initial camera orientation deterministic

**Files:**
- Modify: `assets/_Scripts/CameraController.ts:145-161,250-276`
- Test: Cocos Creator `DevScene` preview (manual; this project has no automated test runner configured in `package.json`).

**Interfaces:**
- Consumes: `target: Node`, `lookAtOffset: Vec3`, `rotationSpeed: number`, and the camera node transform.
- Produces: `private updateLookAt(immediate?: boolean): void`, callable after `initializePosition()` and during normal `update()` frames.

- [ ] **Step 1: Add the failing observable check**

Open `assets/Scenes/DevScene.scene` in Cocos Creator 3.8.7 and run Preview. Record the current failure: UI renders while the world viewport is an empty dark background.

- [ ] **Step 2: Confirm the failure before the code change**

Run: Start Preview from `DevScene`.

Expected: the map and player are absent while the cash UI and move joystick are visible.

- [ ] **Step 3: Update camera initialization and look-at implementation**

In `initializePosition()`, add an immediate orientation after the position is set:

```ts
Vec3.add(this._targetPosition, this.target.position, this.offset);
this.node.setPosition(this._targetPosition);
this.updateLookAt(true);
this._previousTargetPosition.set(this.target.position);
```

Change the method signature and final rotation branch to:

```ts
private updateLookAt(immediate: boolean = false): void {
    if (!this.enableSmoothRotation || !this.target) return;

    Vec3.add(this._tempVec3, this.target.position, this.lookAtOffset);
    if (this.enableShake && this._shakeTimer > 0) {
        Vec3.add(this._tempVec3, this._tempVec3, this._shakeOffset);
    }

    Vec3.subtract(this._tempVec3_2, this._tempVec3, this.node.position);
    if (this._tempVec3_2.length() <= 0.001) return;

    Vec3.normalize(this._tempVec3_2, this._tempVec3_2);
    const targetRotation = math.quat();
    math.Quat.fromViewUp(targetRotation, this._tempVec3_2, Vec3.UP);

    if (immediate) {
        this.node.setRotation(targetRotation);
        return;
    }

    const currentRotation = this.node.rotation;
    math.Quat.slerp(currentRotation, currentRotation, targetRotation, this.rotationSpeed);
    this.node.setRotation(currentRotation);
}
```

- [ ] **Step 4: Run static validation**

Run:

```powershell
git diff --check
rg -n 'updateLookAt\(true\)|private updateLookAt\(immediate: boolean = false\)' assets/_Scripts/CameraController.ts
```

Expected: `git diff --check` has exit code `0`, and both the immediate call and method signature are found.

- [ ] **Step 5: Validate in Cocos preview**

Run: reopen or refresh `DevScene`, then start Preview.

Expected: the first game frame displays the map and player; the camera remains diagonal, and moving the player keeps the view stable without a dark world viewport.

- [ ] **Step 6: Commit**

```powershell
git add assets/_Scripts/CameraController.ts
git commit -m "Fix diagonal camera world visibility"
git push origin main
```

## Self-review

- Spec coverage: Task 1 keeps the diagonal offset, applies immediate valid orientation, retains smooth following, and verifies the first frame plus movement. It does not change UI, assets, layers, or gameplay.
- Placeholder scan: no TODO/TBD or unspecified implementation steps remain.
- Type consistency: `updateLookAt(immediate?: boolean)` is declared and called with `true` only after startup placement; its existing no-argument call remains valid in `update()`.
