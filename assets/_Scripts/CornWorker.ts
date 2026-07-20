import { _decorator, Component, Node, SkeletalAnimation, Vec3 } from 'cc';
import { ChopAction } from './ChopAction';
import { getCornHarvestStandPosition, moveCornWorkerToward } from './CornWorkerRoute';

const { ccclass, property } = _decorator;

enum CornWorkerState {
    Idle = 'idle',
    Moving = 'moving',
    Chopping = 'chopping',
    Waiting = 'waiting',
}

export type CornHarvestTarget = {
    node: Node;
    getPosition?: () => Vec3;
    isAvailable: () => boolean;
    registerChop: (chopperNode: Node) => void;
};

/**
 * 玉米工人沿固定田垄收割。
 *
 * 该状态机与森林伐木工的空闲、移动、砍伐、等待循环保持一致，
 * 但目标仅来自一条玉米田垄，端点只能在本田垄内折返。
 */
@ccclass('CornWorker')
export class CornWorker extends Component {
    @property({ tooltip: '玉米工人移动速度' })
    public moveSpeed = 3.0;

    @property({ tooltip: '收割检测范围' })
    public chopRange = 2.0;

    @property({ tooltip: '完成一株玉米后的等待时间' })
    public waitAfterChop = 1.0;

    @property({ tooltip: '每次挥砍之间的间隔（秒）' })
    public chopInterval = 0.8;

    @property({ type: ChopAction, tooltip: '砍伐动作组件' })
    public chopAction: ChopAction = null!;

    @property({ tooltip: '是否自动开始工作' })
    public autoStart = true;

    @property({ type: SkeletalAnimation, tooltip: '骨骼动画' })
    public skeletalAnimation: SkeletalAnimation = null!;

    @property({ tooltip: '工人与当前玉米中心之间的停止距离' })
    public standDistance = 0.9;

    private _targetList: CornHarvestTarget[] = [];
    private _currentTargetIndex = 0;
    private _currentTarget: CornHarvestTarget | null = null;
    private _currentState = CornWorkerState.Idle;
    private _direction: 1 | -1 = 1;
    private _waitTimer = 0;
    private _isChopping = false;
    private _isChopCycleRunning = false;
    private _isCycleActive = false;
    private _lastAnimation = 'idle1_FuTou';
    private readonly _idleAnimation = 'idle1_FuTou';

    protected onLoad(): void {
        if (!this.chopAction) {
            this.chopAction = this.getComponent(ChopAction) ?? this.addComponent(ChopAction);
        }
    }

    protected start(): void {
        this.scheduleOnce(() => {
            if (this.autoStart) {
                this.startAutoHarvestCycle();
            }
        }, 1);
    }

    protected update(deltaTime: number): void {
        if (!this._isCycleActive) return;

        switch (this._currentState) {
            case CornWorkerState.Idle:
                if (this._lastAnimation !== this._idleAnimation && this.skeletalAnimation) {
                    this.skeletalAnimation.play(this._idleAnimation);
                    this._lastAnimation = this._idleAnimation;
                }
                this.handleIdleState();
                break;

            case CornWorkerState.Moving:
                void this.handleMovingState(deltaTime);
                break;

            case CornWorkerState.Chopping:
                this.handleChoppingState();
                break;

            case CornWorkerState.Waiting:
                this.handleWaitingState(deltaTime);
                break;
        }
    }

    private startAutoHarvestCycle(): void {
        if (this._targetList.length === 0) {
            this._isCycleActive = false;
            this._currentState = CornWorkerState.Idle;
            return;
        }

        this._isCycleActive = true;
        this._currentState = CornWorkerState.Idle;
    }

    private handleIdleState(): void {
        if (this._targetList.length === 0) return;

        this.selectNextTarget();
        if (!this._currentTarget) return;

        this._currentState = CornWorkerState.Moving;
        if (this.skeletalAnimation) {
            this.skeletalAnimation.play('run2_FuTou');
            this._lastAnimation = 'run2_FuTou';
        }
    }

