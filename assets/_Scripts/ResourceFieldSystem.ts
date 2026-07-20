import {
    _decorator,
    Animation,
    Component,
    find,
    instantiate,
    Label,
    Node,
    Prefab,
    SkeletalAnimation,
    Sprite,
    SpriteFrame,
    tween,
    Vec3,
} from 'cc';
import { ChopAction } from './ChopAction';
import { CoinBackpack } from './CoinBackpack';
import { JoystickController } from './JoystickController';
import { MainUI } from './MainUI';
import { MultiResourceBackpack } from './MultiResourceBackpack';
import { PlayerController } from './PlayerController';
import { StoragePoint } from './Resource/StoragePoint';
import { WoodBackpack } from './WoodBackpack';

const { ccclass, property } = _decorator;

type PlantRuntime = {
    node: Node;
    hitPoints: number;
    respawnAt: number;
};

type UnlockStage = 'worker' | 'vehicle' | 'hauler' | 'complete';
type PurchasableUnlockStage = Exclude<UnlockStage, 'complete'>;

type UnlockPadRuntime = {
    node: Node;
    cost: number;
    progress: number;
    stage: UnlockStage;
    timer: number;
};

type ActorRuntime = {
    node: Node;
    target: PlantRuntime | null;
    actionTimer: number;
};

type FieldRuntime = {
    id: string;
    root: Node;
    openingPad: Node;
    resourcePrefab: Prefab | null;
    plantVisualPrefab: Prefab | null;
    icon: SpriteFrame | null;
    hitsPerPlant: number;
    yieldPerPlant: number;
    respawnSeconds: number;
    workerCost: number;
    vehicleCost: number;
    haulerCost: number;
    workerPrefab: Prefab | null;
    vehiclePrefab: Prefab | null;
    haulerPrefab: Prefab | null;
    workerSpeed: number;
    vehicleSpeed: number;
    haulerSpeed: number;
    workerActionInterval: number;
    vehicleActionInterval: number;
    unlocked: boolean;
    plants: PlantRuntime[];
    collectionStorage: StoragePoint;
    sellStorage: StoragePoint;
    sellNode: Node;
    unlockNodes: Record<PurchasableUnlockStage, Node>;
    unlockPad: UnlockPadRuntime | null;
    workers: ActorRuntime[];
    vehicle: ActorRuntime | null;
    hauler: Node | null;
    haulerState: 'waiting' | 'toCollection' | 'toSell' | 'returning';
    haulerTimer: number;
    depositTimer: number;
};

/**
 * Additive, resource-id based gameplay for the two side fields in DevScene.
 * It deliberately does not register crops as Trees and never writes to the
 * WoodBackpack, so the existing forest loop remains isolated.
 */
@ccclass('ResourceFieldSystem')
export class ResourceFieldSystem extends Component {
    public static inst: ResourceFieldSystem | null = null;

    @property({ type: Node, group: 'Scene binding' })
    public leftFieldRoot: Node = null!;

    @property({ type: Node, group: 'Scene binding' })
    public rightFieldRoot: Node = null!;

    @property({ type: Node, group: 'Scene binding' })
    public leftOpeningPad: Node = null!;

    @property({ type: Node, group: 'Scene binding' })
    public rightOpeningPad: Node = null!;

    @property({ type: Node, group: 'Left field scene nodes' })
    public leftWorkerUnlockPoint: Node = null!;

    @property({ type: Node, group: 'Left field scene nodes' })
    public leftVehicleUnlockPoint: Node = null!;

    @property({ type: Node, group: 'Left field scene nodes' })
    public leftHaulerUnlockPoint: Node = null!;

    @property({ type: StoragePoint, group: 'Left field scene nodes' })
    public leftCollectionStorage: StoragePoint = null!;

    @property({ type: Node, group: 'Right field scene nodes' })
    public rightWorkerUnlockPoint: Node = null!;

    @property({ type: Node, group: 'Right field scene nodes' })
    public rightVehicleUnlockPoint: Node = null!;

    @property({ type: Node, group: 'Right field scene nodes' })
    public rightHaulerUnlockPoint: Node = null!;

    @property({ type: StoragePoint, group: 'Right field scene nodes' })
    public rightCollectionStorage: StoragePoint = null!;

