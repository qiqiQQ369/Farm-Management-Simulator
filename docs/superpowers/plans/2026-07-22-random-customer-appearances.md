# 顾客五种外观随机替换实施计划

> **供自动化执行代理使用：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项执行本计划。所有步骤均使用复选框（`- [ ]`）跟踪状态。

**目标：** 将森林区和两个玉米区的全部顾客模型替换为五种随机排序的外观，包括三套男顾客贴图和两套女顾客贴图，资源均来自 `assets/美术资源`。

**架构：** 在每个现有顾客调度器节点上添加一个职责独立的 `CustomerAppearanceRandomizer` 组件。该组件负责引用男女两个 FBX 预制体、管理五套贴图、洗牌袋随机、替换角色模型、隔离材质、检查动画及对齐商品挂点；现有 `NPCScheduler` 和 `CornCustomerScheduler` 仍只负责排队、购买、携带商品和生成金币。

**技术栈：** Cocos Creator 3.8.x、TypeScript、Cocos `Prefab`/`Texture2D`/`Material`/`SkinnedMeshRenderer`/`SkeletalAnimation`、Node.js `node:test`、序列化 `.scene` 场景及 FBX `.meta` 资源配置。

## 全局约束

- 功能必须覆盖三个顾客队伍：森林区、左侧玉米区和右侧玉米区。
- 只使用以下五种外观：`T_NAN`、`T_NAN02`、`T_NAN03`、`T_NV_A`、`T_NV02_A`。
- 使用“洗牌袋”随机方式：每完整的五名顾客必须分别使用五种外观，五种外观在队伍中的顺序随机。
- 不得改变现有移动、购买、商品携带、完成表情、存储和金币生成逻辑。
- 每名顾客必须使用独立的材质实例，防止修改一名顾客贴图时连带改变其他顾客。
- 使用 FBX 中的 `back` 标记对齐现有商品存储节点，但不能将商品存储节点移入动画骨骼层级。
- 不得将 `.creator/asset-template/typescript/Custom Script Template Help Documentation.url` 加入版本控制。

---

### 任务一：锁定五种外观的洗牌袋随机规则

**文件：**

- 新建：`tests/customer-appearance-randomization-regression.test.mjs`
- 新建：`assets/_Scripts/CustomerAppearanceRandomizer.ts`
- 新建：`assets/_Scripts/CustomerAppearanceRandomizer.ts.meta`

**接口：**

- 输出：`export const CUSTOMER_APPEARANCE_COUNT = 5`。
- 输出：`export function buildCustomerAppearanceOrder(customerCount: number, random?: () => number): number[]`。
- 输入：返回 `[0, 1)` 数值的随机函数；游戏运行时默认使用 `Math.random`。

- [ ] **步骤 1：先编写失败的洗牌袋回归测试**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CUSTOMER_APPEARANCE_COUNT,
    buildCustomerAppearanceOrder,
} from '../assets/_Scripts/CustomerAppearanceRandomizer.ts';

test('顾客队伍以随机顺序覆盖全部五种外观', () => {
    const values = [0.82, 0.14, 0.63, 0.31, 0.48, 0.05, 0.71, 0.26];
    let cursor = 0;
    const order = buildCustomerAppearanceOrder(11, () => values[cursor++ % values.length]);

    assert.equal(CUSTOMER_APPEARANCE_COUNT, 5);
    assert.equal(order.length, 11);
    assert.deepEqual([...order.slice(0, 5)].sort(), [0, 1, 2, 3, 4]);
    assert.deepEqual([...order.slice(5, 10)].sort(), [0, 1, 2, 3, 4]);
    assert.ok(order.every(index => index >= 0 && index < 5));
});
```

- [ ] **步骤 2：运行定向测试，确认它因为模块尚不存在而失败**

运行：

```powershell
node --test tests/customer-appearance-randomization-regression.test.mjs
```

预期结果：测试失败，并针对 `CustomerAppearanceRandomizer.ts` 报告 `ERR_MODULE_NOT_FOUND`。

- [ ] **步骤 3：实现纯函数形式的洗牌袋选择器**

```ts
export const CUSTOMER_APPEARANCE_COUNT = 5;

