# 搬运工 NPC 解锁执行计划

> **给执行代理：** 必须逐项执行本计划；步骤使用复选框（`- [ ]`）记录进度。

**目标：** 在拖拉机支付 155 解锁后出现 170 金币的搬运工解锁点；解锁后的搬运工自动把木材从收集点送到卖木点，买家 NPC 继续负责产出金币。

**架构：** 新增独立的 `HaulerUnlockController` 管理两个阶段的可见性和 170 金币扣除，避免修改已有 `CoinConsumer` 的三段升级逻辑。新增 `HaulerNPC` 管理搬运状态机，并只通过 `StoragePoint` 与 `ResourceManager` 转移木材，和现有买家 `NPCScheduler` 解耦。

**技术栈：** Cocos Creator 3.8.7、TypeScript、`StoragePoint`、`ResourceManager`、Cocos `Collider` 与 `Vec3`。

## 全局约束

- 拖拉机解锁费用保持 155 金币。
- 搬运工解锁费用固定为 170 金币。
- 搬运工不得直接生成金币或删除木材。
- 现有买家 `NPCScheduler` 仍是卖木点木材变为金币的唯一入口。
- 不修改玩家移动、买家 NPC、车辆系统和既有资源价格。

---

### 任务 1：实现搬运工自动搬运组件

**文件：**
- 新建：`assets/_Scripts/HaulerNPC.ts`
- 修改：`assets/Scenes/DevScene.scene`（在搬运工节点挂载组件并绑定引用）
- 测试：Cocos Creator 的 `DevScene` 预览。

**接口：**
- 输入：`collectionStorage: StoragePoint`、`sellStorage: StoragePoint`、`carryStorage: StoragePoint`、`collectionPoint: Node`、`sellPoint: Node`、`idlePoint: Node`。
- 输出：`HaulerNPC` 在 `WaitingForWood`、`Loading`、`Delivering`、`Unloading` 与 `Returning` 状态之间循环。

- [ ] **步骤 1：记录失败现象**

在 `DevScene` 预览中把木材放到收集点，确认当前没有 NPC 会将其自动移动到卖木点。

- [ ] **步骤 2：创建状态机脚本**

在 `assets/_Scripts/HaulerNPC.ts` 创建以下组件；它在收集点为空或卖木点满时等待，所有资源移动都使用已有的 `ResourceManager.MoveResource`：

```ts
import { _decorator, Component, Node, Vec3 } from 'cc';
import { ResourceManager } from './Resource/ResourceManager';
import { StoragePoint } from './Resource/StoragePoint';

const { ccclass, property } = _decorator;

enum HaulerState {
    WaitingForWood,
    Loading,
    Delivering,
    Unloading,
    Returning,
}

@ccclass('HaulerNPC')
export class HaulerNPC extends Component {
    @property({ type: Node }) public collectionPoint: Node = null!;
    @property({ type: Node }) public sellPoint: Node = null!;
    @property({ type: Node }) public idlePoint: Node = null!;
    @property({ type: StoragePoint }) public collectionStorage: StoragePoint = null!;
    @property({ type: StoragePoint }) public sellStorage: StoragePoint = null!;
    @property({ type: StoragePoint }) public carryStorage: StoragePoint = null!;
    @property public moveSpeed = 3;
    @property public transferInterval = 0.15;

    private state = HaulerState.WaitingForWood;
    private transferTimer = 0;

    protected onEnable(): void {
        this.state = HaulerState.WaitingForWood;
        this.node.setWorldPosition(this.idlePoint.worldPosition);
    }

    protected update(deltaTime: number): void {
        if (!this.collectionStorage || !this.sellStorage || !this.carryStorage) return;
        switch (this.state) {
            case HaulerState.WaitingForWood:
                if (this.collectionStorage.amount > 0 && this.sellStorage.hasSpace(1)) this.state = HaulerState.Loading;
                break;
            case HaulerState.Loading:
                this.transferTimer += deltaTime;
                if (this.transferTimer < this.transferInterval) break;
                this.transferTimer = 0;
                if (this.carryStorage.hasSpace(1) && this.collectionStorage.amount > 0) {
                    void ResourceManager.MoveResource(this.collectionStorage, this.carryStorage, false, 4, Vec3.ZERO);
                } else {
                    this.state = this.carryStorage.amount > 0 ? HaulerState.Delivering : HaulerState.WaitingForWood;
                }
                break;
            case HaulerState.Delivering:
                if (this.moveTowards(this.sellPoint.worldPosition, deltaTime)) this.state = HaulerState.Unloading;
                break;
            case HaulerState.Unloading:
                this.transferTimer += deltaTime;
                if (this.transferTimer < this.transferInterval) break;
                this.transferTimer = 0;
                if (this.carryStorage.amount > 0 && this.sellStorage.hasSpace(1)) {
                    void ResourceManager.MoveResource(this.carryStorage, this.sellStorage, false, 4, Vec3.ZERO);
                } else if (this.carryStorage.amount === 0) {
                    this.state = HaulerState.Returning;
                }
                break;
            case HaulerState.Returning:
                if (this.moveTowards(this.collectionPoint.worldPosition, deltaTime)) this.state = HaulerState.WaitingForWood;
                break;
        }
    }

    private moveTowards(target: Vec3, deltaTime: number): boolean {
        const direction = target.clone().subtract(this.node.worldPosition);
        if (direction.length() <= 0.05) return true;
        direction.normalize();
        this.node.setWorldPosition(this.node.worldPosition.clone().add(direction.multiplyScalar(this.moveSpeed * deltaTime)));
        this.node.lookAt(target);
        return false;
    }
}
```

