import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
    getCornHaulerStackPosition,
    getCornHaulerVisibleCount,
    planCornHaulerAdd,
    planCornHaulerRemove,
} from '../assets/_Scripts/CornHaulerBackpackInventory.ts';
import { isCornTractorFrontContact } from '../assets/_Scripts/CornTractorContact.ts';

const source = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);
const cornTractorPath = new URL('../assets/_Scripts/CornTractor.ts', import.meta.url);
const loggingTruckPath = new URL('../assets/_Scripts/LoggingTruck.ts', import.meta.url);
const cornHaulerPath = new URL('../assets/_Scripts/CornHauler.ts', import.meta.url);
const cornHaulerBackpackPath = new URL('../assets/_Scripts/CornHaulerBackpack.ts', import.meta.url);
const cornStoragePath = new URL('../assets/_Scripts/CornStoragePoint.ts', import.meta.url);
const cornUnlockPath = new URL('../assets/_Scripts/CornUnlockPad.ts', import.meta.url);
const cornTractorSource = existsSync(cornTractorPath) ? readFileSync(cornTractorPath, 'utf8') : '';
const loggingTruckSource = readFileSync(loggingTruckPath, 'utf8');
const cornHaulerSource = existsSync(cornHaulerPath) ? readFileSync(cornHaulerPath, 'utf8') : '';
const cornHaulerBackpackSource = existsSync(cornHaulerBackpackPath)
    ? readFileSync(cornHaulerBackpackPath, 'utf8')
    : '';
const cornStorageSource = existsSync(cornStoragePath) ? readFileSync(cornStoragePath, 'utf8') : '';
const cornUnlockSource = existsSync(cornUnlockPath) ? readFileSync(cornUnlockPath, 'utf8') : '';
const cornProductionSource = readFileSync(
    new URL('../assets/_Scripts/CornFieldProduction.ts', import.meta.url),
    'utf8',
);
const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));
const unlockPrefab = JSON.parse(readFileSync(
    new URL('../assets/_Assets/icon/Prefabs/new_icon.prefab', import.meta.url),
    'utf8',
));
const fieldSystem = scene.find((entry) =>
    entry?.leftFieldRoot && entry?.rightFieldRoot && entry?.leftWorkerUnlockPoint,
);
assert.ok(fieldSystem, 'ResourceFieldSystem scene binding must exist');

test('corn hauler backpack matches the player corn capacity and visible stack rules', () => {
    assert.deepEqual(planCornHaulerAdd(0), {
        accepted: true,
        nextAmount: 1,
        displayIncomingNode: true,
    });
    assert.deepEqual(planCornHaulerAdd(42), {
        accepted: false,
        nextAmount: 42,
        displayIncomingNode: false,
    });
    assert.equal(getCornHaulerVisibleCount(42), 42);
    assert.deepEqual(planCornHaulerRemove(42), {
        removed: true,
        nextAmount: 41,
        createTransferNode: false,
    });
    assert.deepEqual(getCornHaulerStackPosition(0), { x: -0.2, y: 0, z: -0.2 });
    assert.deepEqual(getCornHaulerStackPosition(1), { x: -0.2, y: 0.2, z: -0.2 });
});

test('corn hauler uses its own player-style backpack component', () => {
    assert.ok(existsSync(cornHaulerBackpackPath));
    assert.match(cornHaulerBackpackSource, /public capacity = 42/);
    assert.match(cornHaulerBackpackSource, /public maxVisibleItems = 42/);
    assert.match(cornHaulerBackpackSource, /public layerHeight = 0\.2/);
    assert.match(cornHaulerBackpackSource, /public moveAnimationDuration = 0\.32/);
    assert.match(cornHaulerBackpackSource, /public moveEasing = 'sineOut'/);
    assert.doesNotMatch(cornHaulerBackpackSource, /MultiResourceBackpack|WoodBackpack|CoinBackpack/);
    assert.match(cornHaulerSource, /type: CornHaulerBackpack/);
});

