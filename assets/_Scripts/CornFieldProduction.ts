import {
    _decorator,
    Component,
    instantiate,
    Node,
    Prefab,
    tween,
    Tween,
    Vec3,
} from 'cc';
import { ChopAction } from './ChopAction';
import { MultiResourceBackpack } from './MultiResourceBackpack';
import { PlayerController } from './PlayerController';
import type { CornHarvestTarget } from './CornWorker';
import { CornStoragePoint } from './CornStoragePoint';

const { ccclass, property } = _decorator;

type CornPlantRuntime = {
    node: Node;
    fullScale: Vec3;
    visualNodes: Node[];
    workerChops: number;
    respawnAt: number;
    harvestableAt: number;
};

type VehiclePathBounds = {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
};

export type CornFieldProductionConfig = {
    resourceId: string;
    cropRoot: Node;
    resourcePrefab: Prefab | null;
    plantVisualPrefab: Prefab | null;
    collectionStorage: CornStoragePoint;
    player: Node;
    playerController: PlayerController | null;
    chopAction: ChopAction | null;
    backpack: MultiResourceBackpack;
};

/**
 * Corn-only adapter for the forest production rhythm.
 *
 * It mirrors the observable Tree production rules without registering corn as
 * wood or sharing any forest storage: vehicle > player > worker, one player or
 * vehicle chop, four worker chops, and a ten-second respawn.
 */
@ccclass('CornFieldProduction')
export class CornFieldProduction extends Component {
    @property({ type: Node, tooltip: 'This field prefab root containing the authored corn plants.' })
    public cropRoot: Node = null!;

    @property({ type: Node, tooltip: 'Field-local CornTractor start point.' })
    public truckStartPoint: Node = null!;

    @property({ type: Node, tooltip: 'Field-local CornTractor end point.' })
    public truckEndPoint: Node = null!;

    @property({ type: CornStoragePoint, tooltip: 'Field-local collection storage.' })
    public collectionStorage: CornStoragePoint = null!;

    @property({ tooltip: 'Stable inventory id; never shared with wood or the other corn field.' })
    public resourceId = '';

    @property({ type: Prefab, tooltip: 'Corn resource visual used by backpack and storage.' })
    public resourcePrefab: Prefab = null!;

    @property public playerReward = 3;
    @property public workerChopsRequired = 4;
    @property public workerRewardPerChop = 2;
    @property public vehicleReward = 3;
    @property public respawnSeconds = 10;
    @property public respawnProtectionSeconds = 0.35;
    @property public playerHarvestRadius = 2.2;
    @property public vehicleHarvestRadius = 3.5;

    private readonly _plants: CornPlantRuntime[] = [];
    private _player: Node | null = null;
    private _playerController: PlayerController | null = null;
    private _chopAction: ChopAction | null = null;
    private _backpack: MultiResourceBackpack | null = null;
    private _vehicle: Node | null = null;
    private _productionActive = false;
    private _playerHarvesting = false;

    public configure(config: CornFieldProductionConfig): void {
        this.resourceId = config.resourceId;
        this.cropRoot = config.cropRoot;
        this.resourcePrefab = config.resourcePrefab!;
        this.collectionStorage = config.collectionStorage;
        this._player = config.player;
        this._playerController = config.playerController;
        this._chopAction = config.chopAction;
        this._backpack = config.backpack;
        this.collectPlants(config.plantVisualPrefab);
    }

    public activateProduction(): void {
        this._productionActive = true;
    }

    public setVehicle(vehicle: Node | null): void {
        this._vehicle = vehicle;
    }

    public getPlantCount(): number {
        return this._plants.length;
    }

    /** Returns the actual planted area used to constrain the corn tractor. */
    public getVehiclePathBounds(): VehiclePathBounds | null {
        const plants = this._plants.filter(plant => plant.node?.isValid);
        if (plants.length === 0) return null;

        const positions = plants.map(plant => plant.node.worldPosition);
        return {
            minX: Math.min(...positions.map(position => position.x)),
            maxX: Math.max(...positions.map(position => position.x)),
            minZ: Math.min(...positions.map(position => position.z)),
            maxZ: Math.max(...positions.map(position => position.z)),
        };
    }

