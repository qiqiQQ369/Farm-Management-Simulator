import { _decorator, Component, Node, SkeletalAnimation, Vec3 } from 'cc';
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
            this.node.setWorldPosition(this.idlePoint.worldPosition);
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
                if (this.collectionStorage.amount > 0 && this.sellStorage.hasSpace(1)) {
                    this._state = HaulerState.MovingToCollection;
                }
                break;
            case HaulerState.MovingToCollection:
                if (this.moveTowards(this.collectionPoint.worldPosition, deltaTime)) {
                    this._state = HaulerState.Loading;
                }
                break;
            case HaulerState.Loading:
                this.playIdleAnimation();
                this.transferWood(this.collectionStorage, this.carryStorage, HaulerState.Delivering, HaulerState.WaitingForWood, deltaTime);
                break;
            case HaulerState.Delivering:
                if (this.moveTowards(this.sellPoint.worldPosition, deltaTime)) {
                    this._state = HaulerState.Unloading;
                }
                break;
            case HaulerState.Unloading:
                this.playIdleAnimation();
                this.transferWood(this.carryStorage, this.sellStorage, HaulerState.Returning, HaulerState.Unloading, deltaTime);
                break;
            case HaulerState.Returning:
                if (this.moveTowards(this.collectionPoint.worldPosition, deltaTime)) {
                    this._state = HaulerState.WaitingForWood;
                }
                break;
        }
    }

    private transferWood(from: StoragePoint, to: StoragePoint, completedState: HaulerState, blockedState: HaulerState, deltaTime: number): void {
        this._transferTimer += deltaTime;
        if (this._transferTimer < this.transferInterval) return;
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

    private moveTowards(target: Vec3, deltaTime: number): boolean {
        const direction = target.clone().subtract(this.node.worldPosition);
        if (direction.length() <= 0.05) {
            this.node.setWorldPosition(target);
            this.playIdleAnimation();
            return true;
        }

        this.playRunAnimation();
        direction.normalize();
        this.node.setWorldPosition(this.node.worldPosition.clone().add(direction.multiplyScalar(this.moveSpeed * deltaTime)));
        this.node.lookAt(target);
        return false;
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
