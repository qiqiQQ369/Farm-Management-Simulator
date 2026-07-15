import { _decorator, Component, Node, Vec3, Collider, ITriggerEvent, Prefab, instantiate, Label, find, Material, Vec4, MeshRenderer, Animation, tween, AudioSource, director, SpriteFrame, Sprite, RigidBody } from 'cc';
import { PlayerController } from './PlayerController';
import { CoinBackpack } from './CoinBackpack';
import { StoragePoint } from './Resource/StoragePoint';
import { CameraController } from './CameraController';
import { JoystickController } from './JoystickController';
const { ccclass, property } = _decorator;

/**
 * 升级目标枚举
 */
enum UpgradeTarget {
    LOGGER = 1,     // 等级1：伐木工
    MACHINE = 2,    // 等级2：伐木机
    FACTORY = 3     // 等级3：工厂
}

/**
 * 金币消耗器组件
 * 检测玩家，消耗金币进行升级，生成对应建筑物
 */
@ccclass('CoinConsumer')
export class CoinConsumer extends Component {
    
    @property({ type: CoinBackpack, tooltip: "玩家金币背包" })
    public playerCoinBackpack: CoinBackpack = null!;
    
    @property({ tooltip: "当前升级目标等级" })
    public targetLevel: UpgradeTarget = UpgradeTarget.LOGGER;
    
    @property({ tooltip: "每次消耗金币数量" })
    public coinsPerConsumption: number = 1;
    
    @property({ tooltip: "消耗间隔时间（秒）" })
    public consumeInterval: number = 0.5;
    
    // 生成位置配置
    @property({ type: Node, group: { name: "生成设置", id: "3" }, tooltip: "生成位置节点" })
    public spawnPosition: Node = null;

    @property({ type: Node, group: { name: "生成设置", id: "3" }, tooltip: "生成位置节点" })
    public loggerNode: Node = null;

    @property({ type: Node, group: { name: "生成设置", id: "3" }, tooltip: "生成位置节点" })
    public level2Node: Node = null;

    @property({ type: Node, group: { name: "生成设置", id: "3" }, tooltip: "生成位置节点" })
    public machineNode: Node = null;

    @property({ type: Node, group: { name: "生成设置", id: "3" }, tooltip: "生成位置节点" })
    public finishNode: Node = null;
    
    @property({ group: { name: "生成设置", id: "3" }, tooltip: "伐木工生成数量" })
    public loggerSpawnCount: number = 3;
    
    @property({ group: { name: "生成设置", id: "3" }, tooltip: "生成间距" })
    public spawnSpacing: number = 2.0;
    
    @property({ type: Label, group: { name: "UI设置", id: "4" }, tooltip: "剩余数量显示文本" })
    public remainingLabel: Label = null!;
    
    @property({ type: Sprite, group: { name: "UI设置", id: "4" } })
    public fillSprite: Sprite = null!;
    
    @property({ tooltip: "是否显示调试信息" })
    public showDebug: boolean = true;

     // 预制件配置
     @property({ type: Prefab, group: { name: "预制件设置", id: "2" }, tooltip: "伐木工预制件" })
     public loggerPrefab: Prefab = null;
     
     @property({ type: Prefab, group: { name: "预制件设置", id: "2" }, tooltip: "伐木机预制件" })
     public machinePrefab: Prefab = null;
     
     @property({ type: Prefab, group: { name: "预制件设置", id: "2" }, tooltip: "工厂预制件" })
     public factoryPrefab: Prefab = null;

    // 升级配置
    @property({ group: { name: "升级配置", id: "1" }, tooltip: "伐木工所需金币数" })
    public loggerRequiredCoins: number = 10;
    
    @property({ group: { name: "升级配置", id: "1" }, tooltip: "伐木机所需金币数" })
    public machineRequiredCoins: number = 50;
    
    @property({ group: { name: "升级配置", id: "1" }, tooltip: "工厂所需金币数" })
    public factoryRequiredCoins: number = 200;
    
    // 私有属性
    private _isPlayerInArea: boolean = false;
    private _playerNode: Node | null = null;
    private _playerController: PlayerController | null = null;
    private _consumeTimer: number = 0;
    private _isConsuming: boolean = false;
    private _currentProgress: number = 0;
    private _isCompleted: boolean = false;

    private _isAnimComplete: boolean = true;

    private _needCoins: number = 100;

