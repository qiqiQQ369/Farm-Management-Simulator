import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/CoinConsumer.ts', import.meta.url),
    'utf8',
);
const backpackSource = readFileSync(
    new URL('../assets/_Scripts/WoodBackpack.ts', import.meta.url),
    'utf8',
);
const haulerSource = readFileSync(
    new URL('../assets/_Scripts/HaulerNPC.ts', import.meta.url),
    'utf8',
);

test('forest hauler moves its storage from the backpack to the customer hands', () => {
    const method = source.match(
        /private ensureHaulerCarryStorage[\s\S]*?\n    private copyStoragePointLayout/,
    )?.[0] ?? '';

    assert.match(method, /const carryNode = this\.findNamedNode\(hauler, 'HaulerCarryStorage'\) \?\? new Node\('HaulerCarryStorage'\)/);
    assert.match(method, /const carryMount = this\._haulerCarryMounts\.get\(hauler\) \?\? null/);
    assert.match(method, /carryNode\.setParent\(hauler\)/);
    assert.match(method, /\(1\.384 - hauler\.worldPosition\.y\) \/ Math\.max\(Math\.abs\(haulerScale\.y\), 0\.0001\)/);
    assert.match(method, /carryNode\.setRotationFromEuler\(0, -90, 0\)/);
    assert.match(method, /carryNode\.setScale\(Vec3\.ONE\)/);
    assert.match(method, /const carryStorage = carryNode\.getComponent\(StoragePoint\) \?\? carryNode\.addComponent\(StoragePoint\)/);
    assert.match(method, /carryStorage\.stackAreaNode = carryStorage\.node/);
    assert.doesNotMatch(method, /stackAreaNode = playerMount/);
    assert.doesNotMatch(method, /return playerStorage/);
    assert.match(source, /private readonly _haulerCarryMounts = new WeakMap<Node, Node>\(\)/);
    assert.match(source, /this\._haulerCarryMounts\.set\(hauler, woodBackpack\.backpackMount\)/);
    assert.doesNotMatch(source, /copyCarryMountTransform|inverseTransformPoint\(relativePosition/);
    assert.match(backpackSource, /public backpackMount: Node/);
    assert.match(haulerSource, /public carryStorage: StoragePoint/);
});

test('every forest hauler spawn path removes all cloned player cargo before activation', () => {
    const createMethod = source.match(
        /private createHaulerNode[\s\S]*?\n    private getHaulerUnlockAnchor/,
    )?.[0] ?? '';
    const prepareMethod = source.match(
        /private preparePlayerSkinHauler[\s\S]*?\n    private configureHaulerNode/,
    )?.[0] ?? '';

    assert.match(source, /import \{ MultiResourceBackpack \} from '\.\/MultiResourceBackpack'/);
    assert.equal(
        (createMethod.match(/this\.preparePlayerSkinHauler\(/g) ?? []).length,
        3,
        'reused, player-cloned, and logger-prefab haulers must all be sanitized',
    );
    assert.match(
        createMethod,
        /const hauler = instantiate\(template\);\s*hauler\.active = false;/,
        'a player clone must be disabled before it is attached to the scene',
    );
    assert.match(prepareMethod, /hauler\.getComponentsInChildren\(StoragePoint\)/);
    assert.match(prepareMethod, /storage\.clearStorage\(\)/);
    assert.match(prepareMethod, /child\.name\.startsWith\('ResourceBackpack_'\)/);
    assert.match(prepareMethod, /child\.active = false/);
    assert.match(prepareMethod, /child\.destroy\(\)/);
    assert.match(prepareMethod, /hauler\.getComponent\(MultiResourceBackpack\)\?\.destroy\(\)/);
    assert.match(prepareMethod, /woodBackpack\?\.destroy\(\)/);
});
