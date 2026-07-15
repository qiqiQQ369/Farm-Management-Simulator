import { _decorator, Component, Node, Vec3, Prefab, instantiate, tween, Quat, Tween } from 'cc';
import { WoodDrop } from './WoodDrop';
import { WoodBackpack } from './WoodBackpack';
import { StoragePoint } from './Resource/StoragePoint';
import { MaxTip } from './UI/MaxTip';
const { ccclass, property } = _decorator;

/**
 * 木头掉落管理器
 * 处理木头的生成、掉落和拾取管理
 */
@ccclass('WoodDropManager')
export class WoodDropManager extends Component {
    
    @property({ type: Prefab, tooltip: "木头掉落物预制件" })
    public woodDropPrefab: Prefab = null!;

    @property({ type: Prefab, tooltip: "木头掉落物预制件" })
    public woodDropPrefab2: Prefab = null!;
    
    @property({ type: WoodBackpack, tooltip: "玩家背包组件" })
    public playerBackpack: WoodBackpack = null!;
    
    @property({ tooltip: "每次砍伐掉落的木头数量" })
    public dropsPerChop: number = 3;
    
    @property({ tooltip: "掉落半径" })
    public dropRadius: number = 2.0;
    
    // 私有属性
    private _activeDrops: WoodDrop[] = [];
    // 对象池（类型1/2）
    private _poolType1: Node[] = [];
    private _poolType2: Node[] = [];

    private getPooledNode(type: number): Node {
        let node: Node | undefined;
        if (type === 1) {
            node = this._poolType1.pop();
        } else {
            node = this._poolType2.pop();
        }
        if (!node) {
            const prefab = type === 1 ? this.woodDropPrefab : this.woodDropPrefab2;
            node = instantiate(prefab);
        }
        node.setParent(this.node);
        node.active = true;
        return node;
    }

    private recycleNode(node: Node, type: number): void {
        if (!node || !node.isValid) return;
        // 停止该节点上的所有补间动画
        try { Tween.stopAllByTarget(node); } catch (e) { /* 忽略 */ }
        // 重置基础变换，避免下次复用出现异常
        node.setScale(new Vec3(1, 1, 1));
        node.rotation = new Quat(0, 0, 0, 1);
        node.eulerAngles = new Vec3(0, 0, 0);
        // 回收到池中（隐藏）
        node.active = false;
        node.setParent(this.node);
        if (type === 1) {
            this._poolType1.push(node);
        } else {
            this._poolType2.push(node);
        }
    }

    protected onLoad(): void {
        // 如果没有设置背包，尝试查找
        if (!this.playerBackpack) {
            this.playerBackpack = this.node.getComponent(WoodBackpack) || 
                                  this.node.getParent()?.getComponentInChildren(WoodBackpack);
        }
    }

    /**
     * 在指定位置生成木头掉落
     */
    public spawnWoodDrops(position: Vec3, count: number = this.dropsPerChop, type: number = 1, parent: Node, targetPosition: Vec3 = null): void {
        if (!this.woodDropPrefab) {
            console.error('木头掉落物预制件未设置');
            return;
        }
        
        for (let i = 0; i < count; i++) {
            this.createSingleWoodDrop(position, type, parent, targetPosition);
        }
        
    }

    /**
     * 创建单个木头掉落物
     */
    private async createSingleWoodDrop(basePosition: Vec3, type: number = 1, parent: Node = null, targetPosition: Vec3 = null): Promise<void> {
        // 使用对象池
        const woodDropNode = this.getPooledNode(type);
        
        if(type === 1){
            woodDropNode.setParent(this.node);
            const woodDrop = woodDropNode.getComponent(WoodDrop);
            if (woodDrop) {
                // 设置掉落位置和参数
                woodDrop.setupDrop(basePosition, 1);
                
                // 设置拾取回调
                woodDrop.onPickedUp = this.onWoodPickedUp.bind(this);
                // 追踪活跃掉落
                if (this._activeDrops.indexOf(woodDrop) === -1) {
                    this._activeDrops.push(woodDrop);
                }
            }
        }
        else{
            woodDropNode.setParent(this.node);
            var storagePoint = parent.getComponent(StoragePoint);
            if(storagePoint){
                this.startDropAnimation(woodDropNode, basePosition, targetPosition, storagePoint, type);
            }
        }
    }

