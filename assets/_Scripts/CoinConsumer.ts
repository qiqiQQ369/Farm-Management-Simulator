import { _decorator, AudioSource, CharacterController, Collider, Component, find, ITriggerEvent, instantiate, Label, Node, Prefab, Quat, RigidBody, Sprite, SpriteFrame, tween, Vec3 } from 'cc';
import { ArrowTipController } from './ArrowTipController';
import { CameraController } from './CameraController';
import { ChopAction } from './ChopAction';
import { CoinBackpack } from './CoinBackpack';
import { HaulerNPC } from './HaulerNPC';
import { JoystickController } from './JoystickController';
import { MultiResourceBackpack } from './MultiResourceBackpack';
import { PlayerController } from './PlayerController';
import { StoragePoint } from './Resource/StoragePoint';
import { WoodBackpack } from './WoodBackpack';

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
    public haulerRequiredCoins = 260;

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
            if (this.targetLevel === UpgradeTarget.HAULER && !this.finishNode) {
                console.log('[HAULER-DEBUG] unlock complete, creating hauler at unlockLevel3', {
                    unlockNode: this.node.name,
                    worldPosition: this.node.worldPosition.clone(),
                });
                this.finishNode = this.createHaulerNode(this.node);
            }

            if (this.finishNode) {
                console.log('[HAULER-DEBUG] activating hauler node', {
                    name: this.finishNode.name,
                    activeBefore: this.finishNode.active,
                    worldPosition: this.finishNode.worldPosition.clone(),
                    parent: this.finishNode.parent?.name ?? 'null',
                });
                this.finishNode.active = true;
            }

            const view = this.node.getChildByName('view');
            if (view) {
                tween(view)
                    .to(0.5, { scale: new Vec3(0, 0, 0) }, { easing: 'linear' })
                    .start();
            }

            if (this.targetLevel === UpgradeTarget.HAULER) {
                this.node.active = false;
            } else {
                this.scheduleOnce(() => {
                    this.node.active = false;
                }, 1);
            }
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

        if (position) {
            haulerUnlockPad.setWorldPosition(position);
        }

        if (haulerUnlockConsumer.targetLevel !== UpgradeTarget.HAULER) {
            haulerUnlockConsumer.prepareAsHaulerUnlock(null);
        }

        if (!haulerUnlockPad.active) {
            haulerUnlockPad.active = true;
        }

        haulerUnlockConsumer.syncHaulerUnlockProgressUI();

        const view = haulerUnlockPad.getChildByName('view');
        if (view) {
            view.setScale(new Vec3(0, 0, 0));
            tween(view)
                .to(0.5, { scale: new Vec3(0.72, 0.72, 0.72) }, { easing: 'linear' })
                .start();
        }

    }

    private createHaulerNode(unlockPad: Node): Node {
        const spawnAnchor = this.getHaulerUnlockAnchor(unlockPad);
        const spawnWorldPosition = this.getHaulerSpawnWorldPosition(spawnAnchor);
        const existingHauler = this.findSceneNodeByName('HaulerNPC');
        if (existingHauler) {
            existingHauler.active = false;
            existingHauler.setWorldPosition(spawnWorldPosition);
            console.log('[HAULER-DEBUG] reusing existing hauler node', {
                worldPosition: existingHauler.worldPosition.clone(),
                parent: existingHauler.parent?.name ?? 'null',
                spawnAnchor: spawnAnchor.name,
            });
            this.preparePlayerSkinHauler(existingHauler);
            this.configureHaulerNode(existingHauler, unlockPad, spawnAnchor);
            return existingHauler;
        }

        const template = this.findPlayerTemplate() ?? this.findHaulerTemplate();
        if (template) {
            console.log('[HAULER-DEBUG] using scene hauler template', {
                templateName: template.name,
                templateParent: template.parent?.name ?? 'null',
                templateWorldPosition: template.worldPosition.clone(),
            });
            const hauler = instantiate(template);
            hauler.active = false;
            hauler.name = 'HaulerNPC';
            hauler.setParent(unlockPad.parent ?? this.loggerNode?.parent ?? this.node.scene!);
            hauler.setWorldPosition(spawnWorldPosition);
            this.preparePlayerSkinHauler(hauler);

            console.log('[HAULER-DEBUG] instantiated hauler from scene template', {
                worldPosition: hauler.worldPosition.clone(),
                localPosition: hauler.position.clone(),
                parent: hauler.parent?.name ?? 'null',
                spawnAnchor: spawnAnchor.name,
            });

            this.configureHaulerNode(hauler, unlockPad, spawnAnchor);
            return hauler;
        }

        if (!this.loggerPrefab) {
            console.warn('No employee template available for hauler');
            return new Node('HaulerNPC');
        }

        console.log('[HAULER-DEBUG] using logger prefab fallback');
        const hauler = instantiate(this.loggerPrefab);
        hauler.active = false;
        hauler.name = 'HaulerNPC';
        hauler.setParent(unlockPad.parent ?? this.loggerNode?.parent ?? this.node.scene!);
        hauler.setWorldPosition(spawnWorldPosition);

        console.log('[HAULER-DEBUG] instantiated hauler from prefab fallback', {
            worldPosition: hauler.worldPosition.clone(),
            localPosition: hauler.position.clone(),
            parent: hauler.parent?.name ?? 'null',
            spawnAnchor: spawnAnchor.name,
        });

        this.preparePlayerSkinHauler(hauler);
        this.configureHaulerNode(hauler, unlockPad, spawnAnchor);

        return hauler;
    }

    private getHaulerUnlockAnchor(unlockPad: Node): Node {
        return unlockPad.getChildByName('pos')
            ?? unlockPad.getChildByName('view')
            ?? unlockPad;
    }

    private getHaulerSpawnWorldPosition(spawnAnchor: Node): Vec3 {
        const spawnWorldPosition = spawnAnchor.worldPosition.clone();
        const playerTemplate = this.findPlayerTemplate();
        if (playerTemplate) {
            spawnWorldPosition.y = playerTemplate.worldPosition.y;
        }

        return spawnWorldPosition;
    }

    private findPlayerTemplate(): Node | null {
        const playerNode = this.findSceneNodeByName('Player');
        if (playerNode) {
            return playerNode;
        }

        const playerController = this.node.scene?.getComponentInChildren(PlayerController) ?? null;
        return playerController?.node ?? null;
    }

    private preparePlayerSkinHauler(hauler: Node): void {
        for (const storage of hauler.getComponentsInChildren(StoragePoint)) {
            const stackArea = storage.stackAreaNode ?? storage.node;
            for (const item of [...stackArea.children]) {
                item.active = false;
                item.destroy();
            }
            storage.clearStorage();
        }

        const woodBackpack = hauler.getComponent(WoodBackpack);
        const coinBackpack = hauler.getComponent(CoinBackpack);
        const multiResourceBackpack = hauler.getComponent(MultiResourceBackpack);

        hauler.getComponent(PlayerController)?.destroy();
        hauler.getComponent(ChopAction)?.destroy();
        if (woodBackpack) woodBackpack.enabled = false;
        woodBackpack?.destroy();
        if (coinBackpack) coinBackpack.enabled = false;
        coinBackpack?.destroy();
        if (multiResourceBackpack) multiResourceBackpack.enabled = false;
        hauler.getComponent(MultiResourceBackpack)?.destroy();
        hauler.getComponent(CharacterController)?.destroy();
        hauler.getComponent(RigidBody)?.destroy();
        hauler.getComponent(Collider)?.destroy();

        const stripPhysicsRecursively = (node: Node): void => {
            node.getComponent(Collider)?.destroy();
            node.getComponent(CharacterController)?.destroy();
            node.getComponent(RigidBody)?.destroy();

            for (const child of [...node.children]) {
                if (child.name.startsWith('ResourceBackpack_')) {
                    child.active = false;
                    child.destroy();
                    continue;
                }
                stripPhysicsRecursively(child);
            }
        };

        stripPhysicsRecursively(hauler);

        const joystickController = this.findSceneNodeByName('JoystickContainer')?.getComponent(JoystickController)
            ?? find('Canvas/JoystickContainer')?.getComponent(JoystickController)
            ?? null;
        const playerController = this.findSceneNodeByName('Player')?.getComponent(PlayerController) ?? null;
        if (joystickController && playerController) {
            joystickController.setInputTarget(playerController);
        }
    }

    private configureHaulerNode(hauler: Node, unlockPad: Node, spawnAnchor: Node): void {
        const behavior = hauler.getComponent(HaulerNPC) ?? hauler.addComponent(HaulerNPC);
        const arrow = this.node.scene?.getComponentInChildren(ArrowTipController);
        const carryStorage = this.ensureHaulerCarryStorage(hauler);
        const collectionStorage = arrow?.cutterWoodStorageNode ?? null;
        const sellStorage = arrow?.sellWoodStorageNode ?? this.resolveNearestSellStoragePoint(collectionStorage?.node.worldPosition ?? unlockPad.worldPosition);
        const sellPoint = arrow?.sellWoodGuideNode ?? sellStorage?.node ?? null;
        if (!carryStorage) {
            console.error('HaulerNPC clone is missing carry StoragePoint');
            return;
        }

        console.log('[HAULER-DEBUG] configuring hauler node', {
            haulerName: hauler.name,
            haulerWorldPosition: hauler.worldPosition.clone(),
            unlockWorldPosition: unlockPad.worldPosition.clone(),
            spawnAnchorWorldPosition: spawnAnchor.worldPosition.clone(),
            carryStorageNode: carryStorage.node.name,
            carryStorageCapacity: carryStorage.capacity,
        });

        if (collectionStorage && sellStorage && sellPoint && carryStorage) {
            behavior.collectionStorage = collectionStorage;
            behavior.sellStorage = sellStorage;
            behavior.carryStorage = carryStorage;
            behavior.collectionPoint = collectionStorage.node;
            behavior.sellPoint = sellPoint;
            behavior.idlePoint = spawnAnchor;

            console.log('[HAULER-DEBUG] hauler bindings ready', {
                collectionPoint: behavior.collectionPoint?.name ?? 'null',
                sellPoint: behavior.sellPoint?.name ?? 'null',
                sellStorageNode: behavior.sellStorage?.node?.name ?? 'null',
                idlePoint: behavior.idlePoint?.name ?? 'null',
            });
        } else {
            console.warn('[HAULER-DEBUG] missing arrow storage bindings', {
                hasArrow: !!arrow,
                hasCollectionStorage: !!collectionStorage,
                hasSellStorage: !!sellStorage,
            });
        }
    }

    private ensureHaulerCarryStorage(hauler: Node): StoragePoint | null {
        const playerRoot = this.findSceneNodeByName('Player');
        const playerMount = playerRoot
            ?.getComponent(WoodBackpack)
            ?.backpackMount ?? null;
        const playerStorage = playerMount?.getComponent(StoragePoint) ?? null;

        const carryNode = this.findNamedNode(hauler, 'HaulerCarryStorage') ?? new Node('HaulerCarryStorage');
        if (carryNode.parent !== hauler) carryNode.setParent(hauler);
        carryNode.setPosition(0, 1.2, -0.6);
        this.copyCarryMountTransform(carryNode, playerMount, playerRoot);

        const carryStorage = carryNode.getComponent(StoragePoint) ?? carryNode.addComponent(StoragePoint);
        carryStorage.storageName = '搬运工木材存储';
        this.copyStoragePointLayout(carryStorage, playerStorage);
        carryStorage.stackAreaNode = carryStorage.node;
        carryStorage.clearStorage();
        return carryStorage;
    }

    /**
     * The player mount is a visual template only. Convert its full bone-chain
     * transform into the player-root coordinate system for a private fallback.
     */
    private copyCarryMountTransform(target: Node, source: Node | null, sourceRoot: Node | null): void {
        if (!source || !sourceRoot) return;

        const relativePosition = new Vec3();
        sourceRoot.inverseTransformPoint(relativePosition, source.worldPosition);
        target.setPosition(relativePosition);

        const parentInverseRotation = new Quat();
        const relativeRotation = new Quat();
        Quat.invert(parentInverseRotation, sourceRoot.worldRotation);
        Quat.multiply(relativeRotation, parentInverseRotation, source.worldRotation);
        target.setRotation(relativeRotation);

        const sourceScale = source.worldScale;
        const rootScale = sourceRoot.worldScale;
        target.setScale(
            rootScale.x === 0 ? sourceScale.x : sourceScale.x / rootScale.x,
            rootScale.y === 0 ? sourceScale.y : sourceScale.y / rootScale.y,
            rootScale.z === 0 ? sourceScale.z : sourceScale.z / rootScale.z,
        );
    }

    private copyStoragePointLayout(target: StoragePoint, source: StoragePoint | null): void {
        target.capacity = source?.capacity ?? 4;
        target.layers = source?.layers ?? 4;
        target.layerHeight = source?.layerHeight ?? 0.18;
        target.resourcePerRow = source?.resourcePerRow ?? 2;
        target.resourcePerCol = source?.resourcePerCol ?? 2;
        target.resourceRowSpacing = source?.resourceRowSpacing ?? 0.18;
        target.resourceColSpacing = source?.resourceColSpacing ?? 0.18;
        target.autoStack = source?.autoStack ?? true;
        target.showCapacityInfo = source?.showCapacityInfo ?? true;
        target.moveAnimationDuration = source?.moveAnimationDuration ?? 1;
        target.fadeAnimationDuration = source?.fadeAnimationDuration ?? 0.5;
        target.moveEasing = source?.moveEasing ?? 'sineOut';
        target.fadeEasing = source?.fadeEasing ?? 'sineIn';
        target.checkOffset = false;
        target.audioInterval = source?.audioInterval ?? 0.2;
        target.stackAreaNode = target.node;
        target.amount = 0;
    }

    private ensureSellStoragePoint(anchor: Node | null): StoragePoint | null {
        if (!anchor) {
            return null;
        }

        const existingStorage = this.findComponentInHierarchy(anchor, StoragePoint);
        if (existingStorage) {
            return existingStorage;
        }

        const storageNode = new Node('RuntimeSellStorage');
        storageNode.setParent(anchor);
        storageNode.setPosition(-3.58, 8.66, 15.3);
        storageNode.setScale(9, 9, 9);

        const storagePoint = storageNode.addComponent(StoragePoint);
        storagePoint.storageName = `${anchor.name}木材仓库`;
        storagePoint.autoStack = true;
        storagePoint.showCapacityInfo = true;
        storagePoint.capacity = 1000000;
        storagePoint.amount = 0;
        storagePoint.layers = 10000;
        storagePoint.layerHeight = 0.2;
        storagePoint.resourcePerRow = 5;
        storagePoint.resourceRowSpacing = 0.2;
        storagePoint.resourcePerCol = 2;
        storagePoint.resourceColSpacing = 1;
        storagePoint.stackAreaNode = storageNode;
        storagePoint.moveAnimationDuration = 1;
        storagePoint.fadeAnimationDuration = 0.5;
        storagePoint.moveEasing = 'sineOut';
        storagePoint.fadeEasing = 'sineIn';
        storagePoint.checkOffset = false;
        storagePoint.audioInterval = 0.2;

        return storagePoint;
    }

    private resolveNearestSellStoragePoint(targetPosition: Vec3): StoragePoint | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const anchors: Node[] = [];
        const visit = (node: Node): void => {
            if (node.name === 'Sell' || node.name === 'Sell1') {
                anchors.push(node);
            }

            for (const child of node.children) {
                visit(child);
            }
        };

        visit(scene);

        let closestStorage: StoragePoint | null = null;
        let closestDistance = Number.MAX_VALUE;
        for (const anchor of anchors) {
            const storagePoint = this.ensureSellStoragePoint(anchor);
            if (!storagePoint) {
                continue;
            }

            const distance = Vec3.distance(targetPosition, anchor.worldPosition);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestStorage = storagePoint;
            }
        }

        return closestStorage;
    }

    private findHaulerTemplate(): Node | null {
        if (!this.loggerNode) {
            return null;
        }

        const queue = [...this.loggerNode.children];
        while (queue.length > 0) {
            const current = queue.shift()!;
            if (this.findComponentInHierarchy(current, StoragePoint)) {
                return current;
            }

            if (current.getComponent(PlayerController) || current.name.toLowerCase().includes('logger')) {
                return current;
            }

            queue.push(...current.children);
        }

        return this.loggerNode.children[0] ?? null;
    }

    private prepareAsHaulerUnlock(haulerNode: Node | null): void {
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

    private syncHaulerUnlockProgressUI(): void {
        if (this.node.name !== 'unlockLevel3' || this.targetLevel !== UpgradeTarget.HAULER) {
            return;
        }

        this.bindHaulerUnlockUI();

        const currentConfig = this._upgradeConfigs.get(this.targetLevel);
        if (!currentConfig) {
            return;
        }

        const expectedFillRange = Math.max(0, 1 - this._needCoins / currentConfig.requiredCoins);
        this.applyUnlockLevel3FillRange(expectedFillRange);

        if (this.remainingLabel) {
            this.remainingLabel.string = `${Math.max(0, this._needCoins)}`;
        }

        this.updateUI();
    }

    private bindHaulerUnlockUI(): void {
        const amountNode = this.node.name === 'unlockLevel3'
            ? this.findFirstNamedNode(this.node, ['ShuZi', 'amount'])
            : this.findNamedNode(this.node, 'amount');
        const amountLabel = amountNode?.getComponent(Label) ?? null;
        if (amountLabel) {
            this.remainingLabel = amountLabel;
            this.remainingLabel.node.active = true;
        }

        const fillNode = this.node.name === 'unlockLevel3'
            ? this.findFirstNamedNode(this.node, ['JinDuTiao', 'fill'])
            : this.node.getChildByName('fill') ?? this.findNamedNode(this.node, 'fill');
        const fillSprite = fillNode?.getComponent(Sprite) ?? null;
        if (fillSprite) {
            this.fillSprite = fillSprite;
            this.fillSprite.fillRange = 0;
        }
    }

    private applyHaulerUnlockVisuals(): void {
        this.applyUnlockLevel3FillRange(0);
    }

    private findNamedSprite(root: Node | null, targetName: string): Sprite | null {
        const targetNode = this.findNamedNode(root, targetName);
        return targetNode?.getComponent(Sprite) ?? null;
    }

    private findFirstNamedNode(root: Node | null, targetNames: string[]): Node | null {
        for (const targetName of targetNames) {
            const targetNode = this.findNamedNode(root, targetName);
            if (targetNode) {
                return targetNode;
            }
        }

        return null;
    }

    private findNamedNode(root: Node | null, targetName: string): Node | null {
        if (!root) {
            return null;
        }

        if (root.name === targetName) {
            return root;
        }

        for (const child of root.children) {
            const result = this.findNamedNode(child, targetName);
            if (result) {
                return result;
            }
        }

        return null;
    }

    private findComponentInHierarchy<T extends Component>(root: Node | null, componentType: new (...args: any[]) => T): T | null {
        if (!root) {
            return null;
        }

        const component = root.getComponent(componentType);
        if (component) {
            return component;
        }

        for (const child of root.children) {
            const result = this.findComponentInHierarchy(child, componentType);
            if (result) {
                return result;
            }
        }

        return null;
    }

    private applyUnlockLevel3FillRange(fillRange: number): void {
        const clampedFillRange = Math.max(0, Math.min(1, fillRange));

        if (this.fillSprite) {
            this.fillSprite.fillRange = clampedFillRange;
        }

        if (this.node.name !== 'unlockLevel3') {
            return;
        }

        const filledSprites = this.node.getComponentsInChildren(Sprite)
            .filter(sprite => sprite.type === Sprite.Type.FILLED);

        for (const sprite of filledSprites) {
            sprite.fillRange = clampedFillRange;
        }
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

        const clampedTargetRemaining = Math.max(0, targetRemaining);
        const initialRemaining = Math.max(0, currentConfig.requiredCoins - this._currentProgress + 5);
        this.remainingLabel.string = clampedTargetRemaining.toString();
        const currentRemaining = Math.min(currentConfig.requiredCoins, initialRemaining);

        if (currentRemaining > currentConfig.requiredCoins) {
            this.applyUnlockLevel3FillRange(1 - clampedTargetRemaining / currentConfig.requiredCoins);
            this._isAnimComplete = true;
            return;
        }

        if (currentRemaining === clampedTargetRemaining) {
            this.remainingLabel.string = `${clampedTargetRemaining}`;
            this.applyUnlockLevel3FillRange(1 - clampedTargetRemaining / currentConfig.requiredCoins);
            this._isAnimComplete = true;
            return;
        }

        const decrementCount = currentRemaining - clampedTargetRemaining;
        if (decrementCount <= 0) {
            this.remainingLabel.string = `${clampedTargetRemaining}`;
            this.applyUnlockLevel3FillRange(1 - clampedTargetRemaining / currentConfig.requiredCoins);
            this._isAnimComplete = true;
            return;
        }

        if (this._remainingAnimationTimer) {
            clearInterval(this._remainingAnimationTimer);
        }

        let currentCount = currentRemaining;
        this._remainingAnimationTimer = setInterval(() => {
            currentCount--;
            this.applyUnlockLevel3FillRange(1 - currentCount / currentConfig.requiredCoins);

            this.remainingLabel.string = `${currentCount}`;

            if (currentCount <= clampedTargetRemaining) {
                if (this._remainingAnimationTimer) {
                    clearInterval(this._remainingAnimationTimer);
                    this._remainingAnimationTimer = null;
                }

                this.remainingLabel.string = `${clampedTargetRemaining}`;
                this.applyUnlockLevel3FillRange(1 - clampedTargetRemaining / currentConfig.requiredCoins);
                this._isAnimComplete = true;
            }
        }, 1);
    }
}
