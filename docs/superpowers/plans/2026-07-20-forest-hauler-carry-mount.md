# 森林搬运工木头挂点对齐实施计划

> 面向执行代理：按任务逐项执行；每项使用复选框记录。

**目标：** 让森林区搬运工的随身木头相对位置、旋转、缩放和堆叠方式与主角一致，同时让搬运工仓储、主角背包和资源转移模块保持独立。

**架构：** CoinConsumer 在创建或复用 HaulerNPC 时，只读取主角 WoodBackpack.backpackMount 的局部变换和 StoragePoint 堆叠布局。它把这些值复制到搬运工自己的挂点与私有 carryStorage；HaulerNPC 继续使用这个私有仓储完成装载和卸货，不修改 WoodBackpack 或 HaulerNPC 的状态机。

**技术栈：** Cocos Creator 3.8.7、TypeScript、Cocos Node/Vec3、Node 内置测试运行器。

## 全局约束

- 只处理森林区由 CoinConsumer 创建或复用的搬运工。
- 主角背包挂点和主角 StoragePoint 只读，绝不作为搬运工的资源父节点或 carryStorage。
- 搬运工始终使用自己的 StoragePoint 和自己的 stackAreaNode。
- 不修改 assets/_Scripts/WoodBackpack.ts，也不修改 assets/_Scripts/HaulerNPC.ts 的转移状态机。
- 保留当前工作区的其他未提交改动；提交时只包含本任务文件。

---

### 任务 1：建立搬运工私有挂点回归信号

**文件：**

- 新建：tests/hauler-carry-mount-regression.test.mjs
- 读取：assets/_Scripts/CoinConsumer.ts
- 读取：assets/_Scripts/WoodBackpack.ts
- 读取：assets/_Scripts/HaulerNPC.ts

**接口：**

- 输入：CoinConsumer.ensureHaulerCarryStorage(hauler: Node)。
- 输出：对私有搬运工挂点、主角只读模板以及转移模块隔离的回归约束。

- [ ] **步骤 1：写入失败的挂点独立性测试**

~~~js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/CoinConsumer.ts', import.meta.url),
    'utf8',
);
const backpackSource = readFileSync(
    new URL('../assets/_Scripts/WoodBackpack.ts', import.meta.url),
    'utf8',
);
const haulerSource = readFileSync(
    new URL('../assets/_Scripts/HaulerNPC.ts', import.meta.url),
    'utf8',
);

