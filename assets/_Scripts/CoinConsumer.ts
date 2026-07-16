import { _decorator, AudioSource, Collider, Component, find, ITriggerEvent, instantiate, Label, Node, Prefab, Sprite, SpriteFrame, tween, Vec3 } from 'cc';
import { ArrowTipController } from './ArrowTipController';
import { CameraController } from './CameraController';
import { CoinBackpack } from './CoinBackpack';
import { HaulerNPC } from './HaulerNPC';
import { JoystickController } from './JoystickController';
import { PlayerController } from './PlayerController';
import { StoragePoint } from './Resource/StoragePoint';

const { ccclass, property } = _decorator;

enum UpgradeTarget {
    LOGGER = 1,
    MACHINE = 2,
    FACTORY = 3,
    HAULER = 4,
}

type UpgradeConfig = {
    requiredCoins: number;
    prefab: Prefab | null;
    name: string;
    spawnCount: number;
};

@ccclass('CoinConsumer')
export class CoinConsumer extends Component {
    @property({ type: CoinBackpack, tooltip: '玩家金币背包' })
    public playerCoinBackpack: CoinBackpack = null!;

    @property({ tooltip: '当前升级目标等级' })
    public targetLevel: UpgradeTarget = UpgradeTarget.LOGGER;

    @property({ tooltip: '每次消耗金币数量' })
    public coinsPerConsumption = 1;

    @property({ tooltip: '消耗间隔时间（秒）' })
    public consumeInterval = 0.5;

    @property({ type: Node, group: { name: '生成设置', id: '3' }, tooltip: '生成位置节点' })
    public spawnPosition: Node = null!;

    @property({ type: Node, group: { name: '生成设置', id: '3' }, tooltip: '伐木工节点' })
    public loggerNode: Node = null!;

    @property({ type: Node, group: { name: '生成设置', id: '3' }, tooltip: '二级解锁点节点' })
    public level2Node: Node = null!;

    @property({ type: Node, group: { name: '生成设置', id: '3' }, tooltip: '拖拉机节点' })
    public machineNode: Node = null!;

    @property({ type: Node, group: { name: '生成设置', id: '3' }, tooltip: '完成后激活的节点' })
    public finishNode: Node = null!;

    @property({ group: { name: '生成设置', id: '3' }, tooltip: '伐木工生成数量' })
    public loggerSpawnCount = 3;

    @property({ group: { name: '生成设置', id: '3' }, tooltip: '生成间距' })
    public spawnSpacing = 2.0;

    @property({ type: Label, group: { name: 'UI设置', id: '4' }, tooltip: '剩余数量显示文本' })
    public remainingLabel: Label = null!;

    @property({ type: Sprite, group: { name: 'UI设置', id: '4' } })
    public fillSprite: Sprite = null!;

    @property({ tooltip: '是否显示调试信息' })
    public showDebug = true;

    @property({ type: Prefab, group: { name: '预制件设置', id: '2' }, tooltip: '伐木工预制件' })
    public loggerPrefab: Prefab = null!;

    @property({ type: Prefab, group: { name: '预制件设置', id: '2' }, tooltip: '拖拉机预制件' })
    public machinePrefab: Prefab = null!;

    @property({ type: Prefab, group: { name: '预制件设置', id: '2' }, tooltip: '工厂预制件' })
    public factoryPrefab: Prefab = null!;

    @property({ group: { name: '升级配置', id: '1' }, tooltip: '伐木工所需金币数' })
    public loggerRequiredCoins = 10;

    @property({ group: { name: '升级配置', id: '1' }, tooltip: '拖拉机所需金币数' })
    public machineRequiredCoins = 50;

    @property({ group: { name: '升级配置', id: '1' }, tooltip: '工厂所需金币数' })
    public factoryRequiredCoins = 200;

    @property({ group: { name: '升级配置', id: '1' }, tooltip: '搬运工所需金币数' })
    public haulerRequiredCoins = 170;

    private _isPlayerInArea = false;
    private _playerNode: Node | null = null;
    private _playerController: PlayerController | null = null;
    private _consumeTimer = 0;
    private _isConsuming = false;
    private _currentProgress = 0;
    private _isCompleted = false;
    private _isAnimComplete = true;
    private _needCoins = 100;
    private _remainingAnimationTimer: ReturnType<typeof setInterval> | null = null;
    private closed = false;

