import { _decorator, Component, Node, Vec3, Collider, ITriggerEvent, AudioSource, tween, find, ICollisionEvent, utils, Animation, instantiate, Prefab, log } from 'cc';
import { TreeData, TreeState } from './TreeData';
import { Utils } from './Utils';
import { WoodDropManager } from './WoodDropManager'
import { LoggingTruck } from './LoggingTruck';
import { WoodBackpack } from './WoodBackpack';
const { ccclass, property } = _decorator;

/**
 * 砍伐者类型枚举
 */
export enum ChopperType {
    Player = 'player',      // 玩家
    Woodcutter = 'woodcutter', // 伐木工
    Vehicle = 'vehicle'     // 伐木车
}

/**
 * 砍伐者信息接口
 */
export interface ChopperInfo {
    type: ChopperType;
    node: Node;
    controller: any;
    chopCount: number;      // 砍伐次数
    chopDuration: number;   // 砍伐时间
    efficiency: number;     // 砍伐效率
}

/**
 * 单个树木组件
 * 管理树木的状态、动画和交互，支持多种砍伐者类型
 */
@ccclass('Tree')
export class Tree extends Component {
    private _interactionColliders: Collider[] = [];
    
    @property({ type: TreeData, tooltip: "树木数据配置" })
    public treeData: TreeData = null!;
    
    @property({ type: Node, tooltip: "完整树冠节点" })
    public fullCrownNode: Node = null!;
    
    @property({ type: Node, tooltip: "半砍树冠节点" })
    public halfCrownNode: Node = null!;
    
    @property({ type: Node, tooltip: "树干节点" })
    public trunkNode: Node = null!;
    
    @property({ type: AudioSource, tooltip: "音频组件" })
    public audioSource: AudioSource = null!;
    
    @property({ type: WoodDropManager, tooltip: "木头掉落管理器" })
    public woodDropManager: WoodDropManager = null!;

    @property({ type: Prefab, tooltip: "特效节点" })
    public effectNode: Prefab = null!;
    // 特效对象池
    private _effectPool: Node[] = [];

    private getEffectFromPool(): Node {
        let node = this._effectPool.pop();
        if (!node) {
            node = instantiate(this.effectNode);
        }
        node.setParent(this.node);
        node.active = true;
        return node;
    }

    private recycleEffectNode(node: Node): void {
        if (!node || !node.isValid) return;
        try { tween(node).stop(); } catch (e) { /* ignore */ }
        // 重置基础属性，避免复用时出现残留
        node.setScale(1, 1, 1);
        node.eulerAngles = new Vec3(0, 0, 0);
        node.active = false;
        node.setParent(this.node);
        this._effectPool.push(node);
    }
    
    // 砍伐者配置
    @property({ tooltip: "玩家砍伐次数" })
    public playerChopCount: number = 2;
    
    @property({ tooltip: "伐木工砍伐次数" })
    public woodcutterChopCount: number = 1;
    
    @property({ tooltip: "伐木车砍伐次数" })
    public vehicleChopCount: number = 3;
    
    @property({ tooltip: "玩家砍伐时间" })
    public playerChopDuration: number = 2.0;
    
    @property({ tooltip: "伐木工砍伐时间" })
    public woodcutterChopDuration: number = 1.5;
    
    @property({ tooltip: "伐木车砍伐时间" })
    public vehicleChopDuration: number = 3.0;
    
    // 木材堆叠配置
    @property({ type: Node, tooltip: "木材堆叠位置（伐木工和伐木车使用）" })
    public woodStackPosition: Node = null!;
    
    @property({ tooltip: "木材堆叠半径" })
    public woodStackRadius: number = 2.0;
    
    @property({ tooltip: "木材堆叠高度" })
    public woodStackHeight: number = 1.0;
    
    @property({ tooltip: "木材堆叠层数" })
    public woodStackLayers: number = 3;
    
    @property({ tooltip: "每层木材数量" })
    public woodPerLayer: number = 4;
    
    // 私有属性
    private _currentState: TreeState = TreeState.Full;
    private _currentChopCount: number = 0;
    private _isChopping: boolean = false;
    private _choppingSince: number = 0;
    private _respawnTimer: number = 0;
    private _initialPosition: Vec3 = new Vec3();
    
