import { _decorator, Component, Node, Vec3, Tween, tween, Animation, Camera, Prefab, instantiate, Sprite, Label } from 'cc';
import { PlayerDetectionZone } from './PlayerDetectionZone';
import { StoragePoint } from './Resource/StoragePoint';
import { ResourceManager } from './Resource/ResourceManager';
import { AnimationLibrary } from './AnimationLibrary';
import { AnimationController } from './AnimationController';
import { CameraFacingUI } from './CameraFacingUI';
const { ccclass, property, executionOrder } = _decorator;

@ccclass('NPCScheduler')
@executionOrder(200)
export class NPCScheduler extends Component {

    @property({ type: PlayerDetectionZone, group: { name: '区域' }, tooltip: '当前区对应的卖货检测区' })
    sellZone: PlayerDetectionZone = null!;

    @property({ type: Node})
    fillTip: Node = null!;
    @property({ group: { name: '参数' }, tooltip: '购买提示框相对 NPC 头顶的高度偏移' })
    fillTipHeadOffsetY: number = 2.4;

    @property({ type: Prefab, group: { name: '金币预制件' } })
    coinPrefab: Prefab = null!;
    @property({ type: Node, group: { name: '金币投放区域' } })
    coinDropArea: Node = null!;
    @property({ group: { name: '参数' } })
    coinReward: number = 5;

    @property({ type: Node, group: { name: '路径点' } })
    startPoint: Node = null!; // 初始位置点（队伍集合处）
    @property({ type: Node, group: { name: '路径点' } })
    pointA: Node = null!;
    @property({ type: Node, group: { name: '路径点' } })
    pointB: Node = null!;
    @property({ type: Node, group: { name: '路径点' } })
    pointC: Node = null!;
    @property({ type: Node, group: { name: '路径点' } })
    pointD: Node = null!;

    @property({ type: [Node], group: { name: 'NPC' } })
    npcs: Node[] = [];

    @property({ group: { name: '参数' } })
    moveSpeed: number = 2.0; // 单位: 米/秒
    @property({ group: { name: '参数' } })
    spacing: number = 1.2; // 队伍内前后间距
    @property({ group: { name: '参数' } })
    loadDuration: number = 2.0; // B点装货时间（秒）
    @property({ group: { name: '参数' } })
    collectInterval: number = 1.0; // 收集间隔时间（秒）

    @property({ group: { name: '动画' } })
    moveAnim: string = 'move';
    @property({ group: { name: '动画' } })
    idleAnim: string = 'idle';
    @property({ group: { name: '动画' } })
    loadAnim: string = 'load';
    @property({ group: { name: '动画' } })
    loadMoveAnim: string = 'loadMove';

    private queue: Node[] = []; // 当前队伍（在起点处跟随移动）
    private waitingAtA: Node | null = null; // 在A点等待的NPC
    private loadingAtB: Node | null = null; // 正在B点装货的NPC
    private bReserved: boolean = false; // 从A出发去B的占用预定（含在途与装货）
    private activeDeparted: Set<Node> = new Set(); // 已脱队执行A->B->C->D->Start链路
    private runningTweens: Map<Node, Tween<Node>> = new Map();
    private _queueDirection: Vec3 | null = null;
    private _fillTipTargetNpc: Node | null = null;
    private _resolvedSellStoragePoint: StoragePoint | null = null;
    private readonly _fillTipOffset: Vec3 = new Vec3();
    private readonly _fillTipWorldPosition: Vec3 = new Vec3();

    protected onEnable(): void {
        this._resolvedSellStoragePoint = null;
        this._queueDirection = null;
        this.setupFillTipFacing();
    }

    protected start(): void {
        this.initializeQueue();
    }

    protected onDisable(): void {
        this.stopAllTweens();
    }

