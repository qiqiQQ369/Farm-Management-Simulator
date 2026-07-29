# Woodcutter Protagonist Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every woodcutter use the protagonist model, skeleton, and animation clips while rendering with the matching worker texture.

**Architecture:** The woodcutter presentation component clones the authored `Player/PlayerVisual` hierarchy so it stays identical to the protagonist rig. It replaces only renderer materials and maps the existing idle/move/chop states to protagonist clips; gameplay state and tree-cutting logic remain unchanged.

**Tech Stack:** Cocos Creator 3.x, TypeScript, Cocos scene JSON, Node test runner.

## Global Constraints

- Do not change woodcutting, navigation, spawning, rewards, or unlock logic.
- Do not control the editor or the user's computer.
- Preserve the axe node and existing prefab/template relationships.
- Apply the same presentation to scene workers and workers cloned later.

---

## Task 1: Lock the visual contract with regression tests

- [x] Update the woodcutter animation regression test for protagonist clip names.
- [x] Assert the protagonist visual is cloned and receives the worker material.
- [x] Assert the worker material references the matching worker texture.
- [x] Run the focused test and confirm it fails before implementation.

## Task 2: Create the worker material

- [x] Add a material based on the protagonist material.
- [x] Bind its main texture to `搬运工贴图/T_NVZHU_A.jpg`.

## Task 3: Replace the woodcutter presentation

- [x] Clone `Player/PlayerVisual` under each woodcutter.
- [x] Hide the old character visual while preserving the axe.
- [x] Apply the worker material to all cloned skinned renderers.
- [x] Map idle, movement, and chopping to protagonist animation clips.

## Task 4: Bind the authored scene

- [x] Assign the worker material to all three woodcutter components.
- [x] Verify the worker template retains the assignment for future clones.
- [x] Validate scene references and JSON integrity.

## Task 5: Verify

- [x] Run focused woodcutter tests.
- [x] Run the relevant full test suite.
- [x] Confirm only presentation assets and mappings changed.
