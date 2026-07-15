import { _decorator, Component, Node, Vec3, Prefab, instantiate } from 'cc';
import { StoragePoint } from './Resource/StoragePoint';
const { ccclass, property } = _decorator;

/**
 * 木头背包组件
 * 处理玩家背上的木头堆叠显示
 */
@ccclass('WoodBackpack')
export class WoodBackpack extends Component {
    
    @property({ type: Prefab, tooltip: "木头显示预制件" })
    public woodDisplayPrefab: Prefab = null!;
    
    @property({ type: Node, tooltip: "背包挂载点" })
    public backpackMount: Node = null!;
    
    @property({ tooltip: "每层木头的高度偏移" })
    public layerHeight: number = 0.2;
    
    @property({ tooltip: "木头缩放比例" })
    public woodScale: number = 0.8;
    
    @property({ tooltip: "最大堆叠层数" })
    public maxLayers: number = 2000;
    
    @property({ tooltip: "每层轻微的随机偏移" })
    public randomOffset: number = 0.1;
    
    // 私有属性
    private _woodCount: number = 0;
    private _woodDisplays: Node[] = [];
    
    // 事件
    public onWoodCountChanged: ((count: number) => void) | null = null;

    protected onLoad(): void {
        // 如果没有设置背包挂载点，创建一个
        if (!this.backpackMount) {
            this.backpackMount = new Node('BackpackMount');
            this.backpackMount.setParent(this.node);
            this.backpackMount.setPosition(0, 1.5, -0.5); // 默认在背后
        }
    }

    /**
     * 添加木头
     */
    public addWood(count: number = 1): void {
        for (let i = 0; i < count; i++) {
            // if (this._woodCount >= this.maxLayers) {
            //     console.log('背包已满，无法再添加木头');
            //     break;
            // }
            
            this.createWoodDisplay();
            this._woodCount++;
        }
        
        this.onWoodCountChanged?.(this._woodCount);
    }

    /**
     * 移除木头
     */
    public removeWood(count: number = 1): boolean {
        if (this._woodCount < count) {
            return false;
        }
        
        for (let i = 0; i < count; i++) {
            this.removeWoodDisplay();
            this._woodCount--;
        }
        
        this.onWoodCountChanged?.(this._woodCount);
        return true;
    }

    /**
     * 创建木头显示
     */
    private createWoodDisplay(): void {
        if (!this.woodDisplayPrefab) {
            return;
        }
        
        const woodDisplay = instantiate(this.woodDisplayPrefab);
        woodDisplay.setParent(this.backpackMount);

        this.backpackMount.getComponent(StoragePoint).addResource(woodDisplay, 2);
        return;
        
        // 设置位置（堆叠效果）
        const layer = this._woodCount;
        const yOffset = layer * this.layerHeight;
        
        woodDisplay.setPosition(0, yOffset, 0);
        woodDisplay.setScale(this.woodScale, this.woodScale, this.woodScale);
        woodDisplay.setRotationFromEuler(0, 0, 0);
        
        // 播放添加动画
        this.playAddAnimation(woodDisplay);
        
        this._woodDisplays.push(woodDisplay);
    }

    /**
     * 移除木头显示
     */
    private removeWoodDisplay(): void {
        if (this._woodDisplays.length === 0) return;
        
        const woodDisplay = this._woodDisplays.pop()!;
        
        // 播放移除动画
        this.playRemoveAnimation(woodDisplay, () => {
            if (woodDisplay && woodDisplay.isValid) {
                woodDisplay.destroy();
            }
        });
    }

    /**
     * 播放添加动画
     */
    private playAddAnimation(woodNode: Node): void {
        // 从稍高的位置掉落
        const finalPos = woodNode.position.clone();
        woodNode.setPosition(finalPos.x, finalPos.y + 0.5, finalPos.z);
        
        const { tween } = require('cc');
        tween(woodNode)
            .to(0.2, { position: finalPos }, { easing: 'bounceOut' })
            .start();
    }

    /**
     * 播放移除动画
     */
    private playRemoveAnimation(woodNode: Node, callback: () => void): void {
        const { tween } = require('cc');
        const finalPos = new Vec3(woodNode.position.x, woodNode.position.y + 1, woodNode.position.z);
        
        tween(woodNode)
            .parallel(
                tween().to(0.3, { position: finalPos }),
                tween().to(0.3, { scale: new Vec3(0.1, 0.1, 0.1) })
            )
            .call(callback)
            .start();
    }

    /**
     * 获取当前木头数量
     */
    public getWoodCount(): number {
        return this._woodCount;
    }


    /**
     * 清除所有木头显示
     */
    public clearAllWoodDisplays(): void {
        for (const woodDisplay of this._woodDisplays) {
            if (woodDisplay && woodDisplay.isValid) {
                woodDisplay.destroy();
            }
        }
        this._woodDisplays = [];
        this._woodCount = 0;
        this.onWoodCountChanged?.(0);
    }

    /**
     * 移除木头但不销毁节点
     */
    public removeWoodWithoutDestroy(count: number): boolean {
        if (this._woodCount < count) {
            return false;
        }
        
        // 只减少计数，不销毁节点（节点会被移动到其他地方）
        for (let i = 0; i < count; i++) {
            if (this._woodDisplays.length > 0) {
                this._woodDisplays.pop(); // 从显示列表中移除，但不销毁
            }
            this._woodCount--;
        }
        
        this.onWoodCountChanged?.(this._woodCount);
        return true;
    }

    /**
     * 添加现有的木头节点到背包
     */
    public addWoodWithExistingNodes(count: number): void {
        // 只增加计数，节点已经在正确位置
        this._woodCount += count;
        this.onWoodCountChanged?.(this._woodCount);
    }

    /**
     * 设置背包位置
     */
    public setBackpackPosition(position: Vec3): void {
        if (this.backpackMount) {
            this.backpackMount.setPosition(position);
        }
    }

    /**
     * 获取背包状态信息
     */
    public getBackpackInfo(): { count: number, maxCount: number, isFull: boolean } {
        return {
            count: this._woodCount,
            maxCount: this.maxLayers,
            isFull: this._woodCount >= this.maxLayers
        };
    }
}