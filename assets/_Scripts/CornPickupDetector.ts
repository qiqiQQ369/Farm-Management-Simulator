import { _decorator, Collider, Component, ITriggerEvent, Node, Vec3 } from 'cc';
import { CornStoragePoint } from './CornStoragePoint';
import { MultiResourceBackpack } from './MultiResourceBackpack';

const { ccclass, property } = _decorator;

export type CornPickupDetectorConfig = {
    player: Node;
    backpack: MultiResourceBackpack;
    collectionStorage: CornStoragePoint;
    resourceId: string;
    collectionInterval: number;
};

/** Corn-only equivalent of the forest collection area's automatic pickup. */
@ccclass('CornPickupDetector')
export class CornPickupDetector extends Component {
    @property({ type: Node }) public player: Node = null!;
    @property({ type: MultiResourceBackpack }) public backpack: MultiResourceBackpack = null!;
    @property({ type: CornStoragePoint }) public collectionStorage: CornStoragePoint = null!;
    @property public resourceId = '';
    @property public collectionInterval = 0.1;

    private _playerInside = false;
    private _collectionTimer = 0;

    public configure(config: CornPickupDetectorConfig): void {
        this.player = config.player;
        this.backpack = config.backpack;
        this.collectionStorage = config.collectionStorage;
        this.resourceId = config.resourceId;
        this.collectionInterval = Math.max(0.01, config.collectionInterval);
    }

    protected onEnable(): void {
        const collider = this.getComponent(Collider);
        collider?.on('onTriggerEnter', this.onTriggerEnter, this);
        collider?.on('onTriggerExit', this.onTriggerExit, this);
    }

    protected onDisable(): void {
        const collider = this.getComponent(Collider);
        collider?.off('onTriggerEnter', this.onTriggerEnter, this);
        collider?.off('onTriggerExit', this.onTriggerExit, this);
        this._playerInside = false;
        this._collectionTimer = 0;
    }

    protected update(deltaTime: number): void {
        if (!this._playerInside) return;

        this._collectionTimer += deltaTime;
        if (this._collectionTimer < this.collectionInterval) return;
        this._collectionTimer = 0;
        this.transferOneCorn();
    }

    private onTriggerEnter(event: ITriggerEvent): void {
        if (!this.isPlayerNode(event.otherCollider.node)) return;
        this._playerInside = true;
        this._collectionTimer = this.collectionInterval;
    }

    private onTriggerExit(event: ITriggerEvent): void {
        if (!this.isPlayerNode(event.otherCollider.node)) return;
        this._playerInside = false;
        this._collectionTimer = 0;
    }

    private isPlayerNode(candidate: Node): boolean {
        let current: Node | null = candidate;
        while (current) {
            if (current === this.player) return true;
            current = current.parent;
        }
        return false;
    }

    private transferOneCorn(): void {
        if (!this.collectionStorage || !this.backpack || !this.resourceId) return;

        const item = this.collectionStorage.removeResource(4);
        if (!item?.isValid) return;

        const sourceWorldPosition = item.worldPosition.clone();
        if (this.backpack.addResource(this.resourceId, sourceWorldPosition)) {
            item.destroy();
            return;
        }

        this.collectionStorage.addResource(item, 0, Vec3.ZERO);
    }
}