export function buildCustomerAppearanceOrder(
    customerCount: number,
    random: () => number = Math.random,
): number[] {
    const result: number[] = [];
    while (result.length < Math.max(0, customerCount)) {
        const bag = Array.from({ length: CUSTOMER_APPEARANCE_COUNT }, (_, index) => index);
        for (let index = bag.length - 1; index > 0; index--) {
            const randomIndex = Math.min(index, Math.floor(Math.max(0, random()) * (index + 1)));
            [bag[index], bag[randomIndex]] = [bag[randomIndex], bag[index]];
        }
        result.push(...bag);
    }
    return result.slice(0, Math.max(0, customerCount));
}
```

- [ ] **步骤 4：添加标准 Cocos TypeScript 元数据文件**

新建 `assets/_Scripts/CustomerAppearanceRandomizer.ts.meta`，配置如下：

- 导入器：`typescript`
- 版本：`4.0.24`
- UUID：生成一个新的、固定不变的 UUID
- `files`：空数组
- `subMetas`：空对象
- `userData`：空对象

- [ ] **步骤 5：再次运行定向测试并确认通过**

运行：

```powershell
node --test tests/customer-appearance-randomization-regression.test.mjs
```

预期结果：1 项测试通过，0 项失败。

---

### 任务二：只替换顾客模型，保留全部游戏功能节点

**文件：**

- 修改：`assets/_Scripts/CustomerAppearanceRandomizer.ts`
- 修改：`tests/customer-appearance-randomization-regression.test.mjs`

**接口：**

- 输出：`@ccclass('CustomerAppearanceRandomizer') export class CustomerAppearanceRandomizer extends Component`。
- 序列化输入：`malePrefab`、`femalePrefab`、`maleTextures`、`femaleTextures`、`customerModelScale`、`customerModelYaw`、`carryAnchorName`。
- 输入：同一节点上的 `NPCScheduler` 或 `CornCustomerScheduler` 组件提供的 `npcs` 数组。

- [ ] **步骤 1：添加模型安全替换的失败测试**

```js
const randomizerSource = readFileSync(
    new URL('../assets/_Scripts/CustomerAppearanceRandomizer.ts', import.meta.url),
    'utf8',
);

test('替换顾客外观时保留功能节点并隔离材质', () => {
    assert.match(randomizerSource, /getComponent\(NPCScheduler\)/);
    assert.match(randomizerSource, /getComponent\(CornCustomerScheduler\)/);
    assert.match(randomizerSource, /child\.getComponentInChildren\(SkeletalAnimation\)/);
    assert.match(randomizerSource, /existingVisual\.destroy\(\)/);
    assert.match(randomizerSource, /instantiate\(variant\.prefab\)/);
    assert.match(randomizerSource, /new Material\(\)/);
    assert.match(randomizerSource, /material\.copy\(sourceMaterial\)/);
    assert.match(randomizerSource, /material\.setProperty\('mainTexture', variant\.texture\)/);
    assert.match(randomizerSource, /renderer\.setMaterial\(material, materialIndex\)/);
    assert.match(randomizerSource, /findDescendant\(model, this\.carryAnchorName\)/);
    assert.match(randomizerSource, /npc\.inverseTransformPoint\(carryPosition, anchor\.worldPosition\)/);
    assert.doesNotMatch(randomizerSource, /storageNode\.setParent\(anchor\)/);
});
```

- [ ] **步骤 2：运行定向测试，确认新增断言失败**

运行：

```powershell
node --test tests/customer-appearance-randomization-regression.test.mjs
```

预期结果：由于组件和替换方法尚未实现，测试失败。

- [ ] **步骤 3：添加序列化资源属性并构建五个固定外观**

```ts
@property({ type: Prefab }) public malePrefab: Prefab = null!;
@property({ type: Prefab }) public femalePrefab: Prefab = null!;
@property({ type: [Texture2D] }) public maleTextures: Texture2D[] = [];
@property({ type: [Texture2D] }) public femaleTextures: Texture2D[] = [];
@property public customerModelScale = 1;
@property public customerModelYaw = 0;
@property public carryAnchorName = 'back';

