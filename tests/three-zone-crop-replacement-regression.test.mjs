import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));
const treeSource = readFileSync(
    new URL('../assets/_Scripts/Tree.ts', import.meta.url),
    'utf8',
);
const dropManagerSource = readFileSync(
    new URL('../assets/_Scripts/WoodDropManager.ts', import.meta.url),
    'utf8',
);
const leftFieldPrefab = JSON.parse(readFileSync(
    new URL('../assets/Prefab/左侧草莓田.prefab', import.meta.url),
    'utf8',
));
const rightFieldPrefab = JSON.parse(readFileSync(
    new URL('../assets/Prefab/右侧向日葵田.prefab', import.meta.url),
    'utf8',
));
const centerTulipPrefab = JSON.parse(readFileSync(
    new URL('../assets/Prefab/中间郁金香.prefab', import.meta.url),
    'utf8',
));
const strawberryProductPrefab = JSON.parse(readFileSync(
    new URL('../assets/Prefab/产物_草莓.prefab', import.meta.url),
    'utf8',
));
const sunflowerProductPrefab = JSON.parse(readFileSync(
    new URL('../assets/Prefab/产物_向日葵花束.prefab', import.meta.url),
    'utf8',
));
const tulipProductPrefab = JSON.parse(readFileSync(
    new URL('../assets/Prefab/产物_郁金香花束.prefab', import.meta.url),
    'utf8',
));

const resourceFields = scene.find(item =>
    item?.leftFieldRoot && item?.rightFieldRoot && 'leftResourcePrefab' in item);
const woodDropManager = scene.find(item =>
    'woodDropPrefab' in (item ?? {}) && 'woodDropPrefab2' in (item ?? {}));
const woodBackpack = scene.find(item => 'woodDisplayPrefab' in (item ?? {}));

test('left field plants and products are strawberries', () => {
    assert.ok(resourceFields);
    assert.equal(resourceFields.leftResourceId, 'field_left_strawberry');
    assert.equal(resourceFields.leftPlantVisualPrefab, null);
    assert.equal(
        resourceFields.leftResourcePrefab?.__uuid__,
        'f53a8cce-3bb8-4963-bf58-d32e1e188d26',
    );
    assert.equal(
        scene.filter(item =>
            item?.__type__ === 'cc.PrefabInfo'
            && item.asset?.__uuid__ === '71cbb87c-ec4b-4e5f-9258-c876625de520').length,
        1,
    );
    assert.equal(leftFieldPrefab.filter(item => item?._name === '草莓植株').length, 28);
    assert.ok(leftFieldPrefab
        .filter(item => item?._name === '草莓植株')
        .every(item => item._lscale.x === 17.2));
    assert.deepEqual(strawberryProductPrefab[1]._lscale, {
        __type__: 'cc.Vec3', x: 10.5, y: 10.5, z: 10.5,
    });
});

test('right field plants are sunflowers and products are sunflower bouquets', () => {
    assert.ok(resourceFields);
    assert.equal(resourceFields.rightResourceId, 'field_right_sunflower');
    assert.equal(resourceFields.rightPlantVisualPrefab, null);
    assert.equal(
        resourceFields.rightResourcePrefab?.__uuid__,
        '4ca5e834-997a-4a1a-bc1f-3bb10a24091d',
    );
    assert.equal(
        scene.filter(item =>
            item?.__type__ === 'cc.PrefabInfo'
            && item.asset?.__uuid__ === 'e3068a89-8c60-463f-9788-2a324ec75eac').length,
        1,
    );
    assert.equal(rightFieldPrefab.filter(item => item?._name === '向日葵植株').length, 28);
    assert.ok(rightFieldPrefab
        .filter(item => item?._name === '向日葵植株')
        .every(item => item._lscale.x === 17.2));
    const sunflowerScale = sunflowerProductPrefab[1]._lscale;
    assert.equal(sunflowerScale.x, sunflowerScale.y);
    assert.equal(sunflowerScale.y, sunflowerScale.z);
    assert.ok(
        sunflowerScale.x > 5.7,
        'sunflower products must be uniformly enlarged from their undersized authored scale',
    );
    assert.equal(sunflowerScale.x, 6.1);
    assert.deepEqual(sunflowerProductPrefab[2]._euler, {
        __type__: 'cc.Vec3', x: 90, y: 0, z: 0,
    });
    assert.deepEqual(sunflowerProductPrefab[2]._lpos, {
        __type__: 'cc.Vec3', x: -0.004412, y: 0.002544, z: -0.00136,
    });
});