    @property({ type: Node, group: 'Scene binding' })
    public endPanel: Node = null!;

    @property({ type: Node, group: 'Reusable actor fallback' })
    public workerTemplate: Node = null!;

    @property({ type: Node, group: 'Reusable actor fallback' })
    public vehicleTemplate: Node = null!;

    @property({ type: Node, group: 'Reusable actor fallback' })
    public haulerTemplate: Node = null!;

    @property({ tooltip: 'Stable inventory id. Change the id when replacing the left resource.', group: 'Left field' })
    public leftResourceId = 'field_left_corn';

    @property({ type: Prefab, tooltip: 'Drop/backpack/stock visual. Wood is used as the current placeholder.', group: 'Left field' })
    public leftResourcePrefab: Prefab = null!;

    @property({ type: SpriteFrame, tooltip: 'Resource icon used by generated unlock pads.', group: 'Left field' })
    public leftResourceIcon: SpriteFrame = null!;

    @property({ type: Prefab, tooltip: 'Optional replacement for each planted crop visual.', group: 'Left field' })
    public leftPlantVisualPrefab: Prefab = null!;

    @property({ type: Prefab, group: 'Left field' })
    public leftWorkerPrefab: Prefab = null!;

    @property({ type: Prefab, group: 'Left field' })
    public leftVehiclePrefab: Prefab = null!;

    @property({ type: Prefab, group: 'Left field' })
    public leftHaulerPrefab: Prefab = null!;

    @property({ group: 'Left field' }) public leftWorkerCost = 100;
    @property({ group: 'Left field' }) public leftVehicleCost = 200;
    @property({ group: 'Left field' }) public leftHaulerCost = 170;
    @property({ group: 'Left field' }) public leftHitsPerPlant = 3;
    @property({ group: 'Left field' }) public leftYieldPerPlant = 1;
    @property({ group: 'Left field' }) public leftRespawnSeconds = 10;
    @property({ group: 'Left field' }) public leftInventoryCapacity = 2000;
    @property({ group: 'Left field' }) public leftWorkerSpeed = 2.6;
    @property({ group: 'Left field' }) public leftVehicleSpeed = 4.5;
    @property({ group: 'Left field' }) public leftHaulerSpeed = 3.2;
    @property({ group: 'Left field' }) public leftWorkerActionInterval = 0.75;
    @property({ group: 'Left field' }) public leftVehicleActionInterval = 0.42;

    @property({ tooltip: 'Stable inventory id. Change the id when replacing the right resource.', group: 'Right field' })
    public rightResourceId = 'field_right_corn';

    @property({ type: Prefab, tooltip: 'Drop/backpack/stock visual. Wood is used as the current placeholder.', group: 'Right field' })
    public rightResourcePrefab: Prefab = null!;

    @property({ type: SpriteFrame, tooltip: 'Resource icon used by generated unlock pads.', group: 'Right field' })
    public rightResourceIcon: SpriteFrame = null!;

    @property({ type: Prefab, tooltip: 'Optional replacement for each planted crop visual.', group: 'Right field' })
    public rightPlantVisualPrefab: Prefab = null!;

    @property({ type: Prefab, group: 'Right field' })
    public rightWorkerPrefab: Prefab = null!;

    @property({ type: Prefab, group: 'Right field' })
    public rightVehiclePrefab: Prefab = null!;

    @property({ type: Prefab, group: 'Right field' })
    public rightHaulerPrefab: Prefab = null!;

    @property({ group: 'Right field' }) public rightWorkerCost = 100;
    @property({ group: 'Right field' }) public rightVehicleCost = 200;
    @property({ group: 'Right field' }) public rightHaulerCost = 170;
    @property({ group: 'Right field' }) public rightHitsPerPlant = 3;
    @property({ group: 'Right field' }) public rightYieldPerPlant = 1;
    @property({ group: 'Right field' }) public rightRespawnSeconds = 10;
    @property({ group: 'Right field' }) public rightInventoryCapacity = 2000;
    @property({ group: 'Right field' }) public rightWorkerSpeed = 2.6;
    @property({ group: 'Right field' }) public rightVehicleSpeed = 4.5;
    @property({ group: 'Right field' }) public rightHaulerSpeed = 3.2;
    @property({ group: 'Right field' }) public rightWorkerActionInterval = 0.75;
    @property({ group: 'Right field' }) public rightVehicleActionInterval = 0.42;