    private _upgradeConfigs = new Map<UpgradeTarget, UpgradeConfig>();

    protected onLoad(): void {
        this.validateComponents();
        this.initializeUpgradeConfigs();
        this.updateUI();

        if (this.remainingLabel) {
            this.remainingLabel.node.active = true;
        }

        if (this.fillSprite) {
            this.fillSprite.fillRange = 0;
        }
    }

    protected start(): void {
        this.setupCollisionDetection();
    }

    protected update(deltaTime: number): void {
        this.normalizeUnlockChainState();

        if (this._isPlayerInArea && !this._isConsuming && !this._isCompleted) {
            this._consumeTimer += deltaTime;

            if (this._consumeTimer >= this.consumeInterval) {
                this._consumeTimer = 0;
                void this.tryConsumeCoins();
            }
        } else if (!this._isCompleted && this._needCoins <= 0) {
            this.onUpgradeComplete();
        }
    }

    private normalizeUnlockChainState(): void {
        const machineActive = this.machineNode?.activeInHierarchy ?? false;
        if (!machineActive) {
            return;
        }

        if (this.node.name === 'unlockLevel2') {
            this.node.active = false;
            this.ensureHaulerUnlockReady(this.node.worldPosition);
            return;
        }

        if (this.node.name === 'unlockLevel3') {
            this.ensureHaulerUnlockReady(this.node.worldPosition);
        }
    }

    private setupCollisionDetection(): void {
        const collider = this.node.getComponent(Collider);
        if (collider) {
            collider.on('onTriggerEnter', this.onPlayerEnter, this);
            collider.on('onTriggerExit', this.onPlayerExit, this);
        } else {
            console.error('CoinConsumer: node is missing Collider');
        }
    }

    private validateComponents(): void {
        if (!this.playerCoinBackpack) {
            this.playerCoinBackpack = this.node.scene.getComponentInChildren(CoinBackpack);
            if (!this.playerCoinBackpack) {
                console.error('CoinConsumer: failed to resolve CoinBackpack');
            }
        }

        if (!this.spawnPosition) {
            this.spawnPosition = this.node;
        }
    }

    private initializeUpgradeConfigs(): void {
        this._upgradeConfigs.clear();
        this._upgradeConfigs.set(UpgradeTarget.LOGGER, {
            requiredCoins: this.loggerRequiredCoins,
            prefab: this.loggerPrefab,
            name: 'Logger',
            spawnCount: this.loggerSpawnCount,
        });

        this._upgradeConfigs.set(UpgradeTarget.MACHINE, {
            requiredCoins: this.machineRequiredCoins,
            prefab: this.machinePrefab,
            name: 'Machine',
            spawnCount: 1,
        });

        this._upgradeConfigs.set(UpgradeTarget.FACTORY, {
            requiredCoins: this.factoryRequiredCoins,
            prefab: this.factoryPrefab,
            name: 'Factory',
            spawnCount: 1,
        });

        this._upgradeConfigs.set(UpgradeTarget.HAULER, {
            requiredCoins: this.haulerRequiredCoins,
            prefab: null,
            name: 'Hauler',
            spawnCount: 1,
        });
    }

    private onPlayerEnter(event: ITriggerEvent): void {
        if (!this.isPlayerNode(event.otherCollider.node)) {
            return;
        }

        this._isPlayerInArea = true;
        this._playerNode = event.otherCollider.node;
        this._playerController = this._playerNode.getComponent(PlayerController);
        this._consumeTimer = 0;
        this.updateUI();
    }

    private onPlayerExit(event: ITriggerEvent): void {
        if (!this.isPlayerNode(event.otherCollider.node)) {
            return;
        }

        this._isPlayerInArea = false;
        this._playerNode = null;
        this._playerController = null;
        this._consumeTimer = 0;
        this._isConsuming = false;
    }

    private isPlayerNode(node: Node): boolean {
        return node.name === 'Player' ||
            node.getComponent(PlayerController) !== null ||
            node.parent?.name === 'Player';
    }

