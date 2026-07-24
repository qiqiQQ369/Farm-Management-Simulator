import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url));
const text = (path) => read(path).toString('utf8');
const productionSource = text('../assets/_Scripts/CornFieldProduction.ts');
const fieldSystemSource = text('../assets/_Scripts/ResourceFieldSystem.ts');
const forestWorkerSource = text('../assets/_Scripts/Woodcutter.ts');
const scene = JSON.parse(text('../assets/Scenes/DevScene.scene'));

const fieldSystem = scene.find((entry) => entry?.leftFieldRoot && entry?.rightFieldRoot);
assert.ok(fieldSystem, 'ResourceFieldSystem scene binding must exist');
const woodBackpackStorage = scene.find(entry => entry?.storageName === '玩家背包');
assert.ok(woodBackpackStorage, 'player wood backpack storage must exist');

const gitBlobHash = (buffer) => {
    const normalized = Buffer.from(buffer.toString('utf8').replace(/\r\n/g, '\n'));
    return createHash('sha1')
        .update(`blob ${normalized.length}\0`)
        .update(normalized)
        .digest('hex');
};

test('corn production matches the forest player, worker, vehicle, and respawn values', () => {
    assert.match(productionSource, /public playerReward = 3/);
    assert.match(productionSource, /public workerChopsRequired = 4/);
    assert.match(productionSource, /public workerRewardPerChop = 2/);
    assert.match(productionSource, /public vehicleReward = 3/);
    assert.match(productionSource, /public respawnSeconds = 10/);
    assert.match(productionSource, /this\.updateRespawns\(Date\.now\(\) \/ 1000\)/);
    assert.match(fieldSystemSource, /leftInventoryCapacity = 42/);
    assert.match(fieldSystemSource, /rightInventoryCapacity = 42/);
    assert.equal(fieldSystem.leftInventoryCapacity, woodBackpackStorage.capacity);
    assert.equal(fieldSystem.rightInventoryCapacity, woodBackpackStorage.capacity);
});

test('corn chopper priority is vehicle then player then worker', () => {
    const playerGate = productionSource.match(
        /private canPlayerHarvest[\s\S]*?\n    private canWorkerHarvest/,
    )?.[0] ?? '';
    const workerGate = productionSource.match(
        /private canWorkerHarvest[\s\S]*?\n    private isVehicleClaiming/,
    )?.[0] ?? '';

    assert.match(playerGate, /!this\.isVehicleClaiming\(plant\)/);
    assert.match(workerGate, /this\.isVehicleClaiming\(plant\)/);
    assert.match(workerGate, /this\.playerHarvestRadius/);
});

test('respawned corn stays visible until its growth animation completes', () => {
    assert.match(productionSource, /public respawnProtectionSeconds = 0\.35/);
    assert.match(productionSource, /harvestableAt: number/);
    assert.match(
        productionSource,
        /plant\.harvestableAt = now \+ this\.respawnProtectionSeconds/,
    );
    assert.match(
        productionSource,
        /Date\.now\(\) \/ 1000 >= plant\.harvestableAt/,
    );

    const respawn = productionSource.match(
        /private updateRespawns[\s\S]*?\n    private addToCollection/,
    )?.[0] ?? '';
    assert.match(respawn, /this\.restorePlantVisual\(plant\)/);
    assert.ok(
        respawn.indexOf('this.restorePlantVisual(plant)') < respawn.indexOf('tween(plant.node)'),
        'corn visual children must reactivate before the growth animation starts',
    );
    assert.match(productionSource, /visualNodes: Node\[\]/);
    assert.match(productionSource, /private restorePlantVisual\(plant: CornPlantRuntime\): void/);
    assert.match(productionSource, /visualNode\.active = true/);
    const chop = productionSource.match(
        /private chopPlant[\s\S]*?\n    private updateRespawns/,
    )?.[0] ?? '';
    assert.match(chop, /this\.captureMaturePlantScale\(plant\)/);
    assert.ok(
        chop.indexOf('this.captureMaturePlantScale(plant)') < chop.indexOf('plant.node.active = false'),
        'mature scale must be recorded before hiding a harvested plant',
    );
    assert.match(productionSource, /private captureMaturePlantScale\(plant: CornPlantRuntime\): void/);
});

test('both corn field controllers and truck paths are authored and module-local', () => {
    const productionType = 'd7e3ajxLGRLkZpSb4TD0ecF';
    const productions = scene.filter((entry) => entry?.__type__ === productionType);
    assert.equal(productions.length, 2);

    const expected = [
        [fieldSystem.leftFieldRoot.__id__, fieldSystem.leftCollectionStorage.__id__, fieldSystem.leftVehicleStartPoint.__id__, fieldSystem.leftVehicleEndPoint.__id__],
        [fieldSystem.rightFieldRoot.__id__, fieldSystem.rightCollectionStorage.__id__, fieldSystem.rightVehicleStartPoint.__id__, fieldSystem.rightVehicleEndPoint.__id__],
    ];

    productions.forEach((production, index) => {
        const [rootId, storageId, startId, endId] = expected[index];
        assert.equal(production.node.__id__, rootId);
        assert.equal(production.collectionStorage.__id__, storageId);
        assert.equal(production.truckStartPoint.__id__, startId);
        assert.equal(production.truckEndPoint.__id__, endId);
        assert.equal(scene[startId]._parent.__id__, rootId);
        assert.equal(scene[endId]._parent.__id__, rootId);
        assert.notEqual(startId, endId);
    });

    assert.notEqual(productions[0].resourceId, productions[1].resourceId);
    assert.notEqual(productions[0].collectionStorage.__id__, productions[1].collectionStorage.__id__);
});

test('forest production sources remain at the frozen implementation baseline', () => {
    const frozen = new Map([
        ['../assets/_Scripts/Tree.ts', '29b8ee58750adfe6f1d4903fd440adf679d3da7b'],
        ['../assets/_Scripts/LoggingTruck.ts', '877ba2ceea390637571fb3bdd6b6a66b28e79281'],
        ['../assets/_Scripts/Resource/StoragePoint.ts', '2f11afebca3d0e5cab1b94e95f3732d9fc8f0fbf'],
        ['../assets/_Scripts/WoodDropManager.ts', 'ec2371434438922b0209db3642f0666188a6f71e'],
        ['../assets/_Scripts/Woodcutter.ts', '7a7610e5cc3bb2fe1fd787e3a370a3c708e1f502'],
    ]);

    for (const [path, expectedHash] of frozen) {
        assert.equal(gitBlobHash(read(path)), expectedHash, `${path} must remain frozen`);
    }

    const forestTreeBranch = forestWorkerSource.match(
        /private async playAndRegisterChop[\s\S]*?\n    \/\*\*/,
    )?.[0] ?? '';
    assert.match(forestTreeBranch, /target\.registerWoodcutterChop/);
});