    @property({ tooltip: 'Player harvest detection radius.', group: 'Shared gameplay' })
    public harvestRadius = 2.2;

    @property({ tooltip: 'Distance at which a field accepts its own carried resource.', group: 'Shared gameplay' })
    public sellRadius = 2.6;

    @property({ tooltip: 'Coins consumed per unlock tick.', group: 'Shared gameplay' })
    public coinsPerTick = 1;

    @property({ tooltip: 'Seconds between unlock consumption ticks.', group: 'Shared gameplay' })
    public consumeInterval = 0.2;

    @property({ tooltip: 'Local position of side-field stock inside its sell slot, matching the forest wood slot.', group: 'Shared gameplay' })
    public sellStoragePosition = new Vec3(-0.358, 0.866, 1.53);

    @property({ tooltip: 'Visual scale of side-field stock inside its sell slot, matching the forest wood slot.', group: 'Shared gameplay' })
    public sellStorageScale = 0.9;

    @property({ tooltip: 'Local rotation of side-field stock inside its sell slot, matching the forest wood slot.', group: 'Shared gameplay' })
    public sellStorageRotation = new Vec3(0, -90, 0);

    private readonly _fields: FieldRuntime[] = [];
    private _player: Node | null = null;
    private _playerController: PlayerController | null = null;
    private _chopAction: ChopAction | null = null;
    private _coinBackpack: CoinBackpack | null = null;
    private _resourceBackpack: MultiResourceBackpack | null = null;
    private _playerHarvesting = false;
    private _openedSideFields = 0;
    private _finished = false;

    protected onLoad(): void {
        ResourceFieldSystem.inst = this;
        this._player = find('Player');
        this._playerController = this._player?.getComponent(PlayerController) ?? null;
        this._chopAction = this._player?.getComponent(ChopAction) ?? null;
        this._coinBackpack = this._player?.getComponent(CoinBackpack) ?? null;
        this._resourceBackpack = this._player?.getComponent(MultiResourceBackpack) ??
            this._player?.addComponent(MultiResourceBackpack) ?? null;
    }

    protected start(): void {
        if (!this._player || !this._resourceBackpack) {
            console.error('ResourceFieldSystem: Player or MultiResourceBackpack is missing.');
            return;
        }

        const fallbackPrefab = this.resolveFallbackResourcePrefab();
        this.leftResourcePrefab = this.leftResourcePrefab ?? fallbackPrefab;
        this.rightResourcePrefab = this.rightResourcePrefab ?? fallbackPrefab;

        const woodMount = this._player.getComponent(WoodBackpack)?.backpackMount ?? null;
        this._resourceBackpack.registerResource(this.leftResourceId, this.leftResourcePrefab, -0.42, this.leftInventoryCapacity, woodMount);
        this._resourceBackpack.registerResource(this.rightResourceId, this.rightResourcePrefab, 0.42, this.rightInventoryCapacity, woodMount);

        const leftField = this.createField(
            this.leftResourceId,
            this.leftFieldRoot,
            this.leftOpeningPad,
            this.leftWorkerUnlockPoint,
            this.leftVehicleUnlockPoint,
            this.leftHaulerUnlockPoint,
            this.leftCollectionStorage,
            this.leftResourcePrefab,
            this.leftResourceIcon,
            this.leftPlantVisualPrefab,
            this.leftWorkerCost,
            this.leftVehicleCost,
            this.leftHaulerCost,
            this.leftWorkerPrefab,
            this.leftVehiclePrefab,
            this.leftHaulerPrefab,
            this.leftHitsPerPlant,
            this.leftYieldPerPlant,
            this.leftRespawnSeconds,
            this.leftWorkerSpeed,
            this.leftVehicleSpeed,
            this.leftHaulerSpeed,
            this.leftWorkerActionInterval,
            this.leftVehicleActionInterval,
        );
        if (leftField) this._fields.push(leftField);

        const rightField = this.createField(
            this.rightResourceId,
            this.rightFieldRoot,
            this.rightOpeningPad,
            this.rightWorkerUnlockPoint,
            this.rightVehicleUnlockPoint,
            this.rightHaulerUnlockPoint,
            this.rightCollectionStorage,
            this.rightResourcePrefab,
            this.rightResourceIcon,
            this.rightPlantVisualPrefab,
            this.rightWorkerCost,
            this.rightVehicleCost,
            this.rightHaulerCost,
            this.rightWorkerPrefab,
            this.rightVehiclePrefab,
            this.rightHaulerPrefab,
            this.rightHitsPerPlant,
            this.rightYieldPerPlant,
            this.rightRespawnSeconds,
            this.rightWorkerSpeed,
            this.rightVehicleSpeed,
            this.rightHaulerSpeed,
            this.rightWorkerActionInterval,
            this.rightVehicleActionInterval,
        );
        if (rightField) this._fields.push(rightField);
    }