    private setupFillTipFacing(): void {
        if (!this.fillTip) {
            return;
        }

        if (!this.fillTip.getComponent(CameraFacingUI)) {
            this.fillTip.addComponent(CameraFacingUI);
        }

        const floatingAnimation = this.fillTip.getComponent(AnimationController);
        if (floatingAnimation) {
            floatingAnimation.stopAnimation();
            floatingAnimation.enabled = false;
        }

        this.fillTip.setPosition(0, 0.95, 10.307);
        this.fillTip.setScale(0.42, 0.42, 0.42);
        this.fillTip.active = false;
        this._fillTipTargetNpc = null;

        for (const child of this.fillTip.children) {
            child.setRotationFromEuler(0, 0, 0);
        }
    }

    // 初始化：从购买位 B 穿过等待位 A，向后排成一条直线
    private initializeQueue(): void {
        if (!this.startPoint || !this.pointA || !this.pointB) return;
        this._queueDirection = this.resolveQueueDirection();
        this.queue = [...this.npcs];
        for (let i = 0; i < this.queue.length; i++) {
            const npc = this.queue[i];
            npc.setWorldPosition(this.getQueueSlot(i));
        }
        this.syncQueueMove(true);
    }

    private getQueueSlot(index: number): Vec3 {
        const authoredDirection = this.pointA.worldPosition.clone().subtract(this.pointB.worldPosition);
        const queueDirection = (this._queueDirection ?? authoredDirection.clone().normalize()).clone();
        const distanceBehindBuyer = authoredDirection.length() + this.spacing * index;
        return this.pointB.worldPosition.clone()
            .add(queueDirection.multiplyScalar(distanceBehindBuyer));
    }

    private resolveQueueDirection(): Vec3 {
        const authoredDirection = this.pointA.worldPosition.clone().subtract(this.pointB.worldPosition);
        const queueDirection = authoredDirection.clone().normalize();
        const gameCamera = this.resolveGameCamera();
        if (gameCamera) {
            const buyerPosition = this.pointB.worldPosition.clone();
            const buyerScreenPosition = gameCamera.worldToScreen(buyerPosition);
            const sameScreenColumnRay = gameCamera.screenPointToRay(
                buyerScreenPosition.x,
                buyerScreenPosition.y - 100,
            );
            if (Math.abs(sameScreenColumnRay.d.y) > 0.0001) {
                const groundDistance = (buyerPosition.y - sameScreenColumnRay.o.y)
                    / sameScreenColumnRay.d.y;
                const screenVerticalGroundPoint = sameScreenColumnRay.o.clone()
                    .add(sameScreenColumnRay.d.clone().multiplyScalar(groundDistance));
                const screenVerticalDirection = screenVerticalGroundPoint.subtract(buyerPosition);
                screenVerticalDirection.y = 0;
                if (screenVerticalDirection.length() > 0.0001) {
                    screenVerticalDirection.normalize();
                    if (Vec3.dot(screenVerticalDirection, authoredDirection) < 0) {
                        screenVerticalDirection.multiplyScalar(-1);
                    }
                    queueDirection.set(screenVerticalDirection);
                }
            }
        }
        return queueDirection;
    }

    private resolveGameCamera(): Camera | null {
        const cameras = this.node.scene?.getComponentsInChildren(Camera) ?? [];
        return cameras.find(camera => camera.node.name === 'Main Camera')
            ?? cameras.find(camera => (camera.visibility & this.node.layer) !== 0)
            ?? cameras[0]
            ?? null;
    }

