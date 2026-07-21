import { _decorator, BoxCollider, Collider, Component, find, Node, Vec3 } from 'cc';
import { isCornTractorFrontContact } from './CornTractorContact';

const { ccclass, property } = _decorator;

enum CornTractorState {
    Idle = 'idle',
    MovingToStart = 'moving_to_start',
    MovingToEnd = 'moving_to_end',
    Turning = 'turning',
    Waiting = 'waiting',
}

/** Independent corn-area copy of the forest vehicle path state machine. */
@ccclass('CornTractor')
export class CornTractor extends Component {
    @property({ type: Node }) public startPoint: Node = null!;
    @property({ type: Node }) public endPoint: Node = null!;
    @property public moveSpeed = 5.0;
    @property public chopRange = 3.0;
    @property public waitAfterChop = 0.5;
    @property public waitAtEndPoint = 2.0;
    @property public waitAtStartPoint = 1.0;
    @property public autoStart = true;
    @property public autoChopWhileMoving = true;
    @property public pathWidth = 5.0;
    @property public turnSpeed = 90.0;
    @property public waitAfterTurn = 0.5;
    @property({ tooltip: 'Extra crop radius around the authored forest front cutter.' })
    public frontContactPadding = 0.35;

    private _currentState = CornTractorState.Idle;
    private _isMovingToEnd = true;
    private _waitTimer = 0;
    private _targetRotation = new Vec3();
    private _turnTimer = 0;
    private _turnDuration = 0;

    protected onLoad(): void {
        this.autoStart = false;
        this.initializePathPoints();
    }

    protected start(): void {
        this.scheduleOnce(() => {
            this.autoStart = true;
            this._turnDuration = 0;
            const collider = this.getComponent(Collider);
            if (collider) collider.enabled = true;
            this.startTractorCycle();
        }, 1);
    }

    protected update(deltaTime: number): void {
        switch (this._currentState) {
            case CornTractorState.Idle:
                this.handleIdleState();
                break;
            case CornTractorState.MovingToStart:
                this.handleMovingState(deltaTime, this.startPoint.position);
                break;
            case CornTractorState.MovingToEnd:
                this.handleMovingState(deltaTime, this.endPoint.position);
                break;
            case CornTractorState.Turning:
                this.handleTurningState(deltaTime);
                break;
            case CornTractorState.Waiting:
                this.handleWaitingState(deltaTime);
                break;
        }
    }

    public setPathPoints(start: Node, end: Node): void {
        this.startPoint = start;
        this.endPoint = end;
        this.initializePathPoints();
    }

    public getCurrentState(): string { return this._currentState; }
    public getMoveDirection(): string { return this._isMovingToEnd ? 'to_end' : 'to_start'; }
    public pauseTractor(): void { this._currentState = CornTractorState.Idle; this.autoStart = false; }
    public resumeTractor(): void { this.autoStart = true; this.startTractorCycle(); }

    /** Uses the cloned forest truck's thin front BoxCollider as the cutter area. */
    public isFrontContact(worldPosition: Vec3): boolean {
        const collider = this.getComponent(BoxCollider);
        if (!collider?.enabled) return false;

        const localPosition = new Vec3();
        this.node.inverseTransformPoint(localPosition, worldPosition);
        return isCornTractorFrontContact(
            localPosition,
            collider.center,
            collider.size,
            this.frontContactPadding,
        );
    }

    private initializePathPoints(): void {
        if (!this.startPoint) this.startPoint = find('CornTruckStart') ?? this.node;
        if (!this.endPoint) this.endPoint = find('CornTruckEnd') ?? this.node;
    }

    private startTractorCycle(): void {
        this._currentState = CornTractorState.Idle;
        this._isMovingToEnd = true;
    }

    private handleIdleState(): void {
        if (!this.autoStart) return;
        this._currentState = this._isMovingToEnd ? CornTractorState.MovingToEnd : CornTractorState.MovingToStart;
    }

    private handleMovingState(deltaTime: number, targetPosition: Vec3): void {
        const currentPosition = this.node.position;
        if (Vec3.distance(currentPosition, targetPosition) <= 0.5) {
            this.onReachedDestination();
            return;
        }
        const direction = new Vec3();
        Vec3.subtract(direction, targetPosition, currentPosition);
        direction.normalize();
        const newPosition = new Vec3();
        Vec3.scaleAndAdd(newPosition, currentPosition, direction, this.moveSpeed * deltaTime);
        this.node.setPosition(newPosition);
        this.faceTarget(targetPosition);
    }

    private onReachedDestination(): void {
        this._currentState = CornTractorState.Turning;
        this.startTurning(!this._isMovingToEnd);
    }

    private startTurning(moveToEnd: boolean): void {
        this._isMovingToEnd = moveToEnd;
        const destination = moveToEnd ? this.endPoint.position : this.startPoint.position;
        const direction = new Vec3();
        Vec3.subtract(direction, destination, this.node.position);
        const angle = Math.atan2(direction.x, direction.z);
        this._targetRotation.set(0, angle * 180 / Math.PI - 180, 0);
        this._turnDuration = 0;
        this._turnTimer = 0;
    }

    private handleTurningState(deltaTime: number): void {
        this._turnTimer += deltaTime;
        if (this._turnTimer < this._turnDuration) return;
        this.node.setRotationFromEuler(this._targetRotation);
        this._currentState = CornTractorState.Waiting;
        this._waitTimer = this.waitAfterTurn;
    }

    private handleWaitingState(deltaTime: number): void {
        this._waitTimer -= deltaTime;
        if (this._waitTimer <= 0) this._currentState = CornTractorState.Idle;
    }

    private faceTarget(targetPosition: Vec3): void {
        const direction = new Vec3();
        Vec3.subtract(direction, targetPosition, this.node.position);
        if (direction.length() > 0.1) this.node.setRotationFromEuler(0, Math.atan2(direction.x, direction.z) * 180 / Math.PI - 180, 0);
    }
}
