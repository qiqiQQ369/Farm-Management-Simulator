import { _decorator, Component, game, Game, math, Node, SkeletalAnimation, Vec3 } from 'cc';
import { ChopAction } from './ChopAction';
import { CornHaulerBackpack } from './CornHaulerBackpack';
import { CornStoragePoint } from './CornStoragePoint';
import { HaulerAnimationName } from './HaulerAnimation';

const { ccclass, property } = _decorator;

enum CornHaulerState {
    WaitingForCorn,
    MovingToCollection,
    Loading,
    Delivering,
    Unloading,
    Returning,
}

type CornTransferStorage = CornStoragePoint | CornHaulerBackpack;

/** Independent corn-area equivalent of the forest transport state machine. */
@ccclass('CornHauler')
export class CornHauler extends Component {
    @property({ type: SkeletalAnimation }) public skeletonAnimation: SkeletalAnimation = null!;
    @property({ type: Node }) public collectionPoint: Node = null!;
    @property({ type: Node }) public sellPoint: Node = null!;
    @property({ type: Node }) public idlePoint: Node = null!;
    @property({ type: Node }) public homeFieldRoot: Node = null!;
    @property({ type: CornStoragePoint }) public collectionStorage: CornStoragePoint = null!;
    @property({ type: CornStoragePoint }) public sellStorage: CornStoragePoint = null!;
    @property({ type: CornHaulerBackpack }) public carryStorage: CornHaulerBackpack = null!;
    @property public moveSpeed = 3;
    @property public transferInterval = 0.15;
    @property public collectionStopDistance = 0.05;
    @property public sellStopDistance = 0.01;
    @property public facingYawOffset = 180;
    @property public transferStallTimeout = 1.5;
    @property public routeStallResetSeconds = 0.5;

    private _state = CornHaulerState.WaitingForCorn;
    private _transferTimer = 0;
    private _isMoving = false;
    private _blockedStorage: CornTransferStorage | null = null;
    private _blockedSince = 0;
    private _monitoredState: CornHaulerState | null = null;
    private _monitoredFromAmount = -1;
    private _monitoredToAmount = -1;
    private _lastTransferProgressAt = 0;
    private _moveStallTimer = 0;
    private _lastMoveDistance = Number.POSITIVE_INFINITY;
    private readonly _lastMoveTarget = new Vec3(Number.NaN, Number.NaN, Number.NaN);
    private _reportedInvalidFieldBinding = false;
    private _futouNode: Node | null = null;

    protected onLoad(): void {
        if (!this.skeletonAnimation) this.skeletonAnimation = this.node.getComponentInChildren(SkeletalAnimation);
        // Cache the axe attach point so we can keep it hidden every frame.
        const chopAction = this.node.getComponentInChildren(ChopAction);
        this._futouNode = chopAction ? (chopAction as any).futouNode as Node | null : null;
    }

    public setHiddenAxeNode(node: Node | null): void {
        this._futouNode = node;
        if (node?.isValid) node.active = false;
    }

    protected onEnable(): void {
        game.on(Game.EVENT_SHOW, this.onApplicationShow, this);
        this.homeFieldRoot ??= this.node.parent ?? this.node;
        this._state = CornHaulerState.WaitingForCorn;
        this._transferTimer = 0;
        this._isMoving = false;
        this.resetTransferWatchdog();
        this.resetTransferProgressMonitor();
        this.resetMovementWatchdog();
        if (this.hasValidFieldBindings() && this.idlePoint) {
            const spawnPosition = this.idlePoint.worldPosition.clone();
            spawnPosition.y = this.node.worldPosition.y;
            this.node.setWorldPosition(spawnPosition);
        }
        this.playIdleAnimation();
    }

    protected onDisable(): void {
        game.off(Game.EVENT_SHOW, this.onApplicationShow, this);
    }

