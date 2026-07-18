import { _decorator, Component, instantiate, Node, Prefab, tween, Tween, Vec3 } from 'cc';
import { CoinBackpack } from './CoinBackpack';
import { StoragePoint } from './Resource/StoragePoint';
import { WoodBackpack } from './WoodBackpack';

const { ccclass, property } = _decorator;

type ResourceSlot = {
    prefab: Prefab | null;
    mount: Node;
    basePosition: Vec3;
    items: Node[];
    count: number;
    capacity: number;
    assignedColumn: number | null;
};

/**
 * Keeps non-wood resources separated by a stable resource id.
 *
 * The existing WoodBackpack and CoinBackpack remain authoritative for wood and
 * coins. This component only owns the additional resource-field inventories.
 */
@ccclass('MultiResourceBackpack')
export class MultiResourceBackpack extends Component {
    @property({ tooltip: 'Number of displayed resources in each row, matching the wood/cash row-column-layer stack.' })
    public stackRows = 1;

    @property({ tooltip: 'Number of displayed resources in each column, matching the wood/cash row-column-layer stack.' })
    public stackColumns = 1;

    @property({ tooltip: 'Distance between displayed resource rows.' })
    public rowSpacing = 0.2;

    @property({ tooltip: 'Distance between displayed resource columns.' })
    public columnSpacing = 0.2;

    @property({ tooltip: 'Vertical distance between carried resource layers.' })
    public layerHeight = 0.2;

    @property({ tooltip: 'Inventory continues growing beyond this value, but only this many models are displayed.' })
    public maxVisibleItems = 42;

    @property({ tooltip: 'Distance between independent carried-resource columns.' })
    public resourceColumnSpacing = 0.1;

    @property({ tooltip: 'Seconds used when a resource stack moves into a newly available column.' })
    public columnReflowDuration = 0.2;

    @property({ tooltip: 'Maximum number of items in each independent resource slot.' })
    public defaultCapacity = 2000;

    private readonly _slots = new Map<string, ResourceSlot>();
    private _woodBackpack: WoodBackpack | null = null;
    private _coinBackpack: CoinBackpack | null = null;
    private _layoutSignature = '';

    protected onLoad(): void {
        this._woodBackpack = this.node.getComponent(WoodBackpack);
        this._coinBackpack = this.node.getComponent(CoinBackpack);
    }

    protected update(): void {
        const signature = this.getLayoutSignature();
        if (signature !== this._layoutSignature) {
            this.refreshColumnLayout();
        }
    }

    public registerResource(
        resourceId: string,
        prefab: Prefab | null,
        horizontalOffset: number,
        capacity = this.defaultCapacity,
        woodMountTemplate: Node | null = null,
    ): void {
        const existing = this._slots.get(resourceId);
        if (existing) {
            existing.prefab = prefab;
            existing.capacity = capacity;
            return;
        }

        const mount = new Node(`ResourceBackpack_${resourceId}`);
        let basePosition: Vec3;
        if (woodMountTemplate?.parent) {
            // Wood is mounted below the character's model socket, not below the
            // Player root. Copying this transform makes crops follow the same
            // back-facing direction and animation as carried wood.
            mount.setParent(woodMountTemplate.parent);
            const position = woodMountTemplate.position.clone();
            basePosition = position.clone();
            position.x += horizontalOffset;
            mount.setPosition(position);
            mount.setRotation(woodMountTemplate.rotation);
            mount.setScale(woodMountTemplate.scale);
        } else {
            mount.setParent(this.node);
            basePosition = new Vec3(0, 1.45, -0.48);
            mount.setPosition(basePosition.x + horizontalOffset, basePosition.y, basePosition.z);
        }

        this._slots.set(resourceId, {
            prefab,
            mount,
            basePosition,
            items: [],
            count: 0,
            capacity,
            assignedColumn: null,
        });
        this._layoutSignature = this.getLayoutSignature();
    }

    public getCount(resourceId: string): number {
        return this._slots.get(resourceId)?.count ?? 0;
    }

    public addResource(resourceId: string, sourceWorldPosition?: Vec3): boolean {
        const slot = this._slots.get(resourceId);
        if (!slot || !slot.prefab || slot.count >= slot.capacity) {
            return false;
        }

        slot.count++;
        this.refreshColumnLayout();
        if (slot.items.length >= this.maxVisibleItems) {
            return true;
        }

        const item = instantiate(slot.prefab);
        this.disableLegacyGameplayComponents(item);
        item.setParent(slot.mount);

        const targetPosition = this.calculatePosition(slot.items.length);
        if (sourceWorldPosition) {
            item.setWorldPosition(sourceWorldPosition);
            tween(item)
                .to(0.32, { position: targetPosition }, { easing: 'sineOut' })
                .start();
        } else {
            item.setPosition(targetPosition);
        }

        slot.items.push(item);
        return true;
    }