    // 砍伐者管理
    private _currentChopper: ChopperInfo | null = null;
    private _choppersInRange: Map<Node, ChopperInfo> = new Map();
    private _chopperPriority: ChopperType[] = [ChopperType.Vehicle, ChopperType.Woodcutter, ChopperType.Player];
    
    // 木材堆叠管理
    private _woodStackCount: number = 0;
    private _currentStackLayer: number = 0;
    private _currentStackIndex: number = 0;

    // 事件
    public onTreeChopped: ((tree: Tree, reward: { wood: number, exp: number }, chopper: ChopperInfo) => void) | null = null;
    public onStateChanged: ((tree: Tree, newState: TreeState) => void) | null = null;
    public onChoppingStarted: ((tree: Tree, chopper: ChopperInfo) => void) | null = null;
    public onChoppingStopped: ((tree: Tree, chopper: ChopperInfo) => void) | null = null;

    protected onLoad(): void {

        this.playerChopCount = 1;
        this.woodcutterChopCount = 4;
        this.vehicleChopCount = 1;

        this.playerChopDuration = 0.6;
        this.woodcutterChopDuration = 0.6;

        this.vehicleChopDuration = 0.1;

        this.woodPerLayer = 10;
        this.woodStackLayers = 1000;
        this.woodStackRadius = 0.2;
        this.woodStackHeight = 0.2;

        this.treeData.woodReward = 3;
        
        // 保存初始位置
        this._initialPosition = this.node.position.clone();
        
        // 设置初始状态
        this.setState(TreeState.Full);
        
        // 确保有音频组件
        if (!this.audioSource) {
            this.audioSource = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
        }

        // 初始化木材堆叠
        this.initializeWoodStack();

        this.fullCrownNode = this.node.getChildByName("Point001_Shu").getChildByName("Bone_ShuGan").getChildByName("songshu_01_a");
        this.halfCrownNode = this.node.getChildByName("Point001_Shu").getChildByName("Bone_ShuGan").getChildByName("songshu_01_b");
        this.trunkNode = this.node.getChildByName("Point001_Shu").getChildByName("Bone_ShuGan").getChildByName("songshu_01");
    }

    start() {
        // 设置碰撞检测
        this.setupCollisionDetection();
    }

    protected update(deltaTime: number): void {
        switch (this._currentState) {
            case TreeState.Full:
            case TreeState.Half:
            case TreeState.Half2:
                this.handleChoppingLogic(deltaTime);
                break;
                
            case TreeState.Chopped:
                // 处理重生逻辑
                this._respawnTimer += deltaTime;
                if (this._respawnTimer >= this.treeData.respawnTime) {
                    this.respawnTree();
                }
                break;
        }
    }

    /**
     * 设置碰撞检测
     */
    private setupCollisionDetection(): void {
        this._interactionColliders = this.getInteractionColliders();
        for (const collider of this._interactionColliders) {
            collider.on('onTriggerEnter', this.onChopperEnter, this);
            collider.on('onTriggerExit', this.onChopperExit, this);
        }
    }

    private getInteractionColliders(): Collider[] {
        const colliders = this.node.getComponents(Collider).filter((collider) => !!collider);
        return colliders;
    }

    private setInteractionCollidersEnabled(enabled: boolean): void {
        if (this._interactionColliders.length === 0) {
            this._interactionColliders = this.getInteractionColliders();
        }

        for (const collider of this._interactionColliders) {
            collider.enabled = enabled;
        }
    }

    /**
     * 砍伐者进入检测区域
     */
    private onChopperEnter(event: ITriggerEvent): void {
        const chopperNode = event.otherCollider.node;
        const chopperInfo = this.identifyChopper(chopperNode);
        if (chopperInfo) {
            this._choppersInRange.set(chopperNode, chopperInfo);
            // 检查是否可以开始砍伐
            this.checkStartChopping();
        }
    }

    /**
     * 砍伐者离开检测区域
     */
    private onChopperExit(event: ITriggerEvent): void {
        const chopperNode = event.otherCollider.node;
        
        if (this._choppersInRange.has(chopperNode)) {
            const chopperInfo = this._choppersInRange.get(chopperNode)!;
            this._choppersInRange.delete(chopperNode);
            
            // 如果是当前砍伐者，停止砍伐
            if (this._currentChopper && this._currentChopper.node === chopperNode) {
                this.stopChopping();
                // if(this._currentChopper.type == ChopperType.Player) {
                //     this._currentChopper.controller.chopAction.chopingTreeNode = null;
                // }
            }
        }
    }

