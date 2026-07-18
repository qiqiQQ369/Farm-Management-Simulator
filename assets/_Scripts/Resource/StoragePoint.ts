import { _decorator, Component, Vec3, Node, Enum, tween, Root, Quat, AudioSource } from 'cc';
import { ResourceManager } from './ResourceManager';
const { ccclass, property } = _decorator;

export enum ResourceType {
    Wood = 0,
    Coin = 1,
}

export class PosData{
    pos: Vec3;
    Node: Node;
    CanMove: boolean
}

/**
 * 存放点配置
 * 定义资源的存放规则和位置
 */
@ccclass('StoragePoint')
export class StoragePoint extends Component {
    
    @property({ tooltip: "存放点名称" })
    public storageName: string = "木材仓库";
    
    @property({ tooltip: "是否自动堆叠" })
    public autoStack: boolean = true;
    
    @property({ tooltip: "是否显示容量信息" })
    public showCapacityInfo: boolean = true;

    @property({ tooltip: "容量" })
    public capacity: number = 0;
    
    @property({ tooltip: "数量" })
    public amount: number = 0;

    @property({type: Enum(ResourceType), tooltip: "类型" })
    public type: ResourceType = ResourceType.Wood;

    @property({ tooltip: "层数" })
    public layers: number = 10;

    @property({ tooltip: "层高" })
    public layerHeight: number = 0.2;
    
    @property({ tooltip: "每行数量" })
    public resourcePerRow: number = 5;
    @property({ tooltip: "每行间距" })
    public resourceRowSpacing: number = 0.2;
    
    @property({ tooltip: "每列数量" })
    public resourcePerCol: number = 5;

    @property({ tooltip: "每列间距" })
    public resourceColSpacing: number = 0.2;

    @property({ type: Node, tooltip: "堆叠区域节点" })
    public stackAreaNode: Node = null;

    @property({ tooltip: "资源移动动画持续时间（秒）" })
    public moveAnimationDuration: number = 1.0;
    
    @property({ tooltip: "资源消失动画持续时间（秒）" })
    public fadeAnimationDuration: number = 0.5;
    
    @property({ tooltip: "资源移动曲线类型" })
    public moveEasing: string = 'sineOut';
    
    @property({ tooltip: "资源消失曲线类型" })
    public fadeEasing: string = 'sineIn';

    @property({ tooltip: "检查偏移" })
    public checkOffset: boolean = false;

    @property
    public audioInterval: number = 0.2;
    private canPlayAudio: boolean = true;

    // @property({ tooltip: "偏移量" })
    private offset: Vec3 = new Vec3(0, 0, -10);
    private offset2: Vec3 = new Vec3(0, -52, -10);

    @property({ type: Node, tooltip: "检查存放点" })
    public checkStoragePoint: Node = null;

    private resourceDic: Map<number, PosData> = new Map<number, PosData>();
    private removedDic: Map<number, PosData> = new Map<number, PosData>();
    
    protected onLoad(): void {
        if(this.stackAreaNode == null) {
            this.stackAreaNode = this.node;
        }
    }
    
    /**
     * 检查是否接受指定类型的资源
     */
    public acceptsResourceType(resourceType: ResourceType): boolean {
        return this.type == resourceType;
    }
    
    /**
     * 检查是否有足够空间
     */
    public hasSpace(requiredCapacity: number): boolean {
        return this.amount + requiredCapacity <= this.capacity;
    }
    
    /**
     * 获取可用空间
     */
    public getAvailableSpace(): number {
        return this.capacity - this.amount;
    }
    
    /**
     * 计算单个资源的存放位置
     */
    private calculateStackPosition(index: number, resource: Node): Vec3 {

        const resourcePerLayer = this.resourcePerRow * this.resourcePerCol;
        var layer = Math.floor(index / resourcePerLayer);
        const posInLayer = index % resourcePerLayer;
        
        // 计算网格中的行列位置
        var row = Math.floor(posInLayer / this.resourcePerRow);
        var col = posInLayer % this.resourcePerRow; 
        
        // 计算实际位置（居中排列）
        const x = (col - 1) * this.resourceRowSpacing;
        const z = (row - 1) * this.resourceColSpacing;
        const y = layer * this.layerHeight;
        
        return new Vec3(x, y, z);
    }
    
