import { _decorator, Component, Node, Vec3, tween, find, Collider } from 'cc';
import { Tree } from './Tree';
import { TreeState } from './TreeData';
import { ChopAction } from './ChopAction';
const { ccclass, property } = _decorator;

// 状态枚举
enum LoggingTruckState {
    Idle = 'idle',
    MovingToStart = 'moving_to_start',
    MovingToEnd = 'moving_to_end',
    Turning = 'turning',        // 新增：转向状态
    Chopping = 'chopping',
    Waiting = 'waiting'
}

/**
 * 伐木车控制脚本
 * 在起点和终点之间循环移动，自动砍伐路径上的树木
 */
@ccclass('LoggingTruck')
export class LoggingTruck extends Component {
    
    @property({ type: Node, tooltip: "起点位置" })
    public startPoint: Node = null!;
    
    @property({ type: Node, tooltip: "终点位置" })
    public endPoint: Node = null!;
    
    @property({ tooltip: "伐木车移动速度" })
    public moveSpeed: number = 5.0;
    
    @property({ tooltip: "砍伐检测范围" })
    public chopRange: number = 3.0;
    
    @property({ tooltip: "砍伐完成后等待时间" })
    public waitAfterChop: number = 0.5;
    
    @property({ tooltip: "到达终点后等待时间" })
    public waitAtEndPoint: number = 2.0;
    
    @property({ tooltip: "到达起点后等待时间" })
    public waitAtStartPoint: number = 1.0;
    
    @property({ type: ChopAction, tooltip: "砍伐动作组件" })
    public chopAction: ChopAction = null!;
    
    @property({ tooltip: "是否自动开始工作" })
    public autoStart: boolean = true;
    
    @property({ tooltip: "是否在移动过程中自动砍伐树木" })
    public autoChopWhileMoving: boolean = true;
    
    @property({ tooltip: "路径检测宽度" })
    public pathWidth: number = 5.0;
    
    @property({ tooltip: "转向速度（度/秒）" })
    public turnSpeed: number = 90.0;
    
    @property({ tooltip: "转向完成后的等待时间" })
    public waitAfterTurn: number = 0.5;

    @property({ tooltip: "整条路线朝主角侧平移的距离" })
    public routeBoundaryOffset: number = 2.0;
    
    // 私有属性
    private _currentState: LoggingTruckState = LoggingTruckState.Idle;
    private _isMoving: boolean = false;
    private _isChopping: boolean = false;
    private _currentTarget: Tree | null = null;
    private _waitTimer: number = 0;
    private _isMovingToEnd: boolean = true; // true: 向终点移动, false: 向起点移动
    private _currentPathTarget: Vec3 = new Vec3();
    
    // 转向相关属性
    private _isTurning: boolean = false;
    private _targetRotation: Vec3 = new Vec3();
    private _turnTimer: number = 0;
    private _turnDuration: number = 0;
    
    // 树木检测
    private _treesInPath: Tree[] = [];
    private _currentTreeIndex: number = 0;

    protected onLoad(): void {
        // 确保有砍伐动作组件
        if (!this.chopAction) {
            this.chopAction = this.getComponent(ChopAction) || this.addComponent(ChopAction);
        }

        this.autoStart = false;
        
        // 初始化起点和终点
        this.initializePathPoints();
    }

    start() {
        this.scheduleOnce(() => {
            this.autoStart = true;
            this._turnDuration = 0;
            this.getComponent(Collider).enabled = true;
            this.startLoggingCycle();
        }, 1);
    }

    protected update(deltaTime: number): void {
        switch (this._currentState) {
            case LoggingTruckState.Idle:
                this.handleIdleState();
                break;
                
            case LoggingTruckState.MovingToStart:
                this.handleMovingToStartState(deltaTime);
                break;
                
            case LoggingTruckState.MovingToEnd:
                this.handleMovingToEndState(deltaTime);
                break;
                
            case LoggingTruckState.Chopping:
                this.handleChoppingState(deltaTime);
                break;
                
            case LoggingTruckState.Waiting:
                this.handleWaitingState(deltaTime);
                break;
                
            case LoggingTruckState.Turning:
                this.handleTurningState(deltaTime);
                break;
        }
    }

