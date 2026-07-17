import { _decorator, Component, Node, Vec3, Collider, ITriggerEvent, Enum, tween, MeshRenderer, color, Color, Material } from 'cc';
import { WoodBackpack } from './WoodBackpack';
import { StoragePoint } from './Resource/StoragePoint';
import { ResourceManager } from './Resource/ResourceManager';
const { ccclass, property } = _decorator;

/**
 * 区域操作类型枚举
 */
export enum ZoneActionType {
    DropWood = 0,           // 放下木头
    CollectWood = 1,        // 收集木头
    RestoreHealth = 2,      // 恢复生命值
    Upgrade = 3,            // 升级
    Store = 4,              // 商店
    Teleport = 5           // 传送
}

/**
 * 玩家检测区域组件
 * 检测玩家是否在区域内且未移动，根据配置执行不同操作
 */
@ccclass('PlayerDetectionZone')
export class PlayerDetectionZone extends Component {
    
    @property({ type: Enum(ZoneActionType), tooltip: "区域操作类型" })
    public actionType: ZoneActionType = ZoneActionType.DropWood;
    
    @property({ tooltip: "玩家停留触发时间（秒）" })
    public triggerDelay: number = 0.1;
    
    @property({ tooltip: "操作执行间隔（秒）" })
    public actionInterval: number = 0.5;
    
    @property({ tooltip: "是否连续执行操作" })
    public continuousAction: boolean = true;
    
    @property({ tooltip: "每次操作的木头数量" })
    public woodCountPerAction: number = 1;
    
    @property({ tooltip: "最大木头堆叠数量（0为无限制）" })
    public maxWoodInZone: number = 50;
    
    @property({ type: Node, tooltip: "木头堆叠区域节点" })
    public woodStackArea: Node = null!;
    
    @property({ tooltip: "木头堆叠层高" })
    public stackLayerHeight: number = 0.2;
    
    @property({ tooltip: "每行最大木头数量" })
    public woodPerRow: number = 5;
    
    @property({ tooltip: "是否显示调试信息" })
    public showDebug: boolean = true;

    @property({ type: Material, tooltip: "材质" })
    public material: Material = null!;

    @property({ type: Material, tooltip: "材质" })
    public material1: Material = null!;
    
    // 私有属性
    public _isPlayerInZone: boolean = false;
    private _playerNode: Node | null = null;
    private _playerController: any = null;
    private _playerBackpack: WoodBackpack | null = null;
    private _stayTimer: number = 0;
    private _actionTimer: number = 0;
    private _isTriggered: boolean = false;
    private _isActionActive: boolean = false;
    private _currentWoodInZone: number = 0;
    private _woodStackNodes: Node[] = [];

    private _meshRenderer: MeshRenderer = null!;
    
    // 事件
    public onPlayerEnterZone: ((player: Node) => void) | null = null;
    public onPlayerExitZone: ((player: Node) => void) | null = null;
    public onActionTriggered: ((actionType: ZoneActionType) => void) | null = null;
    public onWoodDropped: ((count: number, totalInZone: number) => void) | null = null;

    protected onLoad(): void {
        this.setupCollisionDetection();
        
        // 如果没有设置木头堆叠区域，使用当前节点
        if (!this.woodStackArea) {
            this.woodStackArea = this.node;
        }

        this._meshRenderer = this.node.getComponent(MeshRenderer);
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

    private resolveNearestSellStoragePoint(): StoragePoint | null {
        const scene = this.node.scene;
        if (!scene) {
            return this.woodStackArea?.getComponent(StoragePoint) ?? null;
        }

        const targetPosition = this._playerNode?.worldPosition ?? this.node.worldPosition;
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

        let closestStoragePoint: StoragePoint | null = null;
        let closestDistance = Number.MAX_VALUE;
        for (const anchor of anchors) {
            const storagePoint = this.ensureSellStoragePoint(anchor);
            if (!storagePoint) {
                continue;
            }

            const distance = Vec3.distance(targetPosition, anchor.worldPosition);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestStoragePoint = storagePoint;
            }
        }

        return closestStoragePoint ?? this.woodStackArea?.getComponent(StoragePoint) ?? null;
    }

    protected update(deltaTime: number): void {
        if (!this._isPlayerInZone || !this._playerNode) return;
        
        // 检查玩家是否移动
        const isPlayerMoving = this._playerController?.isMoving() || false;
        
        if (!isPlayerMoving) {
            // 玩家未移动，累计停留时间
            this._stayTimer += deltaTime;
            
            if (this._stayTimer >= this.triggerDelay && !this._isTriggered) {
                // 触发操作
                this.triggerAction();
                this._isTriggered = true;
                this._isActionActive = true;
            }
            
            // 连续执行操作
            if (this._isActionActive && this.continuousAction) {
                this._actionTimer += deltaTime;
                if (this._actionTimer >= this.actionInterval) {
                    this.executeAction();
                    this._actionTimer = 0;
                }
            }
        } else {
            // 玩家移动了，重置状态
            this.resetTriggerState();
        }
    }