    // 同步队伍移动与等待A点逻辑（所有NPC同时移动，同时停止）
    private syncQueueMove(initial = false): void {
        if (this.queue.length === 0) return;
        const aPos = this.getQueueSlot(0);
        const head = this.queue[0];
        const headDist = Vec3.distance(head.worldPosition, aPos);
        if (headDist <= 0.0001) {
            // 头部已在A点，直接处理A点逻辑
            this.waitingAtA = head;
            this.tryDispatchFromAToB();
            return;
        }
        const duration = headDist / Math.max(this.moveSpeed, 0.01);

        // 为队伍内所有成员设置在相同时间内前进同样的距离（headDist），从而同时移动并同时停止
        for (let i = 0; i < this.queue.length; i++) {
            const npc = this.queue[i];
            const target = this.getQueueSlot(i);
            if (Vec3.distance(npc.worldPosition, target) < 0.0001) {
                // 已在A点（极少数情况）
                if (i === 0) {
                    this.waitingAtA = npc;
                    this.tryDispatchFromAToB();
                }
                continue;
            }
            if (i === 0) {
                // 朝向A
                this.faceTarget(npc, aPos);
                this.playTween(npc, aPos, duration, () => {
                    // 队首到达A：（队伍已在同一时刻停止）
                    this.waitingAtA = npc;
                    this.playIdle(npc);
                    this.tryDispatchFromAToB();
                });
            } else {
                // 朝向与自己的目标
                this.faceTarget(npc, target);
                this.playTween(npc, target, duration);
            }
        }
    }

    private tryDispatchFromAToB(): void {
        if (!this.waitingAtA) return;
        if (this.loadingAtB) return; // B被占用（装货中），继续等待
        if (this.bReserved) return; // B已被预定（有人在途），继续等待

        // A点NPC脱队去B点
        const npc = this.waitingAtA;
        this.waitingAtA = null;
        this.bReserved = true; // 立即预定B，避免并发派遣
        // 从队伍中移除
        const idx = this.queue.indexOf(npc);
        if (idx >= 0) this.queue.splice(idx, 1);
        this.activeDeparted.add(npc);
        // 队伍内依次前移向A点，直到有NPC到达A点时队伍停止
        this.syncQueueMove();
        // 派遣到B
        const bPos = this.pointB.worldPosition.clone();
        const dist = Vec3.distance(npc.worldPosition, bPos);
        const t = dist / Math.max(this.moveSpeed, 0.01);
        // 朝向B
        this.faceTarget(npc, bPos);
        this.playTween(npc, bPos, t, () => {
            // 到达B：装货
            this.loadingAtB = npc;
            this.hideFillTip();
            this.playIdle(npc);
            npc.eulerAngles = new Vec3(0, 0, 0);
            this.tryCollectItem(npc);
        });
    }

    private loadAtB(npc: Node): Promise<void> {
        return new Promise((resolve) => {
            tween(npc).delay(this.loadDuration).call(() => resolve()).start();
        });
    }

    private loadComplete(npc: Node): void {
        // 装货完成，释放B预定并尝试派遣下一位
        this.loadingAtB = null;
        this.bReserved = false;
        this.tryDispatchFromAToB();
        // B->C->D->Start：每段移动前朝向目标
        this.moveTo(npc, this.pointC, () => {
            this.moveTo(npc, this.pointD, () => {
                this.moveTo(npc, this.startPoint, () => {
                    // 回到起点：重新入队
                    this.activeDeparted.delete(npc);
                    this.playIdle(npc);
                    this.enqueueAtStart(npc);
                    // npc.getComponentInChildren(StoragePoint).clearStorage();
                }, true);
            }, true);
        }, true);
    }

    private moveChain(npc: Node, points: Node[], onComplete?: () => void): void {
        if (points.length === 0) {
            onComplete && onComplete();
            return;
        }
        const [first, ...rest] = points;
        const target = first.worldPosition.clone();
        const dist = Vec3.distance(npc.worldPosition, target);
        const t = dist / Math.max(this.moveSpeed, 0.01);
        this.playTween(npc, target, t, () => this.moveChain(npc, rest, onComplete));
    }

    private moveTo(
        npc: Node,
        targetNode: Node,
        onComplete?: () => void,
        carrying = false,
    ): void {
        const target = targetNode.worldPosition.clone();
        const dist = Vec3.distance(npc.worldPosition, target);
        const t = dist / Math.max(this.moveSpeed, 0.01);
        // 移动前朝向目标
        this.faceTarget(npc, target);
        this.playTween(npc, target, t, onComplete, carrying);
    }

    private moveToPosition(npc: Node, target: Vec3, onComplete?: () => void): void {
        const dist = Vec3.distance(npc.worldPosition, target);
        const t = dist / Math.max(this.moveSpeed, 0.01);
        this.faceTarget(npc, target);
        this.playTween(npc, target, t, onComplete);
    }