- [ ] **步骤 3：配置场景节点**

在 `assets/Scenes/DevScene.scene` 创建或复用一个现有 NPC 节点作为 `HaulerNPC`，并新增一个容量为 4 的子级 `StoragePoint` 作为 `carryStorage`。将其初始 `active` 设为 `false`，并绑定：

```text
collectionPoint    = 木材收集点
collectionStorage  = 收集点的 StoragePoint
sellPoint          = LandObj/Sell
sellStorage        = LandObj/Sell 的 woodStackArea StoragePoint
idlePoint          = 搬运工解锁点旁的待机点
carryStorage       = 搬运工子级的 StoragePoint
moveSpeed          = 3
transferInterval   = 0.15
```

- [ ] **步骤 4：静态验证**

运行：

```powershell
git diff --check
rg -n 'class HaulerNPC|ResourceManager.MoveResource|HaulerState' assets/_Scripts/HaulerNPC.ts
```

预期：`git diff --check` 返回退出码 0，状态机、资源移动调用均能被检索到。

### 任务 2：实现两段式搬运工解锁控制

**文件：**
- 新建：`assets/_Scripts/HaulerUnlockController.ts`
- 修改：`assets/Scenes/DevScene.scene`（配置解锁地块、碰撞体、显示文本及节点引用）
- 测试：Cocos Creator 的 `DevScene` 预览。

**接口：**
- 输入：`tractorNode: Node`、`unlockPad: Node`、`haulerNode: Node`、`playerCoinStorage: StoragePoint`。
- 输出：拖拉机节点激活后显示解锁地块；消费 170 金币后激活搬运工。

- [ ] **步骤 1：创建解锁控制器**

在 `assets/_Scripts/HaulerUnlockController.ts` 创建以下组件。它挂在始终激活的场景控制节点上，因而能在拖拉机完成解锁后显示此前隐藏的解锁地块：