test('corn hauler is empty before activation and mounts corn like the player', () => {
    const spawnMethod = source.match(
        /private spawnHauler[\s\S]*?\n    private createActor/,
    )?.[0] ?? '';

    assert.match(source, /private clearInheritedHaulerCargo\(actor: Node\): Node \| null/);
    assert.match(source, /\.name\.startsWith\('ResourceBackpack_'\)/);
    const clearMethod = source.match(
        /private clearInheritedHaulerCargo[\s\S]*?\n    private createActor/,
    )?.[0] ?? '';
    assert.match(clearMethod, /child\.active = false/);
    assert.match(clearMethod, /item\.active = false/);
    assert.match(spawnMethod, /const mountTemplate = this\.clearInheritedHaulerCargo\(actor\)/);
    assert.ok(spawnMethod.indexOf('clearInheritedHaulerCargo') < spawnMethod.indexOf('actor.active = true'));
    assert.match(spawnMethod, /new Node\('CornHaulerCarryMount'\)/);
    assert.match(spawnMethod, /carryNode\.setParent\(mountTemplate\.parent\)/);
    assert.match(spawnMethod, /carryNode\.setRotation\(mountTemplate\.rotation\)/);
    assert.match(spawnMethod, /carryNode\.setScale\(mountTemplate\.scale\)/);
    assert.match(spawnMethod, /actor\.getComponent\(CornHaulerBackpack\) \?\? actor\.addComponent\(CornHaulerBackpack\)/);
    assert.match(spawnMethod, /carryStorage\.capacity = 42/);
    assert.match(spawnMethod, /carryStorage\.moveAnimationDuration = 0\.6/);
    assert.match(spawnMethod, /carryStorage\.maxVisibleItems = 42/);
    assert.match(spawnMethod, /carryStorage\.clearStorage\(\)/);
    assert.doesNotMatch(spawnMethod, /new Node\('CornCarryStorage'\)|resourcePerRow = 2|resourcePerCol = 2/);
});

test('corn hauler uses the forest-style unlock anchor for spawn and idle positions', () => {
    const spawnMethod = source.match(
        /private spawnHauler[\s\S]*?\n    private clearInheritedHaulerCargo/,
    )?.[0] ?? '';
    const spawnPositionMethod = source.match(
        /private getCornHaulerUnlockAnchor[\s\S]*?\n    private spawnHauler/,
    )?.[0] ?? '';

    assert.match(spawnMethod, /const spawnAnchor = this\.getCornHaulerUnlockAnchor\(padNode\)/);
    assert.match(spawnMethod, /actor\.setWorldPosition\(this\.getCornHaulerSpawnWorldPosition\(spawnAnchor\)\)/);
    assert.match(spawnMethod, /behavior\.idlePoint = spawnAnchor/);
    assert.match(spawnPositionMethod, /padNode\.getChildByName\('pos'\)/);
    assert.match(spawnPositionMethod, /padNode\.getChildByName\('view'\)/);
    assert.match(spawnPositionMethod, /spawnPosition\.y = this\._player\.worldPosition\.y/);
    assert.match(spawnPositionMethod, /return spawnPosition/);
    assert.doesNotMatch(spawnMethod, /behavior\.idlePoint = padNode/);
});

