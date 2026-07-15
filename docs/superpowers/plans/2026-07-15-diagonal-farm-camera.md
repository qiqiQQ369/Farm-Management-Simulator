# Diagonal Farm Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give DevScene a stable perspective diagonal view matching the supplied farm reference without changing gameplay placement or portrait UI.

**Architecture:** Keep `CameraController` as the only runtime source of camera movement and rotation. Configure its existing serialized `offset`, `lookAtOffset`, and rotation flag in DevScene, then align the Main Camera's starting position to Player plus the same offset.

**Tech Stack:** Cocos Creator 3.8.7, Cocos serialized scene JSON, TypeScript, Git.

## Global Constraints

- Keep Cocos Creator at version `3.8.7`.
- Keep perspective projection, FOV `40`, near clip `1`, far clip `50`, and 720 x 1280 portrait design resolution.
- Do not move world nodes or alter UI, player, collision, or map logic.
- Modify only `assets/Scenes/DevScene.scene` for the implementation.

---

### Task 1: Apply the diagonal perspective follow configuration

**Files:**
- Modify: `assets/Scenes/DevScene.scene:129-259`
- Test: Cocos Creator preview of `assets/Scenes/DevScene.scene`

**Interfaces:**
- Consumes: Main Camera's existing `CameraController`, whose `target` is Player and `camera` is the Main Camera component.
- Produces: right-side diagonal perspective follow behavior with Player framed below center.

- [ ] **Step 1: Close Cocos Creator and discard editor-generated scene serialization changes**

Run:

```powershell
Get-Process -Name CocosCreator -ErrorAction SilentlyContinue | Stop-Process
git restore --source=HEAD --staged --worktree -- assets/Scenes/DevScene.scene
git status --short
```

Expected: no output from `git status --short`; this removes only uncommitted editor-generated scene IDs and leaves committed documentation unchanged.

- [ ] **Step 2: Write the failing configuration assertion**

Run:

```powershell
$scene = Get-Content -Raw 'assets/Scenes/DevScene.scene'
if ($scene -match '"x": 8\s*,\s*"y": 16\.8\s*,\s*"z": 10' -and $scene -match '"enableSmoothRotation": true') {
  exit 0
}
throw 'Diagonal camera settings have not been applied.'
```

- [ ] **Step 3: Run the assertion and verify it fails**

Run the Step 2 command.

Expected: PowerShell throws `Diagonal camera settings have not been applied.` because the current follow offset is `(0, 0, 17)` and smooth rotation is disabled.

- [ ] **Step 4: Update the Main Camera and CameraController serialization**

In `assets/Scenes/DevScene.scene`, replace the existing values with the following exact JSON values. Preserve all other fields.

```json
"_lpos": {
  "__type__": "cc.Vec3",
  "x": 7.206,
  "y": 17.022,
  "z": 16.234
}
```

```json
"offset": {
  "__type__": "cc.Vec3",
  "x": 8,
  "y": 16.8,
  "z": 10
},
"lookAtOffset": {
  "__type__": "cc.Vec3",
  "x": 0,
  "y": 0,
  "z": 4
},
"enableSmoothRotation": true,
"rotationSpeed": 0.65
```

- [ ] **Step 5: Run the assertion and static scene checks**

Run:

```powershell
$scene = Get-Content -Raw 'assets/Scenes/DevScene.scene'
if ($scene -notmatch '"x": 8\s*,\s*"y": 16\.8\s*,\s*"z": 10') { throw 'Follow offset mismatch.' }
if ($scene -notmatch '"x": 0\s*,\s*"y": 0\s*,\s*"z": 4') { throw 'Look-at offset mismatch.' }
if ($scene -notmatch '"enableSmoothRotation": true') { throw 'Rotation is disabled.' }
if ($scene -notmatch '"_projection": 1' -or $scene -notmatch '"_fov": 40') { throw 'Perspective camera settings changed.' }
git diff --check
```

Expected: command exits with code `0`.

- [ ] **Step 6: Preview in Cocos Creator and verify composition**

Open DevScene with Creator 3.8.7 and run Preview.

Expected: roads and buildings run diagonally through the portrait frame; model side faces are visible; Player remains in the lower half; moving Player preserves the angle; UI, joystick, collision, and map-boundary behavior remain normal.

- [ ] **Step 7: Commit and push the validated scene change**

```powershell
git add assets/Scenes/DevScene.scene
git commit -m "Set diagonal farm camera view"
git push
```

Expected: `main` matches `origin/main`, and the commit changes only `assets/Scenes/DevScene.scene`.