    protected update(deltaTime: number): void {
        if (this._finished || this._fields.length === 0) {
            return;
        }

        const now = Date.now() / 1000;
        for (const field of this._fields) {
            if (!field.unlocked) {
                continue;
            }

            this.updateRespawns(field, now);
            this.updateUnlockPad(field, deltaTime);
            this.updatePlayerDeposit(field, deltaTime);
            this.updateWorkers(field, deltaTime);
            this.updateVehicle(field, deltaTime);
            this.updateHauler(field, deltaTime);
        }

        void this.updatePlayerHarvest();
    }

    protected onDestroy(): void {
        if (ResourceFieldSystem.inst === this) {
            ResourceFieldSystem.inst = null;
        }
    }

    /** Called by FinishNode after one side-field reveal sequence completes. */
    public static notifyFieldRevealCompleted(fieldRoot: Node): boolean {
        return ResourceFieldSystem.inst?.onFieldRevealCompleted(fieldRoot) ?? false;
    }

    private onFieldRevealCompleted(fieldRoot: Node): boolean {
        const field = this._fields.find(candidate => candidate.root === fieldRoot);
        if (!field || field.unlocked) {
            return this._finished;
        }

        field.unlocked = true;
        this._openedSideFields++;
        field.collectionStorage.node.active = true;
        this.collectPlants(field);
        this.showUnlockStage(field, 'worker');

        if (this._openedSideFields >= 2) {
            this.finishGame();
        }

        return this._finished;
    }

    private createField(
        id: string,
        root: Node,
        openingPad: Node,
        workerUnlockPoint: Node,
        vehicleUnlockPoint: Node,
        haulerUnlockPoint: Node,
        collectionStorage: StoragePoint,
        resourcePrefab: Prefab | null,
        icon: SpriteFrame | null,
        plantVisualPrefab: Prefab | null,
        workerCost: number,
        vehicleCost: number,
        haulerCost: number,
        workerPrefab: Prefab | null,
        vehiclePrefab: Prefab | null,
        haulerPrefab: Prefab | null,
        hitsPerPlant: number,
        yieldPerPlant: number,
        respawnSeconds: number,
        workerSpeed: number,
        vehicleSpeed: number,
        haulerSpeed: number,
        workerActionInterval: number,
        vehicleActionInterval: number,
    ): FieldRuntime | null {
        const missingBindings = [
            ['field root', root],
            ['opening pad', openingPad],
            ['worker unlock point', workerUnlockPoint],
            ['vehicle unlock point', vehicleUnlockPoint],
            ['hauler unlock point', haulerUnlockPoint],
            ['collection storage', collectionStorage],
        ].filter(([, binding]) => !binding).map(([name]) => name);
        if (missingBindings.length > 0) {
            console.error(`ResourceFieldSystem: ${id} disabled; missing scene bindings: ${missingBindings.join(', ')}.`);
            return null;
        }

        const sellNode = root.getChildByName('Sell1') ?? root;
        collectionStorage.storageName = `${id}_collection`;
        collectionStorage.node.active = false;
        workerUnlockPoint.active = false;
        vehicleUnlockPoint.active = false;
        haulerUnlockPoint.active = false;
        const sellStorage = this.ensureSellStorage(sellNode, id);

        return {
            id,
            root,
            openingPad,
            resourcePrefab,
            plantVisualPrefab,
            icon,
            hitsPerPlant,
            yieldPerPlant,
            respawnSeconds,
            workerCost,
            vehicleCost,
            haulerCost,
            workerPrefab,
            vehiclePrefab,
            haulerPrefab,
            workerSpeed,
            vehicleSpeed,
            haulerSpeed,
            workerActionInterval,
            vehicleActionInterval,
            unlocked: false,
            plants: [],
            collectionStorage,
            sellStorage,
            sellNode,
            unlockNodes: {
                worker: workerUnlockPoint,
                vehicle: vehicleUnlockPoint,
                hauler: haulerUnlockPoint,
            },
            unlockPad: null,
            workers: [],
            vehicle: null,
            hauler: null,
            haulerState: 'waiting',
            haulerTimer: 0,
            depositTimer: 0,
        };
    }