test('corn tractor owns a copy of the forest path loop and contact harvest settings', () => {
    const vehicleSpawn = source.match(
        /private spawnVehicle[\s\S]*?\n    private spawnHauler/,
    )?.[0] ?? '';
    assert.ok(existsSync(cornTractorPath), 'corn tractor must have a dedicated component');
    assert.doesNotMatch(source, /LoggingTruck/);
    assert.doesNotMatch(source, /Woodcutter|WoodBackpack/);
    assert.match(vehicleSpawn, /actor\.getComponent\(CornTractor\) \?\? actor\.addComponent\(CornTractor\)/);
    assert.match(vehicleSpawn, /this\.disableActorGameplayComponents\(actor\)/);
    assert.ok(
        vehicleSpawn.indexOf('this.disableActorGameplayComponents(actor)') <
            vehicleSpawn.indexOf('actor.getComponent(CornTractor)'),
        'the cloned forest vehicle gameplay must be disabled before CornTractor starts',
    );
    assert.match(cornProductionSource, /public getVehiclePathBounds\(\): VehiclePathBounds \| null/);
    assert.match(source, /private clampVehiclePath\(field: FieldRuntime, actor: Node\): VehiclePath \| null/);
    assert.match(vehicleSpawn, /const path = this\.clampVehiclePath\(field, actor\)/);
    assert.match(vehicleSpawn, /behavior\.startPoint = path\.start/);
    assert.match(vehicleSpawn, /behavior\.endPoint = path\.end/);
    assert.match(source, /Math\.min\(Math\.max\(value, min\), max\)/);
    assert.match(vehicleSpawn, /field\.production\.setVehicle\(actor, behavior\)/);
    assert.doesNotMatch(source, /private updateVehicle|type VehicleState|createVehiclePath/);

    for (const state of ['Idle', 'MovingToStart', 'MovingToEnd', 'Turning', 'Waiting']) {
        assert.match(cornTractorSource, new RegExp(`CornTractorState\\.${state}`));
    }
    assert.match(cornProductionSource, /private harvestVehicleContacts/);
    assert.match(cornProductionSource, /public vehicleReward = 3/);

    assert.match(cornTractorSource, /public moveSpeed(?:\s*:\s*number)?\s*=\s*5\.0/);
    assert.equal(fieldSystem.leftVehicleSpeed, 2);
    assert.equal(fieldSystem.rightVehicleSpeed, 2);
    assert.equal(fieldSystem.vehicleChopRange, 3);
    assert.equal(fieldSystem.vehicleStartDelay, 1);
    assert.equal(fieldSystem.vehicleEndpointWait, 0.1);

    for (const side of ['left', 'right']) {
        assert.ok(fieldSystem[`${side}VehicleStartPoint`]);
        assert.ok(fieldSystem[`${side}VehicleEndPoint`]);
        assert.notEqual(
            fieldSystem[`${side}VehicleStartPoint`].__id__,
            fieldSystem[`${side}VehicleEndPoint`].__id__,
        );
    }
});

test('corn tractor is positioned and faces its first route target before the unlock reveal', () => {
    const vehicleSpawn = source.match(
        /private spawnVehicle[\s\S]*?\n    private clampVehiclePath/,
    )?.[0] ?? '';
    const setPathPoints = cornTractorSource.match(
        /public setPathPoints[\s\S]*?\n    public getCurrentState/,
    )?.[0] ?? '';

    assert.match(
        setPathPoints,
        /this\.initializeRouteFacing\(\)/,
        'assigning a runtime path must also set the initial visual direction',
    );
    assert.match(
        cornTractorSource,
        /private initializeRouteFacing\(\): void[\s\S]*?this\.faceTarget\(target\)/,
        'the initial direction must use the first movement target rather than the prefab rotation',
    );

    const spawnPositionIndex = vehicleSpawn.indexOf('actor.setWorldPosition');
    const pathSetupIndex = vehicleSpawn.indexOf('behavior.setPathPoints(path.start, path.end)');
    const enabledIndex = vehicleSpawn.indexOf('behavior.enabled = true');
    const revealIndex = vehicleSpawn.lastIndexOf('actor.active = true');
    assert.ok(spawnPositionIndex >= 0 && pathSetupIndex >= 0 && enabledIndex >= 0 && revealIndex >= 0);
    assert.ok(
        spawnPositionIndex < pathSetupIndex,
        'the actor position must be known before the initial route-facing calculation',
    );
    assert.ok(
        pathSetupIndex < enabledIndex && enabledIndex < revealIndex,
        'the configured direction must be in place before the tractor is revealed',
    );
});

