import {
    _decorator,
    Animation,
    BoxCollider,
    Component,
    Label,
    Node,
    Prefab,
    RenderRoot2D,
    Sprite,
    SpriteFrame,
    Tween,
    UITransform,
    Vec3,
    instantiate,
    tween,
} from 'cc';
import { AnimationLibrary } from './AnimationLibrary';
import { AnimationController } from './AnimationController';
import { CameraFacingUI } from './CameraFacingUI';
import { CoinBackpack } from './CoinBackpack';
import { CornCoinCollector } from './CornCoinCollector';
import { CornStoragePoint } from './CornStoragePoint';
import { PlayerController } from './PlayerController';

const { ccclass, property } = _decorator;

type StorageLike = Component & {
    amount: number;
    capacity: number;
    storageName?: string;
    autoStack?: boolean;
    showCapacityInfo?: boolean;
    layers?: number;
    layerHeight?: number;
    resourcePerRow?: number;
    resourceRowSpacing?: number;
    resourcePerCol?: number;
    resourceColSpacing?: number;
    stackAreaNode?: Node;
    moveAnimationDuration?: number;
    fadeAnimationDuration?: number;
    moveEasing?: string;
    fadeEasing?: string;
    checkOffset?: boolean;
    audioInterval?: number;
};

/** 玉米区独立顾客调度器。流程与森林顾客一致，但不读取森林库存。 */
@ccclass('CornCustomerScheduler')
export class CornCustomerScheduler extends Component {
    @property({ type: Component }) public sellZone: Component = null!;
    @property({ type: Node }) public fillTip: Node = null!;
    @property public fillTipHeadOffsetY = 2.1;
    @property({ type: SpriteFrame }) public completionEmojiFrame: SpriteFrame = null!;

    @property({ type: Prefab }) public coinPrefab: Prefab = null!;
    @property({ type: Node }) public coinDropArea: Node = null!;
    @property public coinReward: number = 3;

    @property({ type: Node }) public startPoint: Node = null!;
    @property({ type: Node }) public pointA: Node = null!;
    @property({ type: Node }) public pointB: Node = null!;
    @property({ type: Node }) public pointC: Node = null!;
    @property({ type: Node }) public pointD: Node = null!;
    @property({ type: [Node] }) public npcs: Node[] = [];

    @property public moveSpeed = 2;
    @property public spacing = 1.2;
    @property public loadDuration = 2;
    @property public collectInterval = 1;
    @property public moveAnim = 'move';
    @property public idleAnim = 'idle';
    @property public loadAnim = 'load';
    @property public loadMoveAnim = 'loadMove';

    private readonly _customerCapacity = 4;
    private _queue: Node[] = [];
    private _waitingAtA: Node | null = null;
    private _loadingAtB: Node | null = null;
    private _bReserved = false;
    private readonly _activeDeparted = new Set<Node>();
    private readonly _runningTweens = new Map<Node, Tween<Node>>();
    private _resolvedSellStoragePoint: CornStoragePoint | null = null;
    private _fillTipTargetNpc: Node | null = null;
    private readonly _fillTipOffset = new Vec3();
    private readonly _fillTipWorldPosition = new Vec3();
    private _reportedMissingSellStorage = false;
    private _reportedMissingCarryStorage = false;
    private _reportedMissingCoinStorage = false;

    protected onEnable(): void {
        this._resolvedSellStoragePoint = null;
        this.ensureLocalCoinDropArea();
        this.prepareNpcCarryStorages();
        this.prepareNpcCompletionEmojis();
        this.setupFillTipFacing();
        this.initializeQueue();
    }

    protected onDisable(): void {
        this.stopAllTweens();
        this.unscheduleAllCallbacks();
    }

    protected update(): void {
        this.updateFillTipPosition();
    }

    private setupFillTipFacing(): void {
        if (!this.fillTip) return;
        if (!this.fillTip.getComponent(CameraFacingUI)) this.fillTip.addComponent(CameraFacingUI);
        const floatingAnimation = this.fillTip.getComponent(AnimationController);
        if (floatingAnimation) {
            floatingAnimation.stopAnimation();
            floatingAnimation.enabled = false;
        }
        this.fillTip.setPosition(0, 0.95, 10.307);
        this.fillTip.setScale(0.42, 0.42, 0.42);
        this.fillTip.active = false;
        for (const child of this.fillTip.children) child.setRotationFromEuler(Vec3.ZERO);
    }

    private prepareNpcCarryStorages(): void {
        for (const npc of this.npcs) this.ensureNpcCarryStorage(npc);
    }