    /**
     * 添加资源到存放点
     */
    public addResource(resource: Node, animationType: number = 1, rotation: Vec3 = Vec3.ZERO, removeFromParent: boolean = true): boolean {
        if(resource == null) return false;

        if (!this.hasSpace(1)) {
            // console.warn(`存放点 ${this.storageName} 空间不足`);
            return false;
        }

        if(this.checkOffset && this.checkStoragePoint != null) {
            this.checkStoragePoint.setPosition(this.offset2);
            // this.checkStoragePoint.setPosition(new Vec3(-0.4, -0.42, -0.38));
            // this.checkStoragePoint.setRotationFromEuler(new Vec3(19.2, -5.9, 3));
            //this.checkStoragePoint.setPosition(new Vec3(0.2, -0.4, 0.58));
        }

        var index = this.amount;

        if(this.removedDic.size > 0) {
            var removedKeys = Array.from(this.removedDic.keys());
            removedKeys.sort((a, b) => a - b);
            index = removedKeys[0];
            this.removedDic.delete(index);
        }
        
        const position = this.calculateStackPosition(index, resource);

        this.resourceDic.set(index, {
            pos: position,
            Node: resource,
            CanMove: animationType == 4 ? false : true
        });

        var worldPos = resource.worldPosition;
        resource.setParent(this.stackAreaNode);
        resource.setWorldPosition(worldPos);

        if(animationType == 1) {
            resource.setPosition(position);
            ResourceManager.playAddAnimation(resource);
            
        } else if(animationType == 2) {
            ResourceManager.playAddAnimation2(resource, position, this.stackAreaNode, () => {
            });
        }
        else if(animationType == 3) {
            ResourceManager.playAddAnimation3(resource, position, this.stackAreaNode, () => {
            });
        }
        else if(animationType == 4) {
            ResourceManager.playAddAnimation4(resource, position, this.stackAreaNode, rotation, () => {
                const posData = this.resourceDic.get(index);
                if (posData) {
                    posData.CanMove = true;
                }
            });
        }

        this.amount++;
        
        return true;
    }

     /**
     * 从存放点移除资源
     */
     public removeResource(animationType: number = 1): Node {
        if (this.amount < 1) {

            if(this.checkOffset && this.checkStoragePoint != null) {
                this.checkStoragePoint.setPosition(this.offset);
                // this.checkStoragePoint.setRotationFromEuler(new Vec3(9.1, -1.7, 0));
            }

            console.warn(`存放点 ${this.storageName} 资源不足`);
            return null;
        }

        var resource = null;

        if(this.resourceDic.size > 0 && animationType == 4) {
            var resourceKeys = Array.from(this.resourceDic.keys());
            resourceKeys.sort((a, b) => a - b);

            for(var i = resourceKeys.length - 1; i >= 0; i--) {
                var posData = this.resourceDic.get(resourceKeys[i]);

                if(posData != null && posData.CanMove){
                    resource = posData.Node;
                    this.resourceDic.delete(resourceKeys[i]); 
                    this.removedDic.set(resourceKeys[i], posData);
                    this.amount--;
                    break;
                }
            }
        }

        if(resource == null && animationType != 4) {
            resource = this.stackAreaNode.children[this.amount - 1];
            this.amount--;
        }

        if(this.amount < 1)
        {
            if(this.checkOffset && this.checkStoragePoint != null) {
                this.checkStoragePoint.setPosition(this.offset);
                // this.checkStoragePoint.setRotationFromEuler(new Vec3(9.1, -1.7, 0));
            }
        }
        // console.log(`存放点 ${this.storageName} 移除资源: x1`);
        return resource;
    }