test('corn tractor harvests only when its forest-shaped front collider reaches a crop', () => {
    const colliderCenter = { x: 0, y: 0, z: -4.8 };
    const colliderSize = { x: 9.564268112182617, y: 2.132222, z: 0.553972 };

    assert.equal(
        isCornTractorFrontContact({ x: 0, y: 0, z: -4.8 }, colliderCenter, colliderSize, 0.35),
        true,
        'a crop touching the front cutter must be harvested immediately',
    );
    assert.equal(
        isCornTractorFrontContact({ x: 0, y: 0, z: 0 }, colliderCenter, colliderSize, 0.35),
        false,
        'a crop at the tractor root must not wait for the body to pass over it',
    );
    assert.equal(
        isCornTractorFrontContact({ x: 5.5, y: 0, z: -4.8 }, colliderCenter, colliderSize, 0.35),
        false,
        'crops outside the cutter width must remain untouched',
    );

    assert.match(cornTractorSource, /public isFrontContact\(worldPosition: Vec3\): boolean/);
    assert.match(cornTractorSource, /this\.node\.inverseTransformPoint\(localPosition, worldPosition\)/);
    assert.match(cornProductionSource, /this\._tractor\?\.isFrontContact\(plant\.node\.worldPosition\)/);
});

test('each corn tractor path stays inside its own field production side', () => {
    for (const side of ['left', 'right']) {
        const rootId = fieldSystem[`${side}FieldRoot`].__id__;
        const storageComponent = scene[fieldSystem[`${side}CollectionStorage`].__id__];
        const storage = scene[storageComponent.node.__id__];
        const start = scene[fieldSystem[`${side}VehicleStartPoint`].__id__];
        const end = scene[fieldSystem[`${side}VehicleEndPoint`].__id__];

        assert.equal(start._parent.__id__, rootId);
        assert.equal(end._parent.__id__, rootId);
        assert.ok(
            Math.abs(start._lpos.x - storage._lpos.x) < 5,
            `${side} tractor must spawn beside its own corn storage`,
        );
        assert.ok(
            Math.abs(end._lpos.x - storage._lpos.x) < 5,
            `${side} tractor route must remain on its own corn side`,
        );
    }
});

test('each corn tractor copies the forest tractor safe endpoint margins', () => {
    const forestBehavior = scene.find((entry) => {
        const actor = scene[entry?.node?.__id__];
        return actor?._name === 'Truck' && entry?.startPoint && entry?.endPoint;
    });
    assert.ok(forestBehavior, 'forest tractor path binding must exist');

    const forestStart = scene[forestBehavior.startPoint.__id__];
    const forestEnd = scene[forestBehavior.endPoint.__id__];
    for (const side of ['left', 'right']) {
        const cornStart = scene[fieldSystem[`${side}VehicleStartPoint`].__id__];
        const cornEnd = scene[fieldSystem[`${side}VehicleEndPoint`].__id__];
        assert.equal(
            cornStart._lpos.z,
            forestStart._lpos.z,
            `${side} corn tractor start must keep the forest tractor's body-length margin`,
        );
        assert.equal(
            cornEnd._lpos.z,
            forestEnd._lpos.z,
            `${side} corn tractor end must keep the forest tractor's body-length margin`,
        );
    }
});