    /**
     * 初始化路径点
     */
    private initializePathPoints(): void {
        if (!this.startPoint) {
            this.startPoint = find("LoggingTruckStart") || this.node;
        }
        
        if (!this.endPoint) {
            this.endPoint = find("LoggingTruckEnd") || this.node;
        }
        
    }

    /**
     * 开始伐木循环
     */
    private startLoggingCycle(): void {
        this._currentState = LoggingTruckState.Idle;
        this._isMovingToEnd = true;
    }

    /**
     * 处理空闲状态
     */
    private handleIdleState(): void {
        if(!this.autoStart) return;
        // 选择下一个移动目标
        if (this._isMovingToEnd) {
            this._currentState = LoggingTruckState.MovingToEnd;
            this._currentPathTarget = this.getSafeEndPosition();
        } else {
            this._currentState = LoggingTruckState.MovingToStart;
            this._currentPathTarget = this.getSafeStartPosition();
        }
    }

    /**
     * 处理向起点移动状态
     */
    private handleMovingToStartState(deltaTime: number): void {
        this.handleMovingState(deltaTime, this.getSafeStartPosition());
    }

    /**
     * 处理向终点移动状态
     */
    private handleMovingToEndState(deltaTime: number): void {
        this.handleMovingState(deltaTime, this.getSafeEndPosition());
    }