    /**
     * 检查是否存在已经完成入库动画、可以被转移的资源。
     */
    public hasMovableResource(): boolean {
        if (this.amount < 1 || this.resourceDic.size === 0) {
            return false;
        }

        for (const posData of this.resourceDic.values()) {
            if (posData.CanMove) {
                return true;
            }
        }

        return false;
    }

    /**
     * Completes resources left mid-transfer when the application was hidden.
     * Browser requestAnimationFrame callbacks may be discarded while the tab
     * is in the background, leaving CanMove false forever after returning.
     */
    public recoverInterruptedTransfers(): void {
        const stackArea = this.stackAreaNode ?? this.node;
        const resources = [...stackArea.children].filter(resource => resource?.isValid);

        // Rebuild all three pieces of storage state together. Merely setting
        // CanMove is insufficient when a backgrounded frame was lost between
        // reparenting the node and updating amount/resourceDic.
        this.resourceDic.clear();
        this.removedDic.clear();

        for (let index = 0; index < resources.length; index++) {
            const resource = resources[index];
            const position = this.calculateStackPosition(index, resource);
            resource.setParent(stackArea);
            resource.setPosition(position);
            resource.setRotationFromEuler(Vec3.ZERO);
            this.resourceDic.set(index, {
                pos: position,
                Node: resource,
                CanMove: true,
            });
        }

        this.amount = resources.length;
    }

    /**
     * Releases one resource whose add/move animation never reported completion.
     *
     * This is intentionally separate from removeResource(): normal transfers
     * still wait for CanMove. Callers may use this only after their own timeout
     * so an interrupted animation cannot permanently deadlock a storage point.
     */
    public releaseStalledResource(): Node | null {
        if (this.amount < 1) {
            return null;
        }

        const keys = Array.from(this.resourceDic.keys()).sort((a, b) => b - a);
        for (const key of keys) {
            const posData = this.resourceDic.get(key);
            if (!posData?.Node?.isValid) {
                this.resourceDic.delete(key);
                continue;
            }

            this.resourceDic.delete(key);
            posData.CanMove = true;
            this.removedDic.set(key, posData);
            this.amount = Math.max(0, this.amount - 1);
            return posData.Node;
        }

        // Recover an old count/dictionary desynchronization as well. Storage
        // mounts used by the transport loop contain resource visuals only.
        const fallbackIndex = Math.min(this.amount, this.stackAreaNode?.children.length ?? 0) - 1;
        const fallbackResource = fallbackIndex >= 0 ? this.stackAreaNode.children[fallbackIndex] : null;
        if (fallbackResource?.isValid) {
            this.amount = Math.max(0, this.amount - 1);
            return fallbackResource;
        }

        // No node exists for the serialized count. Clear the stale count so the
        // hauler can leave Loading instead of waiting forever.
        this.amount = 0;

        return null;
    }
    