    public getWorkerLaneStartPosition(laneIndex: number, standDistance = 0.9): Vec3 | null {
        const lane = this.getWorkerLanes()[laneIndex] ?? [];
        if (lane.length === 0) return null;
        if (lane.length === 1) return lane[0].node.worldPosition.clone();

        const direction = new Vec3();
        Vec3.subtract(direction, lane[1].node.worldPosition, lane[0].node.worldPosition);
        direction.y = 0;
        direction.normalize();
        return Vec3.scaleAndAdd(
            new Vec3(),
            lane[0].node.worldPosition,
            direction,
            -standDistance,
        );
    }

    public partitionWorkerTargets(actorParents: Array<Node | null>, workerCount: number): CornHarvestTarget[][] {
        const count = Math.max(1, workerCount);
        const lanes = this.getWorkerLanes();
        return Array.from({ length: count }, (_, index) => {
            const parent = actorParents[index] ?? null;
            const lane = lanes[index] ?? [];
            return lane.map(plant => this.createWorkerTarget(plant, parent));
        });
    }

    protected update(): void {
        if (!this._productionActive) return;

        this.updateRespawns(Date.now() / 1000);
        this.harvestVehicleContacts();
        void this.updatePlayerHarvest();
    }

    private collectPlants(plantVisualPrefab: Prefab | null): void {
        this._plants.length = 0;
        if (!this.cropRoot) return;

        for (const node of this.cropRoot.children) {
            if (plantVisualPrefab) {
                for (const child of [...node.children]) child.destroy();
                const replacement = instantiate(plantVisualPrefab);
                replacement.setParent(node);
                replacement.setPosition(Vec3.ZERO);
                this.disableLegacyGameplayComponents(replacement);
            }

            this._plants.push({
                node,
                fullScale: node.scale.clone(),
                visualNodes: [...node.children],
                workerChops: 0,
                respawnAt: 0,
                harvestableAt: 0,
            });
        }
    }

    private async updatePlayerHarvest(): Promise<void> {
        if (this._playerHarvesting || !this._player || !this._chopAction || !this._backpack) return;

        let target: CornPlantRuntime | null = null;
        let closestDistance = this.playerHarvestRadius;
        for (const plant of this._plants) {
            if (!this.canPlayerHarvest(plant)) continue;
            const distance = Vec3.distance(this._player.worldPosition, plant.node.worldPosition);
            if (distance < closestDistance) {
                closestDistance = distance;
                target = plant;
            }
        }
        if (!target) return;

        this._playerHarvesting = true;
        if (!this._playerController?.isMoving()) {
            this._playerController?.faceTarget(target.node.worldPosition);
        }

        await this._chopAction.playChopAction(target.node.worldPosition);
        if (this.canPlayerHarvest(target)) {
            const sourcePosition = target.node.worldPosition.clone();
            this.chopPlant(target);
            for (let index = 0; index < this.playerReward; index++) {
                this._backpack.addResource(this.resourceId, sourcePosition);
            }
        }
        this._playerController?.refreshMovementAnimation();
        this._playerHarvesting = false;
    }

    private harvestVehicleContacts(): void {
        if (!this._vehicle?.isValid || !this._vehicle.activeInHierarchy) return;
        for (const plant of this._plants) {
            if (!this.isPlantAvailable(plant)) continue;
            if (Vec3.distance(this._vehicle.worldPosition, plant.node.worldPosition) > this.vehicleHarvestRadius) continue;

            const sourcePosition = plant.node.worldPosition.clone();
            this.chopPlant(plant);
            this.addToCollection(sourcePosition, this.vehicleReward);
        }
    }

    private harvestByWorker(plant: CornPlantRuntime): void {
        if (!this.canWorkerHarvest(plant)) return;

        if (plant.workerChops === 0) this.captureMaturePlantScale(plant);
        const sourcePosition = plant.node.worldPosition.clone();
        plant.workerChops++;
        this.addToCollection(sourcePosition, this.workerRewardPerChop);

        if (plant.workerChops >= this.workerChopsRequired) {
            this.chopPlant(plant);
            return;
        }

        const progress = plant.workerChops / this.workerChopsRequired;
        const scale = plant.fullScale.clone();
        scale.y *= Math.max(0.55, 1 - progress * 0.3);
        tween(plant.node).to(0.12, { scale }, { easing: 'sineOut' }).start();
    }

    private canPlayerHarvest(plant: CornPlantRuntime): boolean {
        return this.isPlantAvailable(plant) && !this.isVehicleClaiming(plant);
    }

    private canWorkerHarvest(plant: CornPlantRuntime): boolean {
        if (!this.isPlantAvailable(plant) || this.isVehicleClaiming(plant)) return false;
        return !this._player || Vec3.distance(this._player.worldPosition, plant.node.worldPosition) > this.playerHarvestRadius;
    }