    private collectPlants(field: FieldRuntime): void {
        const finishComponent = field.root.getComponentInChildren('FinishNode') as unknown as { targetNodes?: Node[] } | null;
        const cropRoot = finishComponent?.targetNodes?.[0] ?? field.root.children[0] ?? null;
        if (!cropRoot) {
            console.error(`ResourceFieldSystem: crop root missing for ${field.id}.`);
            return;
        }

        field.plants = cropRoot.children.map(node => ({
            node,
            hitPoints: field.hitsPerPlant,
            respawnAt: 0,
        }));

        if (field.plantVisualPrefab) {
            for (const plant of field.plants) {
                for (const child of [...plant.node.children]) child.destroy();
                const replacement = instantiate(field.plantVisualPrefab);
                replacement.setParent(plant.node);
                replacement.setPosition(Vec3.ZERO);
                this.disableActorGameplayComponents(replacement);
            }
        }
        this.applyResourceIcon(field.root, field.icon);
    }

    private async updatePlayerHarvest(): Promise<void> {
        if (this._playerHarvesting || !this._player || !this._resourceBackpack || !this._chopAction) {
            return;
        }

        let closestField: FieldRuntime | null = null;
        let closestPlant: PlantRuntime | null = null;
        let closestDistance = this.harvestRadius;

        for (const field of this._fields) {
            if (!field.unlocked) continue;
            for (const plant of field.plants) {
                if (!plant.node.activeInHierarchy || plant.respawnAt > 0) continue;
                const distance = Vec3.distance(this._player.worldPosition, plant.node.worldPosition);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestField = field;
                    closestPlant = plant;
                }
            }
        }

        if (!closestField || !closestPlant) {
            return;
        }

        this._playerHarvesting = true;
        if (!this._playerController?.isMoving()) {
            this._playerController?.faceTarget(closestPlant.node.worldPosition);
        }