    private createSingleWoodDrop2(basePosition: Vec3, type: number = 1, parent: Node = null): void {
        const woodDropNode = this.getPooledNode(type);
        woodDropNode.setParent(this.node);
        this.startDropAnimation(woodDropNode, basePosition, null, null, type);
    }

    private startDropAnimation(woodNode: Node, basePosition: Vec3, targetPosition1: Vec3 = null, storagePoint: StoragePoint = null, type: number = 2): void {
        var _startPosition = basePosition.clone();
        var scatterRadius = 1.5;
        var bounceHeight = 1;

        // 计算随机掉落位置
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * scatterRadius * 1.5;
        const offsetX = Math.cos(angle) * distance;
        const offsetZ = Math.sin(angle) * distance;
        
        const targetPosition = new Vec3(
            _startPosition.x + offsetX,
            _startPosition.y,
            _startPosition.z + offsetZ
        );
        
        // 设置初始高度
        const dropHeight = _startPosition.y + bounceHeight * 0.2 + Math.random() * 1;
        woodNode.setPosition(_startPosition.x, dropHeight, _startPosition.z);
        
        // 计算抛物线控制点（最高点）
        const midPoint = new Vec3();
        Vec3.lerp(midPoint, _startPosition, targetPosition, 0.5);
        midPoint.y = dropHeight + bounceHeight * 0.2; // 抛物线最高点
        
        // 使用分段动画实现抛物线效果
        const duration = 0.3;// + Math.random() * 0.2; // 随机掉落时间
        
        // 第一阶段：上升到最高点
        tween(woodNode)
            .to(duration * 0.4, { 
                position: midPoint 
            }, { 
                easing: 'quadOut' 
            })
            .call(() => {
                // 第二阶段：从最高点落到目标位置
                tween(woodNode)
                    .to(duration * 0.6, { 
                        position: targetPosition,
                    }, { 
                        easing: 'quadIn' 
                    })
                    .call(() => {
                        tween(woodNode)
                            .to(0.2, {
                                position: targetPosition1,
                                scale: new Vec3(0, 0, 0) 
                            })
                            .call(() => {
                                woodNode.rotation = new Quat(0, 0, 0, 1);
                                
                                if(storagePoint && storagePoint.amount >= storagePoint.capacity){
                                    if(storagePoint.name.includes("bag"))
                                        MaxTip.showMaxTip();
                                    // 存储已满：回收到对象池
                                    this.recycleNode(woodNode, type);
                                }
                                else if (storagePoint){
                                    storagePoint.addResource(woodNode);
                                } else {
                                    // 无存储点，直接回收
                                    this.recycleNode(woodNode, type);
                                }
                            }).to(0.15, {
                                scale: new Vec3(1.17, 1.17, 1.17) 
                            })
                            .to(0.2, {
                                scale: new Vec3(1, 1, 1) 
                            })
                            .start();
                    })
                    .start();
            })
            .start();
        
        // 随机旋转动画
        const randomRotation = new Vec3(
            Math.random() * 180,
            Math.random() * 360,
            Math.random() * 180
        );
        
        tween(woodNode)
            .to(duration, { eulerAngles: randomRotation })
            .start();
    }

    private onLanded(): void {
    }

    /**
     * 木头被拾取的回调
     */
    private onWoodPickedUp(woodDrop: WoodDrop): void {
        // 从活跃列表中移除
        const index = this._activeDrops.indexOf(woodDrop);
        if (index !== -1) {
            this._activeDrops.splice(index, 1);
        }
        // 回收到对象池（类型1）
        if (woodDrop && woodDrop.node && woodDrop.node.isValid) {
            this.recycleNode(woodDrop.node, 1);
        }
    }

    /**
     * 清理所有掉落物
     */
    public clearAllDrops(): void {
        for (const drop of this._activeDrops) {
            if (drop && drop.node && drop.node.isValid) {
                this.recycleNode(drop.node, 1);
            }
        }
        this._activeDrops = [];
    }

    /**
     * 获取当前掉落物数量
     */
    public getActiveDropCount(): number {
        return this._activeDrops.length;
    }

    /**
     * 设置玩家背包
     */
    public setPlayerBackpack(backpack: WoodBackpack): void {
        this.playerBackpack = backpack;
    }

    /**
     * 强制拾取所有掉落物（测试用）
     */
    public forcePickupAll(): void {
        for (const drop of this._activeDrops) {
            if (drop && drop.node && drop.node.isValid) {
                drop.forcePickup();
            }
        }
    }
}
