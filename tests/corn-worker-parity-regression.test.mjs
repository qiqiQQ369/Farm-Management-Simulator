import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import {
    getCornHarvestStandPosition,
    moveCornWorkerToward,
} from '../assets/_Scripts/CornWorkerRoute.ts';

const source = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);
const cornWorkerPath = new URL('../assets/_Scripts/CornWorker.ts', import.meta.url);
const cornWorkerSource = existsSync(cornWorkerPath)
    ? readFileSync(cornWorkerPath, 'utf8')
    : '';
const cornProductionSource = readFileSync(
    new URL('../assets/_Scripts/CornFieldProduction.ts', import.meta.url),
    'utf8',
);
const forestUnlockSource = readFileSync(
    new URL('../assets/_Scripts/CoinConsumer.ts', import.meta.url),
    'utf8',
);
const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));
const cornPrefabDirectory = new URL('../assets/_Assets/Prefab/', import.meta.url);
const cornPrefabMeta = readdirSync(cornPrefabDirectory).find(fileName =>
    fileName.endsWith('.prefab.meta') &&
    readFileSync(new URL(fileName, cornPrefabDirectory), 'utf8')
        .includes('245bac7d-89a9-4ed4-a29c-aff9fe3086be'),
);
assert.ok(cornPrefabMeta, 'authored corn field prefab must exist');
const cornPrefab = JSON.parse(readFileSync(
    new URL(cornPrefabMeta.replace(/\.meta$/, ''), cornPrefabDirectory),
    'utf8',
));

const fieldSystem = scene.find((entry) =>
    entry?.leftFieldRoot && entry?.rightFieldRoot && entry?.leftWorkerUnlockPoint,
);
assert.ok(fieldSystem, 'ResourceFieldSystem scene binding must exist');

test('corn worker stops on the approach side of a crop in both lane directions', () => {
    const lane = [
        { x: 2, y: 0, z: 6 },
        { x: 2, y: 0, z: 4 },
        { x: 2, y: 0, z: 2 },
    ];

    assert.deepEqual(
        getCornHarvestStandPosition(lane, 1, 1, 0.9),
        { x: 2, y: 0, z: 4.9 },
        'forward worker must stop before reaching the crop center',
    );
    assert.deepEqual(
        getCornHarvestStandPosition(lane, 1, -1, 0.9),
        { x: 2, y: 0, z: 3.1 },
        'returning worker must switch to the opposite side of the crop',
    );
});

test('corn worker movement cannot step past its harvest stand position', () => {
    assert.deepEqual(
        moveCornWorkerToward(
            { x: 2, y: 0, z: 6 },
            { x: 2, y: 0, z: 4.9 },
            3,
        ),
        { x: 2, y: 0, z: 4.9 },
    );
});

test('corn worker always faces the current crop before entering the chop state', () => {
    const workerMovement = cornWorkerSource.match(
        /private async handleMovingState[\s\S]*?\n    private handleChoppingState/,
    )?.[0] ?? '';
    const faceIndex = workerMovement.indexOf(
        'this.faceTarget(this.getTargetPosition(this._currentTarget))',
    );
    const rangeCheckIndex = workerMovement.indexOf(
        'Vec3.distance(currentPosition, targetPosition) <= this.chopRange',
    );

    assert.ok(faceIndex >= 0, 'worker must explicitly face its crop');
    assert.ok(rangeCheckIndex >= 0, 'movement state must keep the chop-range transition');
    assert.ok(
        faceIndex < rangeCheckIndex,
        'spawned and reversing workers may already be in range, so facing must happen first',
    );

    const startChopping = cornWorkerSource.match(
        /private startChopping[\s\S]*?\n    private onPlantHarvested/,
    )?.[0] ?? '';
    assert.match(
        startChopping,
        /this\.faceTarget\(this\.getTargetPosition\(this\._currentTarget\)\)/,
        'the chop entry point must enforce facing as a final invariant',
    );

    const targetSetup = cornWorkerSource.match(
        /public setHarvestTargets[\s\S]*?\n    public pauseAutoHarvest/,
    )?.[0] ?? '';
    assert.match(
        targetSetup,
        /firstAvailable[\s\S]*this\.faceTarget\(this\.getTargetPosition\(firstAvailable\)\)/,
        'inactive worker must face its first crop before ResourceFieldSystem reveals it',
    );
});

test('corn workers keep the player ground height while approaching crop roots', () => {
    assert.deepEqual(
        getCornHarvestStandPosition(
            [
                { x: 2, y: -0.52, z: 6 },
                { x: 2, y: -0.52, z: 4 },
            ],
            0,
            1,
            0.9,
            0.222,
        ),
        { x: 2, y: 0.222, z: 6.9 },
        'crop-root height must not pull a corn worker underground',
    );

    const workerSpawn = source.match(
        /private spawnWorkers[\s\S]*?\n    private spawnVehicle/,
    )?.[0] ?? '';
    assert.match(workerSpawn, /const groundWorldY = this\._player\?\.worldPosition\.y/);
    assert.match(
        workerSpawn,
        /getWorkerLaneStartPosition\(\s*index,\s*controller\.standDistance,\s*groundWorldY,?\s*\)/,
    );
});

