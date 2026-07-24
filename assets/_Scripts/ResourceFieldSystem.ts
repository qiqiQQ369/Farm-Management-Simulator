import {
    _decorator,
    Animation,
    AudioSource,
    BoxCollider,
    CapsuleCollider,
    Component,
    ERigidBodyType,
    find,
    instantiate,
    Label,
    Node,
    Prefab,
    Renderer,
    RigidBody,
    SkeletalAnimation,
    Sprite,
    SpriteFrame,
    tween,
    Vec3,
} from 'cc';
import { ChopAction } from './ChopAction';
import { CameraController } from './CameraController';
import { CoinBackpack } from './CoinBackpack';
import { CornFieldProduction } from './CornFieldProduction';
import { CornCustomerScheduler } from './CornCustomerScheduler';
import { CornHauler } from './CornHauler';
import { CornHaulerBackpack } from './CornHaulerBackpack';
import { CornPickupDetector } from './CornPickupDetector';
import { CornStoragePoint } from './CornStoragePoint';
import { CornTractor } from './CornTractor';
import { CornUnlockPad } from './CornUnlockPad';
import { restoreCornVisualHierarchy } from './CornVisualState';
import { CornWorker } from './CornWorker';
import { JoystickController } from './JoystickController';
import { MainUI } from './MainUI';
import { MultiResourceBackpack } from './MultiResourceBackpack';
import { PlayerController } from './PlayerController';

const { ccclass, property, executionOrder } = _decorator;

type UnlockStage = 'worker' | 'vehicle' | 'hauler' | 'complete';
type PurchasableUnlockStage = Exclude<UnlockStage, 'complete'>;

type VehiclePath = {
    start: Node;
    end: Node;
};

type CarryMountOwner = {
    backpackMount?: Node;
    coinBackpackMount?: Node;
};

type FieldRuntime = {
    id: string;
    root: Node;
    openingPad: Node;
    resourcePrefab: Prefab | null;
    plantVisualPrefab: Prefab | null;
    icon: SpriteFrame | null;
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
    workerChopRange: number;
    workerWaitAfterChop: number;
    workerStartDelay: number;
    unlocked: boolean;
    production: CornFieldProduction;
    vehicleStartPoint: Node;
    vehicleEndPoint: Node;
    collectionStorage: CornStoragePoint;
    sellStorage: CornStoragePoint;
    sellNode: Node;
    unlockNodes: Record<PurchasableUnlockStage, Node>;
    unlockPad: CornUnlockPad | null;
    workers: CornWorker[];
    vehicle: { node: Node; behavior: CornTractor } | null;
    hauler: Node | null;
    haulerBehavior: CornHauler | null;
    depositTimer: number;
};

/**
 * Additive, resource-id based gameplay for the two side fields in DevScene.
 * It deliberately does not register crops as Trees and never writes to the
 * forest production scripts, so the existing forest loop remains isolated.
 */