    private async tryConsumeCoins(): Promise<void> {
        if (!this.playerCoinBackpack || this._isCompleted) {
            return;
        }

        const playerStoragePoint = this.playerCoinBackpack.coinBackpackMount.getComponent(StoragePoint);
        const currentConfig = this._upgradeConfigs.get(this.targetLevel);

        if (!currentConfig) {
            console.error(`CoinConsumer: missing config for level ${this.targetLevel}`);
            return;
        }

        if (this._currentProgress >= currentConfig.requiredCoins) {
            this.onUpgradeComplete();
            this._isConsuming = false;
            return;
        }

        if (playerStoragePoint.amount <= 0) {
            return;
        }

        const coinAmount = find('Canvas/CoinLabel/coinAmount');
        const audioSource = this.node.getComponent(AudioSource);

        for (let index = 0; index < playerStoragePoint.amount; index++) {
            if (this._currentProgress >= currentConfig.requiredCoins) {
                this.onUpgradeComplete();
                this._isConsuming = false;
                return;
            }

            if (audioSource?.clip) {
                audioSource.playOneShot(audioSource.clip);
            }

            const targetNode = this.node.getChildByName('pos') ?? this.node;
            playerStoragePoint.removeResourceWithAnimation(targetNode.worldPosition, 'parabola');

            if (coinAmount) {
                const coinAmountLabel = coinAmount.getComponent(Label);
                if (coinAmountLabel) {
                    coinAmountLabel.string = (parseInt(coinAmountLabel.string) - 5).toString();
                }
            }

            this._currentProgress += 5;
            this.updateUI();
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    private onUpgradeComplete(): void {
        this._isCompleted = true;
        const currentConfig = this._upgradeConfigs.get(this.targetLevel);

        if (!currentConfig) {
            console.error(`CoinConsumer: missing config for level ${this.targetLevel}`);
            return;
        }

        if (this.showDebug) {
            console.log(`Upgrade complete: ${currentConfig.name}`);
        }

        this.updateUI();
        this.schedule(() => {
            if (this._isAnimComplete) {
                this.spawnBuildings(currentConfig);
            }
        }, 0.2);
    }

    private spawnBuildings(_config: UpgradeConfig): void {
        if (this.closed) {
            return;
        }

        this.closed = true;

        if (this.targetLevel === UpgradeTarget.LOGGER) {
            this.loggerNode.active = true;
            tween(this.node.children[0])
                .to(0.5, { scale: new Vec3(0, 1, 0) }, { easing: 'linear' })
                .start();

            this.scheduleOnce(() => {
                this.level2Node.active = true;

                const level2View = this.level2Node.getChildByName('view');
                if (level2View) {
                    tween(level2View)
                        .to(0.5, { scale: new Vec3(0.72, 0.72, 0.72) }, { easing: 'linear' })
                        .start();
                }

                this.node.active = false;
            }, 1.5);

            const cameraController = find('Main Camera').getComponent(CameraController);
            cameraController.target = this.loggerNode.getChildByName('Logger-003');
            const joystickController = find('Canvas/JoystickContainer').getComponent(JoystickController);
            joystickController._lock = true;
            find('Player').getComponent(PlayerController).stopMovement();

            cameraController.scheduleOnce(() => {
                cameraController.target = find('Player');
                joystickController._lock = false;
            }, 6);

            return;
        }

        if (this.targetLevel === UpgradeTarget.MACHINE) {
            this.machineNode.active = true;
            this.spawnHaulerUnlockPointAt(this.node.worldPosition);

            const view = this.node.getChildByName('view');
            if (view) {
                tween(view)
                    .to(0.5, { scale: new Vec3(0, 0, 0) }, { easing: 'linear' })
                    .start();
            }

            this.scheduleOnce(() => {
                this.node.active = false;
            }, 1);

            this.loggerNode.active = false;

            const cameraController = find('Main Camera').getComponent(CameraController);
            cameraController.target = this.machineNode.getChildByName('Truck');
            const joystickController = find('Canvas/JoystickContainer').getComponent(JoystickController);
            joystickController._lock = true;
            find('Player').getComponent(PlayerController).stopMovement();

            cameraController.scheduleOnce(() => {
                cameraController.target = find('Player');
                find('Canvas/JoystickContainer').getComponent(JoystickController)._lock = false;
            }, 4);

            return;
        }

        if (this.targetLevel === UpgradeTarget.FACTORY || this.targetLevel === UpgradeTarget.HAULER) {
            if (this.finishNode) {
                this.finishNode.active = true;
            }

            const view = this.node.getChildByName('view');
            if (view) {
                tween(view)
                    .to(0.5, { scale: new Vec3(0, 0, 0) }, { easing: 'linear' })
                    .start();
            }

            this.scheduleOnce(() => {
                this.node.active = false;
            }, 1);
        }
    }

    private spawnHaulerUnlockPointAt(position: Vec3): void {
        this.ensureHaulerUnlockReady(position);
    }

    private ensureHaulerUnlockReady(position: Vec3): void {
        const haulerUnlockPad = this.findSceneNodeByName('unlockLevel3');
        if (!haulerUnlockPad) {
            console.warn('Missing unlockLevel3');
            return;
        }

        const haulerUnlockConsumer = haulerUnlockPad.getComponent(CoinConsumer);
        if (!haulerUnlockConsumer) {
            console.warn('unlockLevel3 is missing CoinConsumer');
            return;
        }

        const haulerNode = this.createHaulerNode(haulerUnlockPad);
        if (position) {
            haulerUnlockPad.setWorldPosition(position);
        }

        if (haulerUnlockConsumer.targetLevel !== UpgradeTarget.HAULER || haulerUnlockConsumer.finishNode !== haulerNode) {
            haulerUnlockConsumer.prepareAsHaulerUnlock(haulerNode);
        }

        if (!haulerUnlockPad.active) {
            haulerUnlockPad.active = true;
        }

        const view = haulerUnlockPad.getChildByName('view');
        if (view) {
            view.setScale(new Vec3(0, 0, 0));
            tween(view)
                .to(0.5, { scale: new Vec3(0.72, 0.72, 0.72) }, { easing: 'linear' })
                .start();
        }
    }

    private createHaulerNode(unlockPad: Node): Node {
        const existingHauler = this.findSceneNodeByName('HaulerNPC');
        if (existingHauler) {
            existingHauler.active = false;
            return existingHauler;
        }

        const template = this.findHaulerTemplate();
        if (!template) {
            console.warn('No employee template available for hauler');
            return new Node('HaulerNPC');
        }

        const hauler = instantiate(template);
        hauler.name = 'HaulerNPC';
        hauler.setParent(template.parent);
        hauler.setWorldPosition(unlockPad.worldPosition);
        hauler.active = false;

        const behavior = hauler.getComponent(HaulerNPC) ?? hauler.addComponent(HaulerNPC);
        const arrow = this.node.scene?.getComponentInChildren(ArrowTipController);
        const carryStorage = hauler.getComponentInChildren(StoragePoint);
        if (arrow?.cutterWoodStorageNode && arrow.sellWoodStorageNode && carryStorage) {
            behavior.collectionStorage = arrow.cutterWoodStorageNode;
            behavior.sellStorage = arrow.sellWoodStorageNode;
            behavior.carryStorage = carryStorage;
            behavior.collectionPoint = arrow.cutterWoodStorageNode.node;
            behavior.sellPoint = arrow.sellWoodStorageNode.node;
            behavior.idlePoint = unlockPad;
        }

        return hauler;
    }

    private findHaulerTemplate(): Node | null {
        if (!this.loggerNode) {
            return null;
        }

        const queue = [...this.loggerNode.children];
        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current.getComponent(PlayerController) || current.name.toLowerCase().includes('logger')) {
                return current;
            }

            queue.push(...current.children);
        }

        return this.loggerNode.children[0] ?? null;
    }