test('forest and corn tractors translate the full route one grid toward the player', () => {
    const vehicleSpawn = source.match(
        /private spawnVehicle[\s\S]*?\n    private clampVehiclePath/,
    )?.[0] ?? '';

    const forestBehavior = scene.find((entry) => {
        const actor = scene[entry?.node?.__id__];
        return actor?._name === 'Truck' && entry?.startPoint && entry?.endPoint;
    });
    assert.ok(forestBehavior, 'forest tractor path binding must exist');
    const forestStart = scene[forestBehavior.startPoint.__id__]._lpos;
    const forestEnd = scene[forestBehavior.endPoint.__id__]._lpos;
    const routeLength = Math.abs(forestEnd.z - forestStart.z);
    const towardPlayer = Math.sign(forestStart.z - forestEnd.z);

    assert.equal(forestStart.z, -6);
    assert.equal(forestEnd.z, -14);
    assert.equal(forestStart.z + towardPlayer * 2, -4);
    assert.equal(forestEnd.z + towardPlayer * 2, -12);
    assert.equal(
        Math.abs((forestEnd.z + towardPlayer * 2) - (forestStart.z + towardPlayer * 2)),
        routeLength,
        'moving both endpoints must preserve the complete route length',
    );

    for (const [name, tractorSource] of [
        ['forest', loggingTruckSource],
        ['corn', cornTractorSource],
    ]) {
        assert.match(
            tractorSource,
            /public routeBoundaryOffset(?:\s*:\s*number)?\s*=\s*2(?:\.0)?/,
            `${name} tractor must shift the route one two-unit grid`,
        );
        const safeStartMethod = tractorSource.match(
            /public getSafeStartPosition[\s\S]*?\n    (?:private|public) [a-zA-Z]/,
        )?.[0] ?? '';
        const safeEndMethod = tractorSource.match(
            /public getSafeEndPosition[\s\S]*?\n    (?:private|public) [a-zA-Z]/,
        )?.[0] ?? '';
        assert.match(safeStartMethod, /Vec3\.subtract\(direction, startPosition, endPosition\)/);
        assert.match(safeStartMethod, /Vec3\.scaleAndAdd\(safeStart, startPosition, direction, this\.routeBoundaryOffset\)/);
        assert.match(safeEndMethod, /Vec3\.scaleAndAdd\(safeEnd, endPosition, direction, this\.routeBoundaryOffset\)/);
        assert.match(tractorSource, /handleMovingState\(deltaTime, this\.getSafeStartPosition\(\)\)/);
        assert.match(tractorSource, /handleMovingState\(deltaTime, this\.getSafeEndPosition\(\)\)/);
    }

    assert.match(vehicleSpawn, /behavior\.setPathPoints\(path\.start, path\.end\)/);
    assert.match(vehicleSpawn, /actor\.setWorldPosition\(this\.getCornTractorSpawnWorldPosition\(field, behavior\)\)/);
    const spawnPositionMethod = source.match(
        /private getCornTractorSpawnWorldPosition[\s\S]*?\n    private getCornHaulerSpawnWorldPosition/,
    )?.[0] ?? '';
    assert.match(spawnPositionMethod, /field\.vehicleStartPoint\.worldPosition/);
    assert.match(spawnPositionMethod, /field\.vehicleEndPoint\.worldPosition/);
    assert.match(spawnPositionMethod, /this\.cornTractorFrontSpawnOffset/);
    assert.match(source, /public cornTractorFrontSpawnOffset = 9\.974/);
});

test('corn tractor unlock uses the forest MACHINE presentation', () => {
    const method = source.match(
        /private completeVehicleUnlock[\s\S]*?\n    private completeHaulerUnlock/,
    )?.[0] ?? '';
    assert.match(method, /scale: new Vec3\(0, 0, 0\)/);
    assert.match(method, /this\.showUnlockStage\(field, 'hauler', true(?:, padNode)?\)/);
    assert.match(method, /cameraController\.target = field\.vehicle\.node/);
    assert.match(method, /joystickController\._lock = true/);
    assert.match(method, /}, 3\)/);
});

