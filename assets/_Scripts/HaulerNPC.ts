import { _decorator, Component, math, Node, SkeletalAnimation, Vec3 } from 'cc';
import { AnimationName } from './PlayerController';
import { ResourceManager } from './Resource/ResourceManager';
import { StoragePoint } from './Resource/StoragePoint';

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
    public collectionStopDistance = 1.1;

    @property
    public sellStopDistance = 0.2;

    @property
    public facingYawOffset = 180;

    private _state = HaulerState.WaitingForWood;
    private _transferTimer = 0;
    private _isMoving = false;

    protected onLoad(): void {
        if (!this.skeletonAnimation) {
            this.skeletonAnimation = this.node.getComponentInChildren(SkeletalAnimation);
        }
    }

    protected onEnable(): void {
        this._state = HaulerState.WaitingForWood;
        this._transferTimer = 0;
        this._isMoving = false;
        if (this.idlePoint) {
            const spawnPosition = this.idlePoint.worldPosition.clone();
            spawnPosition.y = this.node.worldPosition.y;
            this.node.setWorldPosition(spawnPosition);
        }
        this.playIdleAnimation();
    }

    protected update(deltaTime: number): void {
        if (!this.collectionPoint || !this.sellPoint || !this.collectionStorage || !this.sellStorage || !this.carryStorage) {
            return;
        }

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
                if (this.moveTowards(this.sellPoint.worldPosition, deltaTime, this.sellStopDistance)) {
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
    }

    private transferWood(from: StoragePoint, to: StoragePoint, completedState: HaulerState, blockedState: HaulerState, deltaTime: number): void {
        this._transferTimer += deltaTime;
        if (this._transferTimer < this.transferInterval) {
            return;
        }

        this._transferTimer = 0;

        if (from.amount === 0) {
            this._state = completedState;
            return;
        }

        if (!to.hasSpace(1)) {
            this._state = blockedState;
            return;
        }

        void ResourceManager.MoveResource(from, to, false, 4, Vec3.ZERO);
    }

    private moveTowards(target: Vec3, deltaTime: number, stopDistance = 0.05): boolean {
        const currentPosition = this.node.worldPosition.clone();
        const flattenedTarget = target.clone();
        flattenedTarget.y = currentPosition.y;

        const direction = flattenedTarget.subtract(currentPosition);
        const distance = direction.length();
        const clampedStopDistance = Math.max(stopDistance, 0.05);
        if (distance <= clampedStopDistance) {
            this.playIdleAnimation();
            this.faceTowardsDirection(direction);
            return true;
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
