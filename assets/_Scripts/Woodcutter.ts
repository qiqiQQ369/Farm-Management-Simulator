import { _decorator, Component, Node, Vec3, tween, find, SkeletalAnimation } from 'cc';
import { Tree } from './Tree';
import { TreeState } from './TreeData';
import { ChopAction } from './ChopAction';
const { ccclass, property } = _decorator;

// 状态枚举
enum WoodcutterState {
    Idle = 'idle',
    Moving = 'moving',
    Chopping = 'chopping',
    Waiting = 'waiting'
}

/**
 * 伐木工自动砍树控制器
 * 管理伐木工的自动砍树行为，树木列表从场景中指定
 */
@ccclass('Woodcutter')
export class Woodcutter extends Component {
    
    @property({ type: [Node], tooltip: "场景中指定的树木节点列表" })
    public assignedTrees: Node[] = [];
    
    @property({ tooltip: "伐木工移动速度" })
    public moveSpeed: number = 3.0;
    
    @property({ tooltip: "砍伐检测范围" })
    public chopRange: number = 2.0;
    
    @property({ tooltip: "砍伐完成后等待时间" })
    public waitAfterChop: number = 1.0;
    
    @property({ type: ChopAction, tooltip: "砍伐动作组件" })
    public chopAction: ChopAction = null!;
    
    @property({ tooltip: "是否自动开始工作" })
    public autoStart: boolean = true;

    @property({ type: SkeletalAnimation, tooltip: "骨骼动画" })
    public skeletalAnimation: SkeletalAnimation = null!;
    
    // 私有属性
    private _treeList: Tree[] = [];
    private _currentTreeIndex: number = 0;
    private _isMoving: boolean = false;
    private _isChopping: boolean = false;
    private _isChopCycleRunning: boolean = false;
    private _currentTarget: Tree | null = null;
    private _waitTimer: number = 0;
    private _checkReverse: boolean = false;

    @property({ type: Vec3, tooltip: "偏移量" })
    public offsetVec3: Vec3 = new Vec3(-3.4, 0, -1.26);

    private _currentState: WoodcutterState = WoodcutterState.Idle;
    private lastAnimation: string = "idle1_FuTou";
    private idleAnimName: string = "idle1_FuTou"

    private _dir = 1;

    protected onLoad(): void {
        // 确保有砍伐动作组件
        if (!this.chopAction) {
            this.chopAction = this.getComponent(ChopAction) || this.addComponent(ChopAction);
        }
    }

    start() {
        this.scheduleOnce(() => {
            this.initializeTreeList();
            if (this.autoStart) {
                this.startAutoChopCycle();
            }
        }, 1);
    }

    protected update(deltaTime: number): void {
        switch (this._currentState) {
            case WoodcutterState.Idle:
                if(this.lastAnimation != this.idleAnimName){
                    this.skeletalAnimation.play(this.idleAnimName);
                    this.lastAnimation = this.idleAnimName;
                }
                this.handleIdleState();
                break;
                
            case WoodcutterState.Moving:
                this.handleMovingState(deltaTime);
                break;
                
            case WoodcutterState.Chopping:
                this.handleChoppingState(deltaTime);
                break;
                
            case WoodcutterState.Waiting:
                this.handleWaitingState(deltaTime);
                break;
        }
    }

    /**
     * 初始化树木列表
     * 从场景中指定的树木节点获取Tree组件
     */
    private initializeTreeList(): void {
        this._treeList = [];
        
        for (const treeNode of this.assignedTrees) {
            if (treeNode && treeNode.isValid) {
                const treeComponent = treeNode.getComponent(Tree);
                if (treeComponent) {
                    this._treeList.push(treeComponent);
                } else {
                    console.warn(`树木节点 ${treeNode.name} 缺少Tree组件`);
                }
            }
        }
    }

    /**
     * 开始自动砍树循环
     */
    private startAutoChopCycle(): void {
        if (this._treeList.length === 0) {
            this._currentState = WoodcutterState.Idle;
            return;
        }
        
        this._currentState = WoodcutterState.Idle;
    }

