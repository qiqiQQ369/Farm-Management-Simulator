import { _decorator, Component, Node, Vec3, Collider, ITriggerEvent, tween, find } from 'cc';
import { WoodBackpack } from './WoodBackpack';
import { StoragePoint } from './Resource/StoragePoint';
import { MaxTip } from './UI/MaxTip';
const { ccclass, property } = _decorator;

/**
 * 木头掉落物组件
 * 掉落后等待0.3秒自动飞向玩家背包并堆叠
 */
@ccclass('WoodDrop')
export class WoodDrop extends Component {
    
    @property({ tooltip: "木头价值" })
    public woodValue: number = 1;
    
    @property({ tooltip: "掉落弹跳高度" })
    public bounceHeight: number = 1.0;
    
    @property({ tooltip: "掉落散射半径" })
    public scatterRadius: number = 2.0;
    
    @property({ tooltip: "落地后等待时间（秒）" })
    public waitAfterLanding: number = 0.3;
    
    @property({ tooltip: "飞向玩家的速度" })
    public flySpeed: number = 10.0;

    public isForcePickup: boolean = false;
    
    // 私有属性
    private _isPickedUp: boolean = false;
    private _isLanded: boolean = false;
    private _isFlyingToPlayer: boolean = false;
    private _startPosition: Vec3 = new Vec3();
    private _playerNode: Node | null = null;
    private _playerBackpack: WoodBackpack | null = null;
    
    // 临时向量
    private _tempVec3: Vec3 = new Vec3();
    
    // 事件
    public onPickedUp: ((woodDrop: WoodDrop) => void) | null = null;

    protected onLoad(): void {
        this.setupCollisionDetection();
        //this._startPosition.set(this.node.position);
    }

    protected start(): void {
        // 查找玩家节点和背包
        this.findPlayerNode();
        
        if(this.isForcePickup){
            this.startFlyToPlayer();
            return;
        }
        // 开始掉落动画
        this.startDropAnimation();
    }

    protected update(deltaTime: number): void {
        if (this._isPickedUp || !this._isFlyingToPlayer) return;
        
        // 飞向玩家背包
        this.updateFlyToPlayer(deltaTime);
    }

    /**
     * 查找玩家节点和背包组件
     */
    private findPlayerNode(): void {
        this._playerNode = find('Player') || 
                          this.node.getParent()?.getChildByName('Player') ||
                          this.node.scene?.getChildByName('Player');
        
        if (this._playerNode) {
            // 查找背包组件
            this._playerBackpack = this._playerNode.getComponent(WoodBackpack) ||
                                  this._playerNode.getComponentInChildren(WoodBackpack);
            
            if (!this._playerBackpack) {
                console.warn('未找到玩家背包组件');
            }
        }
    }

    /**
     * 设置碰撞检测
     */
    private setupCollisionDetection(): void {
        const collider = this.node.getComponent(Collider);
        if (collider) {
            collider.on('onTriggerEnter', this.onPlayerEnter, this);
        }
    }

    /**
     * 玩家进入拾取区域（直接碰撞拾取）
     */
    private onPlayerEnter(event: ITriggerEvent): void {
        if (!this._isPickedUp && this.isPlayerNode(event.otherCollider.node)) {
            this.pickUpDirectly();
        }
    }

    /**
     * 检查节点是否为玩家节点
     */
    private isPlayerNode(node: Node): boolean {
        return node.name.includes('Player') || 
               node.getComponent('PlayerController') !== null;
    }