    private prepareAsHaulerUnlock(haulerNode: Node): void {
        this.targetLevel = UpgradeTarget.HAULER;
        this.finishNode = haulerNode;
        this.spawnPosition = this.node;
        this._currentProgress = 0;
        this._isCompleted = false;
        this._isConsuming = false;
        this._consumeTimer = 0;
        this._needCoins = this.haulerRequiredCoins;
        this.closed = false;

        if (this._remainingAnimationTimer) {
            clearInterval(this._remainingAnimationTimer);
            this._remainingAnimationTimer = null;
        }

        if (this.finishNode) {
            this.finishNode.active = false;
        }

        this.initializeUpgradeConfigs();
        this.bindHaulerUnlockUI();
        this.applyHaulerUnlockVisuals();
        this.updateUI();
    }

    private bindHaulerUnlockUI(): void {
        const view = this.node.getChildByName('view');
        if (!view) {
            return;
        }

        const labels = view.getComponentsInChildren(Label);
        if (labels.length > 0) {
            this.remainingLabel = labels[0];
            this.remainingLabel.node.active = true;
        }

        const fillNode = view.getChildByName('fill');
        const fillSprite = fillNode?.getComponent(Sprite) ?? null;
        if (fillSprite) {
            this.fillSprite = fillSprite;
            this.fillSprite.fillRange = 0;
        }
    }