    private prepareNpcCompletionEmojis(): void {
        for (const npc of this.npcs) {
            if (this.getNpcEmoji(npc) || !this.completionEmojiFrame) continue;

            const emoji = new Node('emoji');
            emoji.setParent(npc);
            emoji.setPosition(0.131, 2.396, -0.18);
            emoji.setRotationFromEuler(-45, 0, 0);
            emoji.setScale(0.003, 0.003, 1);
            emoji.layer = 8388608;

            const transform = emoji.addComponent(UITransform);
            transform.setContentSize(188, 188);
            const sprite = emoji.addComponent(Sprite);
            sprite.spriteFrame = this.completionEmojiFrame;
            emoji.addComponent(RenderRoot2D);
            emoji.addComponent(CameraFacingUI);
            emoji.active = false;
        }
    }

    private ensureNpcCarryStorage(npc: Node): CornStoragePoint | null {
        const existing = this.findCornStoragePointInNode(npc);
        if (existing) {
            this.configureNpcCarryLayout(existing);
            existing.recoverInterruptedTransfers();
            return existing;
        }

        const legacy = this.findStorageLikeInNode(npc);
        if (!legacy) {
            if (!this._reportedMissingCarryStorage) {
                console.error('CornCustomerScheduler: customer carry storage is missing.');
                this._reportedMissingCarryStorage = true;
            }
            return null;
        }

        legacy.enabled = false;
        const storage = legacy.node.addComponent(CornStoragePoint);
        storage.stackAreaNode = legacy.stackAreaNode ?? legacy.node;
        this.configureNpcCarryLayout(storage);
        storage.recoverInterruptedTransfers();
        return storage;
    }

    /** Keep every corn customer's carried stack identical to the forest customer layout. */
    private configureNpcCarryLayout(storage: CornStoragePoint): void {
        storage.storageName = 'corn_customer_carry';
        storage.autoStack = true;
        storage.showCapacityInfo = true;
        storage.capacity = this._customerCapacity;
        storage.layers = 10;
        storage.layerHeight = 0.2;
        storage.resourcePerRow = 1;
        storage.resourceRowSpacing = 0.2;
        storage.resourcePerCol = 1;
        storage.resourceColSpacing = 0.2;
        storage.moveAnimationDuration = 1;
        storage.fadeAnimationDuration = 0.5;
        storage.moveEasing = 'sineOut';
        storage.fadeEasing = 'sineIn';
        storage.checkOffset = false;
        storage.audioInterval = 2;
    }

    private findStorageLikeInNode(root: Node | null): StorageLike | null {
        if (!root) return null;
        for (const component of root.components) {
            const candidate = component as StorageLike;
            if (
                component.enabled
                && typeof candidate.amount === 'number'
                && typeof candidate.capacity === 'number'
                && candidate.stackAreaNode instanceof Node
            ) {
                return candidate;
            }
        }
        for (const child of root.children) {
            const result = this.findStorageLikeInNode(child);
            if (result) return result;
        }
        return null;
    }

    private findCornStoragePointInNode(root: Node | null): CornStoragePoint | null {
        if (!root) return null;
        const storage = root.getComponent(CornStoragePoint);
        if (storage) return storage;
        for (const child of root.children) {
            const result = this.findCornStoragePointInNode(child);
            if (result) return result;
        }
        return null;
    }

    private resolveSellAnchor(): Node | null {
        const scene = this.node.scene;
        let moduleRoot: Node | null = this.node.parent;
        while (moduleRoot && moduleRoot !== scene) {
            if (moduleRoot.name === 'Finish' || moduleRoot.name === 'Finish-001') {
                return moduleRoot.getChildByName('Sell1');
            }
            moduleRoot = moduleRoot.parent;
        }
        return null;
    }

    private resolveModuleRoot(): Node | null {
        const scene = this.node.scene;
        let moduleRoot: Node | null = this.node.parent;
        while (moduleRoot && moduleRoot !== scene) {
            if (moduleRoot.name === 'Finish' || moduleRoot.name === 'Finish-001') {
                return moduleRoot;
            }
            moduleRoot = moduleRoot.parent;
        }
        return null;
    }

    private resolveLocalCoinAnchor(): Node | null {
        return this.resolveModuleRoot()?.getChildByName('CoinPlace') ?? null;
    }

    private resolveCoinVisualCenter(anchor: Node): Vec3 {
        const visual = anchor.getChildByName('tubiao_02_chaopiao-001') ?? anchor.children[0] ?? null;
        return visual?.position.clone() ?? new Vec3();
    }