test('forest hauler copies the player mount transform into a private carry storage', () => {
    const method = source.match(
        /private ensureHaulerCarryStorage[\s\S]*?\n    private copyStoragePointLayout/,
    )?.[0] ?? '';

    assert.match(method, /const playerMount = .*WoodBackpack.*backpackMount/);
    assert.match(method, /this\.copyCarryMountTransform\(.*playerMount/);
    assert.match(method, /stackAreaNode = .*\.node/);
    assert.doesNotMatch(method, /stackAreaNode = playerMount/);
    assert.doesNotMatch(method, /return playerStorage/);
    assert.match(source, /private copyCarryMountTransform\(target: Node, source: Node \| null\): void/);
    assert.match(source, /target\.setPosition\(source\.position\)/);
    assert.match(source, /target\.setRotation\(source\.rotation\)/);
    assert.match(source, /target\.setScale\(source\.scale\)/);
    assert.match(backpackSource, /public backpackMount: Node/);
    assert.match(haulerSource, /public carryStorage: StoragePoint/);
});
~~~

- [ ] **步骤 2：运行测试确认当前实现未复制空间变换**

运行：node --test tests/hauler-carry-mount-regression.test.mjs

预期：失败，提示缺少 copyCarryMountTransform 或没有从主角挂点同步局部位置、旋转、缩放。

### 任务 2：同步搬运工私有挂点并保持资源隔离

**文件：**

- 修改：assets/_Scripts/CoinConsumer.ts
- 修改：tests/hauler-carry-mount-regression.test.mjs
- 验证：tests/hauler-background-recovery.test.mjs

**接口：**

- 输入：主角 WoodBackpack.backpackMount 与搬运工私有 StoragePoint。
- 输出：copyCarryMountTransform(target: Node, source: Node | null): void；ensureHaulerCarryStorage 返回搬运工私有 StoragePoint。

- [ ] **步骤 1：提取只读主角视觉模板**

在 ensureHaulerCarryStorage 开头读取主角挂点与布局存储：

~~~ts
const playerMount = this.findSceneNodeByName('Player')
    ?.getComponent(WoodBackpack)
    ?.backpackMount ?? null;
const playerStorage = playerMount?.getComponent(StoragePoint) ?? null;
~~~

该变量只作为复制源；后续不对它调用 addResource、removeResource 或 clearStorage，也不赋值给 HaulerNPC.carryStorage。

- [ ] **步骤 2：新增私有挂点变换复制方法**

在 CoinConsumer 中新增：

~~~ts
private copyCarryMountTransform(target: Node, source: Node | null): void {
    if (!source) return;
    target.setPosition(source.position);
    target.setRotation(source.rotation);
    target.setScale(source.scale);
}
~~~

使用局部变换，使主角与搬运工各自在自己的角色坐标系中拥有相同的背部偏移。

- [ ] **步骤 3：为已有搬运工背包挂点复制视觉变换**

在 backpackStorage 分支中，先同步搬运工自身挂点，再复制堆叠布局：

~~~ts
const haulerMount = hauler.getComponent(WoodBackpack)?.backpackMount ?? null;
if (backpackStorage) {
    this.copyCarryMountTransform(haulerMount ?? backpackStorage.node, playerMount);
    this.copyStoragePointLayout(backpackStorage, playerStorage);
    backpackStorage.stackAreaNode = backpackStorage.node;
    backpackStorage.storageName = '搬运工木材存储';
    backpackStorage.clearStorage();
    return backpackStorage;
}
~~~

- [ ] **步骤 4：为备用挂点复制视觉变换**

在已有 HaulerCarryStorage 分支中执行：

~~~ts
this.copyCarryMountTransform(existingCarryNode, playerMount);
this.copyStoragePointLayout(existingCarryStorage, playerStorage);
existingCarryStorage.stackAreaNode = existingCarryStorage.node;
existingCarryStorage.storageName = '搬运工木材存储';
existingCarryStorage.clearStorage();
return existingCarryStorage;
~~~

创建备用挂点时保留默认值作为无模板回退，再覆盖为主角的局部变换：

~~~ts
const carryNode = new Node('HaulerCarryStorage');
carryNode.setParent(hauler);
carryNode.setPosition(0, 1.2, -0.6);
this.copyCarryMountTransform(carryNode, playerMount);

const storage = carryNode.addComponent(StoragePoint);
this.copyStoragePointLayout(storage, playerStorage);
storage.stackAreaNode = storage.node;
storage.storageName = '搬运工木材存储';
storage.clearStorage();
return storage;
~~~

- [ ] **步骤 5：运行专项测试与既有恢复测试**

运行：

~~~powershell
node --test tests/hauler-carry-mount-regression.test.mjs tests/hauler-background-recovery.test.mjs
~~~

预期：两项通过；新测试证明主角只作为只读视觉模板，既有测试证明应用切回后搬运工仍能恢复工作。

- [ ] **步骤 6：全量验证与提交**

运行：

~~~powershell
git diff --check
node --test tests/*.test.mjs
git status --short
~~~

预期：没有空白错误，完整测试零失败，暂存范围只包含 CoinConsumer.ts 与 hauler-carry-mount-regression.test.mjs。

提交：

~~~powershell
git add assets/_Scripts/CoinConsumer.ts tests/hauler-carry-mount-regression.test.mjs
git commit -m "fix: align forest hauler carry mount"
~~~
