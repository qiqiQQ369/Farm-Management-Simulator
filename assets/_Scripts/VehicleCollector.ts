import { _decorator, Component, Node, Vec3, Prefab, instantiate, tween, Enum, Collider, ITriggerEvent, find, Sprite, Camera } from 'cc';
import { ResourceManager } from './Resource/ResourceManager';
import { StoragePoint } from './Resource/StoragePoint';
import { PlayerDetectionZone } from './PlayerDetectionZone';
import { Billboard } from '../Billboard';
const { ccclass, property } = _decorator;

/**
 * 车辆状态枚举
 */
enum VehicleState {
    WAITING = 0,      // 等待状态
    COLLECTING = 1,   // 收集中
    FULL = 2,         // 满载
    LEAVING = 3,      // 离开中
    DROPPING_COINS = 4 // 投放金币中
}

/**
 * 车辆收集器组件
 * 从目标Node获取子物体，从后往前堆叠到指定区域
 * 达到最大数量后开走，放下金币并堆叠到指定区域
 */
@ccclass('VehicleCollector')
export class VehicleCollector extends Component {
    
    @property({ type: Node, tooltip: "目标收集区域节点" })
    public targetCollectionArea: Node = null!;
    
    @property({ type: Node, tooltip: "车辆物品堆叠区域" })
    public vehicleStackArea: Node = null!;
    
    @property({ type: Node, tooltip: "金币投放区域" })
    public coinDropArea: Node = null!;
    
    @property({ type: Prefab, tooltip: "金币预制件" })
    public coinPrefab: Prefab = null!;
    
    @property({ tooltip: "车辆最大载货量" })
    public maxCapacity: number = 12;
    
    @property({ tooltip: "收集间隔时间（秒）" })
    public collectInterval: number = 1.0;
    
    // 车辆堆叠配置
    @property({ group: { name: "车辆堆叠设置", id: "1" }, tooltip: "车辆堆叠行数" })
    public vehicleStackRows: number = 3;
    
    @property({ group: { name: "车辆堆叠设置", id: "1" }, tooltip: "车辆堆叠列数" })
    public vehicleStackColumns: number = 2;
    
    @property({ group: { name: "车辆堆叠设置", id: "1" }, tooltip: "车辆堆叠层数" })
    public vehicleStackLayers: number = 2;
    
    @property({ group: { name: "车辆堆叠设置", id: "1" }, tooltip: "物品行间距" })
    public vehicleRowSpacing: number = 0.8;
    
    @property({ group: { name: "车辆堆叠设置", id: "1" }, tooltip: "物品列间距" })
    public vehicleColumnSpacing: number = 0.6;
    
    @property({ group: { name: "车辆堆叠设置", id: "1" }, tooltip: "物品层高度" })
    public vehicleLayerHeight: number = 0.4;
    
    // 金币堆叠配置
    @property({ group: { name: "金币堆叠设置", id: "2" }, tooltip: "金币堆叠行数" })
    public coinStackRows: number = 5;
    
    @property({ group: { name: "金币堆叠设置", id: "2" }, tooltip: "金币堆叠列数" })
    public coinStackColumns: number = 5;
    
    @property({ group: { name: "金币堆叠设置", id: "2" }, tooltip: "金币堆叠层数" })
    public coinStackLayers: number = 10;
    
    @property({ group: { name: "金币堆叠设置", id: "2" }, tooltip: "金币行间距" })
    public coinRowSpacing: number = 0.3;
    
    @property({ group: { name: "金币堆叠设置", id: "2" }, tooltip: "金币列间距" })
    public coinColumnSpacing: number = 0.3;
    
    @property({ group: { name: "金币堆叠设置", id: "2" }, tooltip: "金币层高度" })
    public coinLayerHeight: number = 0.1;
    
    @property({ tooltip: "车辆离开位置偏移" })
    public leaveOffset: Vec3 = new Vec3(0, 0, -10);
    
    @property({ tooltip: "车辆移动速度" })
    public moveSpeed: number = 3.0;
    