    /**
     * 开始掉落动画 - 抛物线效果
     */
    private startDropAnimation(): void {
        // 计算随机掉落位置
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.scatterRadius * 1.5;
        const offsetX = Math.cos(angle) * distance;
        const offsetZ = Math.sin(angle) * distance;
        
        const targetPosition = new Vec3(
            this._startPosition.x + offsetX,
            this._startPosition.y,
            this._startPosition.z + offsetZ
        );
        
        // 设置初始高度
        const dropHeight = this._startPosition.y + this.bounceHeight * 0.2 + Math.random() * 1;
        this.node.setPosition(this._startPosition.x, dropHeight, this._startPosition.z);
        
        // 计算抛物线控制点（最高点）
        const midPoint = new Vec3();
        Vec3.lerp(midPoint, this._startPosition, targetPosition, 0.5);
        midPoint.y = dropHeight + this.bounceHeight * 0.2; // 抛物线最高点
        
        // 使用分段动画实现抛物线效果
        const duration = 0.3;// + Math.random() * 0.2; // 随机掉落时间
        
        // 第一阶段：上升到最高点
        tween(this.node)
            .to(duration * 0.4, { 
                position: midPoint 
            }, { 
                easing: 'quadOut' 
            })
            .call(() => {
                // 第二阶段：从最高点落到目标位置
                tween(this.node)
                    .to(duration * 0.6, { 
                        position: targetPosition 
                    }, { 
                        easing: 'quadIn' 
                    })
                    .call(() => {
                        // 落地完成，等待后飞向玩家
                        this.onLanded();
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
        
        tween(this.node)
            .to(duration, { eulerAngles: randomRotation })
            .start();
    }

    /**
     * 落地完成
     */
    private onLanded(): void {
        this._isLanded = true;
        
        // 等待0.3秒后飞向玩家
        this.scheduleOnce(() => {
            this.pickUpToBackpack();
            //this.startFlyToPlayer();
        }, 0.02);
    }

    /**
     * 开始飞向玩家背包
     */
    private startFlyToPlayer(): void {
        if (!this._playerNode || this._isPickedUp) return;
        
        this._isFlyingToPlayer = true;
    }

    /**
     * 获取背包目标位置
     */
    private getBackpackTargetPosition(): Vec3 {
        if (!this._playerBackpack || !this._playerBackpack.backpackMount) {
            // 如果没有背包组件，飞向玩家位置
            return this._playerNode ? this._playerNode.position : this.node.position;
        }
        
        // 获取背包挂载点的世界位置
        const backpackMount = this._playerBackpack.backpackMount;
        const worldPos = new Vec3();
        backpackMount.getWorldPosition(worldPos);
        
        // 根据当前木头数量计算堆叠位置
        const currentWoodCount = this._playerBackpack.getWoodCount();
        const layerHeight = this._playerBackpack.layerHeight || 0.3;
        
        // 添加高度偏移
        worldPos.y += currentWoodCount * layerHeight;
        
        return worldPos;
    }

    /**
     * 更新飞向玩家的逻辑
     */
    private updateFlyToPlayer(deltaTime: number): void {
        if (!this._playerNode) return;
        
        // 获取背包目标位置
        const targetPosition = this.getBackpackTargetPosition();
        
        // 计算到目标的方向
        Vec3.subtract(this._tempVec3, targetPosition, this.node.position);
        const distanceToTarget = this._tempVec3.length();
        
        // 检查是否已经到达目标位置
        if (distanceToTarget < 0.3) {
            this.pickUpToBackpack();
            return;
        }
        
        // 标准化方向向量
        Vec3.normalize(this._tempVec3, this._tempVec3);
        
        // 计算移动距离
        const moveDistance = this.flySpeed * deltaTime;
        
        // 计算新位置
        Vec3.multiplyScalar(this._tempVec3, this._tempVec3, moveDistance);
        Vec3.add(this._tempVec3, this.node.position, this._tempVec3);
        
        // 应用新位置
        this.node.setPosition(this._tempVec3);
        
        // 让木头旋转
        const currentRotation = this.node.eulerAngles.clone();
        currentRotation.y += 360 * deltaTime;
        this.node.setRotationFromEuler(currentRotation);
    }

    /**
     * 拾取到背包并堆叠
     */
    private pickUpToBackpack(): void {
        if (this._isPickedUp) return;
        
        this._isPickedUp = true;

        this.enabled = false;
        var storagePoint = this._playerBackpack.backpackMount.getComponent(StoragePoint);

        if(storagePoint.hasSpace(1) == false){
            this.node.destroy();
            //MaxTip.showMaxTip();
            return;
        }

        storagePoint.addResource(this.node, 2);
    }

    /**
     * 播放背包拾取特效
     */
    private playBackpackPickupEffect(): void {
        // 缩小并消失
        // tween(this.node)
        //     .to(0.2, { 
        //         scale: new Vec3(0.1, 0.1, 0.1)
        //     })
        //     .call(() => {
        //         this.onPickedUp?.(this);
        //         this.node.destroy();
        //     })
        //     .start();
    }

    /**
     * 直接拾取（碰撞拾取）
     */
    private pickUpDirectly(): void {
        if (this._isPickedUp) return;
        
        this._isPickedUp = true;
        
        // 添加到背包
        if (this._playerBackpack) {
            this._playerBackpack.addWood(this.woodValue);
        }
        
        // 简单拾取动画
        tween(this.node)
            .to(0.2, { 
                position: new Vec3(this.node.position.x, this.node.position.y + 1, this.node.position.z),
                scale: new Vec3(0.1, 0.1, 0.1)
            })
            .call(() => {
                this.onPickedUp?.(this);
                this.node.destroy();
            })
            .start();
    }

    /**
     * 设置掉落参数
     */
    public setupDrop(position: Vec3, value: number = 1): void {
        this._startPosition.set(position);
        this.woodValue = value;
        this.node.setPosition(position);
    }

    /**
     * 获取木头价值
     */
    public getWoodValue(): number {
        return this.woodValue;
    }

    /**
     * 强制拾取
     */
    public forcePickup(): void {
        this.pickUpToBackpack();
    }
}