    private async handleMovingState(deltaTime: number): Promise<void> {
        if (!this._currentTarget) {
            this._currentState = CornWorkerState.Idle;
            return;
        }

        const lane = this._targetList.map(target => this.getTargetPosition(target));
        const standPosition = getCornHarvestStandPosition(
            lane,
            this._currentTargetIndex,
            this._direction as 1 | -1,
            Math.max(0, this.standDistance),
        );
        const targetPosition = new Vec3(standPosition.x, standPosition.y, standPosition.z);
        const currentPosition = this.node.position;
        if (Vec3.distance(currentPosition, targetPosition) <= this.chopRange) {
            this._currentState = CornWorkerState.Chopping;
            this.startChopping();
            await new Promise(resolve => setTimeout(resolve, 1000));
            return;
        }

        const nextPosition = moveCornWorkerToward(
            currentPosition,
            targetPosition,
            this.moveSpeed * deltaTime,
        );
        const newPosition = new Vec3(nextPosition.x, nextPosition.y, nextPosition.z);
        this.node.setPosition(newPosition);
        this.faceTarget(this.getTargetPosition(this._currentTarget));
    }

    private handleChoppingState(): void {
        if (!this._currentTarget) {
            this._currentState = CornWorkerState.Idle;
            return;
        }

        if (!this.canChopTarget(this._currentTarget)) {
            this._currentState = CornWorkerState.Waiting;
            this._waitTimer = this.waitAfterChop;
            this.onPlantHarvested();
            return;
        }

        if (!this._isChopCycleRunning) {
            void this.playAndRegisterChop();
        }
    }

    private handleWaitingState(deltaTime: number): void {
        this._waitTimer -= deltaTime;
        if (this._waitTimer <= 0) {
            this._currentState = CornWorkerState.Idle;
            this._currentTarget = null;
        }
    }

    private selectNextTarget(): void {
        if (this._targetList.length === 0) {
            this._currentTarget = null;
            return;
        }

        this._currentTargetIndex = Math.min(
            Math.max(this._currentTargetIndex, 0),
            this._targetList.length - 1,
        );
        const current = this._targetList[this._currentTargetIndex];
        if (this.canChopTarget(current)) {
            this._currentTarget = current;
            return;
        }

        this.findNextTargetInLane();
    }

    private findNextTargetInLane(): void {
        const count = this._targetList.length;
        if (count <= 1) {
            this._currentTarget = null;
            return;
        }

        let index = this._currentTargetIndex;
        for (let attempts = 0; attempts < count - 1; attempts++) {
            const atFirst = index === 0;
            const atLast = index === count - 1;
            if ((atFirst && this._direction < 0) || (atLast && this._direction > 0)) {
                this._direction = this._direction === 1 ? -1 : 1;
            }

            index += this._direction;
            const target = this._targetList[index];
            if (!this.canChopTarget(target)) continue;

            this._currentTargetIndex = index;
            this._currentTarget = target;
            return;
        }

        this._currentTarget = null;
    }

    private canChopTarget(target: CornHarvestTarget | null): target is CornHarvestTarget {
        return !!target && target.node.isValid && target.isAvailable();
    }

    private getTargetPosition(target: CornHarvestTarget): Vec3 {
        return target.getPosition?.() ?? target.node.position.clone();
    }

    private async playAndRegisterChop(): Promise<void> {
        if (this._isChopCycleRunning || !this._currentTarget || !this.chopAction) return;

        const target = this._currentTarget;
        this._isChopCycleRunning = true;
        this.skeletalAnimation?.play('KanMuTou');
        await this.chopAction.playChopAction(this.getTargetPosition(target));

        if (this._currentTarget === target && this.canChopTarget(target)) {
            await new Promise(resolve => setTimeout(resolve, Math.max(this.chopInterval, 0.1) * 1000));
            target.registerChop(this.node);
        }

        this._isChopCycleRunning = false;
    }

    private startChopping(): void {
        if (!this._currentTarget) return;
        this._isChopping = true;
        void this.playAndRegisterChop();
    }

    private onPlantHarvested(): void {
        this._isChopping = false;
        this.chopAction?.playCompleteAction();
    }

    private faceTarget(targetPosition: Vec3): void {
        const direction = new Vec3();
        Vec3.subtract(direction, targetPosition, this.node.position);
        if (direction.length() > 0.1) {
            const angle = Math.atan2(direction.x, direction.z);
            this.node.setRotationFromEuler(0, angle * 180 / Math.PI, 0);
        }
    }

    public setHarvestTargets(targets: CornHarvestTarget[]): void {
        this._targetList = [...targets];
        this._currentTargetIndex = 0;
        this._currentTarget = null;
        this._direction = 1;
        this._isCycleActive = false;
        this._currentState = CornWorkerState.Idle;
    }

    public pauseAutoHarvest(): void {
        this._isCycleActive = false;
        this._currentState = CornWorkerState.Idle;
        this._isChopping = false;
    }

    public resumeAutoHarvest(): void {
        this.startAutoHarvestCycle();
    }

    public getCurrentState(): string {
        return this._currentState;
    }
}
