import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moneyPrefabUuid = '496d89d8-176e-401a-911d-76ee1450436c';
const moneyModelPrefabUuid = '5993df33-fed1-4a10-9457-9e010b256f05@94433';
const moneyMeshUuid = '5993df33-fed1-4a10-9457-9e010b256f05@6bde7';
const moneyMaterialUuid = '5993df33-fed1-4a10-9457-9e010b256f05@7a3ca';
const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));
const vehiclePrefab = JSON.parse(readFileSync(
    new URL('../assets/_Assets/Prefab/vehicle-001.prefab', import.meta.url),
    'utf8',
));
const moneyPrefab = JSON.parse(readFileSync(
    new URL('../assets/_Assets/Prefab/moneyMod.prefab', import.meta.url),
    'utf8',
));

const collectMoneyReferences = entries => entries.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    return ['coinPrefab', 'coinDisplayPrefab']
        .filter(key => entry[key]?.__uuid__)
        .map(key => ({ index, key, uuid: entry[key].__uuid__ }));
});

test('all gameplay money producers and backpack displays use the tulip money prefab', () => {
    const references = [
        ...collectMoneyReferences(scene),
        ...collectMoneyReferences(vehiclePrefab),
    ];
    assert.ok(references.length >= 5, 'all gameplay money references must be discoverable');
    for (const reference of references) {
        assert.equal(
            reference.uuid,
            moneyPrefabUuid,
            `${reference.key} at serialized index ${reference.index} must use moneyMod`,
        );
    }
});

test('the size-preserving money wrapper contains only the new SM_钱 model', () => {
    const serialized = JSON.stringify(moneyPrefab);
    assert.ok(serialized.includes(moneyModelPrefabUuid));
    assert.ok(serialized.includes(moneyMeshUuid));
    assert.ok(serialized.includes(moneyMaterialUuid));
    assert.doesNotMatch(serialized, /811e7c55-2fdb-4744-9715-188cb0817c15@(46540|7c855)/);
});

test('all field-authored money renderers cannot retain the legacy model', () => {
    const fieldSystem = scene.find(entry =>
        entry
        && Object.prototype.hasOwnProperty.call(entry, 'rightFieldRoot')
        && Object.prototype.hasOwnProperty.call(entry, 'rightResourceId'),
    );
    const nodeAt = reference => scene[reference.__id__];
    const descendants = [];
    const visit = node => {
        descendants.push(node);
        for (const child of node._children ?? []) visit(nodeAt(child));
    };
    visit(nodeAt(fieldSystem.leftFieldRoot));
    visit(nodeAt(fieldSystem.rightFieldRoot));
    visit(scene.find(entry => entry?.__type__ === 'cc.Node' && entry._name === 'LandObj'));

    const legacyMoneyNodes = descendants.filter(node =>
        /GroundCoin|tubiao_02_chaopiao|coinDrop/.test(node?._name ?? ''),
    );
    assert.ok(legacyMoneyNodes.length >= 7, 'all field legacy money nodes must be audited');
    for (const node of legacyMoneyNodes) {
        const renderer = (node._components ?? [])
            .map(reference => scene[reference.__id__])
            .find(component => component?.__type__ === 'cc.MeshRenderer');
        if (!renderer) continue;
        assert.equal(
            renderer._mesh?.__uuid__,
            moneyMeshUuid,
            `${node._name} must use the SM_钱 mesh`,
        );
        assert.equal(
            renderer._materials?.[0]?.__uuid__,
            moneyMaterialUuid,
            `${node._name} must use the SM_钱 material`,
        );
        assert.deepEqual(
            node._lscale,
            { __type__: 'cc.Vec3', x: 0.68, y: 0.68, z: 1.5 },
            `${node._name} must use the SM_钱 scale`,
        );
        assert.deepEqual(
            node._euler,
            { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
            `${node._name} must use the SM_钱 rotation`,
        );
    }
});
