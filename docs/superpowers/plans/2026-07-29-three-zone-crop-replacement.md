# Three-Zone Crop Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the center trees with tulips, the right field with sunflowers, and the left field with strawberries, including the harvested product visuals.

**Architecture:** Keep the existing harvesting, worker, vehicle, storage, and unlock components intact. Author separate strawberry and sunflower field prefabs and bind them directly in `DevScene`; replace all 32 center prefab instances with a scaled tulip prefab. Product prefabs are also authored at suitable sizes and referenced by the scene. No plant model is instantiated or replaced by gameplay scripts at startup.

**Tech Stack:** Cocos Creator 3.8.6, TypeScript, serialized `.scene` JSON, Node.js regression tests.

## Global Constraints

- Center mapping: tulip plant (`SM_Flower`) -> tulip bouquet (`SM_FlowerBaoZhuang`).
- Right mapping: sunflower plant (`SM_向日葵`) -> sunflower bouquet (`SM_向日葵花束`).
- Left mapping: strawberry plant (`SM_CaoMei_01`) -> strawberry (`SM_CaoMei_01`).
- Preserve all existing harvesting, respawn, unlock, worker, vehicle, backpack, and storage behavior.
- Do not replace or remove gameplay colliders when replacing visuals.
- Plant visuals must be directly authored prefab instances in `DevScene`, not startup-generated replacements.

---

### Task 1: Lock the three resource mappings

**Files:**
- Create: `tests/three-zone-crop-replacement-regression.test.mjs`
- Create: `assets/Prefab/左侧草莓田.prefab`
- Create: `assets/Prefab/右侧向日葵田.prefab`
- Create: `assets/Prefab/中间郁金香.prefab`
- Create: `assets/Prefab/产物_草莓.prefab`
- Create: `assets/Prefab/产物_向日葵花束.prefab`
- Create: `assets/Prefab/产物_郁金香花束.prefab`
- Modify: `assets/Scenes/DevScene.scene`

**Interfaces:**
- Consumes: `ResourceFieldSystem.leftPlantVisualPrefab`, `leftResourcePrefab`, `rightPlantVisualPrefab`, `rightResourcePrefab`.
- Produces: serialized plant/product prefab references for both side fields and the center `WoodDropManager`.

- [ ] **Step 1: Write the failing test**

Assert that the left field uses `d1d4ae49-dffe-4af2-8b8b-1fd663ff0bd0` for both plant and product, the right field uses `29ce9e6e-1b9a-4b35-ba2b-eaf4f4f0d7de@ea51e` for plants and `c9f085e2-73c6-4ca5-8e3e-32f5aff558f8@bf07f` for products, and the center manager uses `ba576d93-f8de-4db4-9696-57988d01b082@c0435` plus `a7987a15-4938-4fce-b952-3ec96d499359@4afba`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/three-zone-crop-replacement-regression.test.mjs`

Expected: FAIL because the scene still contains corn and wood references.

- [ ] **Step 3: Update the scene mappings**

Set `leftResourceId` to `field_left_strawberry`, `rightResourceId` to `field_right_sunflower`, bind the two authored field prefabs directly, replace all center tree prefab references with the authored tulip prefab, and replace product/backpack display references with the three scaled product prefabs.

- [ ] **Step 4: Run test to verify scene mappings pass**

Run: `node --test tests/three-zone-crop-replacement-regression.test.mjs`

Expected: the mapping assertions pass.

### Task 2: Replace only the center tree prefab's renderer assets

**Files:**
- Create: `assets/Prefab/中间郁金香.prefab`
- Modify: `assets/Scenes/DevScene.scene`
- Test: `tests/three-zone-crop-replacement-regression.test.mjs`

**Interfaces:**
- Consumes: the original tree prefab hierarchy, file IDs, animations, and mounted scene components.
- Produces: the same gameplay prefab structure with only its visible mesh/material changed to the scaled tulip asset.

- [ ] **Step 1: Add failing source assertions**

Assert that no `plantVisualPrefab`, `installReplacementVisual`, or renderer compatibility branch exists in gameplay scripts and that the scene contains 32 direct tulip-prefab references.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/three-zone-crop-replacement-regression.test.mjs`

Expected: FAIL because the replacement interface does not exist.

- [ ] **Step 3: Implement visual-only replacement**

Copy the original tree prefab structure, preserve its root and child file IDs, disable its old tree renderers, and bind the scaled tulip mesh/material to the existing persistent `songshu_01` renderer node. Do not edit `Tree.ts`, colliders, animations, storage bindings, or mounted gameplay components.

- [ ] **Step 4: Run focused and existing regressions**

Run: `node --test tests/three-zone-crop-replacement-regression.test.mjs tests/player-tool-animation-progression-regression.test.mjs`

Expected: PASS.

- [ ] **Step 5: Validate serialized data**

Run: `git diff --check -- assets/Scenes/DevScene.scene assets/Prefab tests/three-zone-crop-replacement-regression.test.mjs`

Expected: no whitespace errors.
