import { _decorator, Component, Node, Vec3, instantiate, Prefab } from 'cc';
import { Tree } from './Tree';
import { TreeState } from './TreeData';
const { ccclass, property } = _decorator;

/**
 * 树木管理器
 * 负责管理场景中的所有树木
 */
@ccclass('TreeManager')
export class TreeManager extends Component {
    
    @property({ type: Prefab, tooltip: "树木预制件" })
    public treePrefab: Prefab = null!;
    
    @property({ tooltip: "初始树木数量" })
    public initialTreeCount: number = 10;
    
    @property({ tooltip: "树木生成区域半径" })
    public spawnRadius: number = 20;
    
    @property({ tooltip: "树木之间的最小距离" })
    public minTreeDistance: number = 3;
    
    // 私有属性
    private _trees: Tree[] = [];
    private _playerWoodCount: number = 0;
    private _playerExp: number = 0;
    
    // 事件
    public onWoodCollected: ((woodCount: number, totalWood: number) => void) | null = null;
    public onExpGained: ((exp: number, totalExp: number) => void) | null = null;

    protected onLoad(): void {
        this.generateInitialTrees();
    }

    /**
     * 生成初始树木
     */
    private generateInitialTrees(): void {
        for (let i = 0; i < this.initialTreeCount; i++) {
            const position = this.findValidSpawnPosition();
            if (position) {
                this.createTreeAt(position);
            }
        }
        
    }

    /**
     * 寻找有效的生成位置
     */
    private findValidSpawnPosition(): Vec3 | null {
        const maxAttempts = 50;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // 生成随机位置
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.spawnRadius;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            
            const position = new Vec3(x, 0, z);
            
            // 检查是否与其他树木距离足够
            if (this.isPositionValid(position)) {
                return position;
            }
        }
        
        console.warn('找不到有效的树木生成位置');
        return null;
    }

    /**
     * 检查位置是否有效
     */
    private isPositionValid(position: Vec3): boolean {
        for (const tree of this._trees) {
            const distance = Vec3.distance(position, tree.node.position);
            if (distance < this.minTreeDistance) {
                return false;
            }
        }
        return true;
    }

    /**
     * 在指定位置创建树木
     */
    private createTreeAt(position: Vec3): Tree | null {
        if (!this.treePrefab) {
            console.error('树木预制件未设置');
            return null;
        }
        
        const treeNode = instantiate(this.treePrefab);
        treeNode.setParent(this.node);
        treeNode.setPosition(position);
        
        const treeComponent = treeNode.getComponent(Tree);
        if (treeComponent) {
            // 设置事件回调
            treeComponent.onTreeChopped = this.onTreeChopped.bind(this);
            treeComponent.onStateChanged = this.onTreeStateChanged.bind(this);
            
            this._trees.push(treeComponent);
            return treeComponent;
        } else {
            console.error('树木预制件缺少Tree组件');
            treeNode.destroy();
            return null;
        }
    }

    /**
     * 树木被砍伐的回调
     */
    private onTreeChopped(tree: Tree, reward: { wood: number, exp: number }): void {
        this._playerWoodCount += reward.wood;
        this._playerExp += reward.exp;
        
        console.log(`获得 ${reward.wood} 木材，${reward.exp} 经验值`);
        console.log(`总计：${this._playerWoodCount} 木材，${this._playerExp} 经验值`);
        
        // 触发事件
        this.onWoodCollected?.(reward.wood, this._playerWoodCount);
        this.onExpGained?.(reward.exp, this._playerExp);
    }

    /**
     * 树木状态改变的回调
     */
    private onTreeStateChanged(tree: Tree, newState: TreeState): void {
        console.log(`树木状态改变为: ${TreeState[newState]}`);
        
        // 如果树木被完全砍伐，可以考虑在其他地方生成新树
        if (newState === TreeState.Chopped) {
            this.scheduleOnce(() => {
                this.trySpawnNewTree();
            }, 5.0);
        }
    }

    /**
     * 尝试生成新树木
     */
    private trySpawnNewTree(): void {
        if (this._trees.length < this.initialTreeCount * 2) {
            const position = this.findValidSpawnPosition();
            if (position) {
                this.createTreeAt(position);
                console.log('生成了新的树木');
            }
        }
    }

    /**
     * 获取附近的树木
     */
    public getNearbyTrees(position: Vec3, radius: number): Tree[] {
        return this._trees.filter(tree => {
            const distance = Vec3.distance(position, tree.node.position);
            return distance <= radius && tree.getCurrentState() !== TreeState.Chopped;
        });
    }

    /**
     * 获取可砍伐的树木数量
     */
    public getChoppableTreeCount(): number {
        return this._trees.filter(tree => 
            tree.getCurrentState() === TreeState.Full || 
            tree.getCurrentState() === TreeState.Half
        ).length;
    }

    /**
     * 重置所有树木
     */
    public resetAllTrees(): void {
        for (const tree of this._trees) {
            tree.reset();
        }
        
        this._playerWoodCount = 0;
        this._playerExp = 0;
        
        console.log('重置了所有树木');
    }

    /**
     * 获取玩家资源
     */
    public getPlayerResources(): { wood: number, exp: number } {
        return {
            wood: this._playerWoodCount,
            exp: this._playerExp
        };
    }

    /**
     * 添加木材
     */
    public addWood(amount: number): void {
        this._playerWoodCount += amount;
        this.onWoodCollected?.(amount, this._playerWoodCount);
    }

    /**
     * 添加经验值
     */
    public addExp(amount: number): void {
        this._playerExp += amount;
        this.onExpGained?.(amount, this._playerExp);
    }
}