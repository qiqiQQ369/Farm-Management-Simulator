# Farm Camera Angle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the active development scene to a lower, right-side perspective camera that matches the supplied farm-game reference while preserving all gameplay layout and portrait UI behavior.

**Architecture:** The existing `CameraController` already owns camera position through `target + offset` and can own orientation through `target + lookAtOffset`. Configure that existing component in `DevScene.scene` rather than adding a second camera script. The scene's Main Camera transform is updated to match the same initial composition so the editor and runtime start from the same viewpoint.

**Tech Stack:** Cocos Creator 3.8.7, TypeScript, Cocos serialized `.scene` JSON, Git/GitHub.

## Global Constraints

- Keep Cocos Creator at version `3.8.7`.
- Keep the current perspective camera projection, `fov: 40`, near clip `1`, and far clip `50`.
- Keep the `720 x 1280` portrait design resolution and all existing world-node positions unchanged.
- Modify only `assets/Scenes/DevScene.scene` for the camera implementation.
- Do not replace farm assets, map assets, UI assets, or the player model in this change.

---

### Task 1: Configure the DevScene follow camera for the farm perspective

**Files:**
- Modify: `assets/Scenes/DevScene.scene:111-259`
- Test: manual Cocos Creator preview of `assets/Scenes/DevScene.scene`

**Interfaces:**
- Consumes: `CameraController` on `Main Camera`, with existing `target: Player`, `camera: cc.Camera`, `offset: Vec3`, and `lookAtOffset: Vec3` properties.
- Produces: a stable right-side, lower perspective view in both the scene editor and runtime follow mode.

- [ ] **Step 1: Write the failing serialized-scene assertion**

Run this PowerShell command from the project root. It asserts the target farm-camera parameters before any scene edit:

```powershell
$scene = Get-Content -Raw 'assets/Scenes/DevScene.scene'
$required = @(
  '"x": 7,`r`n      "y": 16.8,`r`n      "z": 12',
  '"x": 0,`r`n      "y": 0,`r`n      "z": 4',
  '"enableSmoothRotation": true'
)
foreach ($value in $required) {
  if (-not $scene.Contains($value.Replace('`r`n', [Environment]::NewLine))) {
    throw "Missing expected farm-camera setting: $value"
  }
}
```

- [ ] **Step 2: Run the assertion and verify it fails before the edit**

Run the Step 1 command.

Expected: PowerShell throws `Missing expected farm-camera setting` because the current serialized controller uses `offset = (0, 0, 17)`, `lookAtOffset = (0, 0, 0)`, and has smooth rotation disabled.

- [ ] **Step 3: Update the existing Main Camera serialization**

In `assets/Scenes/DevScene.scene`, change the existing `CameraController` component on `Main Camera` to these exact values:

```json
"followMode": 1,
"followSpeed": 0.2,
"offset": {
  "__type__": "cc.Vec3",
  "x": 7,
  "y": 16.8,
  "z": 12
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

Update the preceding `Main Camera` node's initial local position to the matching player-relative position below. Do not change the existing camera projection properties.

```json
"_lpos": {
  "__type__": "cc.Vec3",
  "x": 6.206,
  "y": 17.022,
  "z": 18.234
}
```

Do not alter `boundsMin`, `boundsMax`, `fov`, `_projection`, the Player node, or any other scene object.

- [ ] **Step 4: Run the serialized-scene assertion and verify it passes**

Run the Step 1 command again.

Expected: command exits with code `0`; the controller now starts at the intended elevated right-side offset, looks four world units ahead of Player, and calculates its runtime rotation.

- [ ] **Step 5: Validate the result in Cocos Creator**

Open `assets/Scenes/DevScene.scene` in Cocos Creator `3.8.7`, then run a browser or simulator preview.

Expected:

- Main Camera displays a perspective view from the right-side, lower diagonal direction.
- Player remains in the lower portion of the portrait frame with the area in front of Player visible.
- Walking Player does not reset the camera to the previous straight-behind angle.
- Reaching the existing world boundaries does not force the camera below `y = 16.8` or break portrait UI.
- UI, joystick input, collisions, and player movement continue to work without warnings from `CameraController`.

- [ ] **Step 6: Commit and publish the validated camera adjustment**

```powershell
git add assets/Scenes/DevScene.scene
git commit -m "Adjust farm camera perspective"
git push
```

Expected: `main` is synchronized with `origin/main`, and the commit contains only `assets/Scenes/DevScene.scene`.
