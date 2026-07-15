# Missing Assets Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace obsolete Prefab UUID references with local project resources and prevent missing UI descendants from aborting startup.

**Architecture:** Repair Prefab references in place and add a guard to `UIBase.SetText`; do not change gameplay flows.

**Tech Stack:** Cocos Creator 3.8.7, serialized Prefabs, TypeScript, Git.

## Global Constraints

- Use only resources already in `assets`.
- Do not change camera, map, player, or UI layout logic.

### Task 1: Repair obsolete Prefab references

**Files:**
- Modify: `assets/_Assets/Effects/Prefabs/money.prefab`
- Modify: `assets/_Assets/Effects/Prefabs/logo-001.prefab`
- Modify: `assets/_Assets/Effects/Prefabs/winShow.prefab`
- Modify: `assets/_Assets/Prefab/vehicle-001.prefab`
- Modify: `assets/_Assets/Prefab/moneyMod.prefab`
- Modify: `assets/_Assets/Prefab/chaopiao.prefab`
- Modify: `assets/_Assets/Prefab/箭头.prefab`

- [ ] **Step 1: Verify the current failure**

Run `rg -n '81976d5a|51de6edb|342df24b|fb25e06e|07800329|36310374|87395e1b|4ee61a5b@218c0' assets/_Assets/Effects/Prefabs assets/_Assets/Prefab`.

Expected: old UUID references are found.

- [ ] **Step 2: Apply local UUID replacements**

Set the two money sprite frames to `4faffee0-6cb1-4927-b180-357da51d64f2@f9941`. Set missing logo splash frames to `a1e5fb1d-1659-43c6-8873-d06a7fc39a8e@f9941`, button frames to `409d313a-7dcf-4c59-80aa-cefeb593a60f@f9941`, and winShow finger to `645f0610-f9bc-4313-8d5a-ab67a8eac5c6@f9941`. Set `vehicle-001` coinPrefab to `90a9b3b2-5370-4819-8a5c-b980f4c5315a`.

Replace broken money mesh and material references in moneyMod and chaopiao with `dcb65033-a8fe-4f50-9a5f-5b2c4fed0b9d@46540` and `dcb65033-a8fe-4f50-9a5f-5b2c4fed0b9d@7c855`. Replace the arrow material with `5d55b2d0-61fd-4725-b94b-be8e6accf58f@9d093`.

- [ ] **Step 3: Run static validation**

Run `git diff --check` and rerun the Step 1 search.

Expected: no old UUID reference remains in the named Prefabs.

### Task 2: Guard missing UI descendants

**Files:**
- Modify: `assets/_Scripts/UIBase.ts:245-252`

- [ ] **Step 1: Replace SetText implementation**

```ts
static SetText(node: Node | null, str: string, childpath: string | null = null): void {
    const target = childpath == null ? node : node?.getChildByPath(childpath);
    const label = target?.getComponent(Label);
    if (!label) {
        console.warn(`UIBase.SetText: missing Label at ${childpath ?? 'node'}`);
        return;
    }
    label.string = str;
}
```

- [ ] **Step 2: Validate and publish**

Run `rg -n 'missing Label at|label\.string = str' assets/_Scripts/UIBase.ts`, `git diff --check`, then preview DevScene in Cocos Creator. The console must not contain 404 asset requests, missing-asset messages, or `getChildByPath` TypeError.

Commit with `git add assets/_Assets/Effects/Prefabs assets/_Assets/Prefab assets/_Scripts/UIBase.ts` followed by `git commit -m "Repair missing Cocos asset references"` and `git push`.