    @property({ tooltip: "金币数量" })
    public coinReward: number = 5;

    @property({ type: Prefab, tooltip: "表情预制件" })
    public emojiPrefab: Prefab = null!;

    private curEmoji: Node = null!;

    public dropOffArea: Node = null!;
    
    // 私有属性
    private _vehicleState: VehicleState = VehicleState.WAITING;
    private _currentCapacity: number = 0;
    private _stackedItems: Node[] = [];
    private _originalPosition: Vec3 = new Vec3();
    private _collectTimer: number = 0;
    private _coinStackCount: number = 0;
    
    // 临时向量
    private _tempVec3: Vec3 = new Vec3();

    protected onLoad(): void {
        // 记录车辆初始位置
        this._originalPosition.set(this.dropOffArea.position);
        
        // 验证必要组件
        this.validateComponents();
        
        // 根据堆叠配置调整最大载货量
        this.adjustMaxCapacity();
    }

    protected start(): void {

        this.CheckWaittingState();

        //this.schedule(() => {
        //    this.onVehicleFull();
        //}, 3);

        const collider = this.getComponent(Collider);
        if (collider) {
            collider.on('onTriggerEnter', this.onEnterArea, this);
            collider.on('onTriggerExit', this.onExitArea, this);
        }
    }

    private onEnterArea(event: ITriggerEvent): void {
        if(event.otherCollider.node.name != 'coinDropArea' && event.otherCollider.node.name != 'uploadArea') return;
        
        console.log('onEnterArea');
        //this.
        var resourceInfo = find('Canvas/ResourceInfo');
        resourceInfo.getComponent(Billboard).targetNode = this.node;
        resourceInfo.active = true;
        var fill = resourceInfo.getChildByPath('Sprite-001/Node/fill').getComponent(Sprite);
        fill.fillRange = 0;
        
        this._vehicleState = VehicleState.COLLECTING;
    }

    private onExitArea(event: ITriggerEvent): void {
        if(event.otherCollider.node.name != 'coinDropArea' && event.otherCollider.node.name != 'uploadArea') return;

        console.log('onExitArea');
        
        var resourceInfo = find('Canvas/ResourceInfo');
        resourceInfo.active = false;

        this._vehicleState = VehicleState.WAITING;
    }

    protected update(deltaTime: number): void {
        if (this._vehicleState === VehicleState.COLLECTING) {
            this._collectTimer += deltaTime;
            
            if (this._collectTimer >= this.collectInterval) {
                this._collectTimer = 0;
                this.tryCollectItem();
            }
        }
    }

    private CheckWaittingState(): void {
        if(this._vehicleState != VehicleState.WAITING) return;

        this.scheduleOnce(async () => {
            if(this.emojiPrefab){
                var emoji = instantiate(this.emojiPrefab);
                emoji.setParent(find('Canvas'));
                emoji.setPosition(new Vec3(0, 0, 0));
                this.curEmoji = emoji;
    
                tween(emoji).call(() =>{
                    emoji.scale = new Vec3(0, 0, 0);
                })
                .to(0.2, { scale: new Vec3(0.00425, 0.00425, 0.00425) })
                .start();
    
                var emojiBillboard = emoji.getComponent(Billboard);
                emojiBillboard.targetNode = this.node.getChildByName('emojiPos');
                emojiBillboard.mainCamera = find('Main Camera').getComponent(Camera);
    
                await new Promise(resolve => setTimeout(resolve, 3500));
    
                tween(emoji)
                .to(0.2, { scale: new Vec3(0, 0, 0) })
                .call(() =>{
                    emoji.destroy();
                    this.curEmoji = null;
                })
                .start();
            }
            this.scheduleOnce(() => {
                this.CheckWaittingState();
            }, 3.0);

        }, 3.0);

        // tween(emoji)
        //     .to(1.0, { position: new Vec3(0, 0, 0) }, {
        //         easing: 'quadInOut'
        //     })
    }