test('corn workers restore the forest worker collision body when spawned', () => {
    const workerSpawn = source.match(
        /private spawnWorkers[\s\S]*?\n    private spawnVehicle/,
    )?.[0] ?? '';

    assert.match(workerSpawn, /actor\.getComponent\(RigidBody\) \?\? actor\.addComponent\(RigidBody\)/);
    assert.match(workerSpawn, /rigidBody\.type = ERigidBodyType\.DYNAMIC/);
    assert.match(workerSpawn, /rigidBody\.useGravity = false/);
    assert.match(workerSpawn, /rigidBody\.enabled = true/);
    assert.match(workerSpawn, /actor\.getComponent\(CapsuleCollider\) \?\? actor\.addComponent\(CapsuleCollider\)/);
    assert.match(workerSpawn, /collider\.center\.set\(0, 0\.3, 0\)/);
    assert.match(workerSpawn, /collider\.radius = 0\.5/);
    assert.match(workerSpawn, /collider\.cylinderHeight = 1/);
    assert.match(workerSpawn, /collider\.isTrigger = true/);
    assert.match(workerSpawn, /collider\.enabled = true/);
});

test('corn workers use a dedicated copy of the forest worker state machine', () => {
    assert.ok(existsSync(cornWorkerPath), 'corn workers must have their own component');
    assert.doesNotMatch(source, /Woodcutter/);
    assert.doesNotMatch(cornProductionSource, /Woodcutter/);

    const workerSpawn = source.match(
        /private spawnWorkers[\s\S]*?\n    private spawnVehicle/,
    )?.[0] ?? '';
    assert.match(workerSpawn, /actor\.getComponent\(CornWorker\) \?\? actor\.addComponent\(CornWorker\)/);
    assert.match(workerSpawn, /field\.production\.partitionWorkerTargets/);
    assert.match(workerSpawn, /controller\.setHarvestTargets\(assignments\[index\] \?\? \[\]\)/);
    assert.match(workerSpawn, /controller\.enabled = true/);
    assert.match(workerSpawn, /controller\.standDistance = 0\.9/);
    assert.match(
        workerSpawn,
        /field\.production\.getWorkerLaneStartPosition\(\s*index,\s*controller\.standDistance,\s*groundWorldY,?\s*\)/,
    );
    assert.doesNotMatch(
        source,
        /private updateWorkers/,
        'ResourceFieldSystem must not maintain a second approximate worker state machine',
    );

    for (const state of ['Idle', 'Moving', 'Chopping', 'Waiting']) {
        assert.match(cornWorkerSource, new RegExp(`CornWorkerState\\.${state}`));
    }
    for (const method of [
        'handleIdleState',
        'handleMovingState',
        'handleChoppingState',
        'handleWaitingState',
        'playAndRegisterChop',
        'faceTarget',
    ]) {
        assert.match(cornWorkerSource, new RegExp(`private (?:async )?${method}`));
    }
    assert.match(cornWorkerSource, /public setHarvestTargets\(targets: CornHarvestTarget\[\]\)/);
    assert.match(
        cornWorkerSource,
        /getCornHarvestStandPosition[\s\S]*moveCornWorkerToward[\s\S]*from '\.\/CornWorkerRoute'/,
    );
    const workerMovement = cornWorkerSource.match(
        /private async handleMovingState[\s\S]*?\n    private handleChoppingState/,
    )?.[0] ?? '';
    assert.match(workerMovement, /getCornHarvestStandPosition\(/);
    assert.match(workerMovement, /moveCornWorkerToward\(/);
    assert.doesNotMatch(cornWorkerSource, /Woodcutter|Tree/);

    assert.match(cornWorkerSource, /public moveSpeed(?:\s*:\s*number)?\s*=\s*3\.0/);
    assert.equal(fieldSystem.leftWorkerSpeed, 2);
    assert.equal(fieldSystem.rightWorkerSpeed, 2);
    assert.equal(fieldSystem.leftWorkerActionInterval, 0.8);
    assert.equal(fieldSystem.rightWorkerActionInterval, 0.8);
    assert.equal(fieldSystem.workerChopRange, 0.7);
    assert.equal(fieldSystem.workerWaitAfterChop, 0.2);
    assert.equal(fieldSystem.workerStartDelay, 1);
});

test('corn worker unlock uses the forest LOGGER presentation', () => {
    const workerUnlock = source.match(
        /private completeWorkerUnlock[\s\S]*?\n    private showUnlockStage/,
    )?.[0] ?? '';

    assert.match(forestUnlockSource, /cameraController\.scheduleOnce\([\s\S]*?, 3\)/);
    assert.match(workerUnlock, /scale: new Vec3\(0, 1, 0\)/);
    assert.match(workerUnlock, /this\.showUnlockStage\(field, 'vehicle', true\)/);
    assert.match(workerUnlock, /cameraController\.target = focusWorker/);
    assert.match(workerUnlock, /joystickController\._lock = true/);
    assert.match(workerUnlock, /}, 3\)/);

    const showUnlockStage = source.match(
        /private showUnlockStage[\s\S]*?\n    private resolveUnlockVisual/,
    )?.[0] ?? '';
    assert.match(showUnlockStage, /animateEntrance/);
    assert.match(showUnlockStage, /const visualScale = stage === 'worker' \? 0\.9 : 0\.72/);
    assert.match(showUnlockStage, /scale: new Vec3\(visualScale, visualScale, visualScale\)/);
});