    private enqueueAtStart(npc: Node): void {
        const target = this.getQueueSlot(this.queue.length);
        // 先移动到队尾后方 spacing 处，再加入队列
        this.moveToPosition(npc, target, () => {
            this.queue.push(npc);
            if (!this.waitingAtA) {
                this.syncQueueMove();
            } else {
                this.playIdle(npc);
            }
        });
    }

    private playTween(
        npc: Node,
        target: Vec3,
        duration: number,
        onComplete?: () => void,
        carrying = false,
    ): void {
        this.stopTween(npc);
        // 播放移动动画
        carrying ? this.playLoadMove(npc) : this.playMove(npc);
        const tw = tween(npc).to(duration, { worldPosition: target }).call(() => {
            this.runningTweens.delete(npc);
            if (onComplete) {
                onComplete();
            } else {
                this.playIdle(npc);
            }
        }).start();

        this.runningTweens.set(npc, tw);
    }

    private stopTween(npc: Node): void {
        const tw = this.runningTweens.get(npc);
        if (tw) {
            // @ts-ignore
            tw.stop();
            this.runningTweens.delete(npc);
        }
    }

    private stopQueueTweensExcept(except?: Node): void {
        for (const member of this.queue) {
            if (member === except) continue;
            this.stopTween(member);
        }
    }

    private stopAllTweens(): void {
        for (const tw of this.runningTweens.values()) {
            // @ts-ignore
            tw.stop();
        }
        this.runningTweens.clear();
    }

    private faceTarget(npc: Node, target: Vec3): void {
        const from = npc.worldPosition.clone();
        if (Vec3.distance(from, target) > 0.0001) {
            npc.lookAt(target);
        }
    }

    private getAnimation(npc: Node): Animation | null {
        return npc.getComponentInChildren(Animation);
    }

    private playMove(npc: Node): void {

        const anim = this.getAnimation(npc);
        if (!anim) return;
        if (this.moveAnim) {
            const state = anim.play(this.moveAnim);
            if (state) state.speed = 2;
        }
    }

    private playIdle(npc: Node): void {
        const anim = this.getAnimation(npc);
        if (!anim) return;
        if (this.idleAnim) anim.play(this.idleAnim);
    }

    private playLoad(npc: Node): void {
        const anim = this.getAnimation(npc);
        if (!anim) return;
        if (this.loadAnim) anim.play(this.loadAnim);
    }

    private playLoadMove(npc: Node): void {
        const anim = this.getAnimation(npc);
        if (!anim) return;
        if (this.loadMoveAnim) {
            const state = anim.play(this.loadMoveAnim);
            if (state) state.speed = 2;
        }
        this.hideFillTip();
    }

    protected update(): void {
        this.updateFillTipPosition();
    }

    private updateFillTipPosition(): void {
        if (!this.fillTip || !this.fillTip.active || !this._fillTipTargetNpc || !this._fillTipTargetNpc.isValid) {
            return;
        }

        this._fillTipOffset.set(0, this.fillTipHeadOffsetY, 0);
        Vec3.add(this._fillTipWorldPosition, this._fillTipTargetNpc.worldPosition, this._fillTipOffset);
        this.fillTip.setWorldPosition(this._fillTipWorldPosition);
    }

    private showFillTipForNpc(npc: Node): void {
        if (!this.fillTip) {
            return;
        }

        this._fillTipTargetNpc = npc;
        this.fillTip.active = true;
        this.updateFillTipPosition();
        AnimationLibrary.scaleFadeIn(this.fillTip, 0.1, 1, null).start();
    }

    private hideFillTip(resetContent: boolean = false): void {
        if (!this.fillTip) {
            return;
        }

        if (resetContent) {
            const fill = this.fillTip.getChildByName('fill')?.getComponent(Sprite) ?? null;
            const amount = this.fillTip.getChildByName('amount')?.getComponent(Label) ?? null;
            if (fill) {
                fill.fillRange = 0;
            }
            if (amount) {
                amount.string = '4';
            }
        }

        this._fillTipTargetNpc = null;
        this.fillTip.active = false;
    }

