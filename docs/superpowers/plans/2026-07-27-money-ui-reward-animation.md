# 获得金钱时的钱 UI 动效实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 玩家每次获得金钱时，让 `Canvas/CoinLabel` 整体播放一次可连续触发的缩放回弹动效。

**Architecture:** `MoneyUIRewardAnimator` 是钱 UI 的唯一动效入口，负责查找 `Canvas/CoinLabel`、保存原始缩放并播放 Tween。连续触发时不停止当前 Tween，只用一个布尔待播放状态合并高频奖励；森林区和玉米区金币收集器仍负责金额计算，只在成功更新金额后调用动效入口。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Cocos Tween、Node.js `node:test`

## Global Constraints

- 只有金额增加时播放动效，消费金钱时不播放。
- 动效必须覆盖 `CoinLabel` 下的图标、底框和金额数字。
- 连续获得金钱时，当前 Tween 不得被停止或强制复位。
- 高频奖励最多合并为下一次回弹，不得积累无限动画队列。
- 森林区与玉米区必须使用同一个动效入口。
- 不改变现有金额计算、金币搬运或解锁扣款逻辑。
- 网页 Release 不使用 `constructor.name` 判断组件。

---

### Task 1: 钱 UI 统一动效组件

**Files:**
- Create: `assets/_Scripts/MoneyUIRewardAnimator.ts`
- Create: `assets/_Scripts/MoneyUIRewardAnimator.ts.meta`
- Test: `tests/money-ui-reward-animation-regression.test.mjs`

**Interfaces:**
- Consumes: 当前场景中的 `Canvas/CoinLabel` 节点。
- Produces: `MoneyUIRewardAnimator.playForCurrentScene(): void`，供所有加钱入口调用。

- [ ] **Step 1: 写入失败的回归测试**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const animatorUrl = new URL(
    '../assets/_Scripts/MoneyUIRewardAnimator.ts',
    import.meta.url,
);