test('center trees render as tulips and produce tulip bouquets', () => {
    assert.ok(woodDropManager);
    const centerTulipInstances = scene.filter(item =>
        item?.__type__ === 'cc.PrefabInfo'
        && item.asset?.__uuid__ === 'f0440827-40ee-40a4-81ec-b6fe245d604f');
    assert.equal(centerTulipInstances.length, 32);
    assert.ok(centerTulipInstances.every(
        item => item.fileId === '2cWZvbP2FQYLzV10ovUh5N',
    ));
    assert.equal(
        woodDropManager.woodDropPrefab2?.__uuid__,
        'df5dd58a-8b30-4fa1-a383-69a0f7244d22',
    );
    assert.equal(
        woodBackpack?.woodDisplayPrefab?.__uuid__,
        'df5dd58a-8b30-4fa1-a383-69a0f7244d22',
    );
    assert.equal(woodDropManager.plantVisualPrefab, undefined);
    const tulipRenderers = centerTulipPrefab.filter(item =>
        item?.__type__ === 'cc.MeshRenderer'
        && item._enabled
        && item._mesh?.__uuid__?.startsWith(
            'ba576d93-f8de-4db4-9696-57988d01b082@',
        ));
    assert.deepEqual(
        tulipRenderers.map(renderer => renderer._mesh.__uuid__).sort(),
        [
            'ba576d93-f8de-4db4-9696-57988d01b082@3eaad',
            'ba576d93-f8de-4db4-9696-57988d01b082@fddf0',
        ],
    );
    assert.ok(tulipRenderers.every(renderer => {
        const visualNode = centerTulipPrefab[renderer.node.__id__];
        const animatedParent = centerTulipPrefab[visualNode._parent.__id__];
            return visualNode._lscale.x === 73.6
            && visualNode._lscale.y === 73.6
            && visualNode._lscale.z === 73.6
            && visualNode._lpos.y === -1.139
            && animatedParent._name === 'songshu_01';
    }));
    assert.deepEqual(tulipProductPrefab[1]._lscale, {
        __type__: 'cc.Vec3', x: 1, y: 1, z: 1,
    });
    assert.deepEqual(tulipProductPrefab[2]._lscale, {
        __type__: 'cc.Vec3', x: 12, y: 12, z: 12,
    });
    assert.deepEqual(tulipProductPrefab[2]._euler, {
        __type__: 'cc.Vec3', x: 90, y: 0, z: 0,
    });
    assert.deepEqual(tulipProductPrefab[2]._lpos, {
        __type__: 'cc.Vec3', x: 0.18251, y: 0.03114, z: -0.44117,
    });
});

test('center replacement is authored in the scene and preserves Tree gameplay', () => {
    assert.doesNotMatch(dropManagerSource, /plantVisualPrefab/);
    assert.doesNotMatch(treeSource, /installReplacementVisual/);
    assert.doesNotMatch(treeSource, /_directPlantVisuals|Renderer/);
    assert.match(
        treeSource,
        /getChildByName\("Point001_Shu"\)\.getChildByName\("Bone_ShuGan"\)/,
    );
    assert.doesNotMatch(treeSource, /removeComponent\(Tree\)/);
});

test('side fields remain hidden until their existing unlock sequence runs', () => {
    const unlockNodes = scene.filter(item =>
        item?.__type__ === 'cc.Node'
        && (item._name === 'FinishNode' || item._name === 'FinishNode1'));
    assert.equal(unlockNodes.length, 2);
    assert.ok(unlockNodes.every(node => node._active === false));

    for (const prefab of [leftFieldPrefab, rightFieldPrefab]) {
        const authoredPlants = prefab.filter(item =>
            item?.__type__ === 'cc.Node' && item._name?.startsWith('结尾玉米_A_'));
        assert.equal(authoredPlants.length, 28);
        assert.ok(authoredPlants.every(plant =>
            plant._lscale.x === 0 && plant._lscale.y === 0 && plant._lscale.z === 0));
    }
});
