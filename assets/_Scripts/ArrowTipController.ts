import { _decorator, Component, find, Node, Quat, Vec3 } from 'cc';
import { StoragePoint } from './Resource/StoragePoint';
//import { GameFlowManager, GameState } from './GameFlowManager';
//import { MainUI } from '../ui/MainUI';
//import { SceneManager } from './SceneManager';
//import { MoneyPileController } from './MoneyPileController';
const { ccclass, property } = _decorator;

@ccclass('ArrowTipController')
export class ArrowTipController extends Component {
    public static inst: ArrowTipController;  // 单例实例
    
    // 新增：目标位置箭头节点（需在编辑器绑定）
    @property({ type: Node, tooltip: '目标位置的箭头提示节点' })
    targetArrowTip: Node = null!;

    // 箭头相关属性（需在编辑器中绑定）
    // @property({ type: Node, tooltip: '状态指向箭头提示节点' })
    arrowTip: Node = null!;
    @property({ type: Vec3, tooltip: '箭头相对于玩家的偏移量' })
    arrowOffset: Vec3 = new Vec3(0, 0, 0);

    // 当前箭头指向的目标节点（用于触发判断）
    private currentTargetNode: Node | null = null;
    // 新增：手动隐藏标志位（防止update覆盖隐藏状态）
    private isManuallyHidden: boolean = false;

    @property({ type: Node, tooltip: '砍树引导节点' })
    public chopGuideNode: Node = null!;
    @property({ type: StoragePoint, tooltip: '玩家木材存储点' })
    public playerWoodStorageNode: StoragePoint = null!;
    @property({ type: StoragePoint, tooltip: '玩家金币存储点' })
    public playerCoinStorageNode: StoragePoint = null!;
    @property({ type: StoragePoint, tooltip: '砍树木材存储点' })
    public cutterWoodStorageNode: StoragePoint = null!;
    @property({ type: StoragePoint, tooltip: '金币掉落存储点' })
    public coinDropStorageNode: StoragePoint = null!;
    @property({ type: StoragePoint, tooltip: '卖木材存储点' })
    public sellWoodStorageNode: StoragePoint = null!;

    @property({ type: Node, tooltip: '卖木材引导节点' })
    public sellWoodGuideNode: Node = null!;
    private isSelling: boolean = false;
    private isSelling1: boolean = false;
    private sellCount: number = 0;
    private unlockLevel: number = 1;

    @property({ type: Node, tooltip: '解锁等级1节点' })
    public unlockLevelNode1: Node = null!;
    @property({ type: Node, tooltip: '解锁等级2节点' })
    public unlockLevelNode2: Node = null!;
    @property({ type: Node, tooltip: '解锁等级3节点' })
    public unlockLevelNode3: Node = null!;

    private _tmpVec3: Vec3 = new Vec3(0,0,0);

    protected onLoad() {
        // 单例初始化
        if (ArrowTipController.inst) {
            console.error("ArrowTipController实例已存在");
            this.destroy();
            return;
        }
        
        ArrowTipController.inst = this;
        this.arrowTip = this.node;  // 自动获取自身节点
        this.arrowTip.active = false;  // 默认隐藏

        // 新增：初始化目标箭头为隐藏
        this.targetArrowTip.active = false;
    }

