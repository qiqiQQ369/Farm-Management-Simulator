import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moneyPrefabText = readFileSync(
    new URL('../assets/_Assets/Prefab/moneyMod.prefab', import.meta.url),
    'utf8',
);
const moneyPrefab = JSON.parse(moneyPrefabText);
const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));

const at = reference => reference && Number.isInteger(reference.__id__)
    ? moneyPrefab[reference.__id__]
    : null;

test('moneyMod uses SM_钱 while retaining the previous visible size', () => {
    const nestedRoot = moneyPrefab.find(entry =>
        entry?.__type__ === 'cc.Node'
        && entry._prefab
        && at(entry._prefab)?.asset?.__uuid__ === '5993df33-fed1-4a10-9457-9e010b256f05@94433'
    );
    assert.ok(nestedRoot, 'moneyMod must instantiate the SM_钱 imported prefab');
    assert.doesNotMatch(
        moneyPrefabText,
        /811e7c55-2fdb-4744-9715-188cb0817c15@6f29a/,
        'moneyMod must not retain the old 钱 model prefab',
    );

    const instance = at(at(nestedRoot._prefab).instance);
    const overrides = instance.propertyOverrides.map(at);
    const scaleOverrides = overrides.filter(override => override.propertyPath?.[0] === '_lscale');
    assert.ok(
        scaleOverrides.some(override =>
            override.value.x === 6.181989079783322
            && override.value.y === 6.533216064777648
            && override.value.z === 6.046540176584795
        ),
        'SM_钱 root must match the previous money bounds on all three axes',
    );
    assert.ok(
        scaleOverrides.some(override =>
            override.value.x === 1
            && override.value.y === 1
            && override.value.z === 1
        ),
        'SM_钱 child mesh must keep a neutral local scale before root bounds matching',
    );
});

test('every authored coin producer still shares moneyMod', () => {
    const coinPrefabReferences = scene.filter(entry =>
        entry
        && typeof entry === 'object'
        && entry.coinPrefab?.__uuid__
    );
    assert.ok(coinPrefabReferences.length > 0);
    for (const component of coinPrefabReferences) {
        assert.equal(
            component.coinPrefab.__uuid__,
            '496d89d8-176e-401a-911d-76ee1450436c',
        );
    }
});