    /**
     * 设置碰撞检测
     */
    private setupCollisionDetection(): void {
        const collider = this.node.getComponent(Collider);
        if (collider) {
            collider.on('onTriggerEnter', this.onPlayerEnter, this);
            collider.on('onTriggerExit', this.onPlayerExit, this);
        } else {
            console.warn('PlayerDetectionZone: 未找到Collider组件');
        }
    }

    /**
     * 玩家进入区域
     */
    private onPlayerEnter(event: ITriggerEvent): void {
        if (this.isPlayerNode(event.otherCollider.node)) {
            this._isPlayerInZone = true;
            this._playerNode = event.otherCollider.node;
            
            // 获取玩家组件
            this._playerController = this._playerNode.getComponent('PlayerController');
            this._playerBackpack = this._playerNode.getComponent(WoodBackpack) ||
                                  this._playerNode.getComponentInChildren(WoodBackpack);
            
            this.resetTriggerState();
            this.onPlayerEnterZone?.(this._playerNode);

            this._meshRenderer.material = this.material;
            if (this.showDebug) {
                console.log(`玩家进入${ZoneActionType[this.actionType]}区域`);
            }
        }
    }

    /**
     * 玩家离开区域
     */
    private onPlayerExit(event: ITriggerEvent): void {
        if (this.isPlayerNode(event.otherCollider.node)) {
            this._isPlayerInZone = false;
            this._playerNode = null;
            this._playerController = null;
            this._playerBackpack = null;
            
            this.resetTriggerState();
            this.onPlayerExitZone?.(event.otherCollider.node);

            this._meshRenderer.material = this.material1;
            if (this.showDebug) {
                console.log(`玩家离开${ZoneActionType[this.actionType]}区域`);
            }
        }
    }

    /**
     * 检查节点是否为玩家节点
     */
    private isPlayerNode(node: Node): boolean {
        return node.name.includes('Player') || 
               node.getComponent('PlayerController') !== null ||
               node.parent?.name.includes('Player');
    }

    /**
     * 重置触发状态
     */
    private resetTriggerState(): void {
        this._stayTimer = 0;
        this._actionTimer = 0;
        this._isTriggered = false;
        this._isActionActive = false;
    }

    /**
     * 触发操作
     */
    private triggerAction(): void {
        this.executeAction();
    }

    /**
     * 执行操作
     */
    private executeAction(): void {
        switch (this.actionType) {
            case ZoneActionType.DropWood:
                this.executeDropWood();
                break;
            case ZoneActionType.CollectWood:
                this.executeCollectWood();
                break;
            case ZoneActionType.RestoreHealth:
                this.executeRestoreHealth();
                break;
            case ZoneActionType.Upgrade:
                this.executeUpgrade();
                break;
            case ZoneActionType.Store:
                this.executeStore();
                break;
            case ZoneActionType.Teleport:
                this.executeTeleport();
                break;
        }
    }

    /**
     * 执行放下木头操作 - 直接移动背包节点版本
     */
    private executeDropWood(): void {
        if (!this._playerBackpack) {
            if (this.showDebug) {
                console.log('玩家没有背包组件');
            }
            return;
        }
        
        // for(let i = 0; i < 3; i++){
            ResourceManager.MoveResource(this._playerBackpack.backpackMount.getComponent(StoragePoint), this.resolveNearestSellStoragePoint() ?? this.woodStackArea.getComponent(StoragePoint),  false, 4, new Vec3(0, 0, 0));
        // }
    }

    /**
     * 直接移动背包中的木头节点到堆叠区域
     */
    private moveWoodNodesFromBackpackToZone(count: number): void {
        if (!this._playerBackpack || !this._playerBackpack.backpackMount) {
            if (this.showDebug) {
                console.log('背包挂载点未找到');
            }
            return;
        }
        
        // 获取背包中的木头显示节点
        const backpackWoodNodes = this.getBackpackWoodNodes(count);
        
        if (backpackWoodNodes.length === 0) {
            if (this.showDebug) {
                console.log('背包中没有可移动的木头节点');
            }
            return;
        }
        
        // 从背包系统中移除木头（但不销毁节点）
        this._playerBackpack.removeWoodWithoutDestroy(backpackWoodNodes.length);
        
        // 移动每个木头节点到堆叠区域
        backpackWoodNodes.forEach((woodNode, index) => {
            this.scheduleOnce(() => {
                this.moveWoodNodeToStackArea(woodNode);
            }, index * 0.05); // 每个木头间隔0.05秒移动
        });
        
        this.onWoodDropped?.(backpackWoodNodes.length, this._currentWoodInZone + backpackWoodNodes.length);
    }

