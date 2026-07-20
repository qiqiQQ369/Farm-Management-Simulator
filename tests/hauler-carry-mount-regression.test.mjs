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

test('forest hauler copies the player mount transform into a private carry storage', () => {
    const method = source.match(
        /private ensureHaulerCarryStorage[\s\S]*?\n    private copyStoragePointLayout/,
    )?.[0] ?? '';

    assert.match(method, /const playerMount = [\s\S]*?WoodBackpack\)[\s\S]*?\.backpackMount/);
    assert.match(method, /this\.copyCarryMountTransform\([\s\S]*?playerMount\)/);
    assert.match(method, /stackAreaNode = [a-zA-Z]+Storage\.node/);
    assert.doesNotMatch(method, /stackAreaNode = playerMount/);
    assert.doesNotMatch(method, /return playerStorage/);
    assert.match(source, /private copyCarryMountTransform\(target: Node, source: Node \| null\): void/);
    assert.match(source, /target\.setPosition\(source\.position\)/);
    assert.match(source, /target\.setRotation\(source\.rotation\)/);
    assert.match(source, /target\.setScale\(source\.scale\)/);
    assert.match(backpackSource, /public backpackMount: Node/);
    assert.match(haulerSource, /public carryStorage: StoragePoint/);
});
