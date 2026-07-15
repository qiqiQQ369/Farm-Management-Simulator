import { _decorator, Component, Node, Vec3, Tween, tween, Animation, find, Prefab, instantiate, Sprite, Label, Collider, ITriggerEvent } from 'cc';
import { PlayerDetectionZone } from './PlayerDetectionZone';
import { StoragePoint } from './Resource/StoragePoint';
import { ResourceManager } from './Resource/ResourceManager';
import { AnimationLibrary } from './AnimationLibrary';
import { WoodBackpack } from './WoodBackpack';
import { CameraFacingUI } from './CameraFacingUI';
const { ccclass, property } = _decorator;

@ccclass('NPCScheduler')
export class NPCScheduler extends Component {

    private readonly emojiByNpc = new Map<Node, Node>();

    @property({ type: Node})
    fillTip: Node = null!;

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

    private intervalId: number = -1;
    private checkInterval: number = 3;
    private checkTimer: number = 0;

    private queue: Node[] = []; // 当前队伍（在起点处跟随移动）
    private waitingAtA: Node | null = null; // 在A点等待的NPC
    private loadingAtB: Node | null = null; // 正在B点装货的NPC
    private bReserved: boolean = false; // 从A出发去B的占用预定（含在途与装货）
    private activeDeparted: Set<Node> = new Set(); // 已脱队执行A->B->C->D->Start链路
    private runningTweens: Map<Node, Tween<Node>> = new Map();

    protected onEnable(): void {
        this.initializeQueue();
    }

    protected onDisable(): void {
        this.stopAllTweens();
    }

    protected start(): void {
        this.setupCollisionDetection();
    }

    // 初始化：将所有NPC放置到起点并按间距沿着 start->A 的方向排布
    private initializeQueue(): void {
        if (!this.startPoint || !this.pointA) return;
        this.queue = [...this.npcs];
        const startPos = this.startPoint.worldPosition.clone();
        const dir = this.pointA.worldPosition.clone().subtract(startPos).normalize();
        for (let i = 0; i < this.queue.length; i++) {
            const npc = this.queue[i];
            const offset = dir.clone().multiplyScalar(-this.spacing * i);
            const pos = startPos.clone().add(offset);
            npc.setWorldPosition(pos);
            const emoji = npc.getChildByName('emoji');
            if (emoji) {
                this.emojiByNpc.set(npc, emoji);
                emoji.active = false;
                if (!emoji.getComponent(CameraFacingUI)) {
                    emoji.addComponent(CameraFacingUI);
                }
            }
        }
        this.syncQueueMove(true);
    }

