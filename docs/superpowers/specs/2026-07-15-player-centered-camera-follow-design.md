# Player-centered camera follow design

## Goal

Keep the Player visible at the center of the game viewport while the camera follows player movement and preserves the manually tuned camera angle and distance.

## Current finding

`DevScene` already assigns `CameraController.target` to the `Player` node. The player becomes visually lost because the camera's static framing and follow placement do not reliably establish a player-centered world view at startup.

## Design

- Keep `CameraController` as the single owner of world-camera movement.
- Validate the configured target during startup. If it is empty, locate the root scene node named `Player`.
- Place the camera at `Player.worldPosition + offset` during initialization, then maintain the same relative offset while following.
- Preserve the camera node's manually tuned rotation. The controller will not calculate or overwrite rotation.
- Retain the existing camera bounds. At a map edge, bounds take precedence over exact centering so that the camera cannot reveal outside-map space.

## Scope

- Modify `assets/_Scripts/CameraController.ts` only.
- Do not modify `DevScene`, map, UI, player model, assets, visibility masks, or render settings.

## Verification

1. Preview `DevScene` and confirm Player is visible in the viewport center at startup.
2. Drag to move Player and confirm the world camera follows while retaining the manually set rotation.
3. Move near a map boundary and confirm the camera remains within its configured bounds.