    protected update(deltaTime: number): void {
        if (!this.hasValidFieldBindings()
            || !this.collectionStorage || !this.sellStorage || !this.carryStorage) return;
        // Keep the inherited axe hidden – animation clips may re-enable it each frame.
        if (this._futouNode?.isValid) this._futouNode.active = false;
        this.monitorTransferProgress();

        switch (this._state) {
            case CornHaulerState.WaitingForCorn:
                this.playIdleAnimation();
                if (this.carryStorage.amount > 0 && this.sellStorage.hasSpace(1)) this._state = CornHaulerState.Delivering;
                else if (this.collectionStorage.amount > 0 && this.sellStorage.hasSpace(1)) this._state = CornHaulerState.MovingToCollection;
                break;
            case CornHaulerState.MovingToCollection:
                if (this.moveTowards(this.collectionPoint.worldPosition, deltaTime, this.collectionStopDistance)) this._state = CornHaulerState.Loading;
                break;
            case CornHaulerState.Loading:
                this.playIdleAnimation();
                if (this.carryStorage.amount > 0 && (!this.carryStorage.hasSpace(1) || this.collectionStorage.amount === 0)) this._state = CornHaulerState.Delivering;
                else this.transferCorn(this.collectionStorage, this.carryStorage, CornHaulerState.Delivering, CornHaulerState.Delivering, deltaTime);
                break;
            case CornHaulerState.Delivering:
                if (this.moveTowards(this.sellPoint.worldPosition, deltaTime, this.sellStopDistance) || this.isAtSellTarget()) {
                    this.playIdleAnimation();
                    this._state = CornHaulerState.Unloading;
                }
                break;
            case CornHaulerState.Unloading:
                this.playIdleAnimation();
                this.transferCorn(this.carryStorage, this.sellStorage, CornHaulerState.Returning, CornHaulerState.Unloading, deltaTime);
                break;
            case CornHaulerState.Returning:
                if (this.moveTowards(this.collectionPoint.worldPosition, deltaTime, this.collectionStopDistance)) this._state = CornHaulerState.WaitingForCorn;
                break;
        }
    }

    public isUnloadingAtSellPoint(): boolean {
        return this._state === CornHaulerState.Unloading;
    }

    public recoverAfterSceneTransition(): void {
        if (!this.hasValidFieldBindings()
            || !this.collectionStorage || !this.sellStorage || !this.carryStorage) return;
        this.collectionStorage.recoverInterruptedTransfers();
        this.carryStorage.recoverInterruptedTransfers();
        this.sellStorage.recoverInterruptedTransfers();
        this._transferTimer = 0;
        this.resetTransferWatchdog();
        this.resetTransferProgressMonitor();
        this.resetMovementWatchdog();

        if (this.carryStorage.amount > 0) {
            this._state = CornHaulerState.Delivering;
        } else if (this.collectionStorage.amount > 0 && this.sellStorage.hasSpace(1)) {
            this._state = this.isNearCollection() ? CornHaulerState.Loading : CornHaulerState.MovingToCollection;
        } else {
            this._state = CornHaulerState.WaitingForCorn;
            this.playIdleAnimation();
        }
    }

    private transferCorn(from: CornTransferStorage, to: CornTransferStorage, completedState: CornHaulerState, blockedState: CornHaulerState, deltaTime: number): void {
        this._transferTimer += deltaTime;
        if (this._transferTimer < this.transferInterval) return;
        this._transferTimer = 0;

        if (from.amount === 0) {
            this.resetTransferWatchdog();
            this._state = completedState;
            return;
        }
        if (!from.hasMovableResource()) {
            if (!this.tryRecoverBlockedStorage(from)) return;

            // Recovery can discover that an interrupted transfer left an
            // inventory count without a real corn node. Finish this leg
            // rather than waiting forever for a resource that no longer exists.
            if (from.amount === 0) {
                this._state = completedState;
                return;
            }

            if (!from.hasMovableResource()) return;
        } else {
            this.resetTransferWatchdog();
        }
        if (!to.hasSpace(1)) {
            this._state = blockedState;
            return;
        }

        const resource = from.removeResource(4);
        if (resource) {
            // Keep transferred corn product local scale stable across backpack,
            // sell tray, and customer body mounts.
            resource.setScale(1, 1, 1);
        }
        if (!resource || !to.addResource(resource, 4, Vec3.ZERO)) {
            if (resource) from.addResource(resource, 1);
            return;
        }
        if (from instanceof CornStoragePoint) from.finalizeResourceTransfer(resource);
    }