    private _tilingOffset: Vec4 = new Vec4(1, 1, 0, 0);
    
    // 配置映射
    private _upgradeConfigs = new Map<UpgradeTarget, {
        requiredCoins: number;
        prefab: Prefab;
        name: string;
        spawnCount: number;
    }>();

    protected onLoad(): void {
        //this.setupCollisionDetection();
        this.validateComponents();
        this.initializeUpgradeConfigs();
        this.updateUI();
        this.remainingLabel.node.active = true;
        this.fillSprite.fillRange = 0;

        // 员工解锁点复用为搬运工解锁点：拖拉机完成前隐藏，完成后移动到拖拉机解锁位置。
        if (this.targetLevel === UpgradeTarget.FACTORY && this.node.name === 'unlockLevel3L') {
            this.node.active = false;
        }

        // this.loggerNode.active = false;
    }

    protected update(deltaTime: number): void {
        if (this._isPlayerInArea && !this._isConsuming && !this._isCompleted) {
            this._consumeTimer += deltaTime;
            
            if (this._consumeTimer >= this.consumeInterval) {
                this._consumeTimer = 0;
                this.tryConsumeCoins();
            }
        }
        else if(!this._isCompleted && this._needCoins <= 0){
            this.onUpgradeComplete();
        }
    }

    protected start(): void {
        this.setupCollisionDetection();
    }

    /**
     * 设置碰撞检测
     */
    private setupCollisionDetection(): void {
        const collider = this.node.getComponent(Collider);
        if (collider) {
            console.log('CoinConsumer: 节点上找到Collider组件');
            collider.on('onTriggerEnter', this.onPlayerEnter, this);
            collider.on('onTriggerExit', this.onPlayerExit, this);
        } else {
            console.error('CoinConsumer: 节点上没有找到Collider组件');
        }
    }

    /**
     * 验证必要组件
     */
    private validateComponents(): void {
        if (!this.playerCoinBackpack) {
            // 尝试自动查找
            this.playerCoinBackpack = this.node.scene.getComponentInChildren(CoinBackpack);
            if (!this.playerCoinBackpack) {
                console.error('CoinConsumer: 玩家金币背包未设置且无法自动找到');
            }
        }
        
        if (!this.spawnPosition) {
            this.spawnPosition = this.node;
            console.warn('CoinConsumer: 生成位置未设置，使用当前节点位置');
        }
    }

    /**
     * 初始化升级配置
     */
    private initializeUpgradeConfigs(): void {
        this._upgradeConfigs.set(UpgradeTarget.LOGGER, {
            requiredCoins: this.loggerRequiredCoins,
            prefab: this.loggerPrefab,
            name: "伐木工",
            spawnCount: this.loggerSpawnCount
        });
        
        this._upgradeConfigs.set(UpgradeTarget.MACHINE, {
            requiredCoins: this.machineRequiredCoins,
            prefab: this.machinePrefab,
            name: "伐木机",
            spawnCount: 1
        });
        
        this._upgradeConfigs.set(UpgradeTarget.FACTORY, {
            // 左侧员工解锁点在拖拉机解锁后复用为搬运工解锁点，门槛为 170。
            requiredCoins: this.node.name === 'unlockLevel3L' ? 170 : this.factoryRequiredCoins,
            prefab: this.factoryPrefab,
            name: "工厂",
            spawnCount: 1
        });
    }

    /**
     * 玩家进入区域
     */
    private onPlayerEnter(event: ITriggerEvent): void {
        console.log('CoinConsumer: 玩家进入区域');
        if (this.isPlayerNode(event.otherCollider.node)) {
            this._isPlayerInArea = true;
            this._playerNode = event.otherCollider.node;
            this._playerController = this._playerNode.getComponent(PlayerController);
            this._consumeTimer = 0;
            
            if (this.showDebug) {
                console.log('玩家进入金币消耗区域');
            }
            
            this.updateUI();
        }
    }

    /**
     * 玩家离开区域
     */
    private onPlayerExit(event: ITriggerEvent): void {
        if (this.isPlayerNode(event.otherCollider.node)) {
            this._isPlayerInArea = false;
            this._playerNode = null;
            this._playerController = null;
            this._consumeTimer = 0;
            this._isConsuming = false;
            
            if (this.showDebug) {
                console.log('玩家离开金币消耗区域');
            }
        }
    }

