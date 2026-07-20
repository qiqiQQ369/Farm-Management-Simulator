# 玉米顾客购买与入槽动画 Implementation Plan

> **For agentic workers:** 按任务顺序执行，每个行为先补回归测试，再完成最小实现并运行对应测试；不得修改森林区运行逻辑。

**Goal:** 让左右玉米区顾客只购买所属田地出售槽中的玉米，玉米进入各类槽位时播放与木头区一致的动画，并在每位顾客买满 4 个玉米后生成 3 枚金币。

**Architecture:** 新建独立的 `CornCustomerScheduler`，复制森林顾客的排队、购买、结算、金币掉落和离场状态机，但只连接 `CornStoragePoint`。动画全部由 `CornStoragePoint` 自己实现，不导入或调用森林区的 `NPCScheduler`、`StoragePoint` 或 `ResourceManager`。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Node.js test runner

## Global Constraints

- 森林区脚本和场景组件保持不变。
- 左右玉米区各自解析本模块下的 `Sell1`，不允许跨田或回退到森林出售槽。
- 玉米顾客容量固定为 4；完成购买后固定生成 3 枚金币，间隔 0.1 秒，并遵守金币槽容量。
- 所有代码和测试说明使用中文注释或清晰的英文标识，不提交工作区中的无关改动。

---

### Task 1：建立购买、动画和金币回归测试

**Files:**

- Create: `tests/corn-customer-purchase-animation-regression.test.mjs`
- Inspect: `assets/_Scripts/NPCScheduler.ts`
- Inspect: `assets/_Scripts/StoragePoint.ts`
- Inspect: `assets/Scenes/DevScene.scene`

1. 写入失败测试，验证独立 `CornCustomerScheduler` 存在且不导入森林顾客、森林库位或森林资源管理器。
2. 验证调度器只查找所属模块 `Sell1` 下的 `CornStoragePoint`，购买转移使用动画类型 4。
3. 验证顾客买满 4 个后按 0.1 秒间隔生成 3 枚金币，并检查金币槽容量。
4. 验证 `CornStoragePoint` 为动画类型 1、2、3、4 分别实现动画，类型 4 完成前锁定资源。
5. 验证 `DevScene` 两个玉米调度器使用玉米专属组件且奖励为 3，中央森林调度器类型不变。
6. 运行：`node --test tests/corn-customer-purchase-animation-regression.test.mjs`，确认测试先失败。

### Task 2：补齐 CornStoragePoint 独立入槽动画

**Files:**

- Modify: `assets/_Scripts/CornStoragePoint.ts`
- Test: `tests/corn-customer-purchase-animation-regression.test.mjs`

1. 为类型 1 实现短距离落下动画。
2. 为类型 2 实现先升高再弹落的玩家入槽动画。
3. 为类型 3 实现旋转落下动画。
4. 为类型 4 实现搬运/购买弧线转移动画，并仅在动画完成后设置 `canMove = true`。
5. 保留后台恢复逻辑，避免中断动画后资源永久不可移动。
6. 运行对应回归测试并确认动画静态约束通过。

### Task 3：实现独立 CornCustomerScheduler

**Files:**

- Create: `assets/_Scripts/CornCustomerScheduler.ts`
- Create: `assets/_Scripts/CornCustomerScheduler.ts.meta`
- Reference only: `assets/_Scripts/NPCScheduler.ts`

1. 复制并适配森林顾客的生成、排队、移动、表情、购买进度和离场状态机。
2. 将出售槽和顾客携带槽全部替换为独立 `CornStoragePoint`；若克隆预制体含旧森林库位组件，禁用旧组件并迁移其节点和堆叠参数。
3. 顾客每次从本田 `CornStoragePoint` 取出玉米并以动画类型 4 放入携带槽，买满 4 个后结算。
4. 复制金币预制体创建、堆叠坐标、掉落动画及容量检查逻辑；默认奖励和场景奖励均设为 3。
5. 缺少本田出售槽、携带槽或金币落点时输出一次明确错误并停止对应循环，不创建森林组件作为备用。
6. 运行新增回归测试。

### Task 4：迁移玉米场景接线

**Files:**

- Modify: `assets/Scenes/DevScene.scene`
- Test: `tests/corn-customer-purchase-animation-regression.test.mjs`

1. 将左右两个 `NPCScheduler-001` 节点的组件类型迁移为 `CornCustomerScheduler`，保留已有顾客预制体、路径点、提示 UI、金币落点和时间参数。
2. 将两个玉米调度器的 `coinReward` 设置为 3。
3. 确认中央森林顾客节点仍使用 `NPCScheduler`。
4. 解析场景 JSON 并运行新增回归测试。

### Task 5：全量验证

**Files:**

- Test: `tests/*.test.mjs`

1. 运行：`node --test tests/*.test.mjs`。
2. 运行项目 TypeScript 诊断，区分本轮错误与现有引擎声明错误。
3. 运行：`git diff --check`。
4. 在 Cocos Creator 中目视验证：玉米飞入槽位、顾客逐个取走 4 个玉米、需求气泡递减、购买完成生成 3 枚金币、左右田库存互不串用。