        await this._chopAction.playChopAction(closestPlant.node.worldPosition);
        this.damagePlant(closestField, closestPlant, true);
        this._playerController?.refreshMovementAnimation();
        this._playerHarvesting = false;
    }

    private damagePlant(field: FieldRuntime, plant: PlantRuntime, pickedUpByPlayer: boolean): void {
        if (plant.respawnAt > 0 || !plant.node.activeInHierarchy) {
            return;
        }

        plant.hitPoints--;
        if (plant.hitPoints > 0) {
            return;
        }

        const sourcePosition = plant.node.worldPosition.clone();
        plant.node.active = false;
        plant.respawnAt = Date.now() / 1000 + field.respawnSeconds;

        for (let i = 0; i < field.yieldPerPlant; i++) {
            if (pickedUpByPlayer) {
                this._resourceBackpack?.addResource(field.id, sourcePosition);
            } else {
                const item = this.createResourceVisual(field, sourcePosition);
                if (item) {
                    field.collectionStorage.addResource(item, 1);
                }
            }
        }
    }

    private updateRespawns(field: FieldRuntime, now: number): void {
        for (const plant of field.plants) {
            if (plant.respawnAt <= 0 || now < plant.respawnAt) continue;
            plant.respawnAt = 0;
            plant.hitPoints = field.hitsPerPlant;
            plant.node.active = true;
            const finalScale = plant.node.scale.clone();
            plant.node.setScale(0.1, 0.1, 0.1);
            tween(plant.node).to(0.35, { scale: finalScale }, { easing: 'backOut' }).start();
        }
    }

    private updatePlayerDeposit(field: FieldRuntime, deltaTime: number): void {
        if (!this._player || !this._resourceBackpack) return;
        if (Vec3.distance(this._player.worldPosition, field.sellNode.worldPosition) > this.sellRadius) {
            field.depositTimer = 0;
            return;
        }

        field.depositTimer += deltaTime;
        if (field.depositTimer < 0.16) return;
        field.depositTimer = 0;

        const item = this._resourceBackpack.takeResource(field.id);
        if (item) {
            field.sellStorage.addResource(item, 2);
        }
    }

    private updateUnlockPad(field: FieldRuntime, deltaTime: number): void {
        const pad = field.unlockPad;
        if (!pad || pad.stage === 'complete' || !this._player || !this._coinBackpack) return;
        if (Vec3.distance(this._player.worldPosition, pad.node.worldPosition) > 1.6) {
            pad.timer = 0;
            return;
        }

        pad.timer += deltaTime;
        if (pad.timer < this.consumeInterval) return;
        pad.timer = 0;

        if (!this._coinBackpack.removeCoins(this.coinsPerTick)) {
            return;
        }

        pad.progress = Math.min(pad.cost, pad.progress + this.coinsPerTick);
        this.updateUnlockPadUI(pad);
        if (pad.progress >= pad.cost) {
            this.completeUnlockStage(field, pad.stage);
        }
    }

    private completeUnlockStage(field: FieldRuntime, stage: UnlockStage): void {
        if (field.unlockPad) {
            field.unlockPad.node.active = false;
        }
        field.unlockPad = null;

        if (stage === 'worker') {
            this.spawnWorkers(field);
            this.showUnlockStage(field, 'vehicle');
        } else if (stage === 'vehicle') {
            for (const worker of field.workers) {
                worker.node.active = false;
            }
            this.spawnVehicle(field);
            this.showUnlockStage(field, 'hauler');
        } else if (stage === 'hauler') {
            this.spawnHauler(field);
        }
    }

    private showUnlockStage(field: FieldRuntime, stage: PurchasableUnlockStage): void {
        for (const node of [field.unlockNodes.worker, field.unlockNodes.vehicle, field.unlockNodes.hauler]) {
            node.active = false;
        }

        const padNode = field.unlockNodes[stage];
        padNode.active = true;
        const visual = padNode.getChildByName('view') ?? padNode.children[0] ?? null;
        if (!visual) {
            console.error(`ResourceFieldSystem: scene visual missing from ${padNode.name}.`);
        }
        visual?.setPosition(Vec3.ZERO);
        visual?.setScale(0.72, 0.72, 0.72);
        if (visual) visual.active = true;
        this.applyResourceIcon(padNode, field.icon);

        const cost = stage === 'worker' ? field.workerCost : stage === 'vehicle' ? field.vehicleCost : field.haulerCost;
        field.unlockPad = {
            node: padNode,
            cost,
            progress: 0,
            stage,
            timer: 0,
        };
        this.updateUnlockPadUI(field.unlockPad);
    }

    private updateUnlockPadUI(pad: UnlockPadRuntime): void {
        const remaining = Math.max(0, pad.cost - pad.progress);
        const visit = (node: Node): void => {
            const label = node.getComponent(Label);
            if (label && (node.name === 'amount' || /^\d+$/.test(label.string))) {
                label.string = `${remaining}`;
            }
            const sprite = node.getComponent(Sprite);
            if (sprite && node.name.toLowerCase().includes('fill')) {
                sprite.fillRange = pad.cost > 0 ? pad.progress / pad.cost : 1;
            }
            for (const child of node.children) visit(child);
        };
        visit(pad.node);
    }

    private applyResourceIcon(root: Node, icon: SpriteFrame | null): void {
        if (!icon) return;
        const visit = (node: Node): void => {
            if (node.name.toLowerCase().includes('icon')) {
                const sprite = node.getComponent(Sprite);
                if (sprite) sprite.spriteFrame = icon;
            }
            for (const child of node.children) visit(child);
        };
        visit(root);
    }

    private spawnWorkers(field: FieldRuntime): void {
        for (let index = 0; index < 3; index++) {
            const actor = this.createActor(field.workerPrefab, this.workerTemplate?.children[index] ?? this.workerTemplate?.children[0] ?? this.workerTemplate);
            if (!actor) continue;
            actor.name = `${field.id}_Worker_${index + 1}`;
            actor.setParent(field.root);
            actor.setWorldPosition(field.collectionStorage.node.worldPosition.clone().add3f((index - 1) * 0.8, 0, 0));
            field.workers.push({ node: actor, target: null, actionTimer: index * 0.15 });
        }
    }

    private spawnVehicle(field: FieldRuntime): void {
        const source = this.vehicleTemplate?.getChildByName('Truck') ?? this.vehicleTemplate;
        const actor = this.createActor(field.vehiclePrefab, source);
        if (!actor) return;
        actor.name = `${field.id}_Harvester`;
        actor.setParent(field.root);
        actor.setWorldPosition(field.collectionStorage.node.worldPosition);
        field.vehicle = { node: actor, target: null, actionTimer: 0 };
    }

    private spawnHauler(field: FieldRuntime): void {
        const actor = this.createActor(field.haulerPrefab, this.haulerTemplate);
        if (!actor) return;
        actor.name = `${field.id}_Hauler`;
        actor.setParent(field.root);
        actor.setWorldPosition(field.sellNode.worldPosition);
        field.hauler = actor;
        field.haulerState = 'waiting';
    }

    private updateWorkers(field: FieldRuntime, deltaTime: number): void {
        for (const worker of field.workers) {
            if (!worker.node.active) continue;
            this.updateHarvesterActor(field, worker, deltaTime, field.workerSpeed, field.workerActionInterval);
        }
    }

    private updateVehicle(field: FieldRuntime, deltaTime: number): void {
        if (!field.vehicle) return;
        this.updateHarvesterActor(field, field.vehicle, deltaTime, field.vehicleSpeed, field.vehicleActionInterval);
    }

    private updateHarvesterActor(field: FieldRuntime, actor: ActorRuntime, deltaTime: number, speed: number, actionInterval: number): void {
        if (!actor.target || actor.target.respawnAt > 0 || !actor.target.node.activeInHierarchy) {
            actor.target = this.findClosestActivePlant(field, actor.node.worldPosition);
        }
        if (!actor.target) return;

        const targetPosition = actor.target.node.worldPosition;
        const distance = Vec3.distance(actor.node.worldPosition, targetPosition);
        if (distance > 1.35) {
            this.moveTowards(actor.node, targetPosition, speed * deltaTime);
            return;
        }

        actor.actionTimer += deltaTime;
        if (actor.actionTimer < actionInterval) return;
        actor.actionTimer = 0;
        actor.node.lookAt(targetPosition);
        actor.node.getComponentInChildren(SkeletalAnimation)?.play('KanMuTou');
        this.damagePlant(field, actor.target, false);
    }

    private updateHauler(field: FieldRuntime, deltaTime: number): void {
        if (!field.hauler) return;
        const hauler = field.hauler;

        if (field.haulerState === 'waiting') {
            if (field.collectionStorage.amount > 0) field.haulerState = 'toCollection';
            return;
        }

        if (field.haulerState === 'toCollection') {
            if (this.moveTowards(hauler, field.collectionStorage.node.worldPosition, field.haulerSpeed * deltaTime)) {
                field.haulerTimer = 0;
                field.haulerState = 'toSell';
            }
            return;
        }

        if (field.haulerState === 'toSell') {
            field.haulerTimer += deltaTime;
            if (field.haulerTimer < 0.35) return;
            if (this.moveTowards(hauler, field.sellNode.worldPosition, field.haulerSpeed * deltaTime)) {
                const batch = Math.min(4, field.collectionStorage.amount);
                for (let index = 0; index < batch; index++) {
                    const item = field.collectionStorage.removeResource();
                    if (item) field.sellStorage.addResource(item, 2);
                }
                field.haulerState = 'returning';
            }
            return;
        }

        if (this.moveTowards(hauler, field.collectionStorage.node.worldPosition, field.haulerSpeed * deltaTime)) {
            field.haulerState = field.collectionStorage.amount > 0 ? 'toSell' : 'waiting';
            field.haulerTimer = 0;
        }
    }

    private findClosestActivePlant(field: FieldRuntime, position: Vec3): PlantRuntime | null {
        let closest: PlantRuntime | null = null;
        let distance = Number.MAX_VALUE;
        for (const plant of field.plants) {
            if (!plant.node.activeInHierarchy || plant.respawnAt > 0) continue;
            const candidateDistance = Vec3.distance(position, plant.node.worldPosition);
            if (candidateDistance < distance) {
                distance = candidateDistance;
                closest = plant;
            }
        }
        return closest;
    }

    /** Returns true once the node reaches the target. */
    private moveTowards(node: Node, target: Vec3, distance: number): boolean {
        const current = node.worldPosition;
        const direction = target.clone().subtract(current);
        const remaining = direction.length();
        if (remaining <= Math.max(0.12, distance)) {
            node.setWorldPosition(target);
            return true;
        }
        direction.normalize().multiplyScalar(distance);
        node.lookAt(target);
        node.setWorldPosition(current.clone().add(direction));
        return false;
    }

    private createActor(prefab: Prefab | null, fallback: Node | null): Node | null {
        const actor = prefab ? instantiate(prefab) : fallback ? instantiate(fallback) : null;
        if (!actor) return null;
        this.disableActorGameplayComponents(actor);
        actor.active = true;
        return actor;
    }

    private disableActorGameplayComponents(root: Node): void {
        const visit = (node: Node): void => {
            for (const component of node.components) {
                const name = component.constructor.name;
                const keepEnabled = name.includes('Animation') || name.includes('Renderer');
                if (!keepEnabled) component.enabled = false;
            }
            for (const child of node.children) visit(child);
        };
        visit(root);
    }

    private createResourceVisual(field: FieldRuntime, worldPosition: Vec3): Node | null {
        if (!field.resourcePrefab) return null;
        const item = instantiate(field.resourcePrefab);
        item.setParent(field.root.scene);
        item.setWorldPosition(worldPosition);
        this.disableActorGameplayComponents(item);
        return item;
    }

    private configureStorage(node: Node, name: string, capacity: number): StoragePoint {
        const storage = node.getComponent(StoragePoint) ?? node.addComponent(StoragePoint);
        storage.storageName = name;
        storage.capacity = capacity;
        storage.layers = 10000;
        storage.resourcePerRow = 5;
        storage.resourcePerCol = 2;
        storage.layerHeight = 0.2;
        storage.resourceRowSpacing = 0.22;
        storage.resourceColSpacing = 0.55;
        storage.stackAreaNode = node;
        return storage;
    }

    private ensureSellStorage(sellNode: Node, resourceId: string): StoragePoint {
        const existing = sellNode.getComponentInChildren(StoragePoint);
        const storageNode = existing?.node ?? new Node(`SellStorage_${resourceId}`);
        if (!storageNode.parent) {
            storageNode.setParent(sellNode);
        }

        // Match the central forest slot's effective position, scale and
        // orientation under the side Sell1 nodes, whose revealed scale is 1.
        storageNode.setPosition(this.sellStoragePosition);
        storageNode.setScale(this.sellStorageScale, this.sellStorageScale, this.sellStorageScale);
        storageNode.setRotationFromEuler(this.sellStorageRotation);
        const storage = this.configureStorage(storageNode, `${resourceId}_sell`, 1000000);
        storage.resourcePerRow = 5;
        storage.resourcePerCol = 2;
        storage.resourceRowSpacing = 0.2;
        storage.resourceColSpacing = 1;
        storage.layerHeight = 0.2;
        return storage;
    }

    private resolveFallbackResourcePrefab(): Prefab | null {
        const woodBackpack = this._player?.getComponent('WoodBackpack') as unknown as { woodDisplayPrefab?: Prefab } | null;
        return woodBackpack?.woodDisplayPrefab ?? null;
    }

    private finishGame(): void {
        if (this._finished) return;
        this._finished = true;

        if (MainUI.inst) {
            MainUI.inst.isGameOver = true;
            MainUI.inst.hideMoveUI();
        }

        this._playerController?.setControlEnabled(false);
        const joystick = find('Canvas/JoystickContainer')?.getComponent(JoystickController) ?? null;
        if (joystick) {
            joystick._lock = true;
            joystick.node.active = false;
        }

        if (this.endPanel) {
            this.endPanel.active = true;
            const animations = this.endPanel.getComponentsInChildren(Animation);
            for (const animation of animations) {
                if (animation.defaultClip) animation.play();
            }
        }
    }
}