    /**
     * 获取背包中的木头节点
     */
    private getBackpackWoodNodes(count: number): Node[] {
        if (!this._playerBackpack || !this._playerBackpack.backpackMount) {
            return [];
        }
        
        const backpackMount = this._playerBackpack.backpackMount;
        const allWoodNodes: Node[] = [];
        
        // 遍历背包挂载点的所有子节点，收集木头节点
        for (let i = 0; i < backpackMount.children.length; i++) {
            const child = backpackMount.children[i];
            if (child.name.includes('Wood') || child.name.includes('wood')) {
                allWoodNodes.push(child);
            }
        }
        
        // 返回最后添加的节点（栈顶的木头）
        const result = allWoodNodes.slice(-count);
        return result;
    }

    /**
     * 移动单个木头节点到堆叠区域
     */
    private moveWoodNodeToStackArea(woodNode: Node): void {
        if (!woodNode || !woodNode.isValid) {
            return;
        }
        
        // 获取当前世界位置
        const currentWorldPos = new Vec3();
        woodNode.getWorldPosition(currentWorldPos);
        
        // 计算目标位置
        const targetLocalPos = this.calculateStackPosition(this._currentWoodInZone);
        const targetWorldPos = new Vec3();
        this.woodStackArea.getWorldPosition(targetWorldPos);
        Vec3.add(targetWorldPos, targetWorldPos, targetLocalPos);
        
        // 改变父节点到堆叠区域
        woodNode.setParent(this.woodStackArea);
        
        // 设置为当前世界位置（避免突然跳跃）
        woodNode.setWorldPosition(currentWorldPos);
        
        // 转换为局部坐标
        const currentLocalPos = new Vec3();
        woodNode.getPosition(currentLocalPos);
        
        // 调整缩放和属性
        woodNode.setScale(0.8, 0.8, 0.8);
        
        // 播放移动动画
        this.playMoveToStackAnimation(woodNode, currentLocalPos, targetLocalPos);
        
        // 添加到堆叠列表
        this._woodStackNodes.push(woodNode);
        this._currentWoodInZone++;
    }

    /**
     * 播放移动到堆叠区域的动画
     */
    private playMoveToStackAnimation(woodNode: Node, startPos: Vec3, targetPos: Vec3): void {
        // 计算中间高度点，创建抛物线效果
        const midPos = new Vec3(
            (startPos.x + targetPos.x) / 2,
            Math.max(startPos.y, targetPos.y) + 1, // 抛物线高度
            (startPos.z + targetPos.z) / 2
        );
        
        // 先移动到中间高点
        tween(woodNode)
            .to(0.3, { position: midPos }, { easing: 'quadOut' })
            .to(0.3, { position: targetPos }, { easing: 'quadIn' })
            .start();
        
        // 添加旋转动画
        const currentRotation = woodNode.eulerAngles.clone();
        const targetRotation = new Vec3(
            currentRotation.x + (Math.random() - 0.5) * 20,
            currentRotation.y + Math.random() * 360,
            currentRotation.z + (Math.random() - 0.5) * 20
        );
        
        tween(woodNode)
            .to(0.6, { eulerAngles: targetRotation })
            .call(() => {
                // 落地完成，等待后飞向玩家
                woodNode.eulerAngles = Vec3.ZERO;
                //woodNode.setScale(,2,2);
            })
            .start();
    }
    /**
     * 执行收集木头操作 - 修改为移动节点回背包
     */
    private executeCollectWood(): void {
        if (!this._playerBackpack || this._currentWoodInZone <= 0) return;
        
        const backpackInfo = this._playerBackpack.getBackpackInfo();
        if (backpackInfo.isFull) {
            if (this.showDebug) {
                console.log('玩家背包已满');
            }
            return;
        }
        
        // 计算可收集数量
        const collectCount = Math.min(
            this.woodCountPerAction, 
            this._currentWoodInZone,
            backpackInfo.maxCount - backpackInfo.count
        );
        
        // 移动木头节点回背包
        this.moveWoodNodesFromZoneToBackpack(collectCount);
        
        if (this.showDebug) {
            console.log(`收集了${collectCount}块木头到背包`);
        }
    }

