# 顾客商品双手承托高度修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将顾客携带的整组木头和玉米统一上移 `0.12` 世界单位，使其稳定显示在捧物动作的双手上。

**Architecture:** 保留 `CustomerAppearanceRandomizer` 已有的左右手 Socket、双手中点和商品包围盒逻辑，只增加一个可序列化的垂直承托偏移。森林与玉米调度器不感知该偏移，继续共用同一顾客外观组件。

**Tech Stack:** Cocos Creator 3.8.6、TypeScript、Cocos `Vec3`、Node.js `node:test`

## Global Constraints

- 商品整体上移量固定为 `0.12` 世界单位。
- 木头、玉米、三套男顾客和两套女顾客共用同一参数。
- 不修改商品方向、堆叠间距、购买、付款、动作和离场逻辑。
- 保留当前工作区中尚未提交的手部 Socket 实现，不覆盖或回退。
- `CustomerAppearanceRandomizer.ts` 是混合脏文件，未经额外确认不得整文件暂存。

---

### Task 1: 为双手承托点增加统一高度偏移

**Files:**
- Create: `tests/customer-hand-carry-height-regression.test.mjs`
- Modify: `assets/_Scripts/CustomerAppearanceRandomizer.ts`

**Interfaces:**
- Consumes: `CustomerAppearanceRandomizer.lateUpdate()` 计算出的左右手中点和商品世界包围盒。
- Produces: 可序列化的 `carryHeightOffset: number`，默认值 `0.12`。

- [ ] **Step 1: 写入失败回归测试**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const randomizerUrl = new URL(
    '../assets/_Scripts/CustomerAppearanceRandomizer.ts',
    import.meta.url,
);

test('customer products sit above the wrist midpoint by the shared support offset', async () => {
    const source = await readFile(randomizerUrl, 'utf8');

    assert.match(source, /@property public carryHeightOffset = 0\.12;/);
    assert.match(
        source,
        /this\._carryPosition\.y \+= this\._handCenter\.y\s*\+ this\.carryHeightOffset\s*- bounds\.minY;/,
    );
    assert.match(source, /Vec3\.lerp\(\s*this\._handCenter,/);
    assert.match(source, /this\._carryCenter\.x/);
    assert.match(source, /this\._carryCenter\.z/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
node --test tests/customer-hand-carry-height-regression.test.mjs
```

Expected: FAIL，提示缺少 `carryHeightOffset`，当前商品底面直接对齐手骨中点。

- [ ] **Step 3: 实现最小高度修复**

在模型缩放和朝向参数后增加：

```ts
@property public carryHeightOffset = 0.12;
```

将 `lateUpdate()` 的垂直位置计算改为：

```ts
this._carryPosition.y += this._handCenter.y
    + this.carryHeightOffset
    - bounds.minY;
```

保持 X/Z 中心对齐、Socket 绑定和包围盒读取逻辑原样。

- [ ] **Step 4: 运行专项与相关测试**

Run:

```powershell
node --test tests/customer-hand-carry-height-regression.test.mjs tests/customer-appearance-randomization-regression.test.mjs tests/corn-customer-purchase-animation-regression.test.mjs
```

Expected: 全部 PASS。

- [ ] **Step 5: 检查差异与 TypeScript**

Run:

```powershell
npx.cmd --yes --package typescript@5.1.6 tsc --noEmit --pretty false --project tsconfig.json
git diff --check
git diff -- assets/_Scripts/CustomerAppearanceRandomizer.ts tests/customer-hand-carry-height-regression.test.mjs
```

Expected: 本轮文件无新增 TypeScript 或空白错误。全项目既有 Cocos 声明错误单独记录。

- [ ] **Step 6: 运行 Cocos 视觉验证**

1. 分别观察男、女顾客的 `idle2_NaHeZi`。
2. 确认整组商品位于双手上方，不再偏低。
3. 观察 `walk_NaHeZi`，确认移动期间高度稳定。
4. 对木头和玉米各验证一次。

- [ ] **Step 7: 保留混合工作区边界**

不要整文件提交 `CustomerAppearanceRandomizer.ts`。先保留实现和测试在工作区；若用户要求提交，必须先审查该文件原有 121 行未提交手部 Socket 改动，并由用户确认是否一并纳入。
