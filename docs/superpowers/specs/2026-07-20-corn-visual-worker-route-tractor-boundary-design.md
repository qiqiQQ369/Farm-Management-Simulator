# Corn Visual, Worker Route, and Tractor Boundary Design

## Scope

Fix three corn-field behaviors in `DevScene`:

1. A harvested corn plant must restore its visible model when its respawn timer completes.
2. Only the three workers unlocked in a corn field must harvest their assigned corn row in order, proceed forward to the row boundary, then reverse direction. The forest workers keep their current behavior.
3. A corn tractor must travel only over the occupied corn field area.

## Architecture

`CornFieldProduction` remains the sole owner of corn plant availability, rewards, and respawn timing. Each plant keeps its authored root node and any runtime visual child. Harvest hides the root. Respawn restores the root and all visual descendants to their active state, resets the root to its stored full scale, and then runs the existing growth tween. This keeps rendering and interaction state in the same lifecycle.

`Woodcutter` remains the shared forest worker state machine. The corn-field adapter supplies only its three contiguous, row-ordered crop target lists. The adapter must preserve that order and configure each worker with a bounded forward-and-reverse target sequence. The forest branch continues using its tree targets and is not modified semantically.

`LoggingTruck` remains the tractor movement controller. Every corn field owns a start and end waypoint derived from the outermost occupied crop positions along the tractor lane. The selected two positions must be clamped inside the crop bounds before they are assigned to the tractor, so an incorrectly authored or stale scene waypoint cannot take the tractor beyond the planted field.

## Data Flow

Corn harvest sets a plant's respawn deadline and hides the plant root. On expiry, `CornFieldProduction` restores the authored/root visibility plus its child visual state before the model scales from its growth scale to the captured full scale. The availability check continues to gate player, worker, and tractor harvesting during the short protection window.

When a corn worker unlocks, `ResourceFieldSystem` partitions the plants in row order into three non-overlapping groups. A worker consumes targets in its own group from the current direction, skips temporarily unavailable plants, and reverses only after reaching its group's end. Its target callback delegates damage and output to `CornFieldProduction`; it never registers a forest tree chop or writes to wood storage.

When a tractor unlocks, `ResourceFieldSystem` passes crop-bounded lane endpoints to its `LoggingTruck`. The tractor uses its existing movement, turn, and contact-harvest loop. Crop contact harvesting still delegates to `CornFieldProduction`, so respawn and storage behavior remain unchanged.

## Error Handling

If a corn field has no valid crop plants, workers receive no targets and the tractor remains disabled rather than being given an unbounded fallback route. If a plant root becomes invalid, it is skipped during visibility restoration and targeting. If a visual descendant was deactivated during harvesting, respawn reactivates it only when its authored/runtime state marked it as part of the plant visual.

## Verification

Regression checks will assert that the respawn lifecycle restores visible descendants before the growth tween, corn-worker routing uses row-order targets with endpoint reversal without altering the forest tree target branch, and the tractor endpoints are computed/clamped from the corn plant bounds. Existing corn isolation tests must continue to prove that no corn output enters forest wood storage. The complete Node regression suite, scene JSON parsing, TypeScript diagnostics, and `git diff --check` must pass.