```ts
import { _decorator, Component, Node, Label, Collider, ITriggerEvent } from 'cc';
import { CoinBackpack } from './CoinBackpack';
import { StoragePoint } from './Resource/StoragePoint';

const { ccclass, property } = _decorator;

@ccclass('HaulerUnlockController')
export class HaulerUnlockController extends Component {
    @property({ type: Node }) public tractorNode: Node = null!;
    @property({ type: Node }) public unlockPad: Node = null!;
    @property({ type: Node }) public haulerNode: Node = null!;
    @property({ type: CoinBackpack }) public playerCoinBackpack: CoinBackpack = null!;
    @property({ type: Label }) public remainingLabel: Label = null!;
    @property public requiredCoins = 170;
    @property public consumeInterval = 0.15;

    private playerInside = false;
    private unlocked = false;
    private elapsed = 0;

    protected onLoad(): void {
        this.unlockPad.active = false;
        this.haulerNode.active = false;
        this.remainingLabel.string = `${this.requiredCoins}`;
        const collider = this.unlockPad.getComponent(Collider);
        collider?.on('onTriggerEnter', this.onTriggerEnter, this);
        collider?.on('onTriggerExit', this.onTriggerExit, this);
    }

    protected update(deltaTime: number): void {
        if (!this.unlockPad.active && this.tractorNode.activeInHierarchy && !this.unlocked) {
            this.unlockPad.active = true;
        }
        if (!this.playerInside || this.unlocked) return;
        this.elapsed += deltaTime;
        if (this.elapsed < this.consumeInterval) return;
        this.elapsed = 0;
        this.consumeOneCoin();
    }

    private onTriggerEnter(event: ITriggerEvent): void {
        if (event.otherCollider.node.name === 'Player') this.playerInside = true;
    }

    private onTriggerExit(event: ITriggerEvent): void {
        if (event.otherCollider.node.name === 'Player') this.playerInside = false;
    }

    private consumeOneCoin(): void {
        const storage = this.playerCoinBackpack.coinBackpackMount.getComponent(StoragePoint);
        if (!storage || storage.amount < 1) return;
        storage.removeResourceWithAnimation(this.unlockPad.worldPosition, 'parabola');
        this.requiredCoins -= 5;
        this.remainingLabel.string = `${Math.max(0, this.requiredCoins)}`;
        if (this.requiredCoins <= 0) this.completeUnlock();
    }

    private completeUnlock(): void {
        this.unlocked = true;
        this.playerInside = false;
        this.unlockPad.active = false;
        this.haulerNode.active = true;
    }
}
```

- [ ] **步骤 2：配置解锁地块**

在 `DevScene` 复制拖拉机的解锁地块外观，命名为 `HaulerUnlockPad`，保持碰撞体并将价格文字设为 `170`。在一个始终激活的场景控制节点挂载 `HaulerUnlockController`，绑定：

```text
tractorNode         = 已由 155 金币解锁的拖拉机节点
unlockPad           = HaulerUnlockPad
haulerNode          = 配置完成的搬运工 NPC
playerCoinBackpack  = Player 的 CoinBackpack
remainingLabel      = HaulerUnlockPad 的价格文本
requiredCoins       = 170
consumeInterval     = 0.15
```

- [ ] **步骤 3：人工验收**

在 Cocos Creator 中执行以下验证：

1. 初始状态下，搬运工和 `HaulerUnlockPad` 都不可见。
2. 支付 155 完成拖拉机解锁，`HaulerUnlockPad` 出现并显示 170。
3. 玩家进入该地块并支付 170，地块消失、搬运工出现。
4. 在收集点生成木材，确认搬运工把木材转入卖木点。
5. 确认搬运期间不增加金币；买家 NPC 消耗卖木点木材后才增加金币。

- [ ] **步骤 4：提交**

```powershell
git add assets/_Scripts/HaulerNPC.ts assets/_Scripts/HaulerUnlockController.ts assets/Scenes/DevScene.scene
git commit -m "Add unlockable wood hauler NPC"
git push origin main
```

## 自检

- 需求覆盖：任务 1 实现收集点到卖木点的非产钱搬运；任务 2 实现 155 拖拉机后显示 170 搬运工解锁点。
- 占位检查：计划未保留待定实现、待补步骤或不明确的代码接口。
- 接口一致性：`HaulerUnlockController` 仅激活 `HaulerNPC` 所在节点；`HaulerNPC` 只使用 `StoragePoint` 与 `ResourceManager.MoveResource`，不依赖买家 `NPCScheduler` 的内部状态。
