import { _decorator, Component, game, Game, math, Node, SkeletalAnimation, Vec3 } from 'cc';
import { AnimationName } from './PlayerController';
import { ResourceManager } from './Resource/ResourceManager';
import { StoragePoint } from './Resource/StoragePoint';
import { PlayerDetectionZone } from './PlayerDetectionZone';

const { ccclass, property } = _decorator;

enum HaulerState {
    WaitingForWood,
    MovingToCollection,
    Loading,
    Delivering,
    Unloading,
    Returning,
}

@ccclass('HaulerNPC')
export class HaulerNPC extends Component {
    @property({ type: SkeletalAnimation, tooltip: '搬运工骨骼动画' })
    public skeletonAnimation: SkeletalAnimation = null!;

    @property({ type: Node, tooltip: '木材收集点' })
    public collectionPoint: Node = null!;

    @property({ type: Node, tooltip: '卖木点' })
    public sellPoint: Node = null!;

    @property({ type: Node, tooltip: '搬运工待机点' })
    public idlePoint: Node = null!;

    @property({ type: StoragePoint, tooltip: '木材收集点存储' })
    public collectionStorage: StoragePoint = null!;

    @property({ type: StoragePoint, tooltip: '卖木点存储' })
    public sellStorage: StoragePoint = null!;

    @property({ type: StoragePoint, tooltip: '搬运工携带木材存储' })
    public carryStorage: StoragePoint = null!;

    @property({ tooltip: '移动速度' })
    public moveSpeed = 3;

    @property({ tooltip: '单根木材转移间隔（秒）' })
    public transferInterval = 0.15;

    @property
    public collectionStopDistance = 1.8;

    @property
    public sellStopDistance = 0.01;

    @property
    public facingYawOffset = 180;

    @property({ tooltip: 'Seconds without a movable resource before repairing an interrupted stack transfer.' })
    public transferStallTimeout = 1.5;

    @property({ tooltip: 'Seconds without movement before retrying the current route in place.' })
    public routeStallResetSeconds = 0.5;

    private _state = HaulerState.WaitingForWood;
    private _transferTimer = 0;
    private _isMoving = false;
    private _blockedStorage: StoragePoint | null = null;
    private _blockedSince = 0;
    private _monitoredState: HaulerState | null = null;
    private _monitoredFromAmount = -1;
    private _monitoredToAmount = -1;
    private _lastTransferProgressAt = 0;
    private _moveStallTimer = 0;
    private _lastMoveDistance = Number.POSITIVE_INFINITY;
    private readonly _lastMoveTarget = new Vec3(Number.NaN, Number.NaN, Number.NaN);

    protected onLoad(): void {
        if (!this.skeletonAnimation) {
            this.skeletonAnimation = this.node.getComponentInChildren(SkeletalAnimation);
        }
    }

    protected onEnable(): void {
        game.on(Game.EVENT_SHOW, this.onApplicationShow, this);
        this._state = HaulerState.WaitingForWood;
        this._transferTimer = 0;
        this._isMoving = false;
        this.resetTransferWatchdog();
        this.resetTransferProgressMonitor();
        this.resetMovementWatchdog();
        if (this.idlePoint) {
            const spawnPosition = this.idlePoint.worldPosition.clone();
            spawnPosition.y = this.node.worldPosition.y;
            this.node.setWorldPosition(spawnPosition);
        }
        this.playIdleAnimation();
    }

    protected onDisable(): void {
        game.off(Game.EVENT_SHOW, this.onApplicationShow, this);
        this.setSellZoneHaulerHighlight(false);
    }

    private onApplicationShow(): void {
        this.recoverAfterSceneTransition();
    }

    protected update(deltaTime: number): void {
        if (!this.collectionPoint || !this.sellPoint || !this.collectionStorage || !this.sellStorage || !this.carryStorage) {
            return;
        }

        this.monitorTransferProgress();

        switch (this._state) {
            case HaulerState.WaitingForWood:
                this.playIdleAnimation();
                if (this.carryStorage.amount > 0 && this.sellStorage.hasSpace(1)) {
                    this._state = HaulerState.Delivering;
                    break;
                }
                if (this.collectionStorage.amount > 0 && this.sellStorage.hasSpace(1)) {
                    this._state = HaulerState.MovingToCollection;
                }
                break;
            case HaulerState.MovingToCollection:
                if (this.moveTowards(this.collectionPoint.worldPosition, deltaTime, this.collectionStopDistance)) {
                    this._state = HaulerState.Loading;
                }
                break;
            case HaulerState.Loading:
                this.playIdleAnimation();
                if (this.carryStorage.amount > 0 && (!this.carryStorage.hasSpace(1) || this.collectionStorage.amount === 0)) {
                    this._state = HaulerState.Delivering;
                    break;
                }
                this.transferWood(this.collectionStorage, this.carryStorage, HaulerState.Delivering, HaulerState.Delivering, deltaTime);
                break;
            case HaulerState.Delivering:
                if (this.moveTowards(this.sellPoint.worldPosition, deltaTime, this.sellStopDistance) || this.isAtSellTarget()) {
                    this.playIdleAnimation();
                    this._state = HaulerState.Unloading;
                }
                break;
            case HaulerState.Unloading:
                this.playIdleAnimation();
                this.transferWood(this.carryStorage, this.sellStorage, HaulerState.Returning, HaulerState.Unloading, deltaTime);
                break;
            case HaulerState.Returning:
                if (this.moveTowards(this.collectionPoint.worldPosition, deltaTime, this.collectionStopDistance)) {
                    this._state = HaulerState.WaitingForWood;
                }
                break;
        }
        this.setSellZoneHaulerHighlight(this._state === HaulerState.Unloading);
    }