    private tryRecoverBlockedStorage(storage: CornTransferStorage): boolean {
        const now = Date.now();
        if (this._blockedStorage !== storage) {
            this._blockedStorage = storage;
            this._blockedSince = now;
            return false;
        }
        if (now - this._blockedSince < Math.max(this.transferStallTimeout, 0.7) * 1000) return false;
        storage.recoverInterruptedTransfers();
        this.resetTransferWatchdog();
        return true;
    }

    private monitorTransferProgress(): void {
        if (this._state !== CornHaulerState.Loading && this._state !== CornHaulerState.Unloading) {
            this.resetTransferProgressMonitor();
            return;
        }
        const from = this._state === CornHaulerState.Loading ? this.collectionStorage : this.carryStorage;
        const to = this._state === CornHaulerState.Loading ? this.carryStorage : this.sellStorage;

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
        if (now - this._lastTransferProgressAt < Math.max(this.transferStallTimeout, 0.7) * 1000) return;
        from.recoverInterruptedTransfers();
        this._monitoredFromAmount = from.amount;
        this._monitoredToAmount = to.amount;
        this._lastTransferProgressAt = now;
    }

    private isAtSellTarget(): boolean {
        const current = this.node.worldPosition.clone();
        const point = this.sellPoint.worldPosition.clone();
        point.y = current.y;
        return Vec3.distance(current, point) <= Math.max(this.sellStopDistance, 0.01);
    }

    private isNearCollection(): boolean {
        const current = this.node.worldPosition.clone();
        const point = this.collectionPoint.worldPosition.clone();
        point.y = current.y;
        return Vec3.distance(current, point) <= Math.max(this.collectionStopDistance, 0.05) + 0.8;
    }

    private moveTowards(target: Vec3, deltaTime: number, stopDistance = 0.05): boolean {
        const current = this.node.worldPosition.clone();
        const flattenedTarget = target.clone();
        flattenedTarget.y = current.y;
        const direction = flattenedTarget.subtract(current);
        const distance = direction.length();
        const stop = Math.max(stopDistance, 0.01);
        const arrivalTolerance = stop + 0.001;
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
        this.node.setWorldPosition(current.add(direction.multiplyScalar(Math.min(this.moveSpeed * deltaTime, distance - stop))));
        this.faceTowardsDirection(direction);
        return false;
    }

    private hasValidFieldBindings(): boolean {
        const valid = !!this.homeFieldRoot?.isValid
            && this.belongsToHomeField(this.collectionPoint)
            && this.belongsToHomeField(this.sellPoint)
            && this.belongsToHomeField(this.idlePoint);
        if (!valid && !this._reportedInvalidFieldBinding) {
            console.error('CornHauler: collection, sell, and idle points must belong to the same corn field.');
            this._reportedInvalidFieldBinding = true;
        }
        return valid;
    }

    private belongsToHomeField(node: Node | null): boolean {
        for (let current = node; current; current = current.parent) {
            if (current === this.homeFieldRoot) return true;
        }
        return false;
    }

    /**
     * Keep the same progress detection as the forest hauler.  A stalled
     * corn route resets only its watchdog in place, so it never picks up an
     * anchor from another area's coordinates.
     */
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

    private onApplicationShow(): void { this.recoverAfterSceneTransition(); }
    private resetTransferWatchdog(): void { this._blockedStorage = null; this._blockedSince = 0; }
    private resetTransferProgressMonitor(): void { this._monitoredState = null; this._monitoredFromAmount = -1; this._monitoredToAmount = -1; this._lastTransferProgressAt = 0; }
    private faceTowardsDirection(direction: Vec3): void {
        if (direction.lengthSqr() > 0.000001) this.node.setRotationFromEuler(0, math.toDegree(Math.atan2(direction.x, direction.z)) + this.facingYawOffset, 0);
    }
    private playIdleAnimation(): void {
        if (!this.skeletonAnimation || (!this._isMoving && this.skeletonAnimation.getState(HaulerAnimationName.Idle)?.isPlaying)) return;
        this._isMoving = false;
        this.skeletonAnimation.play(HaulerAnimationName.Idle);
    }
    private playRunAnimation(): void {
        if (!this.skeletonAnimation || (this._isMoving && this.skeletonAnimation.getState(HaulerAnimationName.Run)?.isPlaying)) return;
        this._isMoving = true;
        this.skeletonAnimation.play(HaulerAnimationName.Run);
    }
}
