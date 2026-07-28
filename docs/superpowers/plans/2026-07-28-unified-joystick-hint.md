# Unified Joystick Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Farm's tutorial joystick and movement joystick use one coordinated control and the same background/handle art, matching MNJY's idle-hint interaction.

**Architecture:** `JoystickController` becomes the single owner of the movement joystick and `moveHit` hint lifecycle. The real `JoystickContainer` is shown at the hint anchor after the idle delay, with its real handle playing the hint drag loop, then moved to the touch point during input; the hint prefab keeps only its instructional text and no longer renders a second background or handle. `MainUI` retains layout and public show/hide compatibility, but no longer runs a second touch listener or idle timer.

The hint node's `Widget` alignment is refreshed before its world-space anchor is read so the fixed hint position remains correct after activation, resizing, and orientation changes.
The real joystick receives a 30-unit hint-only upward offset so its 210px background remains clear of the animated instruction text.

**Tech Stack:** Cocos Creator 3.8.6, TypeScript, Node.js built-in test runner

## Global Constraints

- Preserve Farm's existing movement vector API.
- Render the same movement joystick nodes in both hint and active states; never render a duplicate hint background or handle.
- Use a 3-second idle delay.
- Do not modify unrelated working-tree files.

---

### Task 1: Lock the unified behavior with a regression test

**Files:**
- Create: `tests/unified-joystick-hint-regression.test.mjs`

**Interfaces:**
- Consumes: `JoystickController` source and `MainUI` source as text
- Produces: Regression coverage for ownership, timing, touch transitions, and removal of duplicate handling

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('JoystickController owns the MNJY-style hint lifecycle', async () => {
  const joystick = await readFile(new URL('../assets/_Scripts/JoystickController.ts', import.meta.url), 'utf8');
  const mainUI = await readFile(new URL('../assets/_Scripts/MainUI.ts', import.meta.url), 'utf8');
  const hintPrefab = await readFile(new URL('../assets/_Assets/Effects/Prefabs/moveHit-001.prefab', import.meta.url), 'utf8');

  assert.match(joystick, /public hintNode: Node = null!/);
  assert.match(joystick, /public delayShowHintTime: number = 3/);
  assert.match(joystick, /this\\.setHintVisible\\(false\\)[\\s\\S]*this\\.delayShowHint\\(\\)/);
  assert.match(joystick, /onTouchStart[\\s\\S]*this\\.setHintVisible\\(false\\)/);
  assert.match(joystick, /onTouchEnd[\\s\\S]*this\\.delayShowHint\\(\\)/);
  assert.doesNotMatch(mainUI, /this\\.node\\.on\\(Input\\.EventType\\.TOUCH_START/);
  assert.doesNotMatch(mainUI, /noTouchTime/);
  assert.match(hintPrefab, /37ce4d9c-4ad3-4fc0-9d22-3a9476975652@f9941/);
  assert.match(hintPrefab, /2bf951fb-7bb5-45ea-87db-b0006ba838ff@f9941/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unified-joystick-hint-regression.test.mjs`

Expected: FAIL because `JoystickController` does not own `hintNode` or delayed hint behavior.

- [ ] **Step 3: Commit**

```bash
git add tests/unified-joystick-hint-regression.test.mjs
git commit -m "test: cover unified joystick hint lifecycle"
```

### Task 2: Move hint lifecycle into JoystickController

**Files:**
- Modify: `assets/_Scripts/JoystickController.ts`
- Modify: `assets/_Scripts/MainUI.ts`
- Modify: `assets/_Assets/Effects/Prefabs/moveHit-001.prefab`

**Interfaces:**
- Consumes: Existing `JoystickController` touch callbacks and `moveHit` scene node
- Produces: `setHintEnabled(enabled: boolean): void`, unified touch/hint scheduling

- [ ] **Step 1: Implement the unified controller**

Add serialized `hintNode` and `delayShowHintTime`, resolve `moveHit` from the Canvas when unbound, hide both visual modes on load, and schedule the hint. Touch start hides the hint; touch end hides the movement joystick and restarts the timer. Locking cancels both modes.

- [ ] **Step 2: Remove duplicate MainUI input ownership**

Keep `moveHit` lookup, responsive layout, and `hideMoveUI()` / `showMoveUI()`. Remove MainUI's touch listeners, idle timer, and touch callbacks so one component owns the interaction.

- [ ] **Step 3: Reuse the active joystick art in the hint prefab**

Set the hint background to sprite frame `37ce4d9c-4ad3-4fc0-9d22-3a9476975652@f9941` at `210x210`, and the animated hint handle to `2bf951fb-7bb5-45ea-87db-b0006ba838ff@f9941` at `90x90`. Retain the existing instruction strip and animation component.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/unified-joystick-hint-regression.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run the full regression suite**

Run: `node --test tests/*.test.mjs`

Expected: All tests pass.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`

Expected: Exit code 0.

- [ ] **Step 7: Commit**

```bash
git add assets/_Scripts/JoystickController.ts assets/_Scripts/MainUI.ts assets/_Assets/Effects/Prefabs/moveHit-001.prefab tests/unified-joystick-hint-regression.test.mjs docs/superpowers/plans/2026-07-28-unified-joystick-hint.md
git commit -m "feat: unify joystick hint and movement lifecycle"
```