    // 同步队伍移动与等待A点逻辑（所有NPC同时移动，同时停止）
    private syncQueueMove(initial = false): void {
        if (this.queue.length === 0) return;
        const aPos = this.pointA.worldPosition.clone();
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
            const from = npc.worldPosition.clone();
            const dir = aPos.clone().subtract(from);
            if (dir.length() < 0.0001) {
                // 已在A点（极少数情况）
                if (i === 0) {
                    this.waitingAtA = npc;
                    this.tryDispatchFromAToB();
                }
                continue;
            }
            dir.normalize();
            const target = from.clone().add(dir.multiplyScalar(headDist));
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
            this.resetEmoji();
            //npc.getChildByName("emoji").active = false;
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
        this.playLoadMove(npc);
        // B->C->D->Start：每段移动前朝向目标
        this.moveTo(npc, this.pointC, () => {
            this.moveTo(npc, this.pointD, () => {
                this.moveTo(npc, this.startPoint, () => {
                    // 回到起点：重新入队
                    this.activeDeparted.delete(npc);
                    this.playIdle(npc);
                    this.enqueueAtStart(npc);
                    // npc.getComponentInChildren(StoragePoint).clearStorage();
                });
            });
        });
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

    private moveTo(npc: Node, targetNode: Node, onComplete?: () => void): void {
        const target = targetNode.worldPosition.clone();
        const dist = Vec3.distance(npc.worldPosition, target);
        const t = dist / Math.max(this.moveSpeed, 0.01);
        // 移动前朝向目标
        this.faceTarget(npc, target);
        this.playTween(npc, target, t, onComplete);
    }

    private moveToPosition(npc: Node, target: Vec3, onComplete?: () => void): void {
        const dist = Vec3.distance(npc.worldPosition, target);
        const t = dist / Math.max(this.moveSpeed, 0.01);
        this.faceTarget(npc, target);
        this.playTween(npc, target, t, onComplete);
    }

    private enqueueAtStart(npc: Node): void {
        const startPos = this.startPoint.worldPosition.clone();
        const dir = this.pointA.worldPosition.clone().subtract(startPos).normalize();
        const tail = this.queue[this.queue.length - 1];
        const target = tail ? tail.worldPosition.clone().subtract(dir.multiplyScalar(this.spacing)) : startPos;
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

    private playTween(npc: Node, target: Vec3, duration: number, onComplete?: () => void): void {
        this.stopTween(npc);
        // 播放移动动画
        this.playMove(npc);
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

        // if(npc != this.waitingAtA && npc != this.loadingAtB)
        // npc.getChildByName("emoji").active = false;

        const anim = this.getAnimation(npc);
        if (!anim) return;
        if (this.moveAnim) anim.play(this.moveAnim);
    }

    private playIdle(npc: Node): void {
        
        // if(npc != this.loadingAtB)
        //     npc.getChildByName("emoji").active = this.checkEmoji();

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
        if (this.loadMoveAnim) anim.play(this.loadMoveAnim);
        this.resetEmoji();
    }

    protected update(dt: number): void {
        this.checkEmojiUpdate(dt);
    }

    private checkEmojiUpdate(dt:number): void{
        this.checkTimer += dt;
        if(this.checkTimer < this.checkInterval) return;
        this.checkTimer = 0;

        this.checkAllNpc();
    }

    private resetEmoji(): void {
        this.checkTimer = 0;
        for(let i = 0; i < this.npcs.length; i++){
            var npc = this.npcs[i];
            const emoji = this.getNpcEmoji(npc);
            if (emoji) emoji.active = false;
        }
    }

    private checkEmoji(): boolean {
        var tubiao = find('LandObj/Sell');
        var playerBag = find("Player").getComponent(WoodBackpack).backpackMount.getComponent(StoragePoint);
        var playerDetectionZone = tubiao.getComponent(PlayerDetectionZone);
        var targetStoragePoint = playerDetectionZone.woodStackArea.getComponent(StoragePoint);

        if(playerDetectionZone._isPlayerInZone && (targetStoragePoint.amount > 0 || playerBag.amount > 0))
            return false;
        return true;
    }

    private setupCollisionDetection(): void {
        // var tubiao = find('LandObj/Sell');
        // const collider = tubiao.getComponent(Collider);
        // if (collider) {
        //     collider.on('onTriggerEnter', this.onPlayerEnter, this);
        //     // collider.on('onTriggerExit', this.onPlayerExit, this);
        // } else {
        //     console.warn('PlayerDetectionZone: 未找到Collider组件');
        // }
    }

    private checkAllNpc(): void {
        if(this.waitingAtA == null) return;
        var activeEmoji = this.checkEmoji();
        for(let i = 0; i < this.queue.length; i++){
            var npc = this.queue[i];
            const emoji = this.getNpcEmoji(npc);
            if (emoji) emoji.active = activeEmoji;
        }
    }

    private onPlayerEnter(event: ITriggerEvent): void {
        if(!this.checkEmoji())
            this.resetEmoji();
        // if(!this.checkEmoji())
        // {
        //     clearInterval(this.intervalId);
        //     this.intervalId = -1;
        //     return;
        // }

        // if(this.checkEmoji() && this.intervalId != -1) return;

        // this.intervalId = setInterval(() => {
        //     this.checkAllNpc();
        // }, 3 * 1000);
        // this.checkAllNpc();
    }

    // private onPlayerExit(event: ITriggerEvent): void {
    //     if(this.intervalId != -1) return;

    //     this.intervalId = setInterval(() => {
    //         this.checkAllNpc();
    //     }, 3 * 1000);
    // }

    /**
     * 尝试收集物品
     */
    private async tryCollectItem(npc:Node): Promise<void> {

        var tubiao = find('LandObj/Sell');
        var playerDetectionZone = tubiao.getComponent(PlayerDetectionZone);
        
        var npcStoragePoint = npc.getComponentInChildren(StoragePoint);

        var targetStoragePoint = playerDetectionZone.woodStackArea.getComponent(StoragePoint);

        AnimationLibrary.scaleFadeIn(this.fillTip, 0.1, 1, null).start();

        const fill = this.fillTip.getChildByName('fill').getComponent(Sprite);
        const amount = this.fillTip.getChildByName('amount').getComponent(Label);

        while(true) {
            // this.dropCoins();
            if(targetStoragePoint.amount > 0){
                ResourceManager.MoveResource(targetStoragePoint, npcStoragePoint, false, 4, new Vec3(0, 0, 0));

                fill.fillRange = npcStoragePoint.amount / npcStoragePoint.capacity;
                amount.string = (4 - npcStoragePoint.amount).toString();

                this.playLoad(npc);

                if(npcStoragePoint.amount >= npcStoragePoint.capacity){
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    AnimationLibrary.scaleFadeOut(this.fillTip, 0.1, 0, () => {
                        fill.fillRange = 0;
                        amount.string = '4';
                    }).start();
                    await new Promise((resolve) => setTimeout(resolve, 200));

                    this.loadComplete(npc);
                    
                    this.dropCoins();
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    npcStoragePoint.clearStorage();
                    const emoji = this.getNpcEmoji(npc);
                    if (emoji) emoji.active = true;
                    return;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, this.collectInterval * 500));
        }
    }

    private getNpcEmoji(npc: Node): Node | null {
        return this.emojiByNpc.get(npc) ?? npc.getChildByName('emoji');
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


