import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));
const fieldSource = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);
const customerSource = readFileSync(
    new URL('../assets/_Scripts/CornCustomerScheduler.ts', import.meta.url),
    'utf8',
);

const fieldSystem = scene.find(entry =>
    entry
    && Object.prototype.hasOwnProperty.call(entry, 'leftResourceId')
    && Object.prototype.hasOwnProperty.call(entry, 'rightResourceId'),
);

const nodeAt = reference => scene[reference.__id__];
const componentAt = reference => scene[reference.__id__];
const childNamed = (node, name) => (node._children ?? [])
    .map(nodeAt)
    .find(child => child?._name === name);

test('sunflower uses the same field gameplay settings as tulip', () => {
    assert.ok(fieldSystem, 'ResourceFieldSystem must be serialized in DevScene');

    const sharedSettingNames = [
        'WorkerCost',
        'VehicleCost',
        'HaulerCost',
        'HitsPerPlant',
        'YieldPerPlant',
        'RespawnSeconds',
        'InventoryCapacity',
        'WorkerSpeed',
        'VehicleSpeed',
        'HaulerSpeed',
        'WorkerActionInterval',
        'VehicleActionInterval',
    ];
    for (const suffix of sharedSettingNames) {
        assert.equal(
            fieldSystem[`right${suffix}`],
            fieldSystem[`left${suffix}`],
            `sunflower ${suffix} must match tulip`,
        );
    }

    assert.equal(
        (fieldSource.match(/this\.createField\(/g) ?? []).length,
        2,
        'both sides must enter the same createField pipeline',
    );
    assert.equal(
        (fieldSource.match(/private spawnWorkers\(field: FieldRuntime\)/g) ?? []).length,
        1,
        'both sides must share one worker implementation',
    );
    assert.equal(
        (fieldSource.match(/private spawnHauler\(field: FieldRuntime,\s*padNode: Node\)/g) ?? []).length,
        1,
        'both sides must share one hauler implementation',
    );
});

test('sunflower unlock and collection storage match tulip configuration', () => {
    const pairs = [
        ['leftWorkerUnlockPoint', 'rightWorkerUnlockPoint'],
        ['leftVehicleUnlockPoint', 'rightVehicleUnlockPoint'],
        ['leftHaulerUnlockPoint', 'rightHaulerUnlockPoint'],
    ];
    for (const [leftKey, rightKey] of pairs) {
        const left = nodeAt(fieldSystem[leftKey]);
        const right = nodeAt(fieldSystem[rightKey]);
        assert.equal(right._name, left._name);
        assert.equal(right._active, left._active);
        assert.deepEqual(right._lscale, left._lscale);
    }

    const leftStorage = componentAt(fieldSystem.leftCollectionStorage);
    const rightStorage = componentAt(fieldSystem.rightCollectionStorage);
    for (const key of [
        'capacity',
        'layers',
        'layerHeight',
        'resourcePerRow',
        'resourceRowSpacing',
        'resourcePerCol',
        'resourceColSpacing',
        'autoStack',
    ]) {
        assert.equal(rightStorage[key], leftStorage[key], `storage ${key} must match`);
    }
});

test('sunflower money uses the same prefab, reward, and presentation layout as tulip', () => {
    const leftRoot = nodeAt(fieldSystem.leftFieldRoot);
    const rightRoot = nodeAt(fieldSystem.rightFieldRoot);
    const leftSchedulerNode = childNamed(leftRoot, 'NPCScheduler-001');
    const rightSchedulerNode = childNamed(rightRoot, 'NPCScheduler-001');
    const schedulerFor = node => (node._components ?? [])
        .map(componentAt)
        .find(component => component?.coinPrefab && component?.coinReward !== undefined);
    const leftScheduler = schedulerFor(leftSchedulerNode);
    const rightScheduler = schedulerFor(rightSchedulerNode);

    assert.equal(rightScheduler.coinPrefab.__uuid__, leftScheduler.coinPrefab.__uuid__);
    assert.equal(rightScheduler.coinPrefab.__uuid__, '496d89d8-176e-401a-911d-76ee1450436c');
    assert.equal(rightScheduler.coinReward, leftScheduler.coinReward);
    assert.match(customerSource, /moduleRoot\.name === 'Finish' \? 'SM_ZhiWuTai006' : 'SM_ZhiWuTai007'/);
    assert.match(customerSource, /anchor\.name === 'SM_ZhiWuTai006' \|\| anchor\.name === 'SM_ZhiWuTai007'/);
});