    private findStoragePointInNode(root: Node | null): StoragePoint | null {
        if (!root) {
            return null;
        }

        const storagePoint = root.getComponent(StoragePoint);
        if (storagePoint) {
            return storagePoint;
        }

        for (const child of root.children) {
            const result = this.findStoragePointInNode(child);
            if (result) {
                return result;
            }
        }

        return null;
    }

    private ensureSellStoragePoint(anchor: Node | null): StoragePoint | null {
        if (!anchor) {
            return null;
        }

        const existingStoragePoint = this.findStoragePointInNode(anchor);
        if (existingStoragePoint) {
            return existingStoragePoint;
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

    private resolveSellAnchor(): Node | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        // Side-field customers must never consume the forest or the other
        // field's stock. Finish/Finish-001 are independent module roots.
        let moduleRoot: Node | null = this.node.parent;
        while (moduleRoot && moduleRoot !== scene) {
            if (moduleRoot.name === 'Finish' || moduleRoot.name === 'Finish-001') {
                const localSell = moduleRoot.getChildByName('Sell1');
                if (localSell) {
                    return localSell;
                }
                break;
            }
            moduleRoot = moduleRoot.parent;
        }

        // The original forest scheduler owns the unique central Sell node.
        const centralSell = scene.getChildByName('LandObj')?.getChildByName('Sell') ?? null;
        if (centralSell) {
            return centralSell;
        }

        const targetPosition = this.pointB?.worldPosition ?? this.node.worldPosition;
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

        let closestAnchor: Node | null = null;
        let closestDistance = Number.MAX_VALUE;
        for (const anchor of anchors) {
            const distance = Vec3.distance(targetPosition, anchor.worldPosition);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestAnchor = anchor;
            }
        }

        return closestAnchor;
    }

    private resolveSellZone(): PlayerDetectionZone | null {
        return this.sellZone;
    }

    private resolveSellStoragePoint(): StoragePoint | null {
        if (this._resolvedSellStoragePoint?.node?.isValid) {
            return this._resolvedSellStoragePoint;
        }

        this._resolvedSellStoragePoint = this.ensureSellStoragePoint(this.resolveSellAnchor());
        return this._resolvedSellStoragePoint;
    }

    /**
     * 尝试收集物品
     */
    private async tryCollectItem(npc:Node): Promise<void> {
        const targetStoragePoint = this.resolveSellStoragePoint();
        if (!targetStoragePoint) {
            return;
        }

        var npcStoragePoint = npc.getComponentInChildren(StoragePoint);
        if (!npcStoragePoint) {
            return;
        }

        this.showFillTipForNpc(npc);

        const fill = this.fillTip.getChildByName('fill').getComponent(Sprite);
        const amount = this.fillTip.getChildByName('amount').getComponent(Label);
        let stalledDuration = 0;

        while(true) {
            // this.dropCoins();
            if(targetStoragePoint.amount > 0){
                let moved = await ResourceManager.MoveResource(targetStoragePoint, npcStoragePoint, false, 4, new Vec3(0, 0, 0));

                if (!moved) {
                    stalledDuration += this.collectInterval * 0.5;
                    if (stalledDuration >= 1 && npcStoragePoint.hasSpace(1)) {
                        const stalledResource = targetStoragePoint.releaseStalledResource();
                        moved = stalledResource
                            ? npcStoragePoint.addResource(stalledResource, 4, Vec3.ZERO)
                            : false;
                        stalledDuration = 0;
                    }
                } else {
                    stalledDuration = 0;
                }

                fill.fillRange = npcStoragePoint.amount / npcStoragePoint.capacity;
                amount.string = (4 - npcStoragePoint.amount).toString();

                this.playLoad(npc);

                if(npcStoragePoint.amount >= npcStoragePoint.capacity){
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    AnimationLibrary.scaleFadeOut(this.fillTip, 0.1, 0, () => {
                        this.hideFillTip(true);
                    }).start();
                    await new Promise((resolve) => setTimeout(resolve, 200));

                    this.loadComplete(npc);
                    
                    this.dropCoins();
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    npcStoragePoint.clearStorage();
                    return;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, this.collectInterval * 500));
        }
    }