    /**
     * 处理空闲状态
     */
    private handleIdleState(): void {
        // 检查当前树木列表是否有效
        this.validateTreeList();
        
        if (this._treeList.length === 0) {
            return;
        }
        
        // 选择下一个目标树木
        this.selectNextTree();
        
        if (this._currentTarget) {
            this._currentState = WoodcutterState.Moving;
            this.skeletalAnimation.play("run2_FuTou");
            this.lastAnimation = "run2_FuTou";
        }
    }

    /**
     * 处理移动状态
     */
    private async handleMovingState(deltaTime: number): Promise<void> {
        if (!this._currentTarget) {
            this._currentState = WoodcutterState.Idle;
            return;
        }

        if(this._checkReverse){
            this.findNextValidTreeReverse(deltaTime);
        }
        
        const targetPosition = this._currentTarget.node.position.clone().add(this.offsetVec3);
        const currentPosition = this.node.position;
        const distance = Vec3.distance(currentPosition, targetPosition);
        
        if (distance <= this.chopRange) {
            // 到达目标位置，开始砍伐
            this._currentState = WoodcutterState.Chopping;
            this.startChopping();
            await new Promise(resolve => setTimeout(resolve, 1000));
            // if(this.lastAnimation != "KanMuTou"){
            //     this.skeletalAnimation.play("KanMuTou");
            //     this.lastAnimation = "KanMuTou";
            // }
            //await new Promise(resolve => setTimeout(resolve, 1000));
            return;
        }
        
        // 移动向目标
        const direction = new Vec3();
        Vec3.subtract(direction, targetPosition, currentPosition);
        direction.normalize();
        
        const newPosition = new Vec3();
        Vec3.scaleAndAdd(newPosition, currentPosition, direction, this.moveSpeed * deltaTime);
        this.node.setPosition(newPosition);
        
        // 面向目标
        this.faceTarget(targetPosition);
    }

    /**
     * 处理砍伐状态
     */
    private handleChoppingState(deltaTime: number): void {
        if (!this._currentTarget) {
            this._currentState = WoodcutterState.Idle;
            return;
        }
        
        // 检查树木是否还在砍伐状态
        if (this._currentTarget.getCurrentState() === TreeState.Chopped) {
            // 砍伐完成，进入等待状态
            this._currentState = WoodcutterState.Waiting;
            this._waitTimer = this.waitAfterChop;
            this.onTreeChopped();
            return;
        }
        
        // 每次动画结束后才登记一次砍伐，避免动画与树木计数错位。
        if (!this._isChopCycleRunning) {
            void this.playAndRegisterChop();
        }
    }

    /**
     * 处理等待状态
     */
    private handleWaitingState(deltaTime: number): void {
        this._waitTimer -= deltaTime;
        
        if (this._waitTimer <= 0) {
            // 等待结束，进入空闲状态
            this._currentState = WoodcutterState.Idle;
            this._currentTarget = null;
        }
    }

    /**
     * 选择下一个目标树木
     */
    private selectNextTree(): void {
        if (this._treeList.length === 0) return;
        
        // 按顺序选择下一棵树木
        this._currentTarget = this._treeList[this._currentTreeIndex];
        
        // 如果当前树木不可砍伐，寻找下一个
        if (!this._currentTarget || !this.canChopTree(this._currentTarget)) {
            this.findNextValidTree();
        }
    }

    /**
     * 寻找下一个有效的树木
     */
    private findNextValidTree(): void {
        let attempts = 0;
        const maxAttempts = this._treeList.length;
        
        while (attempts < maxAttempts) {

            if(this._currentTreeIndex == this._treeList.length - 1){
                this._dir = -1;
                for(let i = 0; i < this._treeList.length; i++){
                    var validTree = this._treeList[i];
                    if(this.canChopTree(validTree)){
                        this._currentTarget = validTree;
                        this._currentTreeIndex = i;
                        this._checkReverse = true;
                        return;
                    }
                }
            }
            else if(this._currentTreeIndex == 0){
                this._dir = 1;
                this._currentTreeIndex += this._dir;
            }
            else{
                this._currentTreeIndex += this._dir;
            }

            this._currentTarget = this._treeList[this._currentTreeIndex];
            
            if (this._currentTarget && this.canChopTree(this._currentTarget)) {
                this._checkReverse = false;
                return;
            }

            attempts++;
        }
    }