    /**
     * 播放资源移动动画
     * @param resource 资源节点
     * @param targetPosition 目标位置
     * @param onComplete 完成回调
     */
    private playResourceMoveAnimation(resource: Node, targetPosition: Vec3, onComplete?: () => void): void {
        if (!resource) {
            if (onComplete) onComplete();
            return;
        }

        // 起点：物体当前位置
        const startPosition = resource.worldPosition.clone();
        
        // 随机选择左边或右边作为抛射方向
        const throwSide = Math.random() > 0.5 ? 1 : -1;
        
        // 计算投掷控制点（大幅偏移到左边或右边）
        const controlPoint = new Vec3();
        
        // 计算基础方向
        const direction = new Vec3();
        Vec3.subtract(direction, targetPosition, startPosition);
        const perpendicular = new Vec3(-direction.z, 0, direction.x);
        Vec3.normalize(perpendicular, perpendicular);
        
        const distance = Vec3.distance(startPosition, targetPosition);
        
        // 控制点位置：不在中间，而是偏向一边
        const controlPointProgress = 0.2 + Math.random() * 0.2; // 0.3-0.7之间
        Vec3.lerp(controlPoint, startPosition, targetPosition, controlPointProgress);
        
        // 大幅度左右偏移 (1.0 到 1.5 倍距离)
        const sideOffset = (1.0 + Math.random() * 0.2) * distance;
        Vec3.scaleAndAdd(controlPoint, controlPoint, perpendicular, throwSide * sideOffset);
        
        // 高度偏移
        const heightOffset = 0.5;//Math.max(2.0, distance * 0.8);
        controlPoint.y += heightOffset;
        
        // 动画参数
        const duration = 0.3 + Math.random() * 0.1; // 0.35-0.5秒
        const startTime = Date.now();
        
        // 旋转参数（更快的旋转）
        const rotationDirection = throwSide; // 与抛射方向相同
        const rotationSpeed = 180; // 540-900度
        
        const updateBezier = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            let t = Math.min(elapsed / duration, 1.0);
            
            if (t >= 1.0) {
                resource.setWorldPosition(targetPosition);
                resource.rotation = new Quat(0, 0, 0, 1);

                resource.destroy();
                if (onComplete) onComplete();
                return;
            }
            
            // 2阶贝塞尔曲线计算
            const oneMinusT = 1 - t;
            const currentPos = new Vec3(
                oneMinusT * oneMinusT * startPosition.x + 2 * oneMinusT * t * controlPoint.x + t * t * targetPosition.x,
                oneMinusT * oneMinusT * startPosition.y + 2 * oneMinusT * t * controlPoint.y + t * t * targetPosition.y,
                oneMinusT * oneMinusT * startPosition.z + 2 * oneMinusT * t * controlPoint.z + t * t * targetPosition.z
            );
            
            resource.setWorldPosition(currentPos);
            
            // 快速旋转动画
            const currentAngle = rotationDirection * rotationSpeed * t;
            resource.setRotationFromEuler(currentAngle, 0, 0);//currentAngle);
            
            requestAnimationFrame(updateBezier);
        };
        
        updateBezier();


        // 记录原始位置和缩放
        const originalPosition = resource.position.clone();
        const originalScale = resource.scale.clone();
        
    //     // 计算抛物线最高点（在起点和终点之间，高度为距离的一半）
    //     const distance = Vec3.distance(originalPosition, targetPosition);
    //     const midPoint = new Vec3();
    //     Vec3.lerp(midPoint, originalPosition, targetPosition, 0.5);
    //     midPoint.y += 2;//distance * 0.3; // 抛物线最高点
        
