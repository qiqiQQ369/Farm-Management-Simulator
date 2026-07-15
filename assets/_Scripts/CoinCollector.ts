import { _decorator, Component, Node, Vec3, Collider, ITriggerEvent, tween, Prefab, instantiate, find, Label } from 'cc';
import { PlayerController } from './PlayerController';
import { CoinBackpack } from './CoinBackpack';
import { StoragePoint } from './Resource/StoragePoint';
import { ResourceManager } from './Resource/ResourceManager';
const { ccclass, property } = _decorator;

/**
 * 金币收集器组件
 * 检测玩家进入金币装载区，自动收集金币到玩家背包
 */
@ccclass('CoinCollector')
export class CoinCollector extends Component {
    
    @property({ type: Node, tooltip: "金币装载区域" })
    public coinLoadArea: Node = null!;
    
    @property({ type: CoinBackpack, tooltip: "玩家金币背包" })
    public playerCoinBackpack: CoinBackpack = null!;
    
    @property({ tooltip: "收集间隔时间（秒）" })
    public collectInterval: number = 0.05;
    
    @property({ tooltip: "每次收集数量" })
    public coinsPerCollection: number = 1;
    
    @property({ tooltip: "收集动画时间" })
    public collectAnimationTime: number = 0.5;
    
    @property({ tooltip: "金币飞行高度" })
    public coinFlyHeight: number = 2.0;
    
    @property({ tooltip: "是否显示调试信息" })
    public showDebug: boolean = true;
    
    // 私有属性
    private _isPlayerInArea: boolean = false;
    private _playerNode: Node | null = null;
    private _playerController: PlayerController | null = null;
    private _collectTimer: number = 0;
    private _isCollecting: boolean = false;

    
    // 临时向量
    private _tempVec3: Vec3 = new Vec3();

    protected onLoad(): void {
        this.setupCollisionDetection();
        this.validateComponents();
    }

    protected update(dt: number): void {
        this._collectTimer += dt;

        if(!this._isPlayerInArea || this._collectTimer < this.collectInterval) return;

        this._collectTimer = 0;

        this.collectCoin();
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
            console.error('CoinCollector: 节点上没有找到Collider组件');
        }
    }

    /**
     * 验证必要组件
     */
    private validateComponents(): void {
        if (!this.coinLoadArea) {
            console.error('CoinCollector: 金币装载区域未设置');
        }
        
        if (!this.playerCoinBackpack) {
            // 尝试自动查找
            this.playerCoinBackpack = this.node.scene.getComponentInChildren(CoinBackpack);
            if (!this.playerCoinBackpack) {
                console.error('CoinCollector: 玩家金币背包未设置且无法自动找到');
            }
        }
    }

    /**
     * 玩家进入区域
     */
    private onPlayerEnter(event: ITriggerEvent): void {
        if (this.isPlayerNode(event.otherCollider.node)) {

            this._isPlayerInArea = true;
            this._playerNode = event.otherCollider.node;
            this._playerController = this._playerNode.getComponent(PlayerController);
            this._collectTimer = 0;

            //this.collectCoinsFromArea(10);
            
            if (this.showDebug) {
                console.log('玩家进入金币收集区域');
            }
        }
    }

    /**
     * 玩家离开区域
     */
    private onPlayerExit(event: ITriggerEvent): void {
        if (this.isPlayerNode(event.otherCollider.node)) {
            this._isPlayerInArea = false;
            this._playerNode = null;
            this._playerController = null;
            this._collectTimer = 0;
            this._isCollecting = false;
            
            if (this.showDebug) {
                console.log('玩家离开金币收集区域');
            }
        }
    }

    /**
     * 判断是否是玩家节点
     */
    private isPlayerNode(node: Node): boolean {
        return node.name === 'Player' || 
               node.getComponent(PlayerController) !== null ||
               node.parent?.name === 'Player';
    }

    /**
     * 从区域收集金币
     */
    // private async collectCoinsFromArea(count: number): Promise<void> {
    //     const coins = this.coinLoadArea.children;

    //     var coinAmount = find('Canvas/CoinLabel/coinAmount');
    //     var coinStoragePoint = this.node.getComponent(StoragePoint);

    //     // 从后往前收集（类似车辆收集逻辑）
    //     for (let i = coins.length - 1; i >= 0; i--) {
    //         console.log('收集金币', i);
    //         const coin = coins[i];
    //         if (coin) {
    //             var storagePoint = this.playerCoinBackpack.coinBackpackMount.getComponent(StoragePoint);
                
    //             storagePoint.addResource(coin, 4, new Vec3(0, 0, 360), false);
    //             coinStoragePoint.amount = coins.length - i;

    //             console.log('coinAmount', coinAmount);
    //             var coinAmountLabel = coinAmount.getComponent(Label);
    //             coinAmountLabel.string = (parseInt(coinAmountLabel.string) + 20).toString();

    //             await new Promise(resolve => setTimeout(resolve, 100));
    //         }
    //     }
    // }

    private collectCoin(): void {
        
        const coins = this.coinLoadArea.children;
        if(coins.length == 0) return;

        var coinAmount = find('Canvas/CoinLabel/coinAmount');

        var storagePoint = this.playerCoinBackpack.coinBackpackMount.getComponent(StoragePoint);
        var coinStoragePoint = this.node.getComponent(StoragePoint);

        var coin = coins[coins.length - 1];

        coinStoragePoint.amount = coins.length - 1;

        if(ResourceManager.tweenDicCoin.has(coin)) {
            ResourceManager.tweenDicCoin.get(coin).call(() =>{
                storagePoint.addResource(coin, 4, new Vec3(0, 0, 360), false);
                var coinAmountLabel = coinAmount.getComponent(Label);
                coinAmountLabel.string = (parseInt(coinAmountLabel.string) + 5).toString();
            });
        }
        else {
            storagePoint.addResource(coin, 4, new Vec3(0, 0, 360), false);
            var coinAmountLabel = coinAmount.getComponent(Label);
            coinAmountLabel.string = (parseInt(coinAmountLabel.string) + 5).toString();
        }
    }

}