@ccclass('ResourceFieldSystem')
@executionOrder(50)
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

    @property({ type: CornStoragePoint, group: 'Left field scene nodes' })
    public leftCollectionStorage: CornStoragePoint = null!;

    @property({ type: Node, group: 'Left field scene nodes' })
    public leftVehicleStartPoint: Node = null!;

    @property({ type: Node, group: 'Left field scene nodes' })
    public leftVehicleEndPoint: Node = null!;

    @property({ type: Node, group: 'Right field scene nodes' })
    public rightWorkerUnlockPoint: Node = null!;

    @property({ type: Node, group: 'Right field scene nodes' })
    public rightVehicleUnlockPoint: Node = null!;

    @property({ type: Node, group: 'Right field scene nodes' })
    public rightHaulerUnlockPoint: Node = null!;

    @property({ type: CornStoragePoint, group: 'Right field scene nodes' })
    public rightCollectionStorage: CornStoragePoint = null!;

    @property({ type: Node, group: 'Right field scene nodes' })
    public rightVehicleStartPoint: Node = null!;

    @property({ type: Node, group: 'Right field scene nodes' })
    public rightVehicleEndPoint: Node = null!;

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

    @property({ type: Prefab, tooltip: 'Corn drop, backpack, and storage visual.', group: 'Left field' })
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
    @property({ group: 'Left field' }) public leftHitsPerPlant = 1;
    @property({ group: 'Left field' }) public leftYieldPerPlant = 3;
    @property({ group: 'Left field' }) public leftRespawnSeconds = 10;
    @property({ group: 'Left field' }) public leftInventoryCapacity = 42;
    @property({ group: 'Left field' }) public leftWorkerSpeed = 2;
    @property({ group: 'Left field' }) public leftVehicleSpeed = 2;
    @property({ group: 'Left field' }) public leftHaulerSpeed = 3;
    @property({ group: 'Left field' }) public leftWorkerActionInterval = 0.8;
    @property({ group: 'Left field' }) public leftVehicleActionInterval = 0.42;

    @property({ tooltip: 'Stable inventory id. Change the id when replacing the right resource.', group: 'Right field' })
    public rightResourceId = 'field_right_corn';

    @property({ type: Prefab, tooltip: 'Corn drop, backpack, and storage visual.', group: 'Right field' })
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
    @property({ group: 'Right field' }) public rightHitsPerPlant = 1;
    @property({ group: 'Right field' }) public rightYieldPerPlant = 3;
    @property({ group: 'Right field' }) public rightRespawnSeconds = 10;
    @property({ group: 'Right field' }) public rightInventoryCapacity = 42;
    @property({ group: 'Right field' }) public rightWorkerSpeed = 2;
    @property({ group: 'Right field' }) public rightVehicleSpeed = 2;
    @property({ group: 'Right field' }) public rightHaulerSpeed = 3;
    @property({ group: 'Right field' }) public rightWorkerActionInterval = 0.8;
    @property({ group: 'Right field' }) public rightVehicleActionInterval = 0.42;

    @property({ tooltip: 'Player harvest detection radius.', group: 'Shared gameplay' })
    public harvestRadius = 2.2;

    @property({ tooltip: 'Distance at which a field accepts its own carried resource.', group: 'Shared gameplay' })
    public sellRadius = 2.6;

    @property({ tooltip: 'Coins consumed per unlock tick.', group: 'Shared gameplay' })
    public coinsPerTick = 5;

    @property({ tooltip: 'Seconds between unlock consumption ticks.', group: 'Shared gameplay' })
    public consumeInterval = 0.1;

    @property({ tooltip: 'Corn worker chop range.', group: 'Shared gameplay' })
    public workerChopRange = 0.7;

    @property({ tooltip: 'Corn worker wait after one plant is finished.', group: 'Shared gameplay' })
    public workerWaitAfterChop = 0.2;

    @property({ tooltip: 'Corn worker startup delay.', group: 'Shared gameplay' })
    public workerStartDelay = 1;

    @property({ tooltip: 'Corn tractor contact harvest range.', group: 'Shared gameplay' })
    public vehicleChopRange = 3;

    @property({ tooltip: 'Corn tractor startup delay.', group: 'Shared gameplay' })
    public vehicleStartDelay = 1;

    @property({ tooltip: 'Corn tractor endpoint wait.', group: 'Shared gameplay' })
    public vehicleEndpointWait = 0.1;

    @property({ tooltip: 'Local position of side-field stock inside its sell slot, matching the forest wood slot.', group: 'Shared gameplay' })
    public sellStoragePosition = new Vec3(-0.358, 0.866, 1.53);

    @property({ tooltip: 'Visual scale of side-field stock inside its sell slot, matching the forest wood slot.', group: 'Shared gameplay' })
    public sellStorageScale = 0.9;

    @property({ tooltip: "Distance from the route start to the forest truck's front spawn position.", group: 'Shared gameplay' })
    public cornTractorFrontSpawnOffset = 9.974;

    @property({ tooltip: 'Local rotation of side-field stock inside its sell slot, matching the forest wood slot.', group: 'Shared gameplay' })
    public sellStorageRotation = new Vec3(0, -90, 0);

    private readonly _fields: FieldRuntime[] = [];
    private _player: Node | null = null;
    private _playerController: PlayerController | null = null;
    private _chopAction: ChopAction | null = null;
    private _coinBackpack: CoinBackpack | null = null;
    private _resourceBackpack: MultiResourceBackpack | null = null;
    private _openedSideFields = 0;
    private _finished = false;
    private _reportedMissingPlayerForHaulerSpawn = false;

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

        const resourceMount = this._player.components
            .map(component => (component as unknown as { backpackMount?: Node }).backpackMount)
            .find((mount): mount is Node => !!mount?.isValid) ?? null;
        this._resourceBackpack.registerResource(this.leftResourceId, this.leftResourcePrefab, -0.42, this.leftInventoryCapacity, resourceMount);
        this._resourceBackpack.registerResource(this.rightResourceId, this.rightResourcePrefab, 0.42, this.rightInventoryCapacity, resourceMount);

        const leftField = this.createField(
            this.leftResourceId,
            this.leftFieldRoot,
            this.leftOpeningPad,
            this.leftWorkerUnlockPoint,
            this.leftVehicleUnlockPoint,
            this.leftHaulerUnlockPoint,
            this.leftCollectionStorage,
            this.leftVehicleStartPoint,
            this.leftVehicleEndPoint,
            this.leftResourcePrefab,
            this.leftResourceIcon,
            this.leftPlantVisualPrefab,
            this.leftWorkerCost,
            this.leftVehicleCost,
            this.leftHaulerCost,
            this.leftWorkerPrefab,
            this.leftVehiclePrefab,
            this.leftHaulerPrefab,
            this.leftWorkerSpeed,
            this.leftVehicleSpeed,
            this.leftHaulerSpeed,
            this.leftWorkerActionInterval,
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
            this.rightVehicleStartPoint,
            this.rightVehicleEndPoint,
            this.rightResourcePrefab,
            this.rightResourceIcon,
            this.rightPlantVisualPrefab,
            this.rightWorkerCost,
            this.rightVehicleCost,
            this.rightHaulerCost,
            this.rightWorkerPrefab,
            this.rightVehiclePrefab,
            this.rightHaulerPrefab,
            this.rightWorkerSpeed,
            this.rightVehicleSpeed,
            this.rightHaulerSpeed,
            this.rightWorkerActionInterval,
        );
        if (rightField) this._fields.push(rightField);
    }

    protected update(deltaTime: number): void {
        if (this._fields.length === 0) {
            return;
        }

        for (const field of this._fields) {
            if (!field.unlocked) {
                continue;
            }

            this.keepPlayerOutsideCollectionStorage(field);
            if (!this._finished) this.updatePlayerDeposit(field, deltaTime);
        }
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
        field.production.activateProduction();
        // Side-field Sell1/CoinPlace start collapsed for the reveal intro. The
        // second corn field skips FinishNode's scale tween once the game ends,
        // so corn gameplay must restore unit scale here itself. Forest Sell is
        // never owned by this path.
        this.revealCornSellPresentation(field);
        this.showUnlockStage(field, 'worker', true);

        if (this._openedSideFields >= 2) {
            this.finishGame();
        }

        return this._finished;
    }

    /** Restore corn sell/customer presentation after the field reveal intro. */
    private revealCornSellPresentation(field: FieldRuntime): void {
        const sellNode = field.sellNode;
        if (sellNode?.isValid) {
            sellNode.active = true;
            sellNode.setScale(1, 1, 1);
        }

        const sellStorageNode = field.sellStorage?.node;
        if (sellStorageNode?.isValid) {
            sellStorageNode.setPosition(this.sellStoragePosition);
            sellStorageNode.setScale(this.sellStorageScale, this.sellStorageScale, this.sellStorageScale);
            sellStorageNode.setRotationFromEuler(this.sellStorageRotation);
            field.sellStorage.recoverInterruptedTransfers();
        }

        const coinPlace = field.root.getChildByName('CoinPlace');
        if (coinPlace?.isValid) {
            coinPlace.active = true;
            coinPlace.setScale(1, 1, 1);
        }

        const customerScheduler = field.root.getChildByName('NPCScheduler-001');
        if (customerScheduler?.isValid) {
            customerScheduler.active = true;
        }
    }


    private keepPlayerOutsideCollectionStorage(field: FieldRuntime): void {
        if (!this._player || !field.collectionStorage.node.activeInHierarchy) return;

        const storageNode = field.collectionStorage.node;
        const storageCenter = storageNode.worldPosition;
        const storageScale = storageNode.worldScale;
        const playerRadius = this._player.getComponent(CapsuleCollider)?.radius ?? 0.25;
        const halfX = Math.abs(storageScale.x) * 0.9 + playerRadius;
        const halfZ = Math.abs(storageScale.z) * 0.8 + playerRadius;
        const playerPosition = this._player.worldPosition;
        const offsetX = playerPosition.x - storageCenter.x;
        const offsetZ = playerPosition.z - storageCenter.z;
        if (Math.abs(offsetX) >= halfX || Math.abs(offsetZ) >= halfZ) return;

        const penetrationX = halfX - Math.abs(offsetX);
        const penetrationZ = halfZ - Math.abs(offsetZ);
        const correctedPosition = playerPosition.clone();
        const rigidBody = this._player.getComponent(RigidBody);
        const velocity = new Vec3();
        if (penetrationX < penetrationZ) {
            correctedPosition.x = storageCenter.x + (offsetX >= 0 ? halfX : -halfX);
            if (rigidBody) {
                rigidBody.getLinearVelocity(velocity);
                velocity.x = 0;
            }
        } else {
            correctedPosition.z = storageCenter.z + (offsetZ >= 0 ? halfZ : -halfZ);
            if (rigidBody) {
                rigidBody.getLinearVelocity(velocity);
                velocity.z = 0;
            }
        }

        this._player.setWorldPosition(correctedPosition);
        if (rigidBody) rigidBody.setLinearVelocity(velocity);
    }

    private createField(
        id: string,
        root: Node,
        openingPad: Node,
        workerUnlockPoint: Node,
        vehicleUnlockPoint: Node,
        haulerUnlockPoint: Node,
        collectionStorage: CornStoragePoint,
        vehicleStartPoint: Node,
        vehicleEndPoint: Node,
        resourcePrefab: Prefab | null,
        icon: SpriteFrame | null,
        plantVisualPrefab: Prefab | null,
        workerCost: number,
        vehicleCost: number,
        haulerCost: number,
        workerPrefab: Prefab | null,
        vehiclePrefab: Prefab | null,
        haulerPrefab: Prefab | null,
        workerSpeed: number,
        vehicleSpeed: number,
        haulerSpeed: number,
        workerActionInterval: number,
    ): FieldRuntime | null {
        const missingBindings = [
            ['field root', root],
            ['opening pad', openingPad],
            ['worker unlock point', workerUnlockPoint],
            ['vehicle unlock point', vehicleUnlockPoint],
            ['hauler unlock point', haulerUnlockPoint],
            ['collection storage', collectionStorage],
            ['vehicle start point', vehicleStartPoint],
            ['vehicle end point', vehicleEndPoint],
        ].filter(([, binding]) => !binding).map(([name]) => name);
        if (missingBindings.length > 0) {
            console.error(`ResourceFieldSystem: ${id} disabled; missing scene bindings: ${missingBindings.join(', ')}.`);
            return null;
        }

        const sellNode = root.getChildByName('Sell1') ?? root;
        this.configureStorage(collectionStorage.node, `${id}_collection`, 200);
        collectionStorage.enabled = true;
        collectionStorage.capacity = 200;
        collectionStorage.layers = 10;
        collectionStorage.layerHeight = 0.2;
        collectionStorage.resourcePerRow = 10;
        collectionStorage.resourceRowSpacing = 0.2;
        collectionStorage.resourcePerCol = 1;
        collectionStorage.resourceColSpacing = 0.2;
        collectionStorage.autoStack = true;
        collectionStorage.showCapacityInfo = true;
        this.configureCollectionPickup(collectionStorage, id);
        // The board is visible before the field is purchased, so its forest-style
        // solid collider must also stay in the physics world before unlock.
        collectionStorage.node.active = true;
        workerUnlockPoint.active = false;
        vehicleUnlockPoint.active = false;
        haulerUnlockPoint.active = false;
        const sellStorage = this.ensureSellStorage(sellNode, id);
        this.bindCornCustomerScheduler(root, sellStorage);
        const cropRoot = root.children[0] ?? null;
        if (!cropRoot || !this._player || !this._resourceBackpack) {
            console.error(`ResourceFieldSystem: ${id} disabled; crop root or player resource binding is missing.`);
            return null;
        }

        const production = root.getComponent(CornFieldProduction) ?? root.addComponent(CornFieldProduction);
        production.truckStartPoint = vehicleStartPoint;
        production.truckEndPoint = vehicleEndPoint;
        production.playerReward = 3;
        production.workerChopsRequired = 4;
        production.workerRewardPerChop = 2;
        production.vehicleReward = 3;
        production.respawnSeconds = 10;
        production.playerHarvestRadius = this.harvestRadius;
        production.vehicleHarvestRadius = this.vehicleChopRange + 0.5;
        production.configure({
            resourceId: id,
            cropRoot,
            resourcePrefab,
            plantVisualPrefab,
            collectionStorage,
            player: this._player,
            playerController: this._playerController,
            chopAction: this._chopAction,
            backpack: this._resourceBackpack,
        });
        this.applyResourceIcon(root, icon);

        return {
            id,
            root,
            openingPad,
            resourcePrefab,
            plantVisualPrefab,
            icon,
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
            workerChopRange: this.workerChopRange,
            workerWaitAfterChop: this.workerWaitAfterChop,
            workerStartDelay: this.workerStartDelay,
            unlocked: false,
            production,
            vehicleStartPoint,
            vehicleEndPoint,
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
            haulerBehavior: null,
            depositTimer: 0,
        };
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

        if (!field.sellStorage.hasSpace(1)) return;
        const item = this._resourceBackpack.takeResource(field.id);
        if (!item) return;

        item.setScale(1, 1, 1);
        if (field.sellStorage.addResource(item, 4, Vec3.ZERO)) return;

        item.destroy();
        this._resourceBackpack.addResource(field.id);
    }

    private completeUnlockStage(field: FieldRuntime, stage: UnlockStage): void {
        const completedPad = field.unlockPad?.node ?? null;
        field.unlockPad = null;

        if (stage === 'worker') {
            if (completedPad) this.completeWorkerUnlock(field, completedPad);
        } else if (stage === 'vehicle') {
            if (completedPad) this.completeVehicleUnlock(field, completedPad);
        } else if (stage === 'hauler') {
            if (completedPad) this.completeHaulerUnlock(field, completedPad);
        }
    }

    private completeWorkerUnlock(field: FieldRuntime, padNode: Node): void {
        const currentVisual = this.resolveUnlockVisual(padNode);
        if (currentVisual) {
            tween(currentVisual)
                .to(0.5, { scale: new Vec3(0, 1, 0) }, { easing: 'linear' })
                .start();
        }

        this.scheduleOnce(() => {
            this.showUnlockStage(field, 'vehicle', true);
            padNode.active = false;
        }, 1.5);

        // Native mobile physics must not be allowed to interrupt the paid
        // unlock transaction before the pad animation and next stage exist.
        this.spawnWorkers(field);

        const focusWorker = field.workers[2]?.node ?? field.workers[0]?.node ?? null;
        const cameraController = find('Main Camera')?.getComponent(CameraController) ?? null;
        const joystickController = find('Canvas/JoystickContainer')?.getComponent(JoystickController) ?? null;
        if (cameraController && focusWorker) cameraController.target = focusWorker;
        if (joystickController) joystickController._lock = true;
        this._playerController?.stopMovement();

        this.scheduleOnce(() => {
            if (cameraController && this._player) cameraController.target = this._player;
            if (joystickController) joystickController._lock = false;
        }, 3);
    }

    private completeVehicleUnlock(field: FieldRuntime, padNode: Node): void {
        for (const worker of field.workers) worker.node.active = false;
        this.spawnVehicle(field);

        const currentVisual = this.resolveUnlockVisual(padNode);
        if (currentVisual) {
            tween(currentVisual)
                .to(0.5, { scale: new Vec3(0, 0, 0) }, { easing: 'linear' })
                .start();
        }
        this.showUnlockStage(field, 'hauler', true, padNode);
        this.scheduleOnce(() => {
            padNode.active = false;
        }, 1);

        const cameraController = find('Main Camera')?.getComponent(CameraController) ?? null;
        const joystickController = find('Canvas/JoystickContainer')?.getComponent(JoystickController) ?? null;
        if (cameraController && field.vehicle) cameraController.target = field.vehicle.node;
        if (joystickController) joystickController._lock = true;
        this._playerController?.stopMovement();
        this.scheduleOnce(() => {
            if (cameraController && this._player) cameraController.target = this._player;
            if (joystickController) joystickController._lock = false;
        }, 3);
    }

    private completeHaulerUnlock(field: FieldRuntime, padNode: Node): void {
        const currentVisual = this.resolveUnlockVisual(padNode);
        if (currentVisual) {
            tween(currentVisual)
                .to(0.5, { scale: new Vec3(0, 0, 0) }, { easing: 'linear' })
                .start();
        }
        this.spawnHauler(field, padNode);
        this.scheduleOnce(() => {
            padNode.active = false;
        }, 0.5);

        const cameraController = find('Main Camera')?.getComponent(CameraController) ?? null;
        const joystickController = find('Canvas/JoystickContainer')?.getComponent(JoystickController) ?? null;
        if (cameraController && field.hauler) cameraController.target = field.hauler;
        if (joystickController) joystickController._lock = true;
        this._playerController?.stopMovement();

        this.scheduleOnce(() => {
            if (cameraController && this._player) cameraController.target = this._player;
            if (joystickController) joystickController._lock = false;
        }, 3);
    }

    private showUnlockStage(
        field: FieldRuntime,
        stage: PurchasableUnlockStage,
        animateEntrance = false,
        preserveNode: Node | null = null,
    ): void {
        for (const node of [field.unlockNodes.worker, field.unlockNodes.vehicle, field.unlockNodes.hauler]) {
            if (node !== preserveNode) node.active = false;
        }

        const padNode = field.unlockNodes[stage];
        padNode.active = true;
        const visual = this.resolveUnlockVisual(padNode);
        if (!visual) {
            console.error(`ResourceFieldSystem: scene visual missing from ${padNode.name}.`);
        }
        const visualScale = stage === 'worker' ? 0.9 : 0.72;
        if (visual) {
            visual.active = true;
            this.alignUnlockVisualToCornGround(field, visual);
            if (animateEntrance) {
                visual.setScale(0, 1, 0);
                tween(visual)
                    .to(0.5, { scale: new Vec3(visualScale, visualScale, visualScale) }, { easing: 'linear' })
                    .start();
            }
        }
        this.applyResourceIcon(padNode, field.icon);

        const cost = stage === 'worker' ? field.workerCost : stage === 'vehicle' ? field.vehicleCost : field.haulerCost;
        const unlockPad = padNode.getComponent(CornUnlockPad) ?? padNode.addComponent(CornUnlockPad);
        unlockPad.enabled = false;
        if (this._player && this._coinBackpack) {
            unlockPad.configure({
                player: this._player,
                coinBackpack: this._coinBackpack,
                interactionNode: visual ?? padNode,
                cost,
                coinsPerTick: this.coinsPerTick,
                consumeInterval: this.consumeInterval,
                onCompleted: () => this.completeUnlockStage(field, stage),
            });
            unlockPad.enabled = true;
        }
        field.unlockPad = unlockPad;
    }

    private alignUnlockVisualToCornGround(field: FieldRuntime, visual: Node): void {
        const iconGroup = visual.getChildByName('icon');
        if (!iconGroup) return;
        iconGroup.setPosition(0, 0, 0.088);
        iconGroup.setScale(1.6, 1.6, 1.6);
        const groundHeight = field.collectionStorage.node.worldPosition.y;
        const iconWorldPosition = iconGroup.worldPosition.clone();
        iconWorldPosition.y = groundHeight;
        iconGroup.setWorldPosition(iconWorldPosition);
    }

    private resolveUnlockVisual(padNode: Node): Node | null {
        return padNode.getChildByName('view') ?? padNode.children[0] ?? null;
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
        const spawned: Array<{ actor: Node; controller: CornWorker }> = [];
        for (let index = 0; index < 3; index++) {
            const actor = this.createActor(
                field.workerPrefab,
                this.workerTemplate?.children[index] ?? this.workerTemplate?.children[0] ?? this.workerTemplate,
                true,
                false,
            );
            if (!actor) continue;
            actor.name = `${field.id}_Worker_${index + 1}`;
            actor.setParent(field.root);
            const rigidBody = actor.getComponent(RigidBody) ?? actor.addComponent(RigidBody);
            rigidBody.type = ERigidBodyType.DYNAMIC;
            rigidBody.useGravity = false;
            rigidBody.enabled = true;

            const collider = actor.getComponent(CapsuleCollider) ?? actor.addComponent(CapsuleCollider);
            collider.center.set(0, 0.3, 0);
            collider.radius = 0.5;
            collider.cylinderHeight = 1;
            collider.isTrigger = true;
            collider.enabled = true;

            const controller = actor.getComponent(CornWorker) ?? actor.addComponent(CornWorker);
            controller.enabled = false;
            controller.moveSpeed = field.workerSpeed;
            controller.chopRange = field.workerChopRange;
            controller.waitAfterChop = field.workerWaitAfterChop;
            controller.chopInterval = field.workerActionInterval;
            controller.autoStart = true;
            controller.standDistance = 0.9;
            controller.chopAction = actor.getComponent(ChopAction)
                ?? actor.getComponentInChildren(ChopAction)
                ?? actor.addComponent(ChopAction);
            controller.skeletalAnimation = actor.getComponentInChildren(SkeletalAnimation);
            controller.chopAction.skeletonAnimation = controller.skeletalAnimation;
            spawned.push({ actor, controller });
            field.workers.push(controller);
        }

        const assignments = field.production.partitionWorkerTargets(
            spawned.map(({ actor }) => actor.parent),
            spawned.length,
        );
        spawned.forEach(({ actor, controller }, index) => {
            const groundWorldY = this._player?.worldPosition.y ?? actor.worldPosition.y;
            const laneStart = field.production.getWorkerLaneStartPosition(
                index,
                controller.standDistance,
                groundWorldY,
            );
            if (laneStart) actor.setWorldPosition(laneStart);
            controller.setHarvestTargets(assignments[index] ?? []);
            restoreCornVisualHierarchy(actor, false);
            controller.enabled = true;
            actor.active = true;
        });
    }

    private spawnVehicle(field: FieldRuntime): void {
        const source = this.vehicleTemplate?.getChildByName('Truck') ?? this.vehicleTemplate;
        const actor = field.vehiclePrefab ? instantiate(field.vehiclePrefab) : source ? instantiate(source) : null;
        if (!actor) return;
        actor.active = false;
        actor.name = `${field.id}_Harvester`;
        actor.setParent(field.root);
        this.disableActorGameplayComponents(actor);

        const path = this.clampVehiclePath(field, actor);
        if (!path) {
            actor.destroy();
            return;
        }
        const collider = actor.getComponent(BoxCollider) ?? actor.addComponent(BoxCollider);
        collider.isTrigger = true;
        collider.enabled = false;

        const behavior = actor.getComponent(CornTractor) ?? actor.addComponent(CornTractor);
        behavior.enabled = false;
        actor.setWorldPosition(this.getCornTractorSpawnWorldPosition(field, behavior));
        behavior.startPoint = path.start;
        behavior.endPoint = path.end;
        behavior.setPathPoints(path.start, path.end);
        behavior.moveSpeed = field.vehicleSpeed;
        behavior.chopRange = this.vehicleChopRange;
        behavior.waitAfterChop = 0.1;
        behavior.waitAtEndPoint = 0.1;
        behavior.waitAtStartPoint = 0.1;
        behavior.turnSpeed = 360;
        behavior.waitAfterTurn = 0;
        restoreCornVisualHierarchy(actor, false);
        behavior.enabled = true;
        actor.active = true;

        field.vehicle = { node: actor, behavior };
        field.production.setVehicle(actor, behavior);
    }

    private clampVehiclePath(field: FieldRuntime, actor: Node): VehiclePath | null {
        const bounds = field.production.getVehiclePathBounds();
        if (!bounds) return null;

        const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
        const start = this.ensurePathPoint(field.root, 'CornTruckPathStart');
        const end = this.ensurePathPoint(field.root, 'CornTruckPathEnd');
        const startWorld = field.vehicleStartPoint.worldPosition;
        const endWorld = field.vehicleEndPoint.worldPosition;

        start.setWorldPosition(
            clamp(startWorld.x, bounds.minX, bounds.maxX),
            startWorld.y,
            clamp(startWorld.z, bounds.minZ, bounds.maxZ),
        );
        end.setWorldPosition(
            clamp(endWorld.x, bounds.minX, bounds.maxX),
            endWorld.y,
            clamp(endWorld.z, bounds.minZ, bounds.maxZ),
        );

        return Vec3.distance(start.worldPosition, end.worldPosition) > 0.05 ? { start, end } : null;
    }

    private ensurePathPoint(parent: Node, name: string): Node {
        const point = parent.getChildByName(name) ?? new Node(name);
        if (!point.parent) point.setParent(parent);
        return point;
    }

    /** Preserve the forest truck's front-end spawn after entering a side-field hierarchy. */
    private getCornTractorSpawnWorldPosition(field: FieldRuntime, _behavior: CornTractor): Vec3 {
        const start = field.vehicleStartPoint.worldPosition;
        const end = field.vehicleEndPoint.worldPosition;
        const direction = start.clone().subtract(end);
        if (direction.lengthSqr() <= 0.000001) return start.clone();
        direction.normalize();
        return start.clone().add(direction.multiplyScalar(this.cornTractorFrontSpawnOffset));
    }

    private getCornHaulerUnlockAnchor(padNode: Node): Node {
        return padNode.getChildByName('pos')
            ?? padNode.getChildByName('view')
            ?? padNode;
    }

    private getCornHaulerSpawnWorldPosition(spawnAnchor: Node): Vec3 {
        const spawnPosition = spawnAnchor.worldPosition.clone();
        if (this._player?.isValid) {
            spawnPosition.y = this._player.worldPosition.y;
        } else if (!this._reportedMissingPlayerForHaulerSpawn) {
            console.warn('ResourceFieldSystem: player is missing; corn hauler uses unlock-pad height.');
            this._reportedMissingPlayerForHaulerSpawn = true;
        }
        return spawnPosition;
    }

    /**
     * The corn stack grows into a tall solid-looking wall.  Unlike the forest
     * collection pile, its visual footprint can cover the storage-node center,
     * so a hauler must use a dedicated service point on the open, unlock-pad
     * side instead of walking toward the stack center.
     */
    private createCornHaulerCollectionServicePoint(field: FieldRuntime, spawnAnchor: Node): Node {
        const servicePoint = this.ensurePathPoint(field.root, 'CornHaulerCollectionServicePoint');
        const storagePosition = field.collectionStorage.node.worldPosition.clone();
        const direction = spawnAnchor.worldPosition.clone().subtract(storagePosition);
        direction.y = 0;
        if (direction.lengthSqr() <= 0.000001) {
            direction.set(1, 0, 0);
        } else {
            direction.normalize();
        }

        // Keep the same 1.8-unit storage clearance as the forest hauler, but
        // lock the corn hauler to the open side instead of the stack center.
        const servicePosition = storagePosition.add(direction.multiplyScalar(1.8));
        servicePosition.y = spawnAnchor.worldPosition.y;
        servicePoint.setWorldPosition(servicePosition);
        return servicePoint;
    }

    private spawnHauler(field: FieldRuntime, padNode: Node): void {
        const fallback = this.haulerTemplate ?? this.workerTemplate?.children[0] ?? this.workerTemplate;
        const actor = field.haulerPrefab ? instantiate(field.haulerPrefab) : fallback ? instantiate(fallback) : null;
        if (!actor) return;
        const spawnAnchor = this.getCornHaulerUnlockAnchor(padNode);
        const collectionServicePoint = this.createCornHaulerCollectionServicePoint(field, spawnAnchor);
        actor.name = `${field.id}_Hauler`;
        actor.active = false;
        actor.setParent(field.root);
        actor.setWorldPosition(this.getCornHaulerSpawnWorldPosition(spawnAnchor));
        this.disableActorGameplayComponents(actor);
        for (const storage of actor.getComponentsInChildren(CornStoragePoint)) storage.clearStorage();

        const inheritedAxeNode = this.getInheritedAxeNode(actor);
        const mountTemplate = this.clearInheritedHaulerCargo(actor);
        const carryNode = new Node('CornHaulerCarryMount');
        if (mountTemplate?.parent) {
            carryNode.setParent(mountTemplate.parent);
            carryNode.setPosition(mountTemplate.position);
            carryNode.setRotation(mountTemplate.rotation);
            carryNode.setScale(mountTemplate.scale);
        } else {
            carryNode.setParent(actor);
            carryNode.setPosition(0, 1.45, -0.48);
        }

        const carryStorage = actor.getComponent(CornHaulerBackpack) ?? actor.addComponent(CornHaulerBackpack);
        carryStorage.enabled = false;
        carryStorage.resourcePrefab = field.resourcePrefab;
        carryStorage.stackAreaNode = carryNode;
        carryStorage.capacity = 42;
        carryStorage.maxVisibleItems = 42;
        carryStorage.rowSpacing = 0.2;
        carryStorage.columnSpacing = 0.2;
        carryStorage.layerHeight = 0.2;
        // Match the forest StoragePoint type-4 transfer duration.
        carryStorage.moveAnimationDuration = 0.6;
        carryStorage.moveEasing = 'sineOut';
        carryStorage.clearStorage();

        const behavior = actor.getComponent(CornHauler) ?? actor.addComponent(CornHauler);
        behavior.enabled = false;
        behavior.skeletonAnimation = actor.getComponentInChildren(SkeletalAnimation);
        behavior.collectionPoint = collectionServicePoint;
        behavior.sellPoint = field.sellNode;
        behavior.idlePoint = spawnAnchor;
        behavior.homeFieldRoot = field.root;
        behavior.collectionStorage = field.collectionStorage;
        behavior.sellStorage = field.sellStorage;
        behavior.carryStorage = carryStorage;
        behavior.moveSpeed = field.haulerSpeed;
        behavior.transferInterval = 0.15;
        behavior.collectionStopDistance = 0.05;
        behavior.sellStopDistance = 0.2;
        restoreCornVisualHierarchy(actor, false);
        this.removeInheritedAxeVisual(actor, inheritedAxeNode);
        behavior.setHiddenAxeNode(null);
        carryStorage.enabled = true;
        behavior.enabled = true;
        actor.active = true;
        field.hauler = actor;
        field.haulerBehavior = behavior;
    }

    private getInheritedAxeNode(actor: Node): Node | null {
        const chopAction = actor.getComponentInChildren(ChopAction);
        const axeNode = chopAction ? (chopAction as unknown as { futouNode?: Node }).futouNode : null;
        return axeNode?.isValid ? axeNode : null;
    }

    private clearInheritedHaulerCargo(actor: Node): Node | null {
        let mountTemplate: Node | null = null;
        const inheritedMounts = new Set<Node>();
        actor.getComponentInChildren(ChopAction)?.destroy();
        const visit = (node: Node): void => {
            for (const component of node.components) {
                const owner = component as unknown as CarryMountOwner;
                if (owner.backpackMount?.isValid) {
                    mountTemplate ??= owner.backpackMount;
                    inheritedMounts.add(owner.backpackMount);
                }
                if (owner.coinBackpackMount?.isValid) {
                    inheritedMounts.add(owner.coinBackpackMount);
                }
            }

            for (const child of [...node.children]) {
                if (child.name.startsWith('ResourceBackpack_')) {
                    child.active = false;
                    child.destroy();
                } else {
                    visit(child);
                }
            }
        };

        visit(actor);
        for (const mount of inheritedMounts) {
            for (const item of [...mount.children]) {
                item.active = false;
                item.destroy();
            }
        }
        return mountTemplate;
    }

    private createActor(
        prefab: Prefab | null,
        fallback: Node | null,
        preserveChopAction = false,
        activate = true,
    ): Node | null {
        const actor = prefab ? instantiate(prefab) : fallback ? instantiate(fallback) : null;
        if (!actor) return null;
        this.disableActorGameplayComponents(actor, preserveChopAction);
        actor.active = activate;
        return actor;
    }

    private disableActorGameplayComponents(root: Node, preserveChopAction = false): void {
        const visit = (node: Node): void => {
            for (const component of node.components) {
                const keepVisualComponent = component instanceof Animation
                    || component instanceof Renderer;
                const keepHarvestComponent = preserveChopAction
                    && (component instanceof ChopAction || component instanceof AudioSource);
                const keepEnabled = keepVisualComponent || keepHarvestComponent;
                if (!keepEnabled) component.enabled = false;
            }
            if (node !== root && (node.name.includes('斧') || /fuTou/i.test(node.name))) {
                node.active = false;
            }
            for (const child of node.children) visit(child);
        };
        visit(root);
    }

    /** Hide the axe/futou mesh inherited from the Player template. The mesh is attached
     *  as a sibling of the skeleton bones, so a name-based search can miss it. We rely on
     *  ChopAction.futouNode (the Player's axe attach point) and a recursive sweep over
     *  any node whose name contains the axe keywords. */
    private removeInheritedAxeVisual(actor: Node, inheritedAxeNode: Node | null): void {
        if (inheritedAxeNode?.isValid) inheritedAxeNode.destroy();
        const visit = (node: Node): void => {
            const lower = (node.name || '').toLowerCase();
            if (lower.includes('斧') || lower.includes('futou') || lower.includes('axe')) {
                node.destroy();
                return;
            }
            for (const child of [...node.children]) visit(child);
        };
        visit(actor);
    }

    private configureStorage(node: Node, name: string, capacity: number): CornStoragePoint {
        const storage = node.getComponent(CornStoragePoint) ?? node.addComponent(CornStoragePoint);
        storage.storageName = name;
        storage.capacity = capacity;
        storage.layers = 10000;
        storage.resourcePerRow = 5;
        storage.resourcePerCol = 2;
        storage.layerHeight = 0.2;
        storage.resourceRowSpacing = 0.22;
        storage.resourceColSpacing = 0.55;
        storage.stackAreaNode = node.getChildByName('StackArea') ?? node;
        return storage;
    }

    private configureCollectionPickup(collectionStorage: CornStoragePoint, resourceId: string): void {
        const existingColliders = collectionStorage.node.getComponents(BoxCollider);
        const collider = existingColliders.find((candidate) => candidate.isTrigger)
            ?? collectionStorage.node.addComponent(BoxCollider);
        collider.isTrigger = true;
        collider.center.set(0.1, 0, 0);
        collider.size.set(2, 1, 1.8);
        collider.enabled = true;

        const solidCollider = existingColliders.find((candidate) => !candidate.isTrigger)
            ?? collectionStorage.node.addComponent(BoxCollider);
        solidCollider.isTrigger = false;
        solidCollider.center.set(0, 0, 0);
        solidCollider.size.set(1.8, 1, 1.6);
        solidCollider.enabled = true;

        const pickupDetector = collectionStorage.node.getComponent(CornPickupDetector)
            ?? collectionStorage.node.addComponent(CornPickupDetector);
        pickupDetector.enabled = false;
        pickupDetector.configure({
            player: this._player!,
            backpack: this._resourceBackpack!,
            collectionStorage,
            resourceId,
            collectionInterval: 0.05,
        });
        pickupDetector.enabled = true;
    }

    private bindCornCustomerScheduler(root: Node, sellStorage: CornStoragePoint): void {
        const schedulerNode = root.getChildByName('NPCScheduler-001');
        const scheduler = schedulerNode?.getComponent(CornCustomerScheduler) ?? null;
        if (!scheduler) {
            console.error(`ResourceFieldSystem: ${root.name} CornCustomerScheduler is missing.`);
            return;
        }
        scheduler.bindSellStorage(sellStorage);
    }

    private ensureSellStorage(sellNode: Node, resourceId: string): CornStoragePoint {
        const existing = sellNode.getComponentInChildren(CornStoragePoint);
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
        storage.stackAreaNode = storageNode;
        return storage;
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
