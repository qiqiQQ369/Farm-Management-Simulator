# 移除顾客表情功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除森林区和玉米区顾客的黄色完成表情，同时保留商品需求提示牌和完整购买链路。

**Architecture:** 森林与玉米调度器分别删除顾客 `emoji` 状态机和节点创建逻辑；`CustomerAppearanceRandomizer` 不再把旧 `emoji` 当作需要保留的购买节点。需求提示继续由独立的 `fillTip` 方法管理，车辆表情脚本保持不变。

**Tech Stack:** Cocos Creator 3.8.6、TypeScript、Node.js `node:test`

## Global Constraints

- 仅移除顾客 `emoji`，保留 `fillTip` 商品需求提示。
- 保留顾客购买、付款、携带商品和离场行为。
- 不修改 `VehicleCollector` 的车辆表情。
- 保留当前工作区已有的顾客动画、手部 Socket 和网页 Release 改动。
- 三个目标脚本均为混合脏文件，未经额外确认不得整文件暂存。

---

### Task 1: 删除森林与玉米顾客表情链路

**Files:**
- Create: `tests/customer-emoji-removal-regression.test.mjs`
- Modify: `assets/_Scripts/NPCScheduler.ts`
- Modify: `assets/_Scripts/CornCustomerScheduler.ts`
- Modify: `assets/_Scripts/CustomerAppearanceRandomizer.ts`

**Interfaces:**
- Consumes: 森林和玉米调度器现有 `fillTip` 需求提示接口。
- Produces: 不创建、不查找、不激活顾客 `emoji` 的购买流程。

- [ ] **Step 1: 写入失败回归测试**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const script = (name) => new URL(`../assets/_Scripts/${name}`, import.meta.url);

test('customer schedulers remove emoji while preserving demand tips', async () => {
    const [forest, corn, randomizer, vehicle] = await Promise.all([
        readFile(script('NPCScheduler.ts'), 'utf8'),
        readFile(script('CornCustomerScheduler.ts'), 'utf8'),
        readFile(script('CustomerAppearanceRandomizer.ts'), 'utf8'),
        readFile(script('VehicleCollector.ts'), 'utf8'),
    ]);

    for (const source of [forest, corn]) {
        assert.doesNotMatch(source, /getNpcEmoji|resetEmoji|emoji\.active/);
        assert.match(source, /showFillTipForNpc/);
        assert.match(source, /hideFillTip/);
    }

    assert.doesNotMatch(forest, /checkEmoji|checkEmojiUpdate/);
    assert.doesNotMatch(corn, /completionEmojiFrame|prepareNpcCompletionEmojis|new Node\('emoji'\)/);
    assert.doesNotMatch(randomizer, /child\.name !== 'emoji'/);
    assert.match(randomizer, /child\.name !== 'StoragePoint'/);
    assert.match(vehicle, /emojiPrefab/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
node --test tests/customer-emoji-removal-regression.test.mjs
```

Expected: FAIL，森林和玉米调度器仍包含表情逻辑，随机外观仍保留 `emoji`。

- [ ] **Step 3: 删除森林顾客表情状态**

在 `NPCScheduler.ts` 中：

- 从 `initializeQueue()` 删除 `emoji` 查找、隐藏和 `CameraFacingUI` 绑定。
- 将到达 B 点和捧物移动中的 `this.resetEmoji()` 改为 `this.hideFillTip()`。
- `update(dt)` 只调用 `this.updateFillTipPosition()`。
- 删除 `checkEmojiUpdate`、`resetEmoji`、`checkEmoji`、`checkAllNpc`、`getNpcEmoji`。
- 删除购买完成后的 `emoji.active = true`。
- 删除仅由表情使用的 `checkTimer`、`checkInterval`、`intervalId`、`onPlayerEnter` 和空碰撞注册代码。
- 清理不再使用的 `find`、`Collider`、`ITriggerEvent`、`WoodBackpack` 导入。

保留：

```ts
private showFillTipForNpc(npc: Node): void
private hideFillTip(resetContent: boolean = false): void
private updateFillTipPosition(): void
```

- [ ] **Step 4: 删除玉米顾客表情状态**

在 `CornCustomerScheduler.ts` 中：

- 删除 `completionEmojiFrame` 属性。
- 删除 `prepareNpcCompletionEmojis()` 及 `onEnable()` 调用。
- 从 `initializeQueue()` 删除旧 `emoji` 隐藏和朝向处理。
- 将到达 B 点与捧物移动中的 `resetEmoji()` 改为 `hideFillTip()`。
- 删除购买完成后的 `emoji.active = true`。
- 删除 `resetEmoji()` 和 `getNpcEmoji()`。
- 删除不再使用的 `RenderRoot2D`、`SpriteFrame`、`UITransform` 导入；保留 `Sprite`，因为 `fillTip` 仍使用它。

- [ ] **Step 5: 让模型替换清理遗留表情**

将 `CustomerAppearanceRandomizer.replaceVisual()` 的保留条件从：

```ts
const existingVisuals = npc.children.filter(child =>
    child.name !== 'StoragePoint'
    && child.name !== 'emoji',
);
```

改为：

```ts
const existingVisuals = npc.children.filter(child =>
    child.name !== 'StoragePoint',
);
```

同步更新类注释，说明只保留购买库存节点，不再保留表情。

- [ ] **Step 6: 运行专项和相关回归**

Run:

```powershell
node --test tests/customer-emoji-removal-regression.test.mjs tests/customer-appearance-randomization-regression.test.mjs tests/corn-customer-purchase-animation-regression.test.mjs
node --test tests/*.test.mjs
```

Expected: 顾客表情专项与购买链路测试 PASS；完整测试没有本轮新增失败。

- [ ] **Step 7: 检查 TypeScript 和差异**

Run:

```powershell
npx.cmd --yes --package typescript@5.1.6 tsc --noEmit --pretty false --project tsconfig.json
git diff --check
git diff -- assets/_Scripts/NPCScheduler.ts assets/_Scripts/CornCustomerScheduler.ts assets/_Scripts/CustomerAppearanceRandomizer.ts tests/customer-emoji-removal-regression.test.mjs
```

Expected: 本轮文件无新增 TypeScript 或空白错误；需求提示方法仍存在，`VehicleCollector.ts` 无差异。

- [ ] **Step 8: 保留混合工作区边界**

不要整文件提交三个顾客脚本。先保留实现和测试在工作区；若用户要求提交，必须先审查这些文件原有未提交的动画、手部 Socket 和 Release 改动，并由用户确认是否一并纳入。