test('money UI animator owns a restartable whole-node punch animation', async () => {
    const source = await readFile(animatorUrl, 'utf8');

    assert.match(source, /find\('Canvas\/CoinLabel'\)/);
    assert.match(source, /stop\(\)/);
    assert.match(source, /this\._baseScale/);
    assert.match(source, /\.to\(0\.1,/);
    assert.match(source, /\.to\(0\.15,/);
    assert.doesNotMatch(source, /constructor\.name/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
node --test tests/money-ui-reward-animation-regression.test.mjs
```

Expected: FAIL，提示 `MoneyUIRewardAnimator.ts` 不存在。

- [ ] **Step 3: 实现最小动效组件**

```ts
import { _decorator, Component, find, Node, tween, Tween, Vec3 } from 'cc';

const { ccclass } = _decorator;

@ccclass('MoneyUIRewardAnimator')
export class MoneyUIRewardAnimator extends Component {
    private readonly _baseScale = new Vec3();
    private readonly _punchScale = new Vec3();
    private _rewardTween: Tween<Node> | null = null;

    protected onLoad(): void {
        this._baseScale.set(this.node.scale);
    }

    protected onDisable(): void {
        this.stopAndRestore();
    }

    protected onDestroy(): void {
        this.stopAndRestore();
    }

    public static playForCurrentScene(): void {
        const moneyUI = find('Canvas/CoinLabel');
        if (!moneyUI?.isValid) return;

        const animator = moneyUI.getComponent(MoneyUIRewardAnimator)
            ?? moneyUI.addComponent(MoneyUIRewardAnimator);
        animator.play();
    }

    public play(): void {
        if (!this.node.isValid) return;

        this._rewardTween?.stop();
        this.node.setScale(this._baseScale);
        Vec3.multiplyScalar(this._punchScale, this._baseScale, 1.2);

        this._rewardTween = tween(this.node)
            .to(0.1, { scale: this._punchScale }, { easing: 'quadOut' })
            .to(0.15, { scale: this._baseScale }, { easing: 'backOut' })
            .call(() => {
                this._rewardTween = null;
                this.node.setScale(this._baseScale);
            })
            .start();
    }

    private stopAndRestore(): void {
        this._rewardTween?.stop();
        this._rewardTween = null;
        if (this.node.isValid) this.node.setScale(this._baseScale);
    }
}
```

创建与其他 TypeScript 脚本格式一致的 `.meta` 文件，并为新脚本生成唯一 UUID。

- [ ] **Step 4: 运行测试并确认通过**

Run:

```powershell
node --test tests/money-ui-reward-animation-regression.test.mjs
```

Expected: PASS。

- [ ] **Step 5: 提交统一动效组件**

```powershell
git add -- assets/_Scripts/MoneyUIRewardAnimator.ts assets/_Scripts/MoneyUIRewardAnimator.ts.meta tests/money-ui-reward-animation-regression.test.mjs
git commit -m "feat: add money ui reward animation"
```

### Task 2: 接入森林区和玉米区加钱链路

**Files:**
- Modify: `assets/_Scripts/CoinCollector.ts`
- Modify: `assets/_Scripts/CornCoinCollector.ts`
- Modify: `tests/money-ui-reward-animation-regression.test.mjs`

**Interfaces:**
- Consumes: `MoneyUIRewardAnimator.playForCurrentScene(): void`。
- Produces: 森林区和玉米区金额增加后的统一 UI 反馈。

- [ ] **Step 1: 扩展测试，要求两个加钱入口调用统一动效**

```js
const forestCollectorUrl = new URL(
    '../assets/_Scripts/CoinCollector.ts',
    import.meta.url,
);
const cornCollectorUrl = new URL(
    '../assets/_Scripts/CornCoinCollector.ts',
    import.meta.url,
);

test('both money reward paths trigger the shared whole-UI animation', async () => {
    const [forestSource, cornSource] = await Promise.all([
        readFile(forestCollectorUrl, 'utf8'),
        readFile(cornCollectorUrl, 'utf8'),
    ]);

    for (const source of [forestSource, cornSource]) {
        assert.match(
            source,
            /import \{ MoneyUIRewardAnimator \} from '\.\/MoneyUIRewardAnimator';/,
        );
        assert.match(
            source,
            /coinAmountLabel\.string = String\(currentAmount \+ delta\);\s*MoneyUIRewardAnimator\.playForCurrentScene\(\);/,
        );
    }
});
```

- [ ] **Step 2: 运行测试并确认新用例失败**

Run:

```powershell
node --test tests/money-ui-reward-animation-regression.test.mjs
```

Expected: FAIL，提示两个收集器尚未导入或调用 `MoneyUIRewardAnimator`。

- [ ] **Step 3: 在两个金额增加入口接入动效**

在 `CoinCollector.ts` 和 `CornCoinCollector.ts` 中加入：

```ts
import { MoneyUIRewardAnimator } from './MoneyUIRewardAnimator';
```

并将两个文件的 `updateCoinLabel` 尾部统一为：

```ts
const currentAmount = Number.parseInt(coinAmountLabel.string, 10) || 0;
coinAmountLabel.string = String(currentAmount + delta);
MoneyUIRewardAnimator.playForCurrentScene();
```

保持 `CoinConsumer.ts` 和 `CornUnlockPad.ts` 的扣钱逻辑不变，因此扣钱不会触发动效。

- [ ] **Step 4: 运行专项与完整测试**

Run:

```powershell
node --test tests/money-ui-reward-animation-regression.test.mjs
node --test tests/*.test.mjs
```

Expected: 专项测试全部 PASS；完整测试无新增失败。

- [ ] **Step 5: 检查 TypeScript 和差异**

Run:

```powershell
npx.cmd --yes --package typescript@5.1.6 tsc --noEmit --pretty false --project tsconfig.json
git diff --check
git diff -- assets/_Scripts/MoneyUIRewardAnimator.ts assets/_Scripts/CoinCollector.ts assets/_Scripts/CornCoinCollector.ts tests/money-ui-reward-animation-regression.test.mjs
```

Expected: 本轮文件不产生新的 TypeScript 错误；`git diff --check` 无本轮空白错误。若全项目 TypeScript 检查仍报告 Cocos 引擎声明或其他既有文件错误，单独记录，不将其误判为本轮回归。

- [ ] **Step 6: 在 Cocos 中验证表现**

1. 进入森林区金币堆，拾取一笔钱。
2. 确认金额增加，绿色钞票图标、底框和数字整体放大后回弹。
3. 连续拾取多笔钱，确认每笔都有流畅反馈且 UI 最终恢复原尺寸。
4. 在玉米区重复上述验证。
5. 在任一解锁点扣钱，确认不会播放获得金钱动效。

- [ ] **Step 7: 提交接入改动**

```powershell
git add -- assets/_Scripts/CoinCollector.ts assets/_Scripts/CornCoinCollector.ts tests/money-ui-reward-animation-regression.test.mjs
git commit -m "feat: animate money ui on rewards"
```

### Task 3: 平滑连续获得金钱时的回弹节奏

**Files:**
- Modify: `assets/_Scripts/MoneyUIRewardAnimator.ts`
- Modify: `tests/money-ui-reward-animation-regression.test.mjs`

**Interfaces:**
- Consumes: 已有 `MoneyUIRewardAnimator.playForCurrentScene(): void`。
- Produces: 活动 Tween 自然完成、连续奖励按固定节奏合并续播的 `MoneyUIRewardAnimator.play(): void`。

- [ ] **Step 1: 写入连续触发的失败回归测试**

在 `tests/money-ui-reward-animation-regression.test.mjs` 增加：

```js
test('continuous rewards queue one smooth follow-up pulse without hard resets', async () => {
    const source = await readFile(animatorUrl, 'utf8');
    const playMethod = source.match(
        /public play\(\): void \{([\s\S]*?)\n    \}\n\n    private/,
    )?.[1] ?? '';

    assert.match(source, /private _hasPendingReward = false;/);
    assert.match(
        playMethod,
        /if \(this\._rewardTween\) \{\s*this\._hasPendingReward = true;\s*return;\s*\}/,
    );
    assert.doesNotMatch(playMethod, /this\._rewardTween\?\.stop\(\)/);
    assert.doesNotMatch(playMethod, /this\.node\.setScale\(this\._baseScale\)/);
    assert.match(source, /Vec3\.multiplyScalar\(this\._punchScale, this\._baseScale, 1\.12\)/);
    assert.match(
        source,
        /if \(!this\._hasPendingReward\) return;\s*this\._hasPendingReward = false;\s*this\.playPulse\(\);/,
    );
    assert.doesNotMatch(source, /_pendingRewards\s*:\s*[\w<>[\]]+\[\]/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
node --test tests/money-ui-reward-animation-regression.test.mjs
```

Expected: FAIL，提示缺少 `_hasPendingReward`，且 `play()` 仍停止并强制复位当前动画。

- [ ] **Step 3: 将立即重启动画改为合并续播**

将 `MoneyUIRewardAnimator` 的状态和播放方法调整为：

```ts
private _rewardTween: Tween<Node> | null = null;
private _hasPendingReward = false;

public play(): void {
    if (!this.node.isValid) return;

    if (this._rewardTween) {
        this._hasPendingReward = true;
        return;
    }

    this.playPulse();
}

private playPulse(): void {
    if (!this.node.isValid) {
        this._hasPendingReward = false;
        return;
    }

    this.node.setScale(this._baseScale);
    Vec3.multiplyScalar(this._punchScale, this._baseScale, 1.12);

    this._rewardTween = tween(this.node)
        .to(0.1, { scale: this._punchScale }, { easing: 'quadOut' })
        .to(0.15, { scale: this._baseScale }, { easing: 'backOut' })
        .call(() => {
            this._rewardTween = null;
            this.node.setScale(this._baseScale);
            if (!this._hasPendingReward) return;

            this._hasPendingReward = false;
            this.playPulse();
        })
        .start();
}

private stopAndRestore(): void {
    this._rewardTween?.stop();
    this._rewardTween = null;
    this._hasPendingReward = false;
    if (this.node.isValid) this.node.setScale(this._baseScale);
}
```

- [ ] **Step 4: 运行诊断循环和专项测试**

Run:

```powershell
node --test tests/money-ui-reward-animation-regression.test.mjs
```

Expected: 所有钱 UI 动效测试 PASS；连续触发测试证明活动动画不再被硬复位。

- [ ] **Step 5: 运行完整回归与差异检查**

Run:

```powershell
node --test tests/*.test.mjs
npx.cmd --yes --package typescript@5.1.6 tsc --noEmit --pretty false --project tsconfig.json
git diff --check
```

Expected: 新增和相关测试通过；本轮文件不产生新的 TypeScript 错误。若全项目仍有 Cocos 引擎声明、冻结哈希或其他既有工作区错误，单独记录。

- [ ] **Step 6: 在 Cocos 中验证连续获得金钱**

1. 站在森林区金币堆上连续拾取多张钞票。
2. 确认钱 UI 以稳定节奏反复回弹，中间没有突然缩回原尺寸。
3. 离开金币堆，确认最后一次回弹自然完成并恢复原尺寸。
4. 在玉米区重复验证，确认节奏完全一致。

- [ ] **Step 7: 提交平滑动效修复**

```powershell
git add -- assets/_Scripts/MoneyUIRewardAnimator.ts tests/money-ui-reward-animation-regression.test.mjs
git commit -m "fix: smooth continuous money ui rewards"
```
