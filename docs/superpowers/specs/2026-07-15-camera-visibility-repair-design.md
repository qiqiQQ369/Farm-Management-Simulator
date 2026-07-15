# Camera visibility repair design

## Goal

Restore visibility of the 3D map and player while retaining the diagonal farm-style camera angle.

## Cause

The diagonal camera change moved the camera and enabled rotation tracking, but the world camera can begin rendering before its rotation has converged on the follow target. The UI remains visible because it uses a separate UI camera.

## Design

- Keep the existing diagonal follow offset `(8, 16.8, 10)`.
- Add a single camera-orientation routine that calculates the point in front of the player and applies a valid look-at rotation.
- Invoke that routine during camera initialization after the follow position has been established, so the first rendered frame is aimed at the game world.
- Reuse the same routine during normal follow updates. Continue smooth rotation after initialization.
- If the target or camera is unavailable, leave the transform unchanged and log only the existing missing-camera diagnostic.

## Scope

- Update `assets/_Scripts/CameraController.ts` and, only if required to serialize the desired scene settings, `assets/Scenes/DevScene.scene`.
- Do not alter game entities, map assets, UI camera settings, rendering layers, or interaction logic.

## Verification

1. Start the `DevScene` preview.
2. Confirm that the map and player render on the first visible frame.
3. Confirm the view remains diagonal and the camera follows movement without a black world view.