    private checkInterval: number = 0;
    private findNextValidTreeReverse(deltaTime: number): void {
        this.checkInterval += deltaTime;
        if(this.checkInterval < 0.5){
            return;
        }
        this.checkInterval = 0;

        const maxAttempts = this._treeList.length;
            for(let i = maxAttempts - 1; i >= 0; i--){
                var validTree = this._treeList[i];
                if(this.canChopTree(validTree)){
                    this._currentTarget = validTree;
                    this._currentTreeIndex = i;
                    return;
                }
            }
    }

    /**
     * 检查树木是否可以砍伐
     * 基于Tree.ts的状态检测
     */
    private canChopTree(tree: Tree): boolean {
        if (!tree || !tree.node || !tree.node.isValid) {
            return false;
        }
        
        const treeState = tree.getCurrentState();
        
        // 只有完整状态和半砍状态的树木可以砍伐
        return treeState === TreeState.Full || treeState === TreeState.Half;
    }

    /**
     * 播放一次挥斧动画，并在完成后登记一次树木砍伐。
     */
    private async playAndRegisterChop(): Promise<void> {
        if (this._isChopCycleRunning || !this._currentTarget || !this.chopAction) {
            return;
        }

        const target = this._currentTarget;
        this._isChopCycleRunning = true;
        await this.chopAction.playChopAction(target.node.position.clone().add(this.offsetVec3));

        if (this._currentTarget === target && target.node.isValid &&
            target.getCurrentState() !== TreeState.Chopped) {
            target.registerWoodcutterChop(this.node);
        }

        this._isChopCycleRunning = false;
    }

    /**
     * 开始砍伐
     */
    private startChopping(): void {
        if (!this._currentTarget) return;
        
        this._isChopping = true;
        
        // 面向树木
        //this.faceTarget(this._currentTarget.node.position.clone().add(this.offsetVec3));
        
        void this.playAndRegisterChop();
    }

    /**
     * 树木被砍伐完成的回调
     */
    private onTreeChopped(): void {
        this._isChopping = false;
        
        // 播放完成动作
        if (this.chopAction) {
            this.chopAction.playCompleteAction();
        }
        
        
        // 更新树木列表状态
        //this.updateTreeList();
    }


    /**
     * 验证树木列表
     */
    private validateTreeList(): void {
        //return true;
        // this._treeList = this._treeList.filter(tree => 
        //     tree && tree.node && tree.node.isValid && 
        //     tree.getCurrentState() !== TreeState.Chopped && 
        //     tree.getCurrentState() !== TreeState.Respawning
        // );
    }

    /**
     * 面向目标
     */
    private faceTarget(targetPosition: Vec3): void {
        const currentPosition = this.node.position;
        const direction = new Vec3();
        Vec3.subtract(direction, targetPosition, currentPosition);
        
        if (direction.length() > 0.1) {
            const angle = Math.atan2(direction.x, direction.z);
            this.node.setRotationFromEuler(0, angle * 180 / Math.PI, 0);
        }
    }

    /**
     * 手动设置树木列表
     */
    public setAssignedTrees(trees: Node[]): void {
        this.assignedTrees = trees;
        this.initializeTreeList();
    }

    /**
     * 获取当前状态
     */
    public getCurrentState(): string {
        return this._currentState;
    }

    /**
     * 获取当前目标树木
     */
    public getCurrentTarget(): Tree | null {
        return this._currentTarget;
    }

    /**
     * 获取树木列表
     */
    public getTreeList(): Tree[] {
        return this._treeList;
    }

    /**
     * 获取可砍伐的树木数量
     */
    public getChoppableTreeCount(): number {
        return this._treeList.filter(tree => this.canChopTree(tree)).length;
    }

    /**
     * 清空树木列表
     */
    public clearTreeQueue(): void {
        this._treeList = [];
        this.assignedTrees = [];
        this._currentTarget = null;
        this._currentState = WoodcutterState.Idle;
    }

    /**
     * 暂停自动砍树
     */
    public pauseAutoChop(): void {
        this._currentState = WoodcutterState.Idle;
        this._isChopping = false;

    }

    /**
     * 恢复自动砍树
     */
    public resumeAutoChop(): void {
        this.startAutoChopCycle();

    }

    /**
     * 强制重新初始化树木列表
     */
    public refreshTreeList(): void {
        this.initializeTreeList();

    }
}