test('corn hauler, storage, and unlock pad are dedicated copies of forest behavior', () => {
    assert.ok(existsSync(cornHaulerPath), 'corn hauler must have a dedicated component');
    assert.ok(existsSync(cornStoragePath), 'corn storage must have a dedicated component');
    assert.ok(existsSync(cornUnlockPath), 'corn unlock pad must have a dedicated component');
    assert.doesNotMatch(source, /from '\.\/HaulerNPC'|from '\.\/Resource\/StoragePoint'/);
    assert.match(cornHaulerSource, /enum CornHaulerState \{[\s\S]*WaitingForCorn[\s\S]*Loading[\s\S]*Delivering[\s\S]*Unloading[\s\S]*Returning/);
    assert.match(cornStorageSource, /public hasMovableResource\(\)/);
    assert.match(cornStorageSource, /public recoverInterruptedTransfers\(\)/);
    assert.match(cornUnlockSource, /public configure\(config: CornUnlockPadConfig\)/);
    const authoredFillSprite = unlockPrefab.find(entry =>
        entry?.__type__ === 'cc.Sprite' && entry._type === 3,
    );
    assert.ok(authoredFillSprite, 'corn unlock prefab must contain a FILLED progress sprite');
    assert.equal(
        unlockPrefab[authoredFillSprite.node.__id__]._name,
        'splash2',
        'regression fixture must cover the authored fill sprite whose name does not include fill',
    );
    assert.match(cornUnlockSource, /sprite\.type === Sprite\.Type\.FILLED/);
    assert.doesNotMatch(source, /collectionStorageBinding\.enabled = false/);
    for (const storageBinding of [
        fieldSystem.leftCollectionStorage,
        fieldSystem.rightCollectionStorage,
    ]) {
        assert.equal(
            scene[storageBinding.__id__].__type__,
            '548f0yQrgFOlZ7XOImfQyZC',
            'corn collection storage must serialize CornStoragePoint instead of forest StoragePoint',
        );
        assert.equal(
            scene[storageBinding.__id__]._enabled,
            true,
            'serialized CornStoragePoint must be the active storage behavior',
        );
    }

    const method = source.match(
        /private completeHaulerUnlock[\s\S]*?\n    private showUnlockStage/,
    )?.[0] ?? '';
    assert.match(method, /scale: new Vec3\(0, 0, 0\)/);
    assert.match(method, /this\.spawnHauler\(field, padNode\)/);
    assert.match(method, /cameraController\.target = field\.hauler/);
    assert.match(method, /joystickController\._lock = true/);
    assert.match(method, /this\._playerController\?\.stopMovement\(\)/);
    assert.match(method, /cameraController\.target = this\._player/);
    assert.match(method, /joystickController\._lock = false/);
    assert.match(method, /}, 3\)/);

    const spawnMethod = source.match(
        /private spawnHauler[\s\S]*?\n    private createActor/,
    )?.[0] ?? '';
    assert.match(spawnMethod, /addComponent\(CornHauler\)/);
    assert.match(spawnMethod, /behavior\.collectionStorage = field\.collectionStorage/);
    assert.match(spawnMethod, /behavior\.sellStorage = field\.sellStorage/);
    assert.match(spawnMethod, /behavior\.carryStorage = carryStorage/);
    assert.match(spawnMethod, /behavior\.transferInterval = 0\.15/);

    assert.doesNotMatch(source, /private updateHauler|haulerState|haulerTimer/);
});

test('corn hauler removes inherited axe gameplay while keeping corn hauling behavior', () => {
    const spawnMethod = source.match(
        /private spawnHauler[\s\S]*?\n    private clearInheritedHaulerCargo/,
    )?.[0] ?? '';
    const cleanupMethod = source.match(
        /private clearInheritedHaulerCargo[\s\S]*?\n    private createActor/,
    )?.[0] ?? '';

    assert.match(spawnMethod, /clearInheritedHaulerCargo\(actor\)/);
    assert.match(cleanupMethod, /getComponentInChildren\(ChopAction\)/);
    assert.match(cleanupMethod, /getComponentInChildren\(ChopAction\)\?\.destroy\(\)/);
    assert.match(spawnMethod, /getComponent\(CornHauler\) \?\? actor\.addComponent\(CornHauler\)/);
});

test('corn hauler hides the inherited axe after visual hierarchy restoration', () => {
    const spawnMethod = source.match(
        /private spawnHauler[\s\S]*?\n    private clearInheritedHaulerCargo/,
    )?.[0] ?? '';
    const cornHaulerSource = readFileSync(cornHaulerPath, 'utf8');

    assert.match(spawnMethod, /const inheritedAxeNode = this\.getInheritedAxeNode\(actor\)/);
    assert.ok(
        spawnMethod.indexOf('restoreCornVisualHierarchy(actor, false)') <
        spawnMethod.indexOf('removeInheritedAxeVisual(actor, inheritedAxeNode)'),
        'the axe must be removed after restoring visual descendants',
    );
    assert.match(spawnMethod, /behavior\.setHiddenAxeNode\(null\)/);
    assert.match(source, /private removeInheritedAxeVisual\(actor: Node, inheritedAxeNode: Node \| null\)/);
    assert.match(source, /inheritedAxeNode\.destroy\(\)/);
    assert.match(cornHaulerSource, /public setHiddenAxeNode\(node: Node \| null\): void/);
    assert.match(cornHaulerSource, /if \(this\._futouNode\?\.isValid\) this\._futouNode\.active = false/);
});