    private isVehicleClaiming(plant: CornPlantRuntime): boolean {
        return !!this._vehicle?.isValid && this._vehicle.activeInHierarchy &&
            Vec3.distance(this._vehicle.worldPosition, plant.node.worldPosition) <= this.vehicleHarvestRadius;
    }

    private isPlantAvailable(plant: CornPlantRuntime): boolean {
        return plant.respawnAt <= 0 &&
            Date.now() / 1000 >= plant.harvestableAt &&
            plant.node.isValid &&
            plant.node.activeInHierarchy;
    }

    private chopPlant(plant: CornPlantRuntime): void {
        if (!this.isPlantAvailable(plant)) return;
        if (plant.workerChops === 0) this.captureMaturePlantScale(plant);
        Tween.stopAllByTarget(plant.node);
        plant.node.active = false;
        plant.workerChops = 0;
        plant.respawnAt = Date.now() / 1000 + this.respawnSeconds;
    }

    private updateRespawns(now: number): void {
        for (const plant of this._plants) {
            if (plant.respawnAt <= 0 || now < plant.respawnAt || !plant.node.isValid) continue;
            plant.respawnAt = 0;
            plant.workerChops = 0;
            plant.harvestableAt = now + this.respawnProtectionSeconds;
            this.restorePlantVisual(plant);
            plant.node.setScale(
                plant.fullScale.x * 0.1,
                plant.fullScale.y * 0.1,
                plant.fullScale.z * 0.1,
            );
            tween(plant.node).to(0.35, { scale: plant.fullScale }, { easing: 'backOut' }).start();
        }
    }

    private getWorkerLanes(): CornPlantRuntime[][] {
        const quantize = (value: number): number => Math.round(value * 100);
        const lanes = new Map<number, CornPlantRuntime[]>();
        for (const plant of this._plants) {
            const laneKey = quantize(plant.node.position.x);
            const lane = lanes.get(laneKey) ?? [];
            lane.push(plant);
            lanes.set(laneKey, lane);
        }

        return [...lanes.entries()]
            .sort(([left], [right]) => left - right)
            .map(([, lane]) => lane.sort((left, right) =>
                quantize(right.node.position.z) - quantize(left.node.position.z),
            ));
    }

    private createWorkerTarget(plant: CornPlantRuntime, actorParent: Node | null): CornHarvestTarget {
        return {
            node: plant.node,
            getPosition: () => {
                if (!actorParent) return plant.node.worldPosition.clone();
                const localPosition = new Vec3();
                actorParent.inverseTransformPoint(localPosition, plant.node.worldPosition);
                return localPosition;
            },
            isAvailable: () => this.canWorkerHarvest(plant),
            registerChop: () => this.harvestByWorker(plant),
        };
    }

    private restorePlantVisual(plant: CornPlantRuntime): void {
        plant.node.active = true;
        for (const visualNode of plant.visualNodes) {
            if (!visualNode?.isValid) continue;
            visualNode.active = true;
            this.restoreVisualDescendants(visualNode);
        }
    }

    /** Captures the actual grown scale immediately before the plant is hidden. */
    private captureMaturePlantScale(plant: CornPlantRuntime): void {
        if (plant.node?.isValid) plant.fullScale = plant.node.scale.clone();
    }

    private restoreVisualDescendants(node: Node): void {
        for (const child of node.children) {
            child.active = true;
            this.restoreVisualDescendants(child);
        }
    }

    private addToCollection(worldPosition: Vec3, count: number): void {
        for (let index = 0; index < count; index++) {
            const item = this.createResourceVisual(worldPosition);
            if (!item) continue;
            if (!this.collectionStorage.addResource(item, 1)) {
                item.destroy();
            }
        }
    }

    private createResourceVisual(worldPosition: Vec3): Node | null {
        if (!this.resourcePrefab) return null;
        const item = instantiate(this.resourcePrefab);
        item.setParent(this.node.scene);
        item.setWorldPosition(worldPosition);
        this.disableLegacyGameplayComponents(item);
        return item;
    }

    private disableLegacyGameplayComponents(root: Node): void {
        const visit = (node: Node): void => {
            for (const component of node.components) {
                const className = component.constructor.name;
                const keepEnabled = className.includes('Animation') || className.includes('Renderer');
                if (!keepEnabled) component.enabled = false;
            }
            for (const child of node.children) visit(child);
        };
        visit(root);
    }
}