    private ensureLocalCoinDropArea(): CornStoragePoint | null {
        const anchor = this.resolveLocalCoinAnchor();
        if (!anchor) {
            if (!this._reportedMissingCoinStorage) {
                console.error('CornCustomerScheduler: local CoinPlace is missing.');
                this._reportedMissingCoinStorage = true;
            }
            return null;
        }

        const dropArea = anchor.getChildByName('CornCoinDropArea') ?? new Node('CornCoinDropArea');
        if (!dropArea.parent) dropArea.setParent(anchor);
        const visualCenter = this.resolveCoinVisualCenter(anchor);
        dropArea.setPosition(visualCenter.x - 0.017, 0.03, visualCenter.z + 0.086);

        const stackArea = dropArea.getChildByName('CoinStack') ?? new Node('CoinStack');
        if (!stackArea.parent) stackArea.setParent(dropArea);
        stackArea.setPosition(0.5, 0, 0);

        const storage = dropArea.getComponent(CornStoragePoint) ?? dropArea.addComponent(CornStoragePoint);
        storage.storageName = `${this.resolveModuleRoot()?.name ?? 'corn'}_coins`;
        storage.capacity = 54;
        storage.layers = 10;
        storage.layerHeight = 0.2;
        storage.resourcePerRow = 2;
        storage.resourceRowSpacing = 1;
        storage.resourcePerCol = 3;
        storage.resourceColSpacing = 0.5;
        storage.stackAreaNode = stackArea;

        const collider = dropArea.getComponent(BoxCollider) ?? dropArea.addComponent(BoxCollider);
        collider.isTrigger = true;
        collider.center.set(0.1, 0, -0.2);
        collider.size.set(2.3, 1, 2.4);

        const collector = dropArea.getComponent(CornCoinCollector) ?? dropArea.addComponent(CornCoinCollector);
        const playerController = this.node.scene?.getComponentInChildren(PlayerController) ?? null;
        const playerCoinBackpack = playerController?.node.getComponent(CoinBackpack) ?? null;
        collector.configure(storage, stackArea, playerController?.node ?? null, playerCoinBackpack);
        this.coinDropArea = dropArea;
        return storage;
    }

    private resolveSellStoragePoint(): CornStoragePoint | null {
        if (this._resolvedSellStoragePoint?.node?.isValid) return this._resolvedSellStoragePoint;
        this._resolvedSellStoragePoint = this.findCornStoragePointInNode(this.resolveSellAnchor());
        if (!this._resolvedSellStoragePoint && !this._reportedMissingSellStorage) {
            console.error('CornCustomerScheduler: local Sell1 CornStoragePoint is missing.');
            this._reportedMissingSellStorage = true;
        }
        return this._resolvedSellStoragePoint;
    }

    private initializeQueue(): void {
        if (!this.startPoint || !this.pointA) return;
        this._queue = this.npcs.filter(npc => npc?.isValid);
        const startPosition = this.startPoint.worldPosition.clone();
        const direction = this.pointA.worldPosition.clone().subtract(startPosition).normalize();
        this._queue.forEach((npc, index) => {
            npc.setWorldPosition(startPosition.clone().add(direction.clone().multiplyScalar(-this.spacing * index)));
            const emoji = this.getNpcEmoji(npc);
            if (emoji) {
                emoji.active = false;
                if (!emoji.getComponent(CameraFacingUI)) emoji.addComponent(CameraFacingUI);
            }
            this.playIdle(npc);
        });
        this.syncQueueMove();
    }

    private syncQueueMove(): void {
        if (this._queue.length === 0 || !this.pointA) return;
        const targetA = this.pointA.worldPosition.clone();
        const head = this._queue[0];
        const travelDistance = Vec3.distance(head.worldPosition, targetA);
        if (travelDistance <= 0.0001) {
            this._waitingAtA = head;
            this.playIdle(head);
            this.tryDispatchFromAToB();
            return;
        }

        const duration = travelDistance / Math.max(this.moveSpeed, 0.01);
        this._queue.forEach((npc, index) => {
            const from = npc.worldPosition.clone();
            const direction = targetA.clone().subtract(from).normalize();
            const target = index === 0
                ? targetA
                : from.clone().add(direction.multiplyScalar(travelDistance));
            this.faceTarget(npc, target);
            this.playTween(npc, target, duration, index === 0 ? () => {
                this._waitingAtA = npc;
                this.playIdle(npc);
                this.tryDispatchFromAToB();
            } : undefined);
        });
    }