    /**
     * 处理移动状态
     */
    private handleMovingState(deltaTime: number, targetPosition: Vec3): void {
        const currentPosition = this.node.position;
        const distance = Vec3.distance(currentPosition, targetPosition);
        
        if (distance <= 0.5) {
            // 到达目标位置
            this.onReachedDestination();
            return;
        }
        
        // 在移动过程中检测树木
        // if (this.autoChopWhileMoving) {
        //     this.detectTreesInPath();
        // }
        
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
     * 到达目的地
     */
    private onReachedDestination(): void {
        if (this._isMovingToEnd) {
            // 到达终点，开始转向
            this._currentState = LoggingTruckState.Turning;
            this.startTurning(false); // false: 向起点转向
        } else {
            // 到达起点，开始转向
            this._currentState = LoggingTruckState.Turning;
            this.startTurning(true); // true: 向终点转向
        }
    }

    /**
     * 开始转向
     */
    private startTurning(moveToEnd: boolean): void {
        this._isTurning = true;
        this._isMovingToEnd = moveToEnd;
        
        // 计算目标旋转角度
        if (moveToEnd) {
            // 转向终点方向
            const direction = new Vec3();
            Vec3.subtract(direction, this.getSafeEndPosition(), this.node.position);
            const angle = Math.atan2(direction.x, direction.z);
            this._targetRotation = new Vec3(0, angle * 180 / Math.PI - 180, 0);
        } else {
            // 转向起点方向
            const direction = new Vec3();
            Vec3.subtract(direction, this.getSafeStartPosition(), this.node.position);
            const angle = Math.atan2(direction.x, direction.z);
            this._targetRotation = new Vec3(0, angle * 180 / Math.PI - 180, 0);
        }
        
        // 计算转向时间
        const currentRotation = this.node.eulerAngles;
        const angleDifference = Math.abs(this._targetRotation.y - currentRotation.y);
        this._turnDuration = 0;angleDifference / this.turnSpeed;
        this._turnTimer = 0;
        
    }

    /**
     * 处理转向状态
     */
    private handleTurningState(deltaTime: number): void {
        this._turnTimer += deltaTime;
        
        if (this._turnTimer >= this._turnDuration) {
            // 转向完成
            this.onTurningComplete();
            return;
        }
        
        // 计算当前旋转角度
        const currentRotation = this.node.eulerAngles;
        const progress = this._turnTimer / this._turnDuration;
        
        // 使用插值计算当前角度
        const newY = currentRotation.y + (this._targetRotation.y - currentRotation.y) * progress;
        this.node.setRotationFromEuler(currentRotation.x, newY, currentRotation.z);
    }

    /**
     * 转向完成
     */
    private onTurningComplete(): void {
        this._isTurning = false;
        
        // 设置最终旋转角度
        this.node.setRotationFromEuler(this._targetRotation);
        
        // 进入等待状态
        this._currentState = LoggingTruckState.Waiting;
        
        if (this._isMovingToEnd) {
            // 转向终点方向完成，等待后前往终点
            this._waitTimer = this.waitAfterTurn;
        } else {
            // 转向起点方向完成，等待后前往起点
            this._waitTimer = this.waitAfterTurn;
        }
    }

    /**
     * 检测路径上的树木
     */
    private detectTreesInPath(): void {
        // 获取当前位置和移动方向
        const currentPos = this.node.position;
        const direction = new Vec3();
        Vec3.subtract(direction, this._currentPathTarget, currentPos);
        direction.normalize();
        
        // 检测路径两侧的树木
        //this._treesInPath = this.findTreesAlongPath(currentPos, direction);
        
        // 如果有可砍伐的树木，尝试砍伐
        // if (this._treesInPath.length > 0 && !this._isChopping) {
        //     this.tryChopTreeInPath();
        // }
    }

    /**
     * 在路径上寻找树木
     */
    private findTreesAlongPath(position: Vec3, direction: Vec3): Tree[] {
        const trees: Tree[] = [];
        
        // 查找场景中所有树木
        const allTrees = this.node.scene?.getComponentsInChildren(Tree) || [];
        
        for (const tree of allTrees) {
            if (!tree || !tree.node || !tree.node.isValid) continue;
            
            const treePos = tree.node.position;
            const distance = Vec3.distance(position, treePos);
            
            // 检查树木是否在路径范围内
            if (distance <= this.pathWidth && this.isTreeInPathDirection(position, direction, treePos)) {
                // 检查树木是否可以砍伐
                if (this.canChopTree(tree)) {
                    trees.push(tree);
                }
            }
        }
        
        return trees;
    }

    /**
     * 检查树木是否在路径方向上
     */
    private isTreeInPathDirection(startPos: Vec3, direction: Vec3, treePos: Vec3): boolean {
        const toTree = new Vec3();
        Vec3.subtract(toTree, treePos, startPos);
        
        // 计算树木到路径的垂直距离
        const dotProduct = Vec3.dot(direction, toTree);
        const projection = Vec3.scaleAndAdd(new Vec3(), startPos, direction, dotProduct);
        const perpendicular = Vec3.subtract(new Vec3(), treePos, projection);
        
        return perpendicular.length() <= this.pathWidth * 0.5;
    }

    /**
     * 尝试砍伐路径上的树木
     */
    private tryChopTreeInPath(): void {
        if (this._treesInPath.length === 0) return;
        
        // 选择最近的树木
        const currentPos = this.node.position;
        let nearestTree: Tree | null = null;
        let nearestDistance = Infinity;
        
        for (const tree of this._treesInPath) {
            const distance = Vec3.distance(currentPos, tree.node.position);
            if (distance < nearestDistance && distance <= this.chopRange) {
                nearestDistance = distance;
                nearestTree = tree;
            }
        }
        
        if (nearestTree) {
            this.startChopping(nearestTree);
        }
    }

    /**
     * 开始砍伐
     */
    private startChopping(tree: Tree): void {
        this._currentTarget = tree;
        this._isChopping = true;
        this._currentState = LoggingTruckState.Chopping;
        
        
        // 面向树木
        this.faceTarget(tree.node.position);
        
        // 播放砍伐动作
        if (this.chopAction) {
            this.chopAction.playChopAction(tree.node.position);
        }
    }

    /**
     * 处理砍伐状态
     */
    private handleChoppingState(deltaTime: number): void {
        if (!this._currentTarget) {
            this._currentState = LoggingTruckState.Idle;
            return;
        }
        
        // 检查树木是否还在砍伐状态
        if (this._currentTarget.getCurrentState() === TreeState.Chopped) {
            // 砍伐完成，进入等待状态
            this._currentState = LoggingTruckState.Waiting;
            this._waitTimer = this.waitAfterChop;
            this.onTreeChopped();
            return;
        }
        
        // 继续砍伐
        if (this.chopAction && !this.chopAction.isPlaying()) {
            this.chopAction.playChopAction(this._currentTarget.node.position);
        }
    }

    /**
     * 处理等待状态
     */
    private handleWaitingState(deltaTime: number): void {
        this._waitTimer -= deltaTime;
        
        if (this._waitTimer <= 0) {
            // 等待结束，进入空闲状态
            this._currentState = LoggingTruckState.Idle;
            this._currentTarget = null;
        }
    }

    /**
     * 检查树木是否可以砍伐
     */
    private canChopTree(tree: Tree): boolean {
        if (!tree || !tree.node || !tree.node.isValid) {
            return false;
        }
        
        const treeState = tree.getCurrentState();
        
        // 只有完整状态和半砍状态的树木可以砍伐
        return treeState === TreeState.Full ||
            treeState === TreeState.Half ||
            treeState === TreeState.Half2;
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
    
        
        // 清除当前目标
        this._currentTarget = null;
    }

    /**
     * 面向目标（移动过程中使用）
     */
    private faceTarget(targetPosition: Vec3): void {
        const currentPosition = this.node.position;
        const direction = new Vec3();
        Vec3.subtract(direction, targetPosition, currentPosition);
        
        if (direction.length() > 0.1) {
            const angle = Math.atan2(direction.x, direction.z);
            const targetY = angle * 180 / Math.PI - 180;
            
            // 平滑转向
            const currentRotation = this.node.eulerAngles;
            const angleDifference = targetY - currentRotation.y;
            
            // 标准化角度差异到 -180 到 180 度范围
            let normalizedDiff = angleDifference;
            while (normalizedDiff > 180) normalizedDiff -= 360;
            while (normalizedDiff < -180) normalizedDiff += 360;
            
            // 限制转向速度
            const maxTurnThisFrame = this.turnSpeed * 0.016; // 假设60FPS
            const actualTurn = Math.sign(normalizedDiff) * Math.min(Math.abs(normalizedDiff), maxTurnThisFrame);
            
            this.node.setRotationFromEuler(currentRotation.x, currentRotation.y + actualTurn, currentRotation.z);
        }
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
            this.node.setRotationFromEuler(0, angle * 180 / Math.PI - 180, 0);
        }
    }