    /**
     * 移动木头节点从堆叠区域回到背包
     */
    private moveWoodNodesFromZoneToBackpack(count: number): void {
        if (!this._playerBackpack || !this._playerBackpack.backpackMount) return;
        
        for (let i = 0; i < count && this._woodStackNodes.length > 0; i++) {
            const woodNode = this._woodStackNodes.pop()!;
            
            if (woodNode && woodNode.isValid) {
                this.scheduleOnce(() => {
                    this.moveWoodNodeToBackpack(woodNode);
                }, i * 0.05);
            }
            
            this._currentWoodInZone--;
        }
        
        // 添加到背包系统
        this._playerBackpack.addWoodWithExistingNodes(count);
    }

    /**
     * 移动单个木头节点到背包
     */
    private moveWoodNodeToBackpack(woodNode: Node): void {
        if (!woodNode || !woodNode.isValid || !this._playerBackpack) return;
        
        // 获取当前位置
        const currentWorldPos = new Vec3();
        woodNode.getWorldPosition(currentWorldPos);
        
        // 计算背包目标位置
        const backpackMount = this._playerBackpack.backpackMount;
        const backpackWorldPos = new Vec3();
        backpackMount.getWorldPosition(backpackWorldPos);
        
        // 计算背包中的层级位置
        const currentBackpackCount = this._playerBackpack.getWoodCount();
        const layerHeight = this._playerBackpack.layerHeight || 0.3;
        backpackWorldPos.y += currentBackpackCount * layerHeight;
        
        // 改变父节点到背包
        woodNode.setParent(backpackMount);
        woodNode.setWorldPosition(currentWorldPos);
        
        // 获取局部坐标
        const currentLocalPos = woodNode.position.clone();
        const targetLocalPos = new Vec3(0, currentBackpackCount * layerHeight, 0);
        
        // 播放移动动画
        tween(woodNode)
            .to(0.4, { position: targetLocalPos }, { easing: 'quadInOut' })
            .start();
        
        // 调整缩放
        tween(woodNode)
            .to(0.4, { scale: new Vec3(0.8, 0.8, 0.8) })
            .start();
    }

    /**
     * 执行恢复生命值操作
     */
    private executeRestoreHealth(): void {
        if (this.showDebug) {
            console.log('恢复生命值');
        }
        // 这里可以添加恢复生命值的逻辑
    }

    /**
     * 执行升级操作
     */
    private executeUpgrade(): void {
        if (this.showDebug) {
            console.log('执行升级');
        }
        // 这里可以添加升级逻辑
    }

    /**
     * 执行商店操作
     */
    private executeStore(): void {
        if (this.showDebug) {
            console.log('打开商店');
        }
        // 这里可以添加商店逻辑
    }

    /**
     * 执行传送操作
     */
    private executeTeleport(): void {
        if (this.showDebug) {
            console.log('执行传送');
        }
        // 这里可以添加传送逻辑
    }

    /**
     * 获取区域状态信息
     */
    public getZoneInfo(): {
        isPlayerInZone: boolean,
        actionType: string,
        currentWoodInZone: number,
        maxWoodInZone: number,
        isTriggered: boolean
    } {
        return {
            isPlayerInZone: this._isPlayerInZone,
            actionType: ZoneActionType[this.actionType],
            currentWoodInZone: this._currentWoodInZone,
            maxWoodInZone: this.maxWoodInZone,
            isTriggered: this._isTriggered
        };
    }

    /**
     * 手动触发操作
     */
    public manualTrigger(): void {
        if (this._isPlayerInZone) {
            this.triggerAction();
        }
    }

    /**
     * 清空区域中的木头
     */
    public clearZoneWood(): void {
        for (const woodNode of this._woodStackNodes) {
            if (woodNode && woodNode.isValid) {
                woodNode.destroy();
            }
        }
        this._woodStackNodes = [];
        this._currentWoodInZone = 0;
    }

    /**
     * 计算堆叠位置
     */
    private calculateStackPosition(index: number): Vec3 {
        const woodsPerLayer = 9;  // 每层9根木头 (3x3)
        const layer = Math.floor(index / woodsPerLayer);
        const posInLayer = index % woodsPerLayer;
        
        // 计算3x3网格中的行列位置
        const row = Math.floor(posInLayer / 3);  // 0, 1, 2
        const col = posInLayer % 3;              // 0, 1, 2
        
        // 计算实际位置（居中排列）
        const x = (col - 1) * 0.2;  // -0.6, 0, 0.6
        const z = (row - 1) * 0.8;  // -0.6, 0, 0.6
        const y = layer * this.stackLayerHeight;
        
        return new Vec3(x, y, z);
    }
}
