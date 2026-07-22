# Web Release Component Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Web Release 构建中第二关动态对象被错误禁用的问题。

**Architecture:** 保持现有动态创建和禁用旧组件的流程，用稳定的 Cocos `instanceof` 类型判断替换压缩不安全的 `constructor.name` 字符串判断。四个入口采用同一组保留规则，不修改第一关脚本。

**Tech Stack:** Cocos Creator 3.8.6、TypeScript、Node.js `node:test`、Web Mobile Release 构建。

## Global Constraints

- 不修改森林区第一关逻辑。
- 不依赖 JavaScript 构造函数名称。
- 必须覆盖员工、拖拉机、搬运工、玉米掉落、玩家玉米背包和搬运工玉米背包。
- Web 构建保持 `debug: false`。

---

### Task 1: 锁定发布压缩回归

**Files:**
- Create: `tests/web-release-component-filter-regression.test.mjs`
- Inspect: `assets/_Scripts/ResourceFieldSystem.ts`
- Inspect: `assets/_Scripts/CornFieldProduction.ts`
- Inspect: `assets/_Scripts/CornHaulerBackpack.ts`
- Inspect: `assets/_Scripts/MultiResourceBackpack.ts`

**Interfaces:**
- Consumes: 四个动态对象组件筛选入口。
- Produces: 发布版不再依赖构造函数名称的回归约束。

- [ ] **Step 1: Write the failing test**

```js
for (const source of filterSources) {
    assert.doesNotMatch(source, /constructor\.name/);
    assert.match(source, /instanceof/);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web-release-component-filter-regression.test.mjs`

Expected: FAIL，因为四个文件仍使用 `constructor.name`。

### Task 2: 替换四处类型判断

**Files:**
- Modify: `assets/_Scripts/ResourceFieldSystem.ts:1-20,1067-1077`
- Modify: `assets/_Scripts/CornFieldProduction.ts:1-12,382-391`
- Modify: `assets/_Scripts/CornHaulerBackpack.ts:1,119-128`
- Modify: `assets/_Scripts/MultiResourceBackpack.ts:1,255-268`

**Interfaces:**
- Consumes: Cocos `Animation`、`Renderer`、`AudioSource` 和项目 `ChopAction`；两个基类覆盖所有骨骼动画和网格渲染子类。
- Produces: 不受 Web 压缩影响的组件保留结果。

- [ ] **Step 1: Implement stable checks**

```ts
const keepEnabled = component instanceof Animation
    || component instanceof Renderer;
```

- [ ] **Step 2: Preserve harvest components where required**

```ts
const keepHarvestComponent = preserveChopAction
    && (component instanceof ChopAction || component instanceof AudioSource);
```

- [ ] **Step 3: Run focused test**

Run: `node --test tests/web-release-component-filter-regression.test.mjs`

Expected: PASS。

### Task 3: 全链路验证

**Files:**
- Verify: `tests/*.test.mjs`
- Verify: `build/web-mobile`

**Interfaces:**
- Consumes: 修复后的四个动态筛选入口。
- Produces: 可运行的 Web Mobile Release 构建。

- [ ] **Step 1: Run all regression tests**

Run: `node --test tests/*.test.mjs`

Expected: 全部通过。

- [ ] **Step 2: Run TypeScript validation**

Run: `npx.cmd --yes --package typescript@5.1.6 tsc --noEmit --pretty false --project tsconfig.json`

Expected: 本轮四个文件无新增错误；允许记录 Cocos 3.8.6 引擎声明的既有错误。

- [ ] **Step 3: Build Web Mobile Release**

使用 Cocos Creator 3.8.6 重新构建 `web-mobile`，保持 `debug: false`。

- [ ] **Step 4: Verify release output**

确认构建成功、浏览器无 `ResourceFieldSystem` 初始化错误，并确认构建代码不包含四处 `constructor.name` 筛选。