    /**
     * 设置起点和终点
     */
    public setPathPoints(start: Node, end: Node): void {
        this.startPoint = start;
        this.endPoint = end;
        this.initializePathPoints();
        console.log('设置伐木车路径点');
    }

    public getSafeStartPosition(): Vec3 {
        if (!this.startPoint || !this.endPoint) return this.node.position.clone();

        const startPosition = this.startPoint.position;
        const endPosition = this.endPoint.position;
        const direction = new Vec3();
        Vec3.subtract(direction, startPosition, endPosition);
        if (direction.length() <= 0.0001) return startPosition.clone();

        direction.normalize();
        const safeStart = new Vec3();
        Vec3.scaleAndAdd(safeStart, startPosition, direction, this.routeBoundaryOffset);
        return safeStart;
    }

    public getSafeEndPosition(): Vec3 {
        if (!this.startPoint || !this.endPoint) return this.node.position.clone();

        const startPosition = this.startPoint.position;
        const endPosition = this.endPoint.position;
        const direction = new Vec3();
        Vec3.subtract(direction, startPosition, endPosition);
        if (direction.length() <= 0.0001) return endPosition.clone();

        direction.normalize();
        const safeEnd = new Vec3();
        Vec3.scaleAndAdd(safeEnd, endPosition, direction, this.routeBoundaryOffset);
        return safeEnd;
    }

