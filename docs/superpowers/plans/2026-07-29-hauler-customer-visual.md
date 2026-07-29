# Hauler Customer Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace forest and corn hauler visuals with one fixed customer appearance and move carried products from the back to the customer's hands.

**Architecture:** `HaulerAnimation.ts` owns a presentation-only installer that clones the already configured male customer prefab, applies the first configured male customer texture, and returns its skeletal animation. Existing hauler creation code calls this installer but keeps all route, inventory, transfer, unlock, and production components unchanged. Both carry mounts use the same authored customer hand-storage transform from the scene.

**Tech Stack:** Cocos Creator 3.8.6, TypeScript, Cocos scene JSON, Node test runner.

## Global Constraints

- Do not modify hauler routing, transfer, storage capacity, unlock, or production logic.
- Use one fixed customer model and one fixed texture; do not randomize haulers.
- Use customer carry animation clips.
- Position carried resources at the customer hand-storage transform `(-0.199, 1.384, -0.426)`.
- Do not control the editor or the user's computer.

---

### Task 1: Add a presentation regression contract

**Files:**
- Create: `tests/hauler-customer-visual-regression.test.mjs`
- Modify: none

**Interfaces:**
- Consumes: existing `HaulerAnimation.ts`, `CoinConsumer.ts`, and `ResourceFieldSystem.ts`
- Produces: assertions for `installFixedCustomerHaulerVisual(root: Node)`

- [x] Write a failing test asserting the fixed male prefab/first male texture source, customer clips, and hand transform.
- [x] Run `node --test tests/hauler-customer-visual-regression.test.mjs` and confirm failure.

### Task 2: Install the fixed customer presentation

**Files:**
- Modify: `assets/_Scripts/HaulerAnimation.ts`
- Modify: `assets/_Scripts/CoinConsumer.ts`
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`

**Interfaces:**
- Consumes: `CustomerAppearanceRandomizer.malePrefab` and `maleTextures[0]`
- Produces: `installFixedCustomerHaulerVisual(root: Node): SkeletalAnimation | null`

- [x] Clone `malePrefab`, name it `FixedCustomerHaulerVisual`, and apply `maleTextures[0]`.
- [x] Set model scale/yaw from the existing customer appearance configuration.
- [x] Map hauler idle/run presentation to `idle2_NaHeZi` and `walk_NaHeZi`.
- [x] Bind both forest and corn hauler components to the returned customer animation.

### Task 3: Move carried resources to the hands

**Files:**
- Modify: `assets/_Scripts/CoinConsumer.ts`
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`
- Test: `tests/hauler-customer-visual-regression.test.mjs`

**Interfaces:**
- Consumes: customer scene storage transform
- Produces: identical forest/corn hand carry mounts

- [x] Parent each carry mount directly to its hauler root.
- [x] Set local position to `(-0.199, 1.384, -0.426)`.
- [x] Set local rotation to `(0, -90, 0)` and unit scale.

### Task 4: Verify

**Files:**
- Test: `tests/hauler-customer-visual-regression.test.mjs`
- Test: existing hauler regression tests

**Interfaces:**
- Consumes: completed presentation changes
- Produces: evidence that gameplay logic remains intact

- [x] Run focused customer-hauler tests.
- [x] Run existing hauler route, storage, and Web Release tests.
- [x] Confirm no route, capacity, transfer, unlock, or production values changed.