    private tryDispatchFromAToB(): void {
        if (!this._waitingAtA || this._loadingAtB || this._bReserved || !this.pointB) return;
        const npc = this._waitingAtA;
        this._waitingAtA = null;
        this._bReserved = true;
        const index = this._queue.indexOf(npc);
        if (index >= 0) this._queue.splice(index, 1);
        this._activeDeparted.add(npc);
        this.syncQueueMove();
        this.moveTo(npc, this.pointB, () => {
            this._loadingAtB = npc;
            this.resetEmoji();
            this.playIdle(npc);
            npc.setRotationFromEuler(Vec3.ZERO);
            void this.tryCollectItem(npc);
        });
    }

    private loadComplete(npc: Node): void {
        this._loadingAtB = null;
        this._bReserved = false;
        this.tryDispatchFromAToB();
        this.playLoadMove(npc);
        this.moveTo(npc, this.pointC, () => {
            this.moveTo(npc, this.pointD, () => {
                this.moveTo(npc, this.startPoint, () => {
                    this._activeDeparted.delete(npc);
                    this.playIdle(npc);
                    this.enqueueAtStart(npc);
                });
            });
        });
    }

    private enqueueAtStart(npc: Node): void {
        if (!this.startPoint || !this.pointA) return;
        const startPosition = this.startPoint.worldPosition.clone();
        const direction = this.pointA.worldPosition.clone().subtract(startPosition).normalize();
        const tail = this._queue[this._queue.length - 1];
        const target = tail
            ? tail.worldPosition.clone().subtract(direction.multiplyScalar(this.spacing))
            : startPosition;
        this.moveToPosition(npc, target, () => {
            this._queue.push(npc);
            if (!this._waitingAtA) this.syncQueueMove();
            else this.playIdle(npc);
        });
    }

    private async tryCollectItem(npc: Node): Promise<void> {
        const targetStoragePoint = this.resolveSellStoragePoint();
        const npcStoragePoint = this.ensureNpcCarryStorage(npc);
        if (!targetStoragePoint || !npcStoragePoint) return;
        npcStoragePoint.capacity = 4;
        this.showFillTipForNpc(npc);
        let stalledDuration = 0;

        while (this.enabled && npc.isValid) {
            if (targetStoragePoint.amount > 0 && npcStoragePoint.hasSpace(1)) {
                const resource = targetStoragePoint.removeResource(4);
                let moved = resource
                    ? this.movePurchasedProductToCustomer(resource, npcStoragePoint)
                    : false;
                if (!moved) {
                    stalledDuration += this.collectInterval * 0.5;
                    if (stalledDuration >= 1) {
                        const stalledResource = targetStoragePoint.releaseStalledResource();
                        moved = stalledResource
                            ? this.movePurchasedProductToCustomer(stalledResource, npcStoragePoint)
                            : false;
                        stalledDuration = 0;
                    }
                } else {
                    stalledDuration = 0;
                }

                if (moved) {
                    this.updateFillTip(npcStoragePoint.amount, npcStoragePoint.capacity);
                    this.playLoad(npc);
                }

                if (npcStoragePoint.amount >= npcStoragePoint.capacity) {
                    await this.delay(0.3);
                    if (this.fillTip?.isValid) {
                        AnimationLibrary.scaleFadeOut(this.fillTip, 0.1, 0, () => this.hideFillTip(true)).start();
                    }
                    await this.delay(0.2);
                    this.loadComplete(npc);
                    this.dropCoins();
                    await this.delay(1);
                    npcStoragePoint.clearStorage();
                    const emoji = this.getNpcEmoji(npc);
                    if (emoji) emoji.active = true;
                    return;
                }
            }
            await this.delay(Math.max(0.01, this.collectInterval * 0.5));
        }
    }

    /**
     * Normalize corn product local scale before the customer carry animation.
     * Sell-slot ancestry can leave a non-unit local scale that looks correct on
     * the tray but wrong once reparented onto the customer body mount.
     */
    private movePurchasedProductToCustomer(
        resource: Node,
        npcStoragePoint: CornStoragePoint,
    ): boolean {
        if (!resource?.isValid) return false;
        resource.setScale(Vec3.ONE);
        return npcStoragePoint.addResource(resource, 4, Vec3.ZERO);
    }

    private delay(seconds: number): Promise<void> {
        return new Promise(resolve => this.scheduleOnce(resolve, seconds));
    }

    private updateFillTip(carried: number, capacity: number): void {
        if (!this.fillTip) return;
        const fill = this.fillTip.getChildByName('fill')?.getComponent(Sprite);
        const amount = this.fillTip.getChildByName('amount')?.getComponent(Label);
        if (fill) fill.fillRange = carried / Math.max(1, capacity);
        if (amount) amount.string = String(Math.max(0, this._customerCapacity - carried));
    }