private buildVariants(): CustomerAppearanceVariant[] {
    return [
        ...this.maleTextures.slice(0, 3).map(texture => ({ prefab: this.malePrefab, texture })),
        ...this.femaleTextures.slice(0, 2).map(texture => ({ prefab: this.femalePrefab, texture })),
    ];
}
```

- [ ] **步骤 4：在调度器初始化队伍之前完成随机替换**

在组件上使用 `@executionOrder(-100)`。在 `onEnable` 中读取 `NPCScheduler.npcs` 或 `CornCustomerScheduler.npcs`，验证外观列表必须恰好包含五项，然后生成洗牌顺序并替换每名顾客的模型。

旧模型必须通过其后代节点是否存在 `SkeletalAnimation` 来识别，不能依赖子节点下标，从而确保 `StoragePoint`、`emoji`、碰撞体及其他游戏功能节点不会被删除。

```ts
protected onEnable(): void {
    const customers = this.node.getComponent(NPCScheduler)?.npcs
        ?? this.node.getComponent(CornCustomerScheduler)?.npcs
        ?? [];
    const variants = this.buildVariants();
    if (variants.length !== CUSTOMER_APPEARANCE_COUNT || variants.some(variant => !variant.prefab || !variant.texture)) {
        console.error('CustomerAppearanceRandomizer: exactly five configured appearances are required.');
        return;
    }
    const order = buildCustomerAppearanceOrder(customers.length);
    customers.forEach((customer, index) => this.replaceVisual(customer, variants[order[index]]));
}
```

- [ ] **步骤 5：实例化选中的 FBX 并为每名顾客创建独立材质**

具体处理顺序：

1. 将选中的预制体实例化到 NPC 根节点下。
2. 将模型本地位置设置为 `(0, 0, 0)`。
3. 应用 `customerModelYaw` 和统一的 `customerModelScale`。
4. 为模型的每个渲染器复制独立材质。
5. 将选中的贴图写入新材质的 `mainTexture`。
6. 将新材质设置回对应渲染器槽位。
7. 最后只销毁旧模型节点。

检查新模型的 `SkeletalAnimation` 是否包含 `idle`、`walk`、`idle2_NaHeZi`、`walk_NaHeZi` 四个动画。如果缺少动画，只输出一次清晰的错误信息。

- [ ] **步骤 6：使用 FBX 的 `back` 标记对齐现有商品存储节点**

销毁旧模型前先找到现有顾客商品存储节点。实例化新模型后递归查找其 `back` 标记，将该标记的世界坐标转换为 NPC 根节点的本地坐标，然后只更新商品存储节点的本地位置。

商品存储节点仍必须保留在 NPC 游戏功能根节点下，不能成为动画骨骼的子节点。这样既能保持现有木头、玉米存储组件和堆叠旋转，又能把商品移动到新角色背部。

- [ ] **步骤 7：运行定向测试并确认通过**

运行：

```powershell
node --test tests/customer-appearance-randomization-regression.test.mjs
```

预期结果：全部顾客外观测试通过。

---

### 任务三：将男女两个 FBX 的动画切分为调度器使用的四段动画

**文件：**

- 修改：`assets/美术资源/男顾客/Fbx/SM_NAN.fbx.meta`
- 修改：`assets/美术资源/女顾客/Fbx/SM_NV.FBX.meta`
- 修改：`tests/customer-appearance-randomization-regression.test.mjs`

**接口：**

- 为两个 FBX 预制体分别输出 `idle`、`walk`、`idle2_NaHeZi`、`walk_NaHeZi` 四段动画。
- 继续使用现有顾客调度器中已配置的动画名称，不修改调度器的动画字段。

- [ ] **步骤 1：添加两个 FBX 动画切分表的失败测试**

```js
for (const path of [
    '../assets/美术资源/男顾客/Fbx/SM_NAN.fbx.meta',
    '../assets/美术资源/女顾客/Fbx/SM_NV.FBX.meta',
]) {
    const meta = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
    const splits = meta.userData.animationImportSettings[0].splits;
    assert.deepEqual(splits.map(({ name, from, to }) => ({ name, from, to })), [
        { name: 'idle', from: 0, to: 50 / 30 },
        { name: 'walk', from: 60 / 30, to: 95 / 30 },
        { name: 'idle2_NaHeZi', from: 105 / 30, to: 155 / 30 },
        { name: 'walk_NaHeZi', from: 165 / 30, to: 200 / 30 },
    ]);
}
```

- [ ] **步骤 2：运行定向测试，确认它在当前单个 `Take 001` 动画上失败**

运行：

```powershell
node --test tests/customer-appearance-randomization-regression.test.mjs
```

预期结果：测试显示当前只有一个 `Take 001` 动画，而不是四个具名动画。

- [ ] **步骤 3：替换两个 FBX 的动画切分表**

源动画为 30 FPS，按资源附带的帧数说明设置以下秒数范围：

```json
[
  { "name": "idle", "from": 0, "to": 1.6666666666666667, "wrapMode": 2 },
  { "name": "walk", "from": 2, "to": 3.1666666666666665, "wrapMode": 2 },
  { "name": "idle2_NaHeZi", "from": 3.5, "to": 5.166666666666667, "wrapMode": 2 },
  { "name": "walk_NaHeZi", "from": 5.5, "to": 6.666666666666667, "wrapMode": 2 }
]
```

仅第一段动画保留现有 `previousId`，以便 Cocos 保存原动画子资源的身份；其余三段由 Cocos 在重新导入时生成新的子资源身份。

- [ ] **步骤 4：再次运行定向测试并确认通过**

运行：

```powershell
node --test tests/customer-appearance-randomization-regression.test.mjs
```

预期结果：两个 FBX 文件都包含四段正确命名及正确范围的动画。

---

### 任务四：将随机外观组件绑定到三个顾客队伍

**文件：**

- 修改：`assets/Scenes/DevScene.scene`
- 修改：`tests/customer-appearance-randomization-regression.test.mjs`

**接口：**

- 输入：任务一至任务三完成的 `CustomerAppearanceRandomizer` 及其序列化资源属性。
- 输出：两个 `NPCScheduler-001` 玉米顾客节点和一个森林 `NPCScheduler` 节点各有一个配置完整的随机外观组件。

- [ ] **步骤 1：添加场景资源绑定的失败测试**

解析 `DevScene.scene`，找到节点名称为 `NPCScheduler` 或 `NPCScheduler-001` 的全部随机外观组件，并进行以下断言：

```js
assert.equal(randomizers.length, 3);
for (const randomizer of randomizers) {
    assert.equal(randomizer.malePrefab.__uuid__, '5e1288d1-37ad-47aa-b898-4b5358220379@2c774');
    assert.equal(randomizer.femalePrefab.__uuid__, '0a8b911d-2afe-42eb-adca-42e568f379bc@6c894');
    assert.deepEqual(randomizer.maleTextures.map(item => item.__uuid__), [
        'a778d5af-a4b8-41b7-9419-b311a0c4b0cd@6c48a',
        'b8750b64-87f8-494e-a29c-7077a3bfcdc3@6c48a',
        'a7ddaec7-81ce-4ddc-b3f2-10f1ab18690d@6c48a',
    ]);
    assert.deepEqual(randomizer.femaleTextures.map(item => item.__uuid__), [
        '1b01485b-d74d-420e-bedb-9f0babcb2f0c@6c48a',
        '09e16d3e-ab37-4b40-aff0-5085129b86df@6c48a',
    ]);
    assert.equal(randomizer.carryAnchorName, 'back');
}
```

- [ ] **步骤 2：运行定向测试，确认当前场景尚未绑定组件**

运行：

```powershell
node --test tests/customer-appearance-randomization-regression.test.mjs
```

预期结果：测试失败并显示组件数量为 0，而不是 3。

- [ ] **步骤 3：添加并配置三个场景组件**

在 `DevScene.scene` 末尾添加三个 `CustomerAppearanceRandomizer` 组件记录，并把对应组件引用分别加入三个顾客调度器节点。

每个组件都必须按照测试中的 UUID 绑定：

- 男顾客 FBX 预制体
- 女顾客 FBX 预制体
- 三张男顾客贴图
- 两张女顾客贴图

根据导入模型与现有 NPC 根节点的实际尺寸设置三个组件相同的 `customerModelScale` 和 `customerModelYaw`，并将 `carryAnchorName` 设置为 `back`。

- [ ] **步骤 4：验证场景结构和定向测试**

运行：

```powershell
Get-Content -Raw assets/Scenes/DevScene.scene | ConvertFrom-Json | Out-Null
node --test tests/customer-appearance-randomization-regression.test.mjs
```

预期结果：场景 JSON 有效，全部定向测试通过。

---

### 任务五：运行时及完整回归验证

**文件：**

- 仅在运行时校准确有必要时修改：`assets/Scenes/DevScene.scene`
- 测试：`tests/customer-appearance-randomization-regression.test.mjs`

**接口：**

- 输入：任务一至任务四完成的顾客随机外观系统。
- 输出：男女顾客模型和贴图显示正确，同时森林区与玉米区的购买功能保持正常。

- [ ] **步骤 1：在 Cocos Creator 3.8.x 中重新导入两个 FBX**

打开项目并等待资源数据库根据修改后的 FBX 元数据完成重新导入。检查男女两个模型预制体的 `SkeletalAnimation` 组件，确认都包含以下四段动画：

- `idle`
- `walk`
- `idle2_NaHeZi`
- `walk_NaHeZi`

- [ ] **步骤 2：运行场景并检查三个顾客队伍**

逐项确认：

- 三个队伍均随机显示男女顾客。
- 每个完整的五人队伍分别包含五套贴图，顺序随机。
- 顾客朝向与移动方向一致。
- 待机、行走、捧物待机、捧物行走动画切换正确。
- 木头和玉米商品都位于顾客背部正确位置。
- 购买完成表情保持正常。
- 森林区及两个玉米区的金币均正常生成。

- [ ] **步骤 3：只校准序列化的模型显示参数**

如果新 FBX 的人物高度或正面轴与现有顾客不同，只允许统一调整三个随机组件上的 `customerModelScale` 和 `customerModelYaw`。

不得修改以下内容：

- 顾客路径点
- 顾客根节点位置
- 商品存储配置
- 调度器移动代码

- [ ] **步骤 4：运行全部自动化测试**

运行：

```powershell
node --test tests/*.test.mjs
```

预期结果：全部测试通过，包括玉米购买动画、顾客商品显示和新增的随机外观测试。

- [ ] **步骤 5：验证序列化文件和差异质量**

运行：

```powershell
Get-Content -Raw assets/Scenes/DevScene.scene | ConvertFrom-Json | Out-Null
git diff --check
git status --short
```

预期结果：

- 场景 JSON 有效。
- 没有空白字符错误。
- `.creator/asset-template/typescript/Custom Script Template Help Documentation.url` 仍保持未跟踪、未暂存状态。

---

## 实施校验记录（2026-07-22）

- [x] 洗牌袋纯逻辑独立放在 `CustomerAppearanceOrder.ts`，每连续五名顾客覆盖五套外观。
- [x] 森林区和两个玉米区共三个顾客队伍均绑定随机外观组件。
- [x] 男顾客三套贴图与女顾客两套贴图均使用独立材质实例。
- [x] 男女 FBX 均已切分并重新导入 `idle`、`walk`、`idle2_NaHeZi`、`walk_NaHeZi` 四段循环动作。
- [x] 购买完成后的 B→C→D→起点整段路径持续播放捧物行走，回到队伍后恢复普通动作。
- [x] 商品挂点按新模型的 `back` 标记对齐，购买、完成表情和金币链路保持原调度器负责。
- [x] 原顾客视觉根节点会立即从 NPC 层级移除并销毁，不与新模型重叠显示。
- [x] 新顾客独立材质显式启用 `USE_ALBEDO_MAP`，五张外观贴图均参与着色。
- [x] 新 FBX 统一增加 `180°` 偏航校准，使正面轴与现有 NPC 路径朝向一致。
- [x] 场景 JSON 可解析，顾客定向测试与项目 63 项自动化测试全部通过。