    /**
     * 判断是否是玩家节点
     */
    private isPlayerNode(node: Node): boolean {
        return node.name === 'Player' || 
               node.getComponent(PlayerController) !== null ||
               node.parent?.name === 'Player';
    }

    /**
     * 尝试消耗金币
     */
    private async tryConsumeCoins(): Promise<void> {
        if (!this.playerCoinBackpack || this._isCompleted) {
            return;
        }

        // // 检查玩家是否有足够的金币
        const playerStoragePoint = this.playerCoinBackpack.coinBackpackMount.getComponent(StoragePoint);

        const currentConfig = this._upgradeConfigs.get(this.targetLevel);
        if(this._currentProgress >= currentConfig.requiredCoins) {
            this.onUpgradeComplete();
            this._isConsuming = false;
            return;
        }

        if (playerStoragePoint.amount <= 0) {
            if (this.showDebug) {
                console.log('玩家没有金币');
            }
            return;
        }

        // 计算本次消耗的数量
        const consumeCount = Math.min(this.coinsPerConsumption, playerStoragePoint.amount);
        
        
        if (!currentConfig) {
            console.error(`未找到等级 ${this.targetLevel} 的配置`);
            return;
        }

        // 检查是否还需要更多金币
        const remainingNeeded = currentConfig.requiredCoins - this._currentProgress;
        const actualConsume = Math.min(consumeCount, remainingNeeded);

        var coinAmount = find('Canvas/CoinLabel/coinAmount');

        var audioSource = this.node.getComponent(AudioSource);
                
        for (let index = 0; index < playerStoragePoint.amount; index++) {
            if(this._currentProgress >= currentConfig.requiredCoins) {
                this.onUpgradeComplete();
                this._isConsuming = false;
                return;
            }
            
            if(audioSource != null) {
                audioSource.playOneShot(audioSource.clip);
            }

            playerStoragePoint.removeResourceWithAnimation(this.node.getChildByName('pos').worldPosition, 'parabola');
            var coinAmountLabel = coinAmount.getComponent(Label);
            coinAmountLabel.string = (parseInt(coinAmountLabel.string) - 5).toString();

            this._currentProgress += 5;
            // 更新UI
            this.updateUI();
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * 升级完成处理
     */
    private onUpgradeComplete(): void {
        this._isCompleted = true;
        const currentConfig = this._upgradeConfigs.get(this.targetLevel);
        
        if (!currentConfig) {
            console.error(`未找到等级 ${this.targetLevel} 的配置`);
            return;
        }

        if (this.showDebug) {
            console.log(`升级完成！生成 ${currentConfig.name}`);
        }
        
         // 更新UI显示完成状态
         this.updateUI();

         this.schedule(() => {
            if(this._isAnimComplete){
                // 生成对应的建筑物
                //this.remainingLabel.node.active = false;
                this.spawnBuildings(currentConfig);
            }
         }, 0.2);
    }

    private closed: boolean = false;
    /**
     * 生成建筑物
     */
    private spawnBuildings(config: any): void {
        if(this.closed) return;

        this.closed = true;

        if(this.targetLevel == 1){
            this.loggerNode.active = true;
            //this.node.getComponentInChildren(Animation).play("animation_DiMianUI_Close");
            tween(this.node.children[0])
            .to(0.5, { scale: new Vec3(0, 1, 0) }, { easing: 'linear' }).start();
            
            this.scheduleOnce(() => {
                this.level2Node.active = true;

                tween(this.level2Node.getChildByName('view'))
                .to(0.5, { scale: new Vec3(0.72, 0.72, 0.72) }, { easing: 'linear' }).start();

                this.node.active = false;
            }, 1.5);

            const cameraController = find('Main Camera').getComponent(CameraController);
            cameraController.target = this.loggerNode.getChildByName("Logger-003");
            const joystickController = find('Canvas/JoystickContainer').getComponent(JoystickController);
            joystickController._lock = true;
            find("Player").getComponent(PlayerController).stopMovement();

            // find("Player").getComponent(RigidBody).setLinearVelocity(new Vec3(0,0,0));

            cameraController.scheduleOnce(() => {
                cameraController.target = find('Player');
                joystickController._lock = false;
            }, 6)
            
            return;
        }

        if(this.targetLevel == 2){
            this.machineNode.active = true;

            // 复用员工解锁点作为搬运工解锁点，并放到当前拖拉机解锁点的位置。
            const haulerUnlockPad = find('unlockLevel3L');
            if (haulerUnlockPad) {
                haulerUnlockPad.setWorldPosition(this.node.worldPosition);
                haulerUnlockPad.active = true;
            }
            
            // this.node.getComponentInChildren(Animation).play("animation_DiMianUI_Close");
            tween(this.node.getChildByName("view"))
            .to(0.5, { scale: new Vec3(0,0,0) }, { easing: 'linear' }).start();

            this.scheduleOnce(() => {
                this.node.active = false;
            }, 1);
            this.loggerNode.active = false;

            const cameraController = find('Main Camera').getComponent(CameraController);
            cameraController.target = this.machineNode.getChildByName("Truck");
            const joystickController = find('Canvas/JoystickContainer').getComponent(JoystickController);
            joystickController._lock = true;
            find("Player").getComponent(PlayerController).stopMovement();
            // find("Player").getComponent(RigidBody).setLinearVelocity(new Vec3(0,0,0));

            cameraController.scheduleOnce(() => {
                cameraController.target = find('Player');
                find('Canvas/JoystickContainer').getComponent(JoystickController)._lock = false;
            }, 4)

            return;
        }

        if(this.targetLevel ==3){
            this.finishNode.active = true;
            tween(this.node.getChildByName("view"))
            .to(0.5, { scale: new Vec3(0,0,0) }, { easing: 'linear' }).start();
            //this.node.getComponentInChildren(Animation).play("animation_DiMianUI_Close");
            this.scheduleOnce(() => {
                this.node.active = false;
                //find('muweilan').active = false;
            }, 1);
            return;
        }
    }

    /**
     * 更新UI显示
     */
    private updateUI(): void {
        const currentConfig = this._upgradeConfigs.get(this.targetLevel);
        if (!currentConfig) return;

        // 更新剩余数量 - 添加动态递减动画
        if (this.remainingLabel) {
            if (this._isCompleted) {
                //this.remainingLabel.node.active = false;
            } else {
                this._isAnimComplete = false;
                const remaining = currentConfig.requiredCoins - this._currentProgress;
                this._needCoins = remaining;
                this.animateRemainingCount(remaining);
            }
        }
    }

    /**
     * 动态显示剩余数量递减动画
     */
    private animateRemainingCount(targetRemaining: number): void {
        // 获取当前显示的剩余数量
        const currentConfig = this._upgradeConfigs.get(this.targetLevel);
        // const currentText = this.remainingLabel.string;
        this.remainingLabel.string = targetRemaining.toString();
        //const currentRemaining = parseInt(currentText) || 0;
        const currentRemaining = targetRemaining + 5;

        if(currentRemaining > currentConfig.requiredCoins){
            return;
        }
        
        // 如果当前显示的数量等于目标数量，不需要动画
        if (currentRemaining === targetRemaining) {
            this.remainingLabel.string = `${targetRemaining}`;
            this._isAnimComplete = true;
            return;
        }

        // 计算需要递减的次数
        const decrementCount = currentRemaining - targetRemaining;

        console.log("remain:" + decrementCount + " " + targetRemaining + " " + currentRemaining);

        if (decrementCount <= 0) {
            this.remainingLabel.string = `${targetRemaining}`;
            this._isAnimComplete = true;
            return;
        }

        // 设置递减间隔时间（毫秒）
        const decrementInterval = 1; // 每100毫秒减1
        const totalDuration = decrementCount * decrementInterval;

        // 清除之前的定时器
        if (this._remainingAnimationTimer) {
            clearInterval(this._remainingAnimationTimer);
        }

        // 开始递减动画
        let currentCount = currentRemaining;
        this._remainingAnimationTimer = setInterval(() => {
            currentCount--;
            // this._tilingOffset.w = 0.5 * (1 - currentCount / currentConfig.requiredCoins);
            this.fillSprite.fillRange = 1 - currentCount / currentConfig.requiredCoins;
            // this.meshRenderer.materials[0].setProperty('tilingOffset', this._tilingOffset, 0);
            
            this.remainingLabel.string = `${currentCount}`;
            
            // 当达到目标值时停止动画
            if (currentCount <= targetRemaining) {
                clearInterval(this._remainingAnimationTimer);
                this._remainingAnimationTimer = null;
                this.remainingLabel.string = `${targetRemaining}`;
                this._isAnimComplete = true;
            }
        }, decrementInterval);
    }

    // 在类的顶部添加这个属性
    private _remainingAnimationTimer: any | null = null;

}