    // 更新箭头状态（由PlayerController调用）
    updateArrowTip(playerNode: Node) {
        // 手动隐藏时跳过更新逻辑
        if (this.unlockLevelNode3.parent.active == false) {
            this.operateArrowTip(false);
            return;
        }

        //const currentState = GameFlowManager.inst.currentState;
        let targetNode: Node | null = null;

        this._tmpVec3.y = 0;

        if(this.unlockLevelNode1.parent.active){
            targetNode = this.chopGuideNode;
        }
        else{
            targetNode = this.cutterWoodStorageNode.node;
            var count = this.cutterWoodStorageNode.amount;
            this._tmpVec3.y = count / 10 * 0.2 + 1;
            // if(this.cutterWoodStorageNode.stackAreaNode.children.length > 11){
                // this._tmpVec3.y = targetNode.children[targetNode.children.length - 11].position.y + 2;
            // }
        }

        if(targetNode == this.chopGuideNode && playerNode.position.z < -0.35){
            targetNode = null;
        }

        if(this.playerWoodStorageNode.amount >= 20){
            this.isSelling = true;
            this.sellCount++;
        }
        else if(this.playerWoodStorageNode.amount == 0){
            this.isSelling = false;
        }

        if(this.isSelling1 && this.sellWoodStorageNode.amount == 0){
            this.isSelling1 = false;
        }

        if(this.isSelling || this.isSelling1){
            targetNode = this.sellWoodGuideNode;
            this._tmpVec3.y = 0;
            this.isSelling1 = true;
        }

        if(this.unlockLevelNode1.parent.active)
            this.unlockLevel = 1;
        else if(this.unlockLevelNode2.parent.active)
            this.unlockLevel = 2;
        else if(this.unlockLevelNode3.parent.active)
            this.unlockLevel = 3;

        //钱币存储区金额足够时引导至钱币存储区
        var coinChildren = this.coinDropStorageNode.stackAreaNode.children;

        if(coinChildren.length * 20 >= 100 * this.unlockLevel || 
            ((coinChildren.length + this.playerCoinStorageNode.amount) * 20 >= 100 * this.unlockLevel)){
            targetNode = this.coinDropStorageNode.stackAreaNode;
            this._tmpVec3.y = coinChildren.length / 6 * 0.3 + 0.5;
            // if(coinChildren.length > 7){
            //     this._tmpVec3.y = coinChildren[coinChildren.length - 7].position.y + 0.3;
            // }
        }

        //玩家已获取金币时引导至解锁节点
        if(this.playerCoinStorageNode.amount * 20 >= 100 * this.unlockLevel){
            if(this.unlockLevel == 1){
                targetNode = this.unlockLevelNode1;
            }
            else if(this.unlockLevel == 2){
                targetNode = this.unlockLevelNode2;
            }
            else if(this.unlockLevel == 3){
                targetNode = this.unlockLevelNode3;
            }

            this.isSelling = false;
            this._tmpVec3.y = 0;
        }

        this.currentTargetNode = targetNode;  // 同步目标节点

        if (!targetNode || !targetNode.active) {
            this.operateArrowTip(false);
            return;
        }

        var scale = new Vec3(1,1,1);
        if(targetNode == this.chopGuideNode){
            scale.x = 2;
            scale.y = 2;
            scale.z = 2;
        }
        this.targetArrowTip.setScale(scale);

        this.targetArrowTip.setWorldPosition(targetNode.worldPosition.clone().add(this._tmpVec3));

        // 更新箭头位置和旋转
        
        const playerPos = playerNode.worldPosition;
        this.arrowTip.setWorldPosition(
            playerPos.x + this.arrowOffset.x,
            playerPos.y + this.arrowOffset.y,
            playerPos.z + this.arrowOffset.z
        );

        if(Vec3.distance(this.arrowTip.worldPosition, this.targetArrowTip.worldPosition) < 2){
            this.operateArrowTip(false);
            return;
        }


        this.operateArrowTip(true);

        const direction = new Vec3();
        Vec3.subtract(direction, targetNode.worldPosition, this.arrowTip.worldPosition);
        direction.normalize();
        const rotation = new Quat();
        Quat.fromViewUp(rotation, direction, Vec3.UP);
        Quat.rotateY(rotation, rotation, Math.PI);  // 180度偏移
        
        rotation.x = 0;
        rotation.z = 0;

        this.arrowTip.setRotation(rotation);
    }

    // 触发进入时判断是否隐藏箭头（由PlayerController调用）
    checkTriggerHide(triggerNode: Node) {
        console.log("checkTriggerHide", triggerNode.name, "parent:", triggerNode.parent.name, " TargetNode:", this.currentTargetNode.name);
        if (triggerNode.parent === this.currentTargetNode) {
            this.isManuallyHidden = true;  // 标记为手动隐藏
            this.arrowTip.active = false;
        }
    }
    // 新增：重置手动隐藏状态（例如在触发离开时调用）
    resetManualHide() {
        console.log("checkTriggerHide resetManualHide");
        this.isManuallyHidden = false;
    }

    private operateArrowTip(operate: boolean){
        this.arrowTip.active = operate;
        this.targetArrowTip.active = operate;
    }
}