    //     // 创建抛物线移动动画
    //     const moveTween = tween(resource)
    //         .to(this.moveAnimationDuration * 0.6, {
    //             position: midPoint
    //         }, {
    //             easing: 'sineOut'
    //         })
    //         .to(this.moveAnimationDuration * 0.4, {
    //             position: targetPosition
    //         }, {
    //             easing: 'sineIn'
    //         })
    //         .call(() => {
    //             resource.destroy();
    //             if (onComplete) onComplete();
    //         })
    //         .start();
    }

    /**
     * 播放资源移动动画（带弹跳效果）
     * @param resource 资源节点
     * @param targetPosition 目标位置
     * @param onComplete 完成回调
     */
    private playResourceMoveAnimationWithBounce(resource: Node, targetPosition: Vec3, onComplete?: () => void): void {
        if (!resource) {
            if (onComplete) onComplete();
            return;
        }

        // 记录原始位置和缩放
        const originalPosition = resource.position.clone();
        const originalScale = resource.scale.clone();
        
        // 计算抛物线最高点
        const distance = Vec3.distance(originalPosition, targetPosition);
        const midPoint = new Vec3();
        Vec3.lerp(midPoint, originalPosition, targetPosition, 0.5);
        midPoint.y += 2;// distance * 0.4; // 抛物线最高点

        // console.log('playResourceMoveAnimationWithBounce', targetPosition);
        
        // 创建带弹跳的抛物线移动动画
        const moveTween = tween(resource)
            .to(this.moveAnimationDuration * 0.5, {
                worldPosition: midPoint
            }, {
                easing: 'sineOut'
            })
            .to(this.moveAnimationDuration * 0.3, {
                worldPosition: new Vec3(targetPosition.x, targetPosition.y + distance * 0.1, targetPosition.z)
            }, {
                easing: 'sineIn'
            })
            .to(this.moveAnimationDuration * 0.1, {
                worldPosition: targetPosition
            }, {
                easing: 'bounceOut'
            })
            .call(() => {
                resource.destroy();
                if (onComplete) onComplete();
            })
            .start();
    }

    /**
     * 播放资源移动动画（带旋转效果）
     * @param resource 资源节点
     * @param targetPosition 目标位置
     * @param onComplete 完成回调
     */
    private playResourceMoveAnimationWithRotation(resource: Node, targetPosition: Vec3, onComplete?: () => void): void {
        if (!resource) {
            if (onComplete) onComplete();
            return;
        }

        // 记录原始位置、缩放和旋转
        const originalPosition = resource.position.clone();
        const originalScale = resource.scale.clone();
        const originalRotation = resource.eulerAngles.clone();
        
        // 计算抛物线最高点
        const distance = Vec3.distance(originalPosition, targetPosition);
        const midPoint = new Vec3();
        Vec3.lerp(midPoint, originalPosition, targetPosition, 0.5);
        midPoint.y += distance * 0.35;
        
        // 计算旋转角度（根据移动方向）
        const moveDirection = new Vec3();
        Vec3.subtract(moveDirection, targetPosition, originalPosition);
        const rotationAngle = Math.atan2(moveDirection.z, moveDirection.x) * 180 / Math.PI;
        
        // 创建带旋转的抛物线移动动画
        const moveTween = tween(resource)
            .parallel(
                tween(resource)
                    .to(this.moveAnimationDuration * 0.6, {
                        position: midPoint
                    }, {
                        easing: 'sineOut'
                    })
                    .to(this.moveAnimationDuration * 0.4, {
                        position: targetPosition
                    }, {
                        easing: 'sineIn'
                    }),
                tween(resource)
                    .to(this.moveAnimationDuration, {
                        eulerAngles: new Vec3(0, rotationAngle + 360, 0)
                    }, {
                        easing: 'linear'
                    })
            )
            .call(() => {
                resource.destroy();
                if (onComplete) onComplete();
            })
            .start();
    }

    public removeResourceWithAnimation(
        targetPosition: Vec3, 
        animationType: 'parabola' | 'bounce' | 'rotation' = 'parabola',
        onComplete?: () => void
    ): Node {
        if (this.amount < 1) {
            console.warn(`存放点 ${this.storageName} 资源不足`);
            if (onComplete) onComplete();
            return null;
        }
        
        const resource = this.stackAreaNode.children[this.amount - 1];

        this.amount -= 1;

        if(this.amount < 1)
        {
            if(this.checkOffset && this.checkStoragePoint != null) {
                this.checkStoragePoint.setPosition(this.offset);
                // this.checkStoragePoint.setRotationFromEuler(new Vec3(9.1, -1.7, 0));
            }
        }

        
        // console.log(`存放点 ${this.storageName} 移除资源: x1`);
        
        // 根据动画类型选择不同的动画方法
        switch (animationType) {
            case 'bounce':
                this.playResourceMoveAnimationWithBounce(resource, targetPosition, onComplete);
                break;
            case 'rotation':
                this.playResourceMoveAnimationWithRotation(resource, targetPosition, onComplete);
                break;
            case 'parabola':
            default:
                this.playResourceMoveAnimation(resource, targetPosition, onComplete);
                break;
        }
        
        return resource;
    }

    public clearStorage(): void {
        this.resourceDic.clear();
        this.removedDic.clear();
        this.amount = 0;
        this.node.removeAllChildren();
    }

    public playAudio(): void{
        if(this.canPlayAudio == false) return;
        this.canPlayAudio = false;
        var audioSource = this.node.getComponent(AudioSource);
        if(audioSource != null) {
            audioSource.playOneShot(audioSource.clip);
            this.scheduleOnce(() => {
                this.canPlayAudio = true;
            }, this.audioInterval);
        }
    }

}
