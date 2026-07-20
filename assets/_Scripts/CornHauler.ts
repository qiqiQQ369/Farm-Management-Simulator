import { _decorator, Component, game, Game, math, Node, SkeletalAnimation, Vec3 } from 'cc';
import { AnimationName } from './PlayerController';
import { CornHaulerBackpack } from './CornHaulerBackpack';
import { CornStoragePoint } from './CornStoragePoint';

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
    @property({ type: CornStoragePoint }) public collectionStorage: CornStoragePoint = null!;
    @property({ type: CornStoragePoint }) public sellStorage: CornStoragePoint = null!;
    @property({ type: CornHaulerBackpack }) public carryStorage: CornHaulerBackpack = null!;
    @property public moveSpeed = 3;
    @property public transferInterval = 0.15;
    @property public collectionStopDistance = 1.1;
    @property public sellStopDistance = 0.2;
    @property public facingYawOffset = 180;
    @property public transferStallTimeout = 1.5;

    private _state = CornHaulerState.WaitingForCorn;
    private _transferTimer = 0;
    private _isMoving = false;
    private _blockedStorage: CornTransferStorage | null = null;
    private _blockedSince = 0;
    private _monitoredState: CornHaulerState | null = null;
    private _monitoredFromAmount = -1;
    private _monitoredToAmount = -1;
    private _lastTransferProgressAt = 0;

    protected onLoad(): void {
        if (!this.skeletonAnimation) this.skeletonAnimation = this.node.getComponentInChildren(SkeletalAnimation);
    }

    protected onEnable(): void {
        game.on(Game.EVENT_SHOW, this.onApplicationShow, this);
        this._state = CornHaulerState.WaitingForCorn;
        this._transferTimer = 0;
        this._isMoving = false;
        this.resetTransferWatchdog();
        this.resetTransferProgressMonitor();
        if (this.idlePoint) {
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
        if (!this.collectionPoint || !this.sellPoint || !this.collectionStorage || !this.sellStorage || !this.carryStorage) return;
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
                if (!this.isAtSellTarget()) this._state = CornHaulerState.Delivering;
                else this.transferCorn(this.carryStorage, this.sellStorage, CornHaulerState.Returning, CornHaulerState.Unloading, deltaTime);
                break;
            case CornHaulerState.Returning:
                if (this.moveTowards(this.collectionPoint.worldPosition, deltaTime, this.collectionStopDistance)) this._state = CornHaulerState.WaitingForCorn;
                break;
        }
    }

    public recoverAfterSceneTransition(): void {
        if (!this.collectionPoint || !this.collectionStorage || !this.sellStorage || !this.carryStorage) return;
        this.collectionStorage.recoverInterruptedTransfers();
        this.carryStorage.recoverInterruptedTransfers();
        this.sellStorage.recoverInterruptedTransfers();
        this._transferTimer = 0;
        this.resetTransferWatchdog();
        this.resetTransferProgressMonitor();

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
            if (!this.tryRecoverBlockedStorage(from) || !from.hasMovableResource()) return;
        } else {
            this.resetTransferWatchdog();
        }
        if (!to.hasSpace(1)) {
            this._state = blockedState;
            return;
        }

        const resource = from.removeResource(4);
        if (!resource || !to.addResource(resource, 4, Vec3.ZERO)) {
            if (resource) from.addResource(resource, 1);
            return;
        }
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
        let from: CornTransferStorage | null = null;
        let to: CornTransferStorage | null = null;
        let completedState: CornHaulerState | null = null;
        if (this._state === CornHaulerState.Loading) {
            from = this.collectionStorage;
            to = this.carryStorage;
            completedState = CornHaulerState.Delivering;
        } else if (this._state === CornHaulerState.Unloading) {
            from = this.carryStorage;
            to = this.sellStorage;
            completedState = CornHaulerState.Returning;
        } else {
            this.resetTransferProgressMonitor();
            return;
        }

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
        to.recoverInterruptedTransfers();
        this._transferTimer = 0;
        this.resetTransferWatchdog();
        if (from.amount === 0 || (this._state === CornHaulerState.Loading && to.amount > 0)) this._state = completedState;
        this.resetTransferProgressMonitor();
    }

    private isAtSellTarget(): boolean {
        const current = this.node.worldPosition.clone();
        const storagePosition = this.sellStorage.node.worldPosition.clone();
        storagePosition.y = current.y;
        if (Vec3.distance(current, storagePosition) <= Math.max(this.sellStopDistance, 0.2) + 0.8) return true;
        const point = this.sellPoint.worldPosition.clone();
        point.y = current.y;
        return Vec3.distance(current, point) <= Math.max(this.sellStopDistance, 0.2) + 0.8;
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
        const stop = Math.max(stopDistance, 0.05);
        if (distance <= stop) {
            this.playIdleAnimation();
            this.faceTowardsDirection(direction);
            return true;
        }
        this.playRunAnimation();
        direction.normalize();
        this.node.setWorldPosition(current.add(direction.multiplyScalar(Math.min(this.moveSpeed * deltaTime, distance - stop))));
        this.faceTowardsDirection(direction);
        return false;
    }

    private onApplicationShow(): void { this.recoverAfterSceneTransition(); }
    private resetTransferWatchdog(): void { this._blockedStorage = null; this._blockedSince = 0; }
    private resetTransferProgressMonitor(): void { this._monitoredState = null; this._monitoredFromAmount = -1; this._monitoredToAmount = -1; this._lastTransferProgressAt = 0; }
    private faceTowardsDirection(direction: Vec3): void {
        if (direction.lengthSqr() > 0.000001) this.node.setRotationFromEuler(0, math.toDegree(Math.atan2(direction.x, direction.z)) + this.facingYawOffset, 0);
    }
    private playIdleAnimation(): void {
        if (!this.skeletonAnimation || (!this._isMoving && this.skeletonAnimation.getState(AnimationName.Idle)?.isPlaying)) return;
        this._isMoving = false;
        this.skeletonAnimation.play(AnimationName.Idle);
    }
    private playRunAnimation(): void {
        if (!this.skeletonAnimation || (this._isMoving && this.skeletonAnimation.getState(AnimationName.Run)?.isPlaying)) return;
        this._isMoving = true;
        this.skeletonAnimation.play(AnimationName.Run);
    }
}