    /**
     * 设置移动速度
     */
    public setMoveSpeed(speed: number): void {
        this.moveSpeed = Math.max(0.1, speed);
        console.log(`设置伐木车移动速度: ${this.moveSpeed}`);
    }

    /**
     * 设置路径宽度
     */
    public setPathWidth(width: number): void {
        this.pathWidth = Math.max(0.5, width);
        console.log(`设置伐木车路径宽度: ${this.pathWidth}`);
    }

    /**
     * 获取当前状态
     */
    public getCurrentState(): string {
        return this._currentState;
    }

    /**
     * 获取转向信息
     */
    public getTurningInfo(): {
        isTurning: boolean,
        turnProgress: number,
        targetRotation: Vec3,
        turnDuration: number
    } {
        return {
            isTurning: this._isTurning,
            turnProgress: this._turnDuration > 0 ? this._turnTimer / this._turnDuration : 0,
            targetRotation: this._targetRotation.clone(),
            turnDuration: this._turnDuration
        };
    }

    /**
     * 获取当前目标树木
     */
    public getCurrentTarget(): Tree | null {
        return this._currentTarget;
    }

    /**
     * 获取移动方向
     */
    public getMoveDirection(): string {
        return this._isMovingToEnd ? 'to_end' : 'to_start';
    }

    /**
     * 获取路径上的树木数量
     */
    public getTreesInPathCount(): number {
        return this._treesInPath.length;
    }

    /**
     * 暂停伐木车
     */
    public pauseLogging(): void {
        this._currentState = LoggingTruckState.Idle;
        this._isChopping = false;
        console.log('伐木车暂停工作');
    }

    /**
     * 恢复伐木车
     */
    public resumeLogging(): void {
        this.startLoggingCycle();
        console.log('伐木车恢复工作');
    }

    /**
     * 强制移动到指定位置
     */
    public forceMoveTo(position: Vec3): void {
        this.node.setPosition(position);
        console.log('伐木车强制移动到指定位置');
    }

    /**
     * 重置伐木车
     */
    public reset(): void {
        this._currentState = LoggingTruckState.Idle;
        this._isChopping = false;
        this._currentTarget = null;
        this._waitTimer = 0;
        this._isMovingToEnd = true;
        this._treesInPath = [];
        this._currentTreeIndex = 0;
        
        // 重置转向相关属性
        this._isTurning = false;
        this._turnTimer = 0;
        this._turnDuration = 0;
        this._targetRotation = Vec3.ZERO;
        
        // 重置到起点位置
        if (this.startPoint && this.startPoint.isValid) {
            this.node.setPosition(this.getSafeStartPosition());
            // 面向终点方向
            const direction = new Vec3();
            Vec3.subtract(direction, this.getSafeEndPosition(), this.getSafeStartPosition());
            const angle = Math.atan2(direction.x, direction.z);
            this.node.setRotationFromEuler(0, angle * 180 / Math.PI - 180, 0);
        }
        
        console.log('伐木车重置完成');
    }

    /**
     * 设置转向速度
     */
    public setTurnSpeed(speed: number): void {
        this.turnSpeed = Math.max(1, speed);
        console.log(`设置伐木车转向速度: ${this.turnSpeed}°/秒`);
    }

    /**
     * 设置转向后等待时间
     */
    public setWaitAfterTurn(waitTime: number): void {
        this.waitAfterTurn = Math.max(0, waitTime);
        console.log(`设置伐木车转向后等待时间: ${this.waitAfterTurn}秒`);
    }
}