    private setSellZoneHaulerHighlight(highlighted: boolean): void {
        for (let node: Node | null = this.sellStorage?.node ?? null; node; node = node.parent) {
            const sellZone = node.getComponent(PlayerDetectionZone);
            if (sellZone) {
                sellZone.setHaulerInZone(highlighted);
                return;
            }
        }
    }

    /**
     * Reconcile the forest hauler after the game resumes or a reveal sequence.
     *
     * Either interruption can pause a resource transfer between marking a stack
     * item immovable and completing its animation. Rebuild the three real stacks,
     * then resume from inventory state instead of retaining a stale run state.
     */
    public recoverAfterSceneTransition(): void {
        if (!this.collectionPoint || !this.collectionStorage || !this.sellStorage || !this.carryStorage) {
            return;
        }

        this.collectionStorage.recoverInterruptedTransfers();
        this.carryStorage.recoverInterruptedTransfers();
        this.sellStorage.recoverInterruptedTransfers();
        this._transferTimer = 0;
        this.resetTransferWatchdog();
        this.resetTransferProgressMonitor();
        this.resetMovementWatchdog();

        if (this.carryStorage.amount > 0) {
            this._state = HaulerState.Delivering;
            return;
        }

        if (this.collectionStorage.amount > 0 && this.sellStorage.hasSpace(1)) {
            const currentPosition = this.node.worldPosition.clone();
            const collectionPosition = this.collectionPoint.worldPosition.clone();
            collectionPosition.y = currentPosition.y;

            if (Vec3.distance(currentPosition, collectionPosition) <= Math.max(this.collectionStopDistance, 0.05) + 0.8) {
                this._state = HaulerState.Loading;
                this.playIdleAnimation();
            } else {
                this._state = HaulerState.MovingToCollection;
            }
            return;
        }

        this._state = HaulerState.WaitingForWood;
        this.playIdleAnimation();
    }

    private transferWood(from: StoragePoint, to: StoragePoint, completedState: HaulerState, blockedState: HaulerState, deltaTime: number): void {
        this._transferTimer += deltaTime;
        if (this._transferTimer < this.transferInterval) {
            return;
        }

        this._transferTimer = 0;

        if (from.amount === 0) {
            this.resetTransferWatchdog();
            this._state = completedState;
            return;
        }

        if (!from.hasMovableResource()) {
            if (!this.tryRecoverBlockedStorage(from)) {
                return;
            }

            // Recovery may discover that the serialized amount had no real
            // resource node behind it. Let the state machine leave this phase.
            if (from.amount === 0) {
                this._state = completedState;
                return;
            }

            if (!from.hasMovableResource()) {
                return;
            }
        } else {
            this.resetTransferWatchdog();
        }

        if (!to.hasSpace(1)) {
            this._state = blockedState;
            return;
        }

        void ResourceManager.MoveResource(from, to, false, 4, Vec3.ZERO);
    }

    /**
     * A type-4 transfer normally unlocks its destination item in about 0.6s.
     * If that completion callback is lost, amount remains positive while every
     * entry is permanently immovable. Repair only after a conservative timeout
     * so ordinary in-flight animations are never interrupted.
     */
    private tryRecoverBlockedStorage(storage: StoragePoint): boolean {
        const now = Date.now();
        if (this._blockedStorage !== storage) {
            this._blockedStorage = storage;
            this._blockedSince = now;
            return false;
        }

        const timeoutMs = Math.max(this.transferStallTimeout, 0.7) * 1000;
        if (now - this._blockedSince < timeoutMs) {
            return false;
        }

        storage.recoverInterruptedTransfers();
        this.resetTransferWatchdog();
        return true;
    }

    private resetTransferWatchdog(): void {
        this._blockedStorage = null;
        this._blockedSince = 0;
    }