    /**
     * 识别砍伐者类型
     */
    private identifyChopper(node: Node): ChopperInfo | null {
        // 检查是否为玩家
        if (this.isPlayerNode(node)) {
            const controller = this.getPlayerController(node);
            return {
                type: ChopperType.Player,
                node: node,
                controller: controller,
                chopCount: this.playerChopCount,
                chopDuration: this.playerChopDuration,
                efficiency: 1.0
            };
        }
        
        // 检查是否为伐木工
        if (this.isWoodcutterNode(node)) {
            const controller = node.getComponent('Woodcutter');
            return {
                type: ChopperType.Woodcutter,
                node: node,
                controller: controller,
                chopCount: this.woodcutterChopCount,
                chopDuration: this.woodcutterChopDuration,
                efficiency: 1
            };
        }
        
        // 检查是否为伐木车
        if (this.isVehicleNode(node)) {
            const controller = node.getComponent(LoggingTruck);
            return {
                type: ChopperType.Vehicle,
                node: node,
                controller: controller,
                chopCount: this.vehicleChopCount,
                chopDuration: 0,
                efficiency: 100
            };
        }
        
        return null;
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
     * 检查节点是否为伐木工节点
     */
    private isWoodcutterNode(node: Node): boolean {
        return node.name.includes('Woodcutter') || 
               node.getComponent('Woodcutter') !== null ||
               node.parent?.name.includes('Woodcutter');
    }

    /**
     * 检查节点是否为伐木车节点
     */
    private isVehicleNode(node: Node): boolean {
        return node.name.includes('Vehicle') || 
               node.name.includes('Truck') ||
               node.getComponent('VehicleCollector') !== null ||
               node.parent?.name.includes('Vehicle');
    }

    /**
     * 处理砍伐逻辑
     */
    private handleChoppingLogic(deltaTime: number): void {
        this.pruneInactiveChoppers();

        if (this._choppersInRange.size === 0) {
            if (this._isChopping) {
                this.stopChopping();
            }
            return;
        }

        // 选择优先级最高的砍伐者
        this.selectPriorityChopper();
        
        if (!this._currentChopper) {
            if (this._isChopping) {
                this.stopChopping();
            }
            return;
        }

        // 伐木工的砍伐次数由每次挥斧动画完成后显式登记，避免定时器与动画错位。
        if (this._currentChopper.type === ChopperType.Woodcutter) {
            return;
        }

        // 检查砍伐者是否停止移动
        const isChopperMoving = this.isChopperMoving(this._currentChopper);
        
        if (!isChopperMoving) {
            // 砍伐者停止移动，开始或继续砍伐
            if (!this._isChopping) {
                this.startChopping();
            }
            
            // 累计砍伐时间（考虑效率）
            this._choppingSince += deltaTime * this._currentChopper.efficiency;
            
            // 检查是否完成一次砍伐
            if (this._choppingSince >= this._currentChopper.chopDuration || (this._currentChopCount == 0 && this._currentChopper.type == ChopperType.Player)) {
                this.completeChop();
            }
        } else {
            // 砍伐者正在移动，停止砍伐
            if (this._isChopping) {
                this.stopChopping();
            }
        }
    }

    private pruneInactiveChoppers(): void {
        for (const [node] of this._choppersInRange) {
            if (!node || !node.isValid || !node.activeInHierarchy) {
                this._choppersInRange.delete(node);

                if (this._currentChopper && this._currentChopper.node === node) {
                    this._currentChopper = null;
                }
            }
        }
    }

    /**
     * 选择优先级最高的砍伐者
     */
    private selectPriorityChopper(): void {
        let selectedChopper: ChopperInfo | null = null;
        const preferInteractiveTakeover =
            this._currentState === TreeState.Half ||
            this._currentState === TreeState.Half2;
        const priorityOrder = preferInteractiveTakeover
            ? [ChopperType.Vehicle, ChopperType.Player, ChopperType.Woodcutter]
            : this._chopperPriority;
        
        // 按优先级选择砍伐者
        for (const priorityType of priorityOrder) {
            for (const [node, chopperInfo] of this._choppersInRange) {
                if (chopperInfo.type === priorityType &&
                    chopperInfo.node.isValid &&
                    chopperInfo.node.activeInHierarchy) {
                    selectedChopper = chopperInfo;
                    break;
                }
            }
            if (selectedChopper) break;
        }
        
        this._currentChopper = selectedChopper;
    }

    /**
     * 检查砍伐者是否在移动
     */
    private isChopperMoving(chopper: ChopperInfo): boolean {
        switch (chopper.type) {
            case ChopperType.Player:
                return false;
                
            case ChopperType.Woodcutter:
                return chopper.controller && chopper.controller.getCurrentState ? 
                       chopper.controller.getCurrentState() === 'moving' : false;
                
            case ChopperType.Vehicle:
                return false;
                return chopper.controller && chopper.controller.isMoving ? chopper.controller.isMoving() : false;
                
            default:
                return false;
        }
    }

    /**
     * 检查是否可以开始砍伐
     */
    private checkStartChopping(): void {
        if (this._choppersInRange.size > 0 && 
            this._currentChopper && 
            !this.isChopperMoving(this._currentChopper) && 
            !this._isChopping &&
            (this._currentState === TreeState.Full || this._currentState === TreeState.Half || this._currentState === TreeState.Half2)) {
                // if(this._currentChopper.type == ChopperType.Player) {
                //     if(this._currentChopper.controller.chopAction.chopingTreeNode == null) {
                //         this._currentChopper.controller.chopAction.chopingTreeNode = this.node;
                //     }
                //     else {
                //         if(this._currentChopper.controller.chopAction.chopingTreeNode != this.node) {
                //            return;
                //         }
                //     }
                // }
            this.startChopping();
        }
    }



    /**
     * 开始砍伐
     */
    private startChopping(): void {
        if (!this._currentChopper || this._isChopping ||
            (this._currentState !== TreeState.Full && this._currentState !== TreeState.Half && this._currentState !== TreeState.Half2)) {
            return;
        }

        this._isChopping = true;
        this._choppingSince = 0;        
        this.makeChopperFaceTree();
    }

    /**
     * 停止砍伐
     */
    private stopChopping(): void {
        if (!this._isChopping) return;
        
        this._isChopping = false;
        this._choppingSince = 0;
        
        // 触发事件
        if (this._currentChopper) {
            this.onChoppingStopped?.(this, this._currentChopper);
        }
    }

    /**
     * 登记伐木工完成的一次挥斧。
     */
    public registerWoodcutterChop(chopperNode: Node): boolean {
        const chopper = this._choppersInRange.get(chopperNode);
        const isChoppableState = this._currentState === TreeState.Full ||
            this._currentState === TreeState.Half ||
            this._currentState === TreeState.Half2;

        if (!chopper || chopper.type !== ChopperType.Woodcutter || !isChoppableState) {
            return false;
        }

        this._currentChopper = chopper;
        this._isChopping = true;
        void this.completeChop();
        return true;
    }

    /**
     * 完成一次砍伐
     */
    private async completeChop(): Promise<void> {
        if (!this._currentChopper || this._isChopping == false) return;
        
        this._currentChopCount++;
        this._isChopping = false;
        this._choppingSince = 0;

        if(this._currentChopper.type == ChopperType.Player) {
            this._currentChopper.controller.chopAction.playChopAction(this.node.position);
            await new Promise(resolve => setTimeout(resolve, 500));
            this._currentChopper.controller.refreshMovementAnimation?.();
        }

        this.playShakeAnimation();
        // 根据砍伐者类型生成木材
        this.spawnWoodDrops();

        if(this._currentChopper.type == ChopperType.Player || this._currentChopper.type == ChopperType.Woodcutter) {
            if (this.effectNode) {
                const effect = this.getEffectFromPool();
                // 简单的特效生命周期
                this.scheduleOnce(() => {
                    this.recycleEffectNode(effect);
                }, 1);
            }
        }

        if (this._currentChopCount >= this._currentChopper.chopCount) {
            if(this._currentChopper.type == ChopperType.Player && this._isChopping) {
                this._currentChopper.controller.chopAction.playIdleAnimation();
            }

            // 砍伐完成
            this.setState(TreeState.Chopped);
            this.onTreeChopped?.(this, {
                wood: 3 / this._currentChopper.chopCount,
                exp: this.treeData.expReward
            }, this._currentChopper);

            this.stopChopping();
        } else {

            if(this._currentChopCount == 1) {
                this.setState(TreeState.Half);
            }

            if(this._currentChopCount == 2) {
                this.setState(TreeState.Half2);
            }
            
            // 进入半砍状态
            // this.setState(TreeState.Half);
            
            // 继续砍伐下一阶段
            this.scheduleOnce(() => {
                this.checkStartChopping();
            }, 0.1);
        }
    }

    /**
     * 让砍伐者面向树木
     */
    private makeChopperFaceTree(): void {
        if (!this._currentChopper) return;
        
        switch (this._currentChopper.type) {
            case ChopperType.Player:
                if (this._currentChopper.controller &&
                    this._currentChopper.controller.faceTarget &&
                    (!this._currentChopper.controller.isMoving || !this._currentChopper.controller.isMoving())) {
                    this._currentChopper.controller.faceTarget(this.node.position);
                }
                break;
                
            case ChopperType.Woodcutter:
                if (this._currentChopper.controller && this._currentChopper.controller.faceTarget) {
                    //this._currentChopper.controller.faceTarget(this.node.position);
                }
                break;
                
            case ChopperType.Vehicle:
                // 车辆通常不需要面向树木
                break;
        }
    }

    /**
     * 设置树木状态
     */
    private setState(newState: TreeState): void {
        if (this._currentState === newState) return;
        
        this._currentState = newState;
        this.updateVisualState();
        this.onStateChanged?.(this, newState);
    }

    /**
     * 更新视觉状态
     */
    private updateVisualState(): void {
        switch (this._currentState) {
            case TreeState.Full:
                this.showFullTree();
                break;
                
            case TreeState.Half:
                this.showHalfTree();
                break;

            case TreeState.Half2:
                this.showHalfTree2();
                break;  
                
            case TreeState.Chopped:
                this.hideTree();
                break;
                
            case TreeState.Respawning:
                this.showRespawningTree();
                break;
        }
    }

    /**
     * 显示完整树木
     */
    private showFullTree(): void {
        if (this.fullCrownNode) this.fullCrownNode.active = true;
        if (this.halfCrownNode) this.halfCrownNode.active = true;
        if (this.trunkNode) this.trunkNode.active = true;
        
        // 重置缩放
        //this.node.setScale(1, 1, 1);
    }

    /**
     * 显示半砍树木
     */
    private showHalfTree(): void {
        if (this.fullCrownNode) this.fullCrownNode.active = false;
        if (this.halfCrownNode) this.halfCrownNode.active = true;
        if (this.trunkNode) this.trunkNode.active = true;
        
        // 添加摇摆动画
        //this.playShakeAnimation();
    }

    /**
     * 显示半砍树木
     */
    private showHalfTree2(): void {
        if (this.fullCrownNode) this.fullCrownNode.active = false;
        if (this.halfCrownNode) this.halfCrownNode.active = false;
        if (this.trunkNode) this.trunkNode.active = true;
        
        // 添加摇摆动画
        //this.playShakeAnimation();
    }

    /**
     * 隐藏树木
     */
    private hideTree(): void {
        if (this.fullCrownNode) this.fullCrownNode.active = false;
        if (this.halfCrownNode) this.halfCrownNode.active = false;
        if (this.trunkNode) this.trunkNode.active = false;

        this.setInteractionCollidersEnabled(false);
        
        // 播放消失动画
        //this.playDisappearAnimation();
    }

    /**
     * 显示重生中的树木
     */
    private showRespawningTree(): void {
        if (this.trunkNode) this.trunkNode.active = true;
        if (this.fullCrownNode) this.fullCrownNode.active = false;
        if (this.halfCrownNode) this.halfCrownNode.active = false;
        

        //this.getComponent(Animation).play("chusheng");
        
        // 播放生长动画
        //this.playGrowAnimation();
    }

    /**
     * 重生树木
     */
    private respawnTree(): void {

        this._currentChopCount = 0;
        this._respawnTimer = 0;
        this._isChopping = false;
        this._choppingSince = 0;

        if (this.fullCrownNode) this.fullCrownNode.active = true;
        if (this.halfCrownNode) this.halfCrownNode.active = true;
        if (this.trunkNode) this.trunkNode.active = true;

        this.setInteractionCollidersEnabled(true);

        // this.node.setScale(1, 1, 1);
        
        this.getComponent(Animation).play("ChuSheng");

        // 延迟一段时间后恢复到完整状态
        this.scheduleOnce(() => {
            this.setState(TreeState.Full);
        }, 0.1);
    }

    /**
     * 播放摇摆动画
     */
    private playShakeAnimation(): void {
        //const originalRotation = this.node.eulerAngles.clone();
        this.getComponent(Animation).play("KanShu");
        // tween(this.node)
        //     .to(0.1, { eulerAngles: new Vec3(originalRotation.x, originalRotation.y, originalRotation.z + 5) })
        //     .to(0.2, { eulerAngles: new Vec3(originalRotation.x, originalRotation.y, originalRotation.z - 5) })
        //     .to(0.1, { eulerAngles: originalRotation })
        //     .start();
    }


    /**
     * 播放砍伐音效
     */
    private playChopSound(): void {
    }


    /**
     * 获取玩家控制器
     */
    private getPlayerController(playerNode?: Node): any {
        if (playerNode) {
            return playerNode.getComponent('PlayerController');
        }
        
        // 尝试查找玩家节点
        const playerNode2 = find('Player') || 
                           this.node.getParent()?.getChildByName('Player') ||
                           this.node.scene?.getChildByName('Player');
        
        return playerNode2?.getComponent('PlayerController');
    }

    /**
     * 获取当前状态
     */
    public getCurrentState(): TreeState {
        return this._currentState;
    }

    /**
     * 获取当前砍伐者信息
     */
    public getCurrentChopper(): ChopperInfo | null {
        return this._currentChopper;
    }

    /**
     * 获取砍伐者类型
     */
    public getChopperType(): ChopperType | null {
        return this._currentChopper ? this._currentChopper.type : null;
    }

    /**
     * 获取砍伐进度
     */
    public getChopProgress(): number {
        if (!this._currentChopper) return 0;
        return this._currentChopCount / this._currentChopper.chopCount;
    }

    /**
     * 获取砍伐时间进度
     */
    public getChopTimeProgress(): number {
        if (!this._currentChopper) return 0;
        return this._choppingSince / this._currentChopper.chopDuration;
    }

    /**
     * 设置砍伐者优先级
     */
    public setChopperPriority(priority: ChopperType[]): void {
        this._chopperPriority = priority;
    }

    /**
     * 强制重置树木
     */
    public reset(): void {
        this._currentChopCount = 0;
        this._respawnTimer = 0;
        this._isChopping = false;
        this._choppingSince = 0;
        this._currentChopper = null;
        this._choppersInRange.clear();
        
        this.setState(TreeState.Full);
        this.node.setPosition(this._initialPosition);
    }

    /**
     * 初始化木材堆叠
     */
    private initializeWoodStack(): void {
        this._woodStackCount = 0;
        this._currentStackLayer = 0;
        this._currentStackIndex = 0;
        
        if (!this.woodStackPosition) {
            // 如果没有指定堆叠位置，使用树木位置
            this.woodStackPosition = find("woodStackArea");
        }
    }

    /**
     * 生成木头掉落物
     * 根据砍伐者类型决定木材处理方式
     */
    private async spawnWoodDrops(): Promise<void> {
        if (!this._currentChopper) return;

        await new Promise(resolve => setTimeout(resolve, 100));
        
        const woodCount = this.treeData.woodReward;
        
        switch (this._currentChopper.type) {
            case ChopperType.Player:
                // 玩家：随机掉落木材
                this.spawnRandomWoodDrops(woodCount);
                break;
                
            case ChopperType.Woodcutter:
            case ChopperType.Vehicle:
                // 伐木工和伐木车：堆叠木材到指定位置
                this.stackWoodAtPosition(woodCount);
                break;
        }
    }

    /**
     * 随机掉落木材（玩家使用）
     */
    private async spawnRandomWoodDrops(woodCount: number): Promise<void> {
        if (this.woodDropManager) {
            // 在树的位置随机生成木材掉落物
            var position = this.node.position.clone();
            position.x += -3.363214;
            position.z += -1.260171;
            for(let i = 0; i < woodCount; i++) {
                this.woodDropManager.spawnWoodDrops(position, 1, 2, this._currentChopper.node.getComponent(WoodBackpack).backpackMount, this._currentChopper.node.position);
                await new Promise(resolve => setTimeout(resolve, 60));
            }

            //this.woodDropManager.spawnWoodDrops(position, woodCount, 1, null);
        } else {
            console.warn('木头掉落管理器未设置');
        }
    }

    /**
     * 在指定位置堆叠木材（伐木工和伐木车使用）
     */
    private async stackWoodAtPosition(woodCount: number): Promise<void> {
        if (!this.woodStackPosition) {
            this.woodStackPosition = find("woodStackArea");
            console.warn('木材堆叠位置未设置，使用:' + this.woodStackPosition.name);
            //this.spawnRandomWoodDrops(woodCount);
            //return;
        }

        var position = this.node.position.clone();
            position.x += -3.363214;
            position.z += -1.260171;

        var woodCount1 = 3;
        if(this._currentChopper.type == ChopperType.Woodcutter)
            woodCount1 = 2;
        for(let i = 0; i < woodCount1; i++) {
            this.woodDropManager.spawnWoodDrops(position, 1, 2, this.woodStackPosition, this._currentChopper.node.position);
            await new Promise(resolve => setTimeout(resolve, 60));
        }
    }

    /**
     * 计算木材堆叠位置
     */
    private calculateWoodStackPositions(woodCount: number): Vec3[] {
        const positions: Vec3[] = [];
        const basePosition = this.woodStackPosition.position.clone();

        this._woodStackCount = this.woodStackPosition.children.length;

        for (let i = 0; i < woodCount; i++) {
            // 计算当前木材在堆叠中的位置
            const layer = Math.floor(this._woodStackCount / (this.woodPerLayer * this.woodStackLayers));
            const layerIndex = this._woodStackCount % (this.woodPerLayer * this.woodStackLayers);
            const currentLayer = Math.floor(layerIndex / this.woodPerLayer);
            const currentIndex = layerIndex % this.woodPerLayer;
            
            // 计算在层内的位置
            const angle = (currentIndex / this.woodPerLayer) * Math.PI * 2;
            const radius = this.woodStackRadius * (1 - currentLayer / this.woodStackLayers);
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = currentLayer * this.woodStackHeight;
            
            // 添加随机偏移，让堆叠看起来更自然
            //const randomOffset = 0.2;
            const finalX = basePosition.x + x;// + (Math.random() - 0.5) * randomOffset;
            const finalZ = basePosition.z + z;// + (Math.random() - 0.5) * randomOffset;
            const finalY = basePosition.y + y;// + (Math.random() - 0.5) * randomOffset * 0.5;
            
            positions.push(new Vec3(finalX, finalY, finalZ));
            this._woodStackCount++;
        }
        
        return positions;
    }

    /**
     * 计算堆叠位置
     */
    private calculateStackPosition(index: number): Vec3 {
        index += this.woodStackPosition.children.length;
        const woodsPerLayer = 10;  // 每层9根木头 (3x3)
        const layer = Math.floor(index / woodsPerLayer);
        const posInLayer = index % woodsPerLayer;
        
        // 计算3x3网格中的行列位置
        const row = posInLayer;// % 10;//Math.floor(posInLayer / 10);  // 0, 1, 2
        const col = 1;//posInLayer % 3;              // 0, 1, 2
        
        // 计算实际位置（居中排列）
        const x = (row - 1) * 0.2;  // -0.6, 0, 0.6
        const z = (col - 1) * 0.8;  // -0.6, 0, 0.6

        const y = layer * this.woodStackHeight;
        
        return new Vec3(x, y, z);
    }

    /**
     * 设置木材堆叠位置
     */
    public setWoodStackPosition(position: Node): void {
        this.woodStackPosition = position;
    }

    /**
     * 获取当前木材堆叠信息
     */
    public getWoodStackInfo(): {
        totalWood: number,
        currentLayer: number,
        currentIndex: number,
        stackPosition: Node | null
    } {
        return {
            totalWood: this._woodStackCount,
            currentLayer: this._currentStackLayer,
            currentIndex: this._currentStackIndex,
            stackPosition: this.woodStackPosition
        };
    }

    /**
     * 清空木材堆叠
     */
    public clearWoodStack(): void {
        this._woodStackCount = 0;
        this._currentStackLayer = 0;
        this._currentStackIndex = 0;
    }

    /**
     * 重置木材堆叠位置
     */
    public resetWoodStackPosition(): void {
        this.woodStackPosition = find("woodStackArea");
        this.clearWoodStack();
    }
}
