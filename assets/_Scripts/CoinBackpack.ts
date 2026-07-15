import { _decorator, Component, Node, Vec3, Prefab, instantiate } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 玩家金币背包组件
 * 管理玩家收集的金币显示和堆叠
 */
@ccclass('CoinBackpack')
export class CoinBackpack extends Component {
    
    @property({ type: Prefab, tooltip: "金币显示预制件" })
    public coinDisplayPrefab: Prefab = null!;
    
    @property({ type: Node, tooltip: "金币背包挂载点" })
    public coinBackpackMount: Node = null!;
    
    // 堆叠配置
    @property({ group: { name: "堆叠设置", id: "1" }, tooltip: "金币堆叠行数" })
    public stackRows: number = 3;
    
    @property({ group: { name: "堆叠设置", id: "1" }, tooltip: "金币堆叠列数" })
    public stackColumns: number = 3;
    
    @property({ group: { name: "堆叠设置", id: "1" }, tooltip: "金币堆叠层数" })
    public stackLayers: number = 5;
    
    @property({ group: { name: "堆叠设置", id: "1" }, tooltip: "金币行间距" })
    public rowSpacing: number = 0.2;
    
    @property({ group: { name: "堆叠设置", id: "1" }, tooltip: "金币列间距" })
    public columnSpacing: number = 0.2;
    
    @property({ group: { name: "堆叠设置", id: "1" }, tooltip: "金币层高度" })
    public layerHeight: number = 0.1;
    
    @property({ group: { name: "外观设置", id: "2" }, tooltip: "金币缩放比例" })
    public coinScale: number = 0.5;
    
    @property({ group: { name: "外观设置", id: "2" }, tooltip: "每层轻微的随机偏移" })
    public randomOffset: number = 0.05;
    
    @property({ group: { name: "外观设置", id: "2" }, tooltip: "金币旋转动画速度" })
    public rotationSpeed: number = 90.0; // 度/秒
    
    // 私有属性
    private _coinCount: number = 0;
    private _coinDisplays: Node[] = [];
    private _maxCapacity: number = 0;
    
    // 事件
    public onCoinCountChanged: ((count: number) => void) | null = null;

    protected onLoad(): void {
        this.setupBackpackMount();
        this.calculateMaxCapacity();
    }

    protected start(): void {
        // 可以在这里添加初始金币用于测试
        // this.addCoins(5);
    }

    protected update(deltaTime: number): void {
        // 金币旋转动画
        if (this.rotationSpeed > 0) {
            this.animateCoins(deltaTime);
        }
    }

    /**
     * 设置背包挂载点
     */
    private setupBackpackMount(): void {
        if (!this.coinBackpackMount) {
            this.coinBackpackMount = new Node('CoinBackpackMount');
            this.coinBackpackMount.setParent(this.node);
            // 默认在玩家右侧腰部位置
            this.coinBackpackMount.setPosition(0.8, 0.8, 0);
        }
    }

    /**
     * 计算最大容量
     */
    private calculateMaxCapacity(): void {
        this._maxCapacity = this.stackRows * this.stackColumns * this.stackLayers;
        console.log(`金币背包最大容量: ${this._maxCapacity} (${this.stackRows}行×${this.stackColumns}列×${this.stackLayers}层)`);
    }

    /**
     * 添加金币
     */
    public addCoins(count: number = 1): void {
        for (let i = 0; i < count; i++) {
            if (this._coinCount >= this._maxCapacity) {
                console.log('金币背包已满，无法添加更多金币');
                break;
            }
            
            this.createCoinDisplay();
        }
        
        // 触发事件
        if (this.onCoinCountChanged) {
            this.onCoinCountChanged(this._coinCount);
        }
        
        console.log(`添加 ${count} 枚金币，当前总数: ${this._coinCount}`);
    }

