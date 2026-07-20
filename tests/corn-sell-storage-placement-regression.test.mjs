import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));
const source = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);

const centralSell = scene.find((entry) =>
    entry?.__type__ === 'cc.Node' && entry._name === 'Sell' && entry._children?.length,
);
assert.ok(centralSell, 'central forest sell tray must exist');

const centralStorage = centralSell._children
    .map((reference) => scene[reference.__id__])
    .find((node) => node?._components?.some((reference) =>
        scene[reference.__id__]?.storageName === '木材仓库1',
    ));
assert.ok(centralStorage, 'central forest sell tray storage must exist');
assert.ok(
    Math.abs(centralStorage._euler.y + 90) < 0.0001,
    'forest products must be stacked across the tray',
);

assert.match(
    source,
    /sellStorageRotation\s*=\s*new Vec3\(0,\s*-90,\s*0\)/,
    'corn sell storage must copy the forest tray rotation',
);

const ensureSellStorage = source.match(
    /private ensureSellStorage[\s\S]*?\n    private finishGame/,
)?.[0] ?? '';
assert.match(
    ensureSellStorage,
    /storageNode\.setRotationFromEuler\(this\.sellStorageRotation\)/,
    'corn sell storage must apply the tray rotation before stacking products',
);

console.log('PASS: corn products use the forest tray storage orientation');