    /**
     * 根据堆叠配置调整最大载货量
     */
    private adjustMaxCapacity(): void {
        const calculatedCapacity = this.vehicleStackRows * this.vehicleStackColumns * this.vehicleStackLayers;
        if (this.maxCapacity !== calculatedCapacity) {
            console.log(`车辆载货量从 ${this.maxCapacity} 调整为 ${calculatedCapacity} (${this.vehicleStackRows}行×${this.vehicleStackColumns}列×${this.vehicleStackLayers}层)`);
            this.maxCapacity = calculatedCapacity;
        }
    }

    /**
     * 验证必要组件
     */
    private validateComponents(): void {
        if (!this.targetCollectionArea) {
            console.error('VehicleCollector: 目标收集区域未设置');
        }
        
        if (!this.vehicleStackArea) {
            console.error('VehicleCollector: 车辆堆叠区域未设置');
        }
        
        if (!this.coinDropArea) {
            console.error('VehicleCollector: 金币投放区域未设置');
        }
        
        if (!this.coinPrefab) {
            console.error('VehicleCollector: 金币预制件未设置');
        }
    }

    /**
     * 开始收集循环
     */
    private startCollectionCycle(): void {
        this._vehicleState = VehicleState.COLLECTING;
        this._currentCapacity = 0;
        this._collectTimer = 0;
        
        console.log('车辆开始收集物品...');
    }

    /**
     * 尝试收集物品
     */
    private tryCollectItem(): void {
        if (!this.targetCollectionArea || this._currentCapacity >= this.maxCapacity) {
            return;
        }

        var tubiao = find('tubiao_06_shoumai-001');
        var playerDetectionZone = tubiao.getComponent(PlayerDetectionZone);
        if(!playerDetectionZone._isPlayerInZone) {
            return;
        }

        var resourceInfo = find('Canvas/ResourceInfo');
        // resourceInfo.getComponent(Billboard).targetNode = this.node;
        // resourceInfo.active = true;

        if(this.curEmoji){
            this.curEmoji.destroy();
            this.curEmoji = null;
        }
        
        var fill = resourceInfo.getChildByPath('Sprite-001/Node/fill').getComponent(Sprite);
        
        var vehicleStoragePoint = this.vehicleStackArea.getComponent(StoragePoint);
        var targetStoragePoint = this.targetCollectionArea.getComponent(StoragePoint);
        ResourceManager.MoveResource(targetStoragePoint, vehicleStoragePoint, false, 4, new Vec3(0, 0, 0));

        fill.fillRange = vehicleStoragePoint.amount / vehicleStoragePoint.capacity;

        // 检查是否满载
        if (vehicleStoragePoint.amount >= vehicleStoragePoint.capacity) {
            this.onVehicleFull();
        }
    }

    /**
     * 收集物品
     */
    private collectItem(item: Node): void {
        // 从原父节点移除
        item.removeFromParent();
        
        // 计算在车辆上的堆叠位置
        const stackPosition = this.calculateVehicleStackPosition(this._currentCapacity);
        
        // 将物品移动到车辆堆叠区域
        item.setParent(this.vehicleStackArea);
        item.setPosition(stackPosition);
        
        // 添加收集动画
        this.animateItemToVehicle(item, stackPosition);
        
        // 记录堆叠的物品
        this._stackedItems.push(item);
        this._currentCapacity++;
        
        console.log(`收集物品，当前载货: ${this._currentCapacity}/${this.maxCapacity}`);
        
        // 检查是否满载
        if (this._currentCapacity >= this.maxCapacity) {
            this.onVehicleFull();
        }
    }