    private showFillTipForNpc(npc: Node): void {
        if (!this.fillTip) return;
        this._fillTipTargetNpc = npc;
        this.fillTip.active = true;
        this.updateFillTipPosition();
        AnimationLibrary.scaleFadeIn(this.fillTip, 0.1, 1, null).start();
    }

    private updateFillTipPosition(): void {
        if (!this.fillTip?.active || !this._fillTipTargetNpc?.isValid) return;
        this._fillTipOffset.set(0, this.fillTipHeadOffsetY, 0);
        Vec3.add(this._fillTipWorldPosition, this._fillTipTargetNpc.worldPosition, this._fillTipOffset);
        this.fillTip.setWorldPosition(this._fillTipWorldPosition);
    }

    private hideFillTip(resetContent = false): void {
        if (!this.fillTip) return;
        if (resetContent) this.updateFillTip(0, this._customerCapacity);
        this._fillTipTargetNpc = null;
        this.fillTip.active = false;
    }

    private resetEmoji(): void {
        this.hideFillTip();
        for (const npc of this.npcs) {
            const emoji = this.getNpcEmoji(npc);
            if (emoji) emoji.active = false;
        }
    }

    private getNpcEmoji(npc: Node): Node | null {
        return npc?.isValid ? npc.getChildByName('emoji') : null;
    }

    private dropCoins(): void {
        const coinStorage = this.ensureLocalCoinDropArea();
        if (!coinStorage || !this.coinPrefab) return;
        for (let i = 0; i < this.coinReward; i++) {
            this.scheduleOnce(() => {
                if (!coinStorage.hasSpace(1)) return;
                this.createCoin(coinStorage);
            }, i * 0.1);
        }
    }

    private createCoin(storage: CornStoragePoint): boolean {
        if (!this.coinPrefab) return false;
        const coin = instantiate(this.coinPrefab);
        coin.setScale(Vec3.ZERO);
        if (!storage.addResource(coin, 1)) {
            coin.destroy();
            return false;
        }
        tween(coin)
            .to(0.3, { scale: new Vec3(1.17, 1.17, 1.17) }, { easing: 'bounceOut' })
            .to(0.2, { scale: Vec3.ONE }, { easing: 'bounceOut' })
            .start();
        return true;
    }

    private moveTo(npc: Node, targetNode: Node | null, onComplete?: () => void): void {
        if (!targetNode) {
            onComplete?.();
            return;
        }
        this.moveToPosition(npc, targetNode.worldPosition.clone(), onComplete);
    }

    private moveToPosition(npc: Node, target: Vec3, onComplete?: () => void): void {
        const duration = Vec3.distance(npc.worldPosition, target) / Math.max(this.moveSpeed, 0.01);
        this.faceTarget(npc, target);
        this.playTween(npc, target, duration, onComplete);
    }

    private playTween(npc: Node, target: Vec3, duration: number, onComplete?: () => void): void {
        this.stopTween(npc);
        this.playMove(npc);
        const movement = tween(npc)
            .to(duration, { worldPosition: target })
            .call(() => {
                this._runningTweens.delete(npc);
                if (onComplete) onComplete();
                else this.playIdle(npc);
            })
            .start();
        this._runningTweens.set(npc, movement);
    }

    private stopTween(npc: Node): void {
        const movement = this._runningTweens.get(npc);
        if (!movement) return;
        movement.stop();
        this._runningTweens.delete(npc);
    }

    private stopAllTweens(): void {
        for (const movement of this._runningTweens.values()) movement.stop();
        this._runningTweens.clear();
    }

    private faceTarget(npc: Node, target: Vec3): void {
        if (Vec3.distance(npc.worldPosition, target) > 0.0001) npc.lookAt(target);
    }

    private getAnimation(npc: Node): Animation | null {
        return npc.getComponentInChildren(Animation);
    }

    private playMove(npc: Node): void {
        const animation = this.getAnimation(npc);
        if (animation && this.moveAnim) animation.play(this.moveAnim);
    }

    private playIdle(npc: Node): void {
        const animation = this.getAnimation(npc);
        if (animation && this.idleAnim) animation.play(this.idleAnim);
    }

    private playLoad(npc: Node): void {
        const animation = this.getAnimation(npc);
        if (animation && this.loadAnim) animation.play(this.loadAnim);
    }

    private playLoadMove(npc: Node): void {
        const animation = this.getAnimation(npc);
        if (animation && this.loadMoveAnim) animation.play(this.loadMoveAnim);
        this.resetEmoji();
    }
}