    /**
     * 移除金币
     */
    public removeCoins(count: number = 1): boolean {
        const actualRemoveCount = Math.min(count, this._coinCount);
        
        if (actualRemoveCount === 0) {
            return false;
        }
        
        // 从后往前移除显示的金币
        for (let i = 0; i < actualRemoveCount; i++) {
            const coinDisplay = this._coinDisplays.pop();
            if (coinDisplay && coinDisplay.isValid) {
                coinDisplay.destroy();
            }
            this._coinCount--;
        }
        
        // 触发事件
        if (this.onCoinCountChanged) {
            this.onCoinCountChanged(this._coinCount);
        }
        
        console.log(`移除 ${actualRemoveCount} 枚金币，剩余: ${this._coinCount}`);
        return true;
    }

    /**
     * 创建金币显示
     */
    private createCoinDisplay(): void {
        if (!this.coinDisplayPrefab) {
            console.error('金币显示预制件未设置');
            return;
        }

        const coinDisplay = instantiate(this.coinDisplayPrefab);
        coinDisplay.setParent(this.coinBackpackMount);
        
        // 设置缩放
        coinDisplay.setScale(this.coinScale, this.coinScale, this.coinScale);
        
        // 计算位置
        const position = this.calculateCoinPosition(this._coinCount);
        coinDisplay.setPosition(position);
        
        // 添加到数组
        this._coinDisplays.push(coinDisplay);
        this._coinCount++;
        
        console.log(`创建金币显示 #${this._coinCount}，位置: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    }

    /**
     * 计算金币位置（行列层排列）
     */
    private calculateCoinPosition(index: number): Vec3 {
        const position = new Vec3();
        
        // 计算当前金币在行列层中的位置
        const coinsPerLayer = this.stackRows * this.stackColumns;
        const layer = Math.floor(index / coinsPerLayer);
        const indexInLayer = index % coinsPerLayer;
        const row = Math.floor(indexInLayer / this.stackColumns);
        const column = indexInLayer % this.stackColumns;
        
        // 计算实际位置（以背包挂载点为原点）
        const totalRowWidth = (this.stackRows - 1) * this.rowSpacing;
        const totalColumnWidth = (this.stackColumns - 1) * this.columnSpacing;
        
        position.x = column * this.columnSpacing - totalColumnWidth * 0.5;
        position.z = row * this.rowSpacing - totalRowWidth * 0.5;
        position.y = layer * this.layerHeight;
        
        // 添加随机偏移
        if (this.randomOffset > 0) {
            position.x += (Math.random() - 0.5) * this.randomOffset;
            position.z += (Math.random() - 0.5) * this.randomOffset;
        }
        
        return position;
    }

    /**
     * 金币旋转动画
     */
    private animateCoins(deltaTime: number): void {
        const rotationDelta = this.rotationSpeed * deltaTime;
        
        for (const coinDisplay of this._coinDisplays) {
            if (coinDisplay && coinDisplay.isValid) {
                const currentRotation = coinDisplay.eulerAngles;
                currentRotation.y += rotationDelta;
                coinDisplay.setRotationFromEuler(currentRotation);
            }
        }
    }

    /**
     * 获取金币数量
     */
    public getCoinCount(): number {
        return this._coinCount;
    }

    /**
     * 获取最大容量
     */
    public getMaxCapacity(): number {
        return this._maxCapacity;
    }

    /**
     * 获取背包状态信息
     */
    public getBackpackInfo(): string {
        const percentage = ((this._coinCount / this._maxCapacity) * 100).toFixed(1);
        return `金币背包: ${this._coinCount}/${this._maxCapacity} (${percentage}%)`;
    }

    /**
     * 清空所有金币
     */
    public clearAllCoins(): void {
        for (const coinDisplay of this._coinDisplays) {
            if (coinDisplay && coinDisplay.isValid) {
                coinDisplay.destroy();
            }
        }
        
        this._coinDisplays.length = 0;
        this._coinCount = 0;
        
        // 触发事件
        if (this.onCoinCountChanged) {
            this.onCoinCountChanged(this._coinCount);
        }
        
        console.log('清空所有金币');
    }

    /**
     * 设置金币背包位置
     */
    public setBackpackPosition(position: Vec3): void {
        if (this.coinBackpackMount) {
            this.coinBackpackMount.setPosition(position);
        }
    }

    /**
     * 检查是否可以添加金币
     */
    public canAddCoins(count: number = 1): boolean {
        return this._coinCount + count <= this._maxCapacity;
    }
}