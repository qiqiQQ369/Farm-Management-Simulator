# 玉米区本地金币生成与收集设计

## 问题与根因

左右两个玉米区的 `CornCustomerScheduler.coinDropArea` 都序列化指向森林区 `LandObj/coinDropArea`。因此玉米顾客完成购买后，即使执行金币创建，金币也会落到森林区中央槽位，而不会出现在对应玉米区。

玉米区现有 `CoinPlace` 只包含提示图标，没有金币库存、触发碰撞体或收集组件，不能作为完整金币区域使用。

## 目标

- 每块玉米田拥有独立的实体金币区域。
- 顾客从所属玉米田购买满 4 个玉米后，在本田生成 3 枚实体金币。
- 金币按照森林区相同的堆叠、弹出和收集节奏工作。
- 玩家收集每枚实体金币后增加 5 点金币数，与森林区一致。
- 玉米金币逻辑不导入或调用森林区 `CoinCollector`、`StoragePoint`、`ResourceManager` 或 `NPCScheduler`。
- 森林区金币逻辑和场景接线保持不变。

## 结构

新增独立 `CornCoinCollector`。左右玉米区各自在本地 `CoinPlace` 下创建一个 `CornCoinDropArea`：

- `CornCoinDropArea` 使用 `CornStoragePoint` 记录金币容量与数量，容量与森林区一致为 54。
- 节点配置独立 `BoxCollider` 触发区，中心和尺寸复制森林金币区参数。
- 节点配置独立 `CornCoinCollector`，负责检测玩家、逐枚转移金币、更新玩家金币背包和 UI。
- `CornCustomerScheduler` 只解析所属 `Finish` 或 `Finish-001` 下的本地金币区，不接受森林区或另一块玉米田的金币区作为后备。

本地金币区由玉米顾客调度器在启用前确保存在。若场景已经包含本地金币区则复用，避免重复创建。

## 数据流

1. 玉米顾客从本田 `Sell1/CornStoragePoint` 买满 4 个玉米。
2. `CornCustomerScheduler.dropCoins()` 获取本田 `CornCoinDropArea/CornStoragePoint`。
3. 调度器以 0.1 秒间隔创建 3 枚金币，并在每次创建前检查容量。
4. 金币作为本地金币区子节点播放缩放弹出动画。
5. 玩家进入本地触发区后，`CornCoinCollector` 按森林区相同节奏逐枚取出金币。
6. 金币飞入玩家现有金币背包；每枚金币让 UI 金币数增加 5，并同步减少本地金币库存数量。

## 独立性与兼容

`CornCoinCollector` 可以读取全局玩家、`CoinBackpack` 和金币 UI，因为这些是全局玩家系统；但它不导入森林金币收集器或森林库存实现。玩家金币背包通过结构化接口接收实体金币，以避免玉米脚本依赖森林 `StoragePoint` 类型。

场景中两个玉米调度器原有的森林 `coinDropArea` 引用会被移除或迁移为各自本地节点。中央森林 `NPCScheduler` 继续绑定原来的 `LandObj/coinDropArea`。

## 错误处理

- 缺少本地 `CoinPlace` 时，输出一次明确错误并停止本田金币创建，不回退到森林区。
- 缺少金币预制体或玩家金币背包时，保留本地金币，不销毁、不重复计数。
- 本地金币槽满时停止继续生成，避免数量与实体子节点不一致。
- 收集过程中组件禁用或玩家离开时停止当前循环，未收集金币继续保留在本田。

## 验证

自动回归必须覆盖：

- 左右玉米调度器的金币区域都属于各自 `Finish` 模块。
- 两块玉米田的金币区域、库存和收集器互不共享。
- 玉米脚本不导入森林 `CoinCollector`、`StoragePoint` 或 `ResourceManager`。
- 每位顾客买满 4 个玉米后生成 3 枚金币，生成间隔为 0.1 秒。
- 金币槽容量为 54，满载后不再超量生成。
- 每枚金币收集后增加 5，并正确减少本地库存。
- 中央森林调度器和金币区接线不变。
- 全部 Node 回归测试、场景 JSON 解析与差异检查通过。

最终在 Cocos Creator 中目视确认：左右玉米区顾客购买后，金币出现在对应玉米区 `CoinPlace`；玩家靠近可逐枚收取；森林区不出现玉米订单产生的金币。
