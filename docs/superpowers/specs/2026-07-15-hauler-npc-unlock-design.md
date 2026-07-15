# Hauler NPC unlock design

## Goal

Add a worker NPC that moves wood from the collection point to the sell point after the player unlocks it.

## Unlock flow

1. The tractor unlock pad requires 155 currency.
2. When the tractor unlock completes, the hauler NPC unlock pad becomes active.
3. The player pays 170 currency at the hauler unlock pad.
4. The hauler unlock pad is hidden and the hauler NPC becomes active.

## Hauler behaviour

- Reuse an existing NPC prefab with its current movement and idle animations.
- When active, the hauler waits at the wood collection point until wood is available.
- It loads up to its configured carrying capacity, moves to the sell point, and deposits all carried wood into that point's `StoragePoint`.
- It then returns to the collection point and repeats.
- If the collection point is empty or the sell point has no available capacity, it waits without creating, losing, or selling wood.

## Economy boundary

The hauler does not award currency. Existing buyer NPC logic remains the only system that consumes sell-point wood and spawns currency.

## Scope

- Add a dedicated `HaulerNPC` component and configure one scene NPC plus its unlock pad.
- Connect the two existing/new unlock pads through explicit completion events or node activation checks.
- Reuse `StoragePoint`, `ResourceManager`, and existing NPC assets.
- Do not alter player movement, buyer NPC purchase logic, vehicle operation, or resource prices other than the new 170 unlock cost.

## Verification

1. Before the tractor is unlocked, the hauler unlock pad and hauler NPC are hidden.
2. Paying 155 for the tractor reveals the hauler unlock pad.
3. Paying 170 reveals and starts the hauler.
4. The hauler transfers wood from the collection point to the sell point.
5. Buyer NPCs can still buy deposited wood and generate currency.