    private applyHaulerUnlockVisuals(): void {
        const sourceIconSprite = this.findNamedSprite(this.findSceneNodeByName('unlockLevel1'), 'icon');
        const targetIconSprite = this.findNamedSprite(this.node, 'icon');
        const sourceSpriteFrame = sourceIconSprite?.spriteFrame as SpriteFrame | null;

        if (targetIconSprite && sourceSpriteFrame) {
            targetIconSprite.spriteFrame = sourceSpriteFrame;
        }

        if (this.fillSprite) {
            this.fillSprite.fillRange = 0;
        }
    }

    private findNamedSprite(root: Node | null, targetName: string): Sprite | null {
        if (!root) {
            return null;
        }

        if (root.name === targetName) {
            return root.getComponent(Sprite);
        }

        for (const child of root.children) {
            const result = this.findNamedSprite(child, targetName);
            if (result) {
                return result;
            }
        }

        return null;
    }

    private findSceneNodeByName(name: string): Node | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const visit = (parent: Node): Node | null => {
            if (parent.name === name) {
                return parent;
            }

            for (const child of parent.children) {
                const result = visit(child);
                if (result) {
                    return result;
                }
            }

            return null;
        };

        return visit(scene);
    }

    private updateUI(): void {
        const currentConfig = this._upgradeConfigs.get(this.targetLevel);
        if (!currentConfig || !this.remainingLabel) {
            return;
        }

        if (!this._isCompleted) {
            this._isAnimComplete = false;
            const remaining = currentConfig.requiredCoins - this._currentProgress;
            this._needCoins = remaining;
            this.animateRemainingCount(remaining);
        }
    }

    private animateRemainingCount(targetRemaining: number): void {
        const currentConfig = this._upgradeConfigs.get(this.targetLevel);
        if (!currentConfig || !this.remainingLabel) {
            return;
        }

        this.remainingLabel.string = targetRemaining.toString();
        const currentRemaining = targetRemaining + 5;

        if (currentRemaining > currentConfig.requiredCoins) {
            if (this.fillSprite) {
                this.fillSprite.fillRange = 1 - targetRemaining / currentConfig.requiredCoins;
            }
            this._isAnimComplete = true;
            return;
        }

        if (currentRemaining === targetRemaining) {
            this.remainingLabel.string = `${targetRemaining}`;
            this._isAnimComplete = true;
            return;
        }

        const decrementCount = currentRemaining - targetRemaining;
        if (decrementCount <= 0) {
            this.remainingLabel.string = `${targetRemaining}`;
            this._isAnimComplete = true;
            return;
        }

        if (this._remainingAnimationTimer) {
            clearInterval(this._remainingAnimationTimer);
        }

        let currentCount = currentRemaining;
        this._remainingAnimationTimer = setInterval(() => {
            currentCount--;
            if (this.fillSprite) {
                this.fillSprite.fillRange = 1 - currentCount / currentConfig.requiredCoins;
            }

            this.remainingLabel.string = `${currentCount}`;

            if (currentCount <= targetRemaining) {
                if (this._remainingAnimationTimer) {
                    clearInterval(this._remainingAnimationTimer);
                    this._remainingAnimationTimer = null;
                }

                this.remainingLabel.string = `${targetRemaining}`;
                this._isAnimComplete = true;
            }
        }, 1);
    }
}
