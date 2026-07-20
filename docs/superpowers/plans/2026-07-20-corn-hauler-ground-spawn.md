# 玉米搬运工地面出生修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让左右玉米区搬运工解锁后使用解锁点 X/Z、真实玩家 Y 出生，避免模型位于地下。

**Architecture:** `ResourceFieldSystem` 在激活玉米搬运工前计算独立出生坐标。坐标算法复制森林区可观察行为，但不调用森林 `CoinConsumer` 或 `HaulerNPC`。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Node.js `node:test`。

## Global Constraints

- 不导入或复用森林区 `HaulerNPC`、`CoinConsumer`。
- 不改变搬运工路线、背包容量、运输节奏或出售槽位置。
- 左右玉米区使用同一出生坐标算法。

---

### Task 1: 搬运工地面出生

**Files:**
- Modify: `tests/corn-vehicle-hauler-parity-regression.test.mjs`
- Modify: `assets/_Scripts/ResourceFieldSystem.ts`

**Interfaces:**
- Consumes: `ResourceFieldSystem._player: Node | null`、`padNode.worldPosition`。
- Produces: `getCornHaulerSpawnWorldPosition(padNode: Node): Vec3`，返回解锁点 X/Z 和玩家 Y。

- [ ] **Step 1: 写入失败回归测试**

在搬运工测试中加入：

```js
const spawnMethod = source.match(
    /private spawnHauler[\s\S]*?\n    private clearInheritedHaulerCargo/,
)?.[0] ?? '';
const spawnPositionMethod = source.match(
    /private getCornHaulerSpawnWorldPosition[\s\S]*?\n    private spawnHauler/,
)?.[0] ?? '';

assert.match(spawnMethod, /actor\.setWorldPosition\(this\.getCornHaulerSpawnWorldPosition\(padNode\)\)/);
assert.match(spawnPositionMethod, /const spawnPosition = padNode\.worldPosition\.clone\(\)/);
assert.match(spawnPositionMethod, /spawnPosition\.y = this\._player\.worldPosition\.y/);
assert.match(spawnPositionMethod, /return spawnPosition/);
assert.doesNotMatch(spawnMethod, /actor\.setWorldPosition\(padNode\.worldPosition\)/);
```

- [ ] **Step 2: 运行定向测试并确认失败**

```powershell
node --test tests/corn-vehicle-hauler-parity-regression.test.mjs
```

Expected: FAIL，指出缺少 `getCornHaulerSpawnWorldPosition`。

- [ ] **Step 3: 增加一次性缺失玩家警告状态**

在 `ResourceFieldSystem` 私有状态区域加入：

```ts
private _reportedMissingPlayerForHaulerSpawn = false;
```

- [ ] **Step 4: 实现玉米搬运工出生坐标**

在 `spawnHauler()` 前加入：

```ts
private getCornHaulerSpawnWorldPosition(padNode: Node): Vec3 {
    const spawnPosition = padNode.worldPosition.clone();
    if (this._player?.isValid) {
        spawnPosition.y = this._player.worldPosition.y;
    } else if (!this._reportedMissingPlayerForHaulerSpawn) {
        console.warn('ResourceFieldSystem: player is missing; corn hauler uses unlock-pad height.');
        this._reportedMissingPlayerForHaulerSpawn = true;
    }
    return spawnPosition;
}
```

将：

```ts
actor.setWorldPosition(padNode.worldPosition);
```

替换为：

```ts
actor.setWorldPosition(this.getCornHaulerSpawnWorldPosition(padNode));
```

- [ ] **Step 5: 运行定向测试并确认通过**

```powershell
node --test tests/corn-vehicle-hauler-parity-regression.test.mjs
```

Expected: 全部通过。

- [ ] **Step 6: 提交修复**

```powershell
git add -- assets/_Scripts/ResourceFieldSystem.ts tests/corn-vehicle-hauler-parity-regression.test.mjs
git commit -m "fix: spawn corn haulers at player ground height"
```