    /** Removes one item without destroying it so it can move into field storage. */
    public takeResource(resourceId: string): Node | null {
        const slot = this._slots.get(resourceId);
        if (!slot || !slot.prefab || slot.count === 0) {
            return null;
        }

        slot.count--;
        this.refreshColumnLayout();

        // Hidden inventory still needs a real node when it is transferred to
        // the sell storage. Keep the 42 visible models on the backpack and
        // create the transfer node at the top of that stack.
        if (slot.count >= this.maxVisibleItems) {
            const item = instantiate(slot.prefab);
            this.disableLegacyGameplayComponents(item);
            item.setParent(slot.mount);
            item.setPosition(this.calculatePosition(this.maxVisibleItems - 1));
            return item;
        }

        return slot.items.pop() ?? null;
    }

    /**
     * Use a single direction: wood -> cash -> left field -> right field.
     * Crops must always stay behind cash instead of alternating across it.
     */
    private refreshColumnLayout(immediate = false): void {
        this._woodBackpack ??= this.node.getComponent(WoodBackpack);
        this._coinBackpack ??= this.node.getComponent(CoinBackpack);

        const hasWood = this.getWoodInventoryCount() > 0;
        const hasCoin = this.getCoinInventoryCount() > 0;
        let nextResourceColumn = hasCoin ? 2 : hasWood ? 1 : 0;

        for (const slot of this._slots.values()) {
            if (slot.count <= 0) {
                slot.assignedColumn = null;
                continue;
            }

            const column = nextResourceColumn++;
            if (slot.assignedColumn === column) continue;

            slot.assignedColumn = column;
            const target = slot.basePosition.clone();
            // Keep additional resource stacks tightly grouped on the back.
            target.y -= column * this.resourceColumnSpacing;

            Tween.stopAllByTarget(slot.mount);
            if (immediate || this.columnReflowDuration <= 0) {
                slot.mount.setPosition(target);
            } else {
                tween(slot.mount)
                    .to(this.columnReflowDuration, { position: target }, { easing: 'sineInOut' })
                    .start();
            }
        }

        this._layoutSignature = this.getLayoutSignature();
    }

    private getLayoutSignature(): string {
        const woodOccupied = this.getWoodInventoryCount() > 0 ? 1 : 0;
        const coinOccupied = this.getCoinInventoryCount() > 0 ? 1 : 0;
        const resources = Array.from(this._slots.entries())
            .map(([id, slot]) => `${id}:${slot.count > 0 ? 1 : 0}`)
            .join('|');
        return `${woodOccupied}:${coinOccupied}|${resources}`;
    }

    /** Forest pickups update StoragePoint.amount directly, bypassing WoodBackpack._woodCount. */
    private getWoodInventoryCount(): number {
        const componentCount = this._woodBackpack?.getWoodCount() ?? 0;
        const storageCount = this._woodBackpack?.backpackMount
            ?.getComponent(StoragePoint)
            ?.amount ?? 0;
        return Math.max(componentCount, storageCount);
    }

    /** Accept both the legacy CoinBackpack counter and its mounted StoragePoint as authoritative inputs. */
    private getCoinInventoryCount(): number {
        const componentCount = this._coinBackpack?.getCoinCount() ?? 0;
        const storageCount = this._coinBackpack?.coinBackpackMount
            ?.getComponent(StoragePoint)
            ?.amount ?? 0;
        return Math.max(componentCount, storageCount);
    }

    private calculatePosition(index: number): Vec3 {
        const rows = Math.max(1, Math.floor(this.stackRows));
        const columns = Math.max(1, Math.floor(this.stackColumns));
        const itemsPerLayer = rows * columns;
        const layer = Math.floor(index / itemsPerLayer);
        const indexInLayer = index % itemsPerLayer;
        const row = Math.floor(indexInLayer / columns);
        const column = indexInLayer % columns;

        return new Vec3(
            (column - 1) * this.columnSpacing,
            layer * this.layerHeight,
            (row - 1) * this.rowSpacing,
        );
    }

    private disableLegacyGameplayComponents(root: Node): void {
        const visit = (node: Node): void => {
            for (const component of node.components) {
                const className = component.constructor.name;
                const keepEnabled = className.includes('Animation') || className.includes('Renderer');
                if (!keepEnabled) {
                    component.enabled = false;
                }
            }

            for (const child of node.children) {
                visit(child);
            }
        };

        visit(root);
    }
}
