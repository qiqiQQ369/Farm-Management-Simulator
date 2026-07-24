import { _decorator, Animation, Component, instantiate, Node, Prefab, Renderer, Tween, tween, Vec3 } from 'cc';
import {
    getCornHaulerStackPosition,
    planCornHaulerAdd,
    planCornHaulerRemove,
} from './CornHaulerBackpackInventory';
import { restoreCornVisualHierarchy } from './CornVisualState';

const { ccclass, property } = _decorator;

/** 玉米搬运工独立随身背包，显示规则与主角携带玉米一致。 */
@ccclass('CornHaulerBackpack')
export class CornHaulerBackpack extends Component {
    @property({ type: Prefab }) public resourcePrefab: Prefab = null!;
    @property({ type: Node }) public stackAreaNode: Node = null!;
    @property public capacity = 42;
    @property public amount = 0;
    @property public maxVisibleItems = 42;
    @property public rowSpacing = 0.2;
    @property public columnSpacing = 0.2;
    @property public layerHeight = 0.2;
    @property public moveAnimationDuration = 0.32;
    @property public moveEasing = 'sineOut' as const;

    private readonly _items: Node[] = [];
    private readonly _readyItems = new Set<Node>();

    protected onLoad(): void {
        if (!this.stackAreaNode) this.stackAreaNode = this.node;
    }

    public hasSpace(requiredCapacity: number): boolean {
        return this.amount + requiredCapacity <= this.capacity;
    }

    public getAvailableSpace(): number {
        return this.capacity - this.amount;
    }

    public addResource(resource: Node, animationType = 1, rotation: Vec3 = Vec3.ZERO): boolean {
        if (!resource?.isValid) return false;

        const plan = planCornHaulerAdd(this.amount, this.capacity, this.maxVisibleItems);
        if (!plan.accepted || (!plan.displayIncomingNode && !this.resourcePrefab)) return false;

        this.amount = plan.nextAmount;
        if (!plan.displayIncomingNode) {
            Tween.stopAllByTarget(resource);
            resource.active = false;
            resource.destroy();
            return true;
        }

        Tween.stopAllByTarget(resource);
        restoreCornVisualHierarchy(resource);
        const stackArea = this.stackAreaNode ?? this.node;
        const startWorldPosition = resource.worldPosition.clone();
        resource.setParent(stackArea);
        resource.setWorldPosition(startWorldPosition);
        const position = this.getStackPosition(this._items.length);
        tween(resource)
            .to(this.moveAnimationDuration, { position }, { easing: this.moveEasing })
            .call(() => this._readyItems.add(resource))
            .start();
        this._items.push(resource);
        return true;
    }

    public removeResource(animationType = 1): Node | null {
        if (animationType === 4 && !this.hasMovableResource()) return null;

        const itemIndex = animationType === 4
            ? this.findLastReadyItemIndex()
            : this._items.length - 1;
        const plan = planCornHaulerRemove(this.amount, this.maxVisibleItems);
        if (!plan.removed || (plan.createTransferNode && !this.resourcePrefab)) return null;

        this.amount = plan.nextAmount;
        if (!plan.createTransferNode) {
            if (itemIndex < 0) return null;
            const item = this._items.splice(itemIndex, 1)[0] ?? null;
            if (item?.isValid) {
                this._readyItems.delete(item);
                Tween.stopAllByTarget(item);
                restoreCornVisualHierarchy(item);
                return item;
            }
            return null;
        }

        const item = instantiate(this.resourcePrefab);
        this.disableLegacyGameplayComponents(item);
        restoreCornVisualHierarchy(item);
        item.setParent(this.stackAreaNode ?? this.node);
        item.setPosition(this.getStackPosition(Math.max(0, this.maxVisibleItems - 1)));
        this._readyItems.delete(item);
        return item;
    }

    public hasMovableResource(): boolean {
        return this.amount > 0 && (this._readyItems.size > 0 || (!!this.resourcePrefab && this._items.length === 0));
    }

    public recoverInterruptedTransfers(): void {
        const stackArea = this.stackAreaNode ?? this.node;
        this._items.length = 0;
        this._readyItems.clear();
        for (const child of [...stackArea.children].slice(0, this.maxVisibleItems)) {
            if (!child?.isValid) continue;
            Tween.stopAllByTarget(child);
            restoreCornVisualHierarchy(child);
            child.setPosition(this.getStackPosition(this._items.length));
            child.setRotationFromEuler(Vec3.ZERO);
            this._items.push(child);
            this._readyItems.add(child);
        }
        this.amount = Math.max(this.amount, this._items.length);
    }

    public clearStorage(): void {
        const stackArea = this.stackAreaNode ?? this.node;
        for (const item of [...stackArea.children]) {
            item.active = false;
            item.destroy();
        }
        this._items.length = 0;
        this._readyItems.clear();
        this.amount = 0;
    }

    private findLastReadyItemIndex(): number {
        for (let index = this._items.length - 1; index >= 0; index--) {
            if (this._readyItems.has(this._items[index])) return index;
        }
        return -1;
    }

    private getStackPosition(index: number): Vec3 {
        const position = getCornHaulerStackPosition(
            index,
            this.rowSpacing,
            this.columnSpacing,
            this.layerHeight,
        );
        return new Vec3(position.x, position.y, position.z);
    }

    private disableLegacyGameplayComponents(root: Node): void {
        const visit = (node: Node): void => {
            for (const component of node.components) {
                const keepEnabled = component instanceof Animation
                    || component instanceof Renderer;
                if (!keepEnabled) component.enabled = false;
            }
            for (const child of node.children) visit(child);
        };
        visit(root);
    }
}
