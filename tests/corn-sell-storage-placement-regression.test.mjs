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
assert.match(
    source,
    /sellStoragePosition\s*=\s*new Vec3\(-1\.167,\s*0\.885,\s*-0\.104\)/,
    'corn sell storage must use the forest cashier storage position',
);

const resourceFieldSystem = scene.find((entry) =>
    entry?.sellStoragePosition?.__type__ === 'cc.Vec3',
);
assert.deepEqual(
    resourceFieldSystem?.sellStoragePosition,
    { __type__: 'cc.Vec3', x: -1.167, y: 0.885, z: -0.104 },
    'scene configuration must preserve the forest cashier storage position',
);

const ensureSellStorage = source.match(
    /private ensureSellStorage[\s\S]*?\n    private finishGame/,
)?.[0] ?? '';
assert.match(
    ensureSellStorage,
    /storageNode\.setRotationFromEuler\(this\.sellStorageRotation\)/,
    'corn sell storage must apply the tray rotation before stacking products',
);
assert.match(
    source,
    /fieldRoot === this\.leftFieldRoot[\s\S]*?'收银台3'[\s\S]*?fieldRoot === this\.rightFieldRoot[\s\S]*?'收银台2'/,
    'left and right corn storage must mount to their corresponding cashier nodes',
);

console.log('PASS: corn products use the forest tray storage orientation');
