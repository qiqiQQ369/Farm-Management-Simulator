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

test('forest hauler keeps its own socket or derives a root-relative private carry mount', () => {
    const method = source.match(
        /private ensureHaulerCarryStorage[\s\S]*?\n    private copyStoragePointLayout/,
    )?.[0] ?? '';

    assert.match(method, /const playerRoot = this\.findSceneNodeByName\('Player'\)/);
    assert.match(method, /const playerMount = playerRoot[\s\S]*?WoodBackpack\)[\s\S]*?\.backpackMount/);
    assert.match(method, /this\.isNodeOwnedBy\(hauler, haulerMount\)/);
    assert.match(method, /this\.copyCarryMountTransform\([\s\S]*?playerMount, playerRoot\)/);
    assert.match(method, /stackAreaNode = [a-zA-Z]+Storage\.node/);
    assert.doesNotMatch(method, /stackAreaNode = playerMount/);
    assert.doesNotMatch(method, /return playerStorage/);
    assert.match(source, /private isNodeOwnedBy\(root: Node, candidate: Node \| null\): boolean/);
    assert.match(source, /private copyCarryMountTransform\(target: Node, source: Node \| null, sourceRoot: Node \| null\): void/);
    assert.match(source, /sourceRoot\.inverseTransformPoint\(relativePosition, source\.worldPosition\)/);
    assert.match(source, /Quat\.invert\(parentInverseRotation, sourceRoot\.worldRotation\)/);
    assert.match(source, /Quat\.multiply\(relativeRotation, parentInverseRotation, source\.worldRotation\)/);
    assert.match(backpackSource, /public backpackMount: Node/);
    assert.match(haulerSource, /public carryStorage: StoragePoint/);
});