    /**
     * Detect a transfer phase whose inventory counts stop changing and rebuild
     * the complete route state, matching a browser hide/show recovery.
     */
    private monitorTransferProgress(): void {
        if (this._state !== HaulerState.Loading && this._state !== HaulerState.Unloading) {
            this.resetTransferProgressMonitor();
            return;
        }
        const from = this._state === HaulerState.Loading ? this.collectionStorage : this.carryStorage;
        const to = this._state === HaulerState.Loading ? this.carryStorage : this.sellStorage;

        const now = Date.now();
        if (this._monitoredState !== this._state) {
            this._monitoredState = this._state;
            this._monitoredFromAmount = from.amount;
            this._monitoredToAmount = to.amount;
            this._lastTransferProgressAt = now;
            return;
        }

        if (from.amount !== this._monitoredFromAmount || to.amount !== this._monitoredToAmount) {
            this._monitoredFromAmount = from.amount;
            this._monitoredToAmount = to.amount;
            this._lastTransferProgressAt = now;
            return;
        }

        const timeoutMs = Math.max(this.transferStallTimeout, 0.7) * 1000;
        if (now - this._lastTransferProgressAt < timeoutMs) {
            return;
        }

        from.recoverInterruptedTransfers();
        this._monitoredFromAmount = from.amount;
        this._monitoredToAmount = to.amount;
        this._lastTransferProgressAt = now;
    }

    private resetTransferProgressMonitor(): void {
        this._monitoredState = null;
        this._monitoredFromAmount = -1;
        this._monitoredToAmount = -1;
        this._lastTransferProgressAt = 0;
    }

    private isAtSellTarget(): boolean {
        if (!this.sellStorage?.node) {
            return false;
        }

        const currentPosition = this.node.worldPosition.clone();
        if (!this.sellPoint) {
            return false;
        }

        const sellPointPosition = this.sellPoint.worldPosition.clone();
        sellPointPosition.y = currentPosition.y;
        return Vec3.distance(currentPosition, sellPointPosition) <= Math.max(this.sellStopDistance, 0.01);
    }

    private moveTowards(target: Vec3, deltaTime: number, stopDistance = 0.05): boolean {
        const currentPosition = this.node.worldPosition.clone();
        const flattenedTarget = target.clone();
        flattenedTarget.y = currentPosition.y;

        const direction = flattenedTarget.subtract(currentPosition);
        const distance = direction.length();
        const clampedStopDistance = Math.max(stopDistance, 0.01);
        const arrivalTolerance = clampedStopDistance + 0.001;
        if (distance <= arrivalTolerance) {
            this.resetMovementWatchdog();
            this.playIdleAnimation();
            this.faceTowardsDirection(direction);
            return true;
        }

        if (this.recoverStalledMovement(flattenedTarget, distance, deltaTime)) {
            this.playIdleAnimation();
            return false;
        }

        this.playRunAnimation();
        direction.normalize();
        const moveDistance = Math.min(this.moveSpeed * deltaTime, distance - clampedStopDistance);
        if (moveDistance <= 0) {
            this.playIdleAnimation();
            this.faceTowardsDirection(direction);
            return true;
        }

        this.node.setWorldPosition(currentPosition.add(direction.multiplyScalar(moveDistance)));
        this.faceTowardsDirection(direction);
        return false;
    }

    private recoverStalledMovement(targetPosition: Vec3, distance: number, deltaTime: number): boolean {
        const targetChanged = !Number.isFinite(this._lastMoveTarget.x)
            || Vec3.distance(this._lastMoveTarget, targetPosition) > 0.01;
        if (targetChanged) {
            this._lastMoveTarget.set(targetPosition);
            this._lastMoveDistance = distance;
            this._moveStallTimer = 0;
            return false;
        }

        if (distance < this._lastMoveDistance - 0.01) {
            this._lastMoveDistance = distance;
            this._moveStallTimer = 0;
            return false;
        }

        this._lastMoveDistance = distance;
        this._moveStallTimer += Math.max(0, deltaTime);
        if (this._moveStallTimer < Math.max(this.routeStallResetSeconds, 0.05)) return false;

        this.resetStalledRouteInPlace();
        return true;
    }

    private resetStalledRouteInPlace(): void {
        const currentPosition = this.node.worldPosition.clone();
        this.recoverAfterSceneTransition();
        this.node.setWorldPosition(currentPosition);
    }

    private resetMovementWatchdog(): void {
        this._moveStallTimer = 0;
        this._lastMoveDistance = Number.POSITIVE_INFINITY;
        this._lastMoveTarget.set(Number.NaN, Number.NaN, Number.NaN);
    }

    private faceTowardsDirection(direction: Vec3): void {
        if (direction.lengthSqr() <= 0.000001) {
            return;
        }

        const yaw = math.toDegree(Math.atan2(direction.x, direction.z)) + this.facingYawOffset;
        this.node.setRotationFromEuler(0, yaw, 0);
    }

    private playIdleAnimation(): void {
        if (!this.skeletonAnimation) {
            return;
        }

        if (!this._isMoving && this.skeletonAnimation.getState(AnimationName.Idle)?.isPlaying) {
            return;
        }

        this._isMoving = false;
        this.skeletonAnimation.play(AnimationName.Idle);
    }

    private playRunAnimation(): void {
        if (!this.skeletonAnimation) {
            return;
        }

        if (this._isMoving && this.skeletonAnimation.getState(AnimationName.Run)?.isPlaying) {
            return;
        }

        this._isMoving = true;
        this.skeletonAnimation.play(AnimationName.Run);
    }
}