test('mobile worker unlock commits the paid pad before native worker creation', () => {
    const workerUnlock = source.match(
        /private completeWorkerUnlock[\s\S]*?\n    private completeVehicleUnlock/,
    )?.[0] ?? '';

    const spawnIndex = workerUnlock.indexOf('this.spawnWorkers(field)');
    const advanceIndex = workerUnlock.indexOf("this.showUnlockStage(field, 'vehicle', true)");
    assert.ok(spawnIndex >= 0, 'worker creation must still run');
    assert.ok(advanceIndex >= 0, 'paid worker pad must advance to the vehicle stage');
    assert.ok(
        advanceIndex < spawnIndex,
        'paid unlock state must be committed before mobile-native worker creation can fail',
    );
});

test('mobile workers enter the scene only after physics and harvest setup completes', () => {
    const workerSpawn = source.match(
        /private spawnWorkers[\s\S]*?\n    private spawnVehicle/,
    )?.[0] ?? '';

    assert.match(workerSpawn, /this\.createActor\([\s\S]*?true,\s*false,?\s*\)/);
    const targetSetupIndex = workerSpawn.indexOf('controller.setHarvestTargets');
    const activateIndex = workerSpawn.lastIndexOf('actor.active = true');
    assert.ok(targetSetupIndex >= 0);
    assert.ok(activateIndex > targetSetupIndex, 'native physics actor must activate after target setup');
});

test('corn workers keep crop output isolated from forest wood storage', () => {
    const workerHarvest = cornProductionSource.match(
        /private harvestByWorker[\s\S]*?\n    private canPlayerHarvest/,
    )?.[0] ?? '';
    assert.match(workerHarvest, /this\.addToCollection\(sourcePosition, this\.workerRewardPerChop\)/);
    assert.match(cornProductionSource, /this\.collectionStorage\.addResource\(item, 1\)/);
    assert.doesNotMatch(cornProductionSource, /WoodBackpack|woodStackArea|registerWoodcutterChop/);
});

test('corn workers follow ordered lanes and reverse only inside their crop assignments', () => {
    const assignmentMethod = cornProductionSource.match(
        /public partitionWorkerTargets[\s\S]*?\n    protected update/,
    )?.[0] ?? '';

    assert.match(cornProductionSource, /private getWorkerLanes\(\): CornPlantRuntime\[\]\[\]/);
    assert.match(cornProductionSource, /Math\.round\(value \* 100\)/);
    assert.match(assignmentMethod, /const lane = lanes\[index\] \?\? \[\]/);
    assert.match(assignmentMethod, /return lane\.map\(plant => this\.createWorkerTarget\(plant, parent\)\)/);

    assert.match(cornWorkerSource, /private selectNextTarget\(\): void/);
    assert.match(cornWorkerSource, /private findNextTargetInLane\(\): void/);
    assert.match(cornWorkerSource, /this\._direction = this\._direction === 1 \? -1 : 1/);
    assert.match(cornWorkerSource, /const atFirst = index === 0/);
    assert.match(cornWorkerSource, /const atLast = index === count - 1/);

    const cropRoot = cornPrefab.find(entry =>
        entry?.__type__ === 'cc.Node' && entry._children?.length === 28,
    );
    assert.ok(cropRoot, 'corn regression fixture must expose all 28 authored plants');
    const authoredLanes = new Map();
    for (const childRef of cropRoot._children) {
        const plant = cornPrefab[childRef.__id__];
        const laneKey = Math.round(plant._lpos.x * 100);
        const lane = authoredLanes.get(laneKey) ?? [];
        lane.push(plant._lpos.z);
        authoredLanes.set(laneKey, lane);
    }
    const orderedLanes = [...authoredLanes.entries()].sort(([left], [right]) => left - right);
    assert.equal(orderedLanes.length, 4, 'the authored corn field must contain four straight lanes');
    for (const [index, [, laneZ]] of orderedLanes.slice(0, 3).entries()) {
        assert.equal(laneZ.length, 7, `worker ${index + 1} must receive one complete seven-plant lane`);
        assert.equal(new Set(laneZ).size, 7, `worker ${index + 1} lane targets must not overlap`);
    }
});