    /**
     * 计算车辆堆叠位置（行列层排列）
     */
    private calculateVehicleStackPosition(index: number): Vec3 {
        const position = new Vec3();
        
        // 计算当前物品在行列层中的位置
        const itemsPerLayer = this.vehicleStackRows * this.vehicleStackColumns;
        const layer = Math.floor(index / itemsPerLayer);
        const indexInLayer = index % itemsPerLayer;
        const row = Math.floor(indexInLayer / this.vehicleStackColumns);
        const column = indexInLayer % this.vehicleStackColumns;
        
        // 计算实际位置（以堆叠区域中心为原点）
        const totalRowWidth = (this.vehicleStackRows - 1) * this.vehicleRowSpacing;
        const totalColumnWidth = (this.vehicleStackColumns - 1) * this.vehicleColumnSpacing;
        
        position.x = column * this.vehicleColumnSpacing - totalColumnWidth * 0.5;
        position.z = row * this.vehicleRowSpacing - totalRowWidth * 0.5;
        position.y = layer * this.vehicleLayerHeight;
        
        console.log(`物品 ${index}: 第${layer}层, 第${row}行, 第${column}列 → 位置(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
        
        return position;
    }

    /**
     * 物品收集动画
     */
    private animateItemToVehicle(item: Node, targetPosition: Vec3): void {
        // 创建一个弹跳动画
        const startPos = item.position.clone();
        const midPos = new Vec3(
            (startPos.x + targetPosition.x) / 2,
            Math.max(startPos.y, targetPosition.y) + 2.0,
            (startPos.z + targetPosition.z) / 2
        );

        // 先跳到中间位置，再落到目标位置
        tween(item)
            .to(0.3, { position: midPos }, { 
                easing: 'quadOut'
            })
            .to(0.2, { position: targetPosition }, { 
                easing: 'quadIn'
            })
            .start();
    }

    /**
     * 车辆满载处理
     */
    private onVehicleFull(): void {
        this._vehicleState = VehicleState.FULL;
        console.log('车辆满载，准备离开...');
        
        // 延迟后开始离开
        this.scheduleOnce(() => {
            this.startLeaving();
        }, 1);
    }

    /**
     * 开始离开
     */
    private startLeaving(): void {
        this._vehicleState = VehicleState.LEAVING;
        
        // 计算离开位置
        this._tempVec3.set(this._originalPosition);
        //this._tempVec3.add(this.leaveOffset);
        
        // 车辆移动动画
        tween(this.node)
            .to(2.0, { position: this._tempVec3 }, {
                easing: 'quadInOut'
            })
            .call(() => {
                this.onReachedDropLocation();
            })
            .start();

        this.scheduleOnce(() => {
            this.dropCoins();
            this.node.emit('vehicleDropCompleted', this.node);
            //this.node.emit('vehicleUploadCompleted', this.node);
        }, 0.3);
            
        console.log('车辆开始离开...');
    }

    /**
     * 到达投放位置
     */
    private onReachedDropLocation(): void {
        this._vehicleState = VehicleState.DROPPING_COINS;
        console.log('车辆到达投放位置，开始投放金币...');
        
        // 清空车辆上的物品
        this.clearVehicleItems();
        
        // 投放金币
        //this.dropCoins();
        
        // 延迟后返回
        // this.scheduleOnce(() => {
        //     this.returnToStart();
        // }, 2.0);
        
        // 通知管理器投放完成
        this.scheduleOnce(() => {
            this.node.emit('vehicleDropCompleted', this.node);
        }, 1.0);
    }

    /**
     * 清空车辆物品
     */
    private clearVehicleItems(): void {
        // 销毁所有堆叠的物品
        for (const item of this._stackedItems) {
            if (item && item.isValid) {
                item.destroy();
            }
        }
        
        this._stackedItems.length = 0;
        this._currentCapacity = 0;
    }

    /**
     * 投放金币
     */
    private dropCoins(): void {
        if (!this.coinPrefab || !this.coinDropArea) {
            console.error('金币预制件或投放区域未设置');
            return;
        }

        var totalCoins = this.coinDropArea.children.length;
        this._coinStackCount = totalCoins;
        var coinStoragePoint = this.coinDropArea.getComponent(StoragePoint);

        for (let i = 0; i < this.coinReward; i++) {
            this.scheduleOnce(() => {
                if(this._coinStackCount >= coinStoragePoint.capacity) return;
                this.createCoin();
                coinStoragePoint.amount = this._coinStackCount;
            }, i * 0.1); // 间隔投放
        }
    }

    /**
     * 创建金币
     */
    private createCoin(): void {
        const coin = instantiate(this.coinPrefab);
        //coin.setParent(this.coinDropArea);

        //this.coinDropArea.getComponent(StoragePoint).addResource(coin, 2, false);
        // this._coinStackCount++;
        // console.log(`投放金币，当前金币数: ${this._coinStackCount}`);

        //return;
        
        // 计算金币堆叠位置
        const stackPos = this.calculateCoinStackPosition(this._coinStackCount);
        
        // 设置父节点和位置
        coin.setParent(this.coinDropArea);
        coin.setPosition(stackPos);
        
        // 添加掉落动画
        this.animateCoinDrop(coin, stackPos);
        
        this._coinStackCount++;
        console.log(`投放金币，当前金币数: ${this._coinStackCount}`);
    }

    /**
     * 计算金币堆叠位置（行列层排列）
     */
    private calculateCoinStackPosition(index: number): Vec3 {
        const position = new Vec3();
        
        // 计算当前金币在行列层中的位置
        const coinsPerLayer = this.coinStackRows * this.coinStackColumns;
        const layer = Math.floor(index / coinsPerLayer);
        const indexInLayer = index % coinsPerLayer;
        const row = Math.floor(indexInLayer / this.coinStackColumns);
        const column = indexInLayer % this.coinStackColumns;
        
        // 计算实际位置（以投放区域中心为原点）
        const totalRowWidth = (this.coinStackRows - 1) * this.coinRowSpacing;
        const totalColumnWidth = (this.coinStackColumns - 1) * this.coinColumnSpacing;
        
        position.x = column * this.coinColumnSpacing - totalColumnWidth * 0.5;
        position.z = row * this.coinRowSpacing - totalRowWidth * 0.5;
        position.y = layer * this.coinLayerHeight;
        
        console.log(`金币 ${index}: 第${layer}层, 第${row}行, 第${column}列 → 位置(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
        
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

    /**
     * 返回起始位置
     */
    private returnToStart(): void {
        console.log('车辆返回起始位置...');
        
        // 返回动画
        tween(this.node)
            .to(2.0, { position: this._originalPosition }, {
                easing: 'quadInOut'
            })
            .call(() => {
                //this.onReturnedToStart();
            })
            .start();
    }

    /**
     * 返回起始位置完成
     */
    private onReturnedToStart(): void {
        console.log('车辆已返回，开始新的收集循环...');
        
        // 延迟后开始新的收集循环
        this.scheduleOnce(() => {
            this.startCollectionCycle();
        }, 1.0);
    }

    /**
     * 手动触发收集（用于测试）
     */
    public triggerCollection(): void {
        if (this._vehicleState === VehicleState.WAITING) {
            this.startCollectionCycle();
        }
    }

    /**
     * 获取当前状态（用于调试）
     */
    public getCurrentState(): string {
        return VehicleState[this._vehicleState];
    }

    /**
     * 获取当前载货量
     */
    public getCurrentCapacity(): number {
        return this._currentCapacity;
    }

    /**
     * 获取车辆堆叠信息（用于调试）
     */
    public getVehicleStackInfo(): string {
        return `车辆堆叠: ${this.vehicleStackRows}行×${this.vehicleStackColumns}列×${this.vehicleStackLayers}层 = ${this.maxCapacity}个位置`;
    }

    /**
     * 获取金币堆叠信息（用于调试）
     */
    public getCoinStackInfo(): string {
        const maxCoins = this.coinStackRows * this.coinStackColumns * this.coinStackLayers;
        return `金币堆叠: ${this.coinStackRows}行×${this.coinStackColumns}列×${this.coinStackLayers}层 = 最多${maxCoins}枚金币`;
    }
}

Enum(VehicleState);