    /**
     * 投放金币
     */
    private dropCoins(): void {
        if (!this.coinPrefab || !this.coinDropArea) {
            console.error('金币预制件或投放区域未设置');
            return;
        }

        // var totalCoins = this.coinDropArea.children.length;
        // var coinStackCount = 0;
        var coinStoragePoint = this.coinDropArea.getComponent(StoragePoint);

        for (let i = 0; i < this.coinReward; i++) {
            this.scheduleOnce(() => {
                if(coinStoragePoint.amount >= coinStoragePoint.capacity) return;
                this.createCoin(coinStoragePoint.amount);
                coinStoragePoint.amount++;
            }, i * 0.1); // 间隔投放
        }
    }

    /**
 * 创建金币
 */
    private createCoin(coinStackCount: number): void {
        const coin = instantiate(this.coinPrefab);
        //coin.setParent(this.coinDropArea);

        //this.coinDropArea.getComponent(StoragePoint).addResource(coin, 2, false);
        // this._coinStackCount++;
        // console.log(`投放金币，当前金币数: ${this._coinStackCount}`);

        //return;
        
        // 计算金币堆叠位置
        const stackPos = this.calculateCoinStackPosition(coinStackCount);
        
        // 设置父节点和位置
        coin.setParent(this.coinDropArea);
        coin.setPosition(stackPos);
        
        // 添加掉落动画
        this.animateCoinDrop(coin, stackPos);
        
        // coinStackCount++;
        // console.log(`投放金币，当前金币数: ${this._coinStackCount}`);
    }

        /**
     * 计算金币堆叠位置（行列层排列）
     */
        private calculateCoinStackPosition(index: number): Vec3 {
            const position = new Vec3();
            
            var coinStackRows = 3;
            var coinStackColumns = 2;
            var coinRowSpacing = 0.5;
            var coinColumnSpacing = 1; 
            var coinLayerHeight = 0.2;

            // 计算当前金币在行列层中的位置
            const coinsPerLayer = coinStackRows * coinStackColumns;
            const layer = Math.floor(index / coinsPerLayer);
            const indexInLayer = index % coinsPerLayer;
            const row = Math.floor(indexInLayer / coinStackColumns);
            const column = indexInLayer % coinStackColumns;
            
            // 计算实际位置（以投放区域中心为原点）
            const totalRowWidth = (coinStackRows - 1) * coinRowSpacing;
            const totalColumnWidth = (coinStackColumns - 1) * coinColumnSpacing;
            
            position.x = column * coinColumnSpacing - totalColumnWidth * 0.5;
            position.z = row * coinRowSpacing - totalRowWidth * 0.5;
            position.y = layer * coinLayerHeight;
            
            // console.log(`金币 ${index}: 第${layer}层, 第${row}行, 第${column}列 → 位置(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
            
            return position;
        }
    
        /**
         * 金币掉落动画
         */
        private animateCoinDrop(coin: Node, targetPosition: Vec3): void {
            // 从高处掉落
            const startPos = targetPosition.clone();
            //startPos.y += 3.0;
            coin.setPosition(startPos);
            coin.setScale(0, 0, 0);
    
            // 掉落动画
            var tweenAnim = tween(coin)
    
                .to(0.3, {scale: new Vec3(1.17, 1.17, 1.17) }, {
                    easing: 'bounceOut'
                })
                .to(0.2, {scale: new Vec3(1, 1, 1) }, {
                    easing: 'bounceOut'
                })
                .call(() => {
                    ResourceManager.tweenDicCoin.delete(coin);
                });
    
            ResourceManager.tweenDicCoin.set(coin, tweenAnim);
            tweenAnim.start();
        }
        
}


