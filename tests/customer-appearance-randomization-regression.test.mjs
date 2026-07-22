import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
    CUSTOMER_APPEARANCE_COUNT,
    buildCustomerAppearanceOrder,
} from '../assets/_Scripts/CustomerAppearanceOrder.ts';

test('每连续五名顾客覆盖全部五种外观且顺序随机', () => {
    const values = [0.82, 0.14, 0.63, 0.31, 0.48, 0.05, 0.71, 0.26];
    let cursor = 0;
    const order = buildCustomerAppearanceOrder(11, () => values[cursor++ % values.length]);

    assert.equal(CUSTOMER_APPEARANCE_COUNT, 5);
    assert.equal(order.length, 11);
    assert.deepEqual([...order.slice(0, 5)].sort(), [0, 1, 2, 3, 4]);
    assert.deepEqual([...order.slice(5, 10)].sort(), [0, 1, 2, 3, 4]);
    assert.ok(order.every(index => index >= 0 && index < 5));
    assert.notDeepEqual(order.slice(0, 5), order.slice(5, 10));
});

test('男女顾客均提供待机、行走、捧物待机和捧物行走动作', () => {
    const expected = [
        { name: 'idle', from: 0, to: 1.6666666666666667 },
        { name: 'walk', from: 2, to: 3.1666666666666665 },
        { name: 'idle2_NaHeZi', from: 3.5, to: 5.166666666666667 },
        { name: 'walk_NaHeZi', from: 5.5, to: 6.666666666666667 },
    ];

    for (const relativePath of [
        '../assets/美术资源/男顾客/Fbx/SM_NAN.fbx.meta',
        '../assets/美术资源/女顾客/Fbx/SM_NV.FBX.meta',
    ]) {
        const meta = JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
        const splits = meta.userData.animationImportSettings[0].splits;
        assert.deepEqual(splits.map(({ name }) => name), expected.map(({ name }) => name));
        splits.forEach((split, index) => {
            assert.ok(Math.abs(split.from - expected[index].from) < 0.00001);
            assert.ok(Math.abs(split.to - expected[index].to) < 0.00001);
        });
        assert.ok(splits.every(({ wrapMode }) => wrapMode === 2));
    }
});

test('编辑器预览使用与运行时相同的顾客替换脚本但不改变运行时随机顺序', () => {
    const source = readFileSync(
        new URL('../assets/_Scripts/CustomerAppearanceRandomizer.ts', import.meta.url),
        'utf8',
    );

    assert.match(source, /executeInEditMode/);
    assert.match(source, /EDITOR_NOT_IN_PREVIEW/);
    assert.match(source, /from 'cc\/env'/);
    assert.match(source, /EDITOR_NOT_IN_PREVIEW\s*\?/);
    assert.match(source, /buildEditorAppearanceOrder/);
    assert.match(source, /RandomCustomerVisual/);
    assert.match(source, /existingVisual\.removeFromParent\(\)/);
    assert.match(source, /existingVisual\.destroy\(\)/);
});

test('editor preview removes the original customer visual instead of only hiding it', () => {
    const source = readFileSync(
        new URL('../assets/_Scripts/CustomerAppearanceRandomizer.ts', import.meta.url),
        'utf8',
    );
    const cleanup = source.match(
        /const existingVisuals = npc\.children\.filter[\s\S]*?for \(const existingVisual of existingVisuals\) \{(?<body>[\s\S]*?)\}\s*const model = instantiate/,
    );

    assert.ok(cleanup?.groups?.body, 'visual cleanup must run before the replacement is instantiated');
    assert.match(cleanup.groups.body, /existingVisual\.removeFromParent\(\)/);
    assert.match(cleanup.groups.body, /existingVisual\.destroy\(\)/);
    assert.match(source, /child\.name !== 'StoragePoint'/);
    assert.match(source, /child\.name !== 'emoji'/);
    assert.doesNotMatch(source, /if \(EDITOR_NOT_IN_PREVIEW\) \{\s*existingVisual\.active = false;\s*\}/);
});

test('森林和玉米顾客购买完成后的整段离场路径持续播放捧物行走', () => {
    for (const relativePath of [
        '../assets/_Scripts/NPCScheduler.ts',
        '../assets/_Scripts/CornCustomerScheduler.ts',
    ]) {
        const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
        assert.match(source, /private moveTo\([\s\S]*?carrying = false[\s\S]*?\)/);
        assert.match(source, /private playTween\([\s\S]*?carrying = false[\s\S]*?\)/);
        assert.match(source, /carrying \? this\.playLoadMove\(npc\) : this\.playMove\(npc\)/);

        const loadComplete = source.match(
            /private loadComplete\(npc: Node\): void \{([\s\S]*?)\r?\n    \}\r?\n/,
        )?.[1] ?? '';
        assert.equal(
            (loadComplete.match(/\}, true\);/g) ?? []).length,
            3,
            `${relativePath} must keep carrying movement on B -> C -> D -> Start`,
        );
    }
});

test('随机外观组件只替换模型并保留顾客购买链路节点', () => {
    const source = readFileSync(
        new URL('../assets/_Scripts/CustomerAppearanceRandomizer.ts', import.meta.url),
        'utf8',
    );

    assert.match(
        source,
        /@ccclass\('CustomerAppearanceRandomizer'\)\s*@executionOrder\(-100\)/,
        'Cocos 3.8 expects executionOrder below ccclass in source',
    );
    assert.match(source, /maleTextures: Texture2D\[\]/);
    assert.match(source, /femaleTextures: Texture2D\[\]/);
    assert.match(source, /getComponent\(NPCScheduler\)/);
    assert.match(source, /getComponent\(CornCustomerScheduler\)/);
    assert.match(source, /buildCustomerAppearanceOrder\(customers\.length\)/);
    assert.match(source, /const existingVisuals = npc\.children\.filter/);
    assert.match(source, /child\.name !== 'StoragePoint'/);
    assert.match(source, /child\.name !== 'emoji'/);
    assert.match(source, /for \(const existingVisual of existingVisuals\)/);
    assert.match(source, /existingVisual\.removeFromParent\(\)/);
    assert.match(source, /existingVisual\.destroy\(\)/);
    assert.match(source, /instantiate\(variant\.prefab\)/);
    assert.match(source, /renderer\.getMaterialInstance\(materialIndex\)/);
    assert.match(source, /material\.recompileShaders\(\{ USE_ALBEDO_MAP: true \}\)/);
    assert.match(source, /material\.setProperty\('mainTexture', variant\.texture\)/);
    assert.doesNotMatch(source, /new Material\(/);
    assert.doesNotMatch(source, /renderer\.getMaterial\(/);
    assert.doesNotMatch(source, /renderer\.setMaterial\(/);
    assert.doesNotMatch(source, /alignCarryStorage/);
    assert.doesNotMatch(source, /inverseTransformPoint/);
    assert.doesNotMatch(source, /maleAnimationClips|femaleAnimationClips/);
    assert.doesNotMatch(source, /animationClips\.length/);
    assert.match(source, /model\.getComponentInChildren\(SkeletalAnimation\)/);
    assert.match(source, /model\.getComponentsInChildren\(MeshRenderer\)/);

    for (const clipName of ['idle', 'walk', 'idle2_NaHeZi', 'walk_NaHeZi']) {
        assert.match(source, new RegExp(`'${clipName}'`));
    }
});

test('森林和两个玉米顾客队伍均绑定同一组五种随机外观资源', () => {
    const scene = JSON.parse(readFileSync(
        new URL('../assets/Scenes/DevScene.scene', import.meta.url),
        'utf8',
    ));
    const randomizerType = '3efe4sm6RJIH7IyS3jvx2Km';
    const randomizers = scene
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry?.__type__ === randomizerType);

    assert.equal(randomizers.length, 3);
    assert.deepEqual(
        randomizers.map(({ entry }) => scene[entry.node.__id__]._name).sort(),
        ['NPCScheduler', 'NPCScheduler-001', 'NPCScheduler-001'],
    );

    for (const { entry, index } of randomizers) {
        const schedulerNode = scene[entry.node.__id__];
        assert.ok(schedulerNode._components.some(component => component.__id__ === index));
        assert.equal(entry.malePrefab.__uuid__, '5e1288d1-37ad-47aa-b898-4b5358220379@2c774');
        assert.equal(entry.femalePrefab.__uuid__, '0a8b911d-2afe-42eb-adca-42e568f379bc@6c894');
        assert.deepEqual(entry.maleTextures.map(item => item.__uuid__), [
            'a778d5af-a4b8-41b7-9419-b311a0c4b0cd@6c48a',
            'b8750b64-87f8-494e-a29c-7077a3bfcdc3@6c48a',
            'a7ddaec7-81ce-4ddc-b3f2-10f1ab18690d@6c48a',
        ]);
        assert.deepEqual(entry.femaleTextures.map(item => item.__uuid__), [
            '1b01485b-d74d-420e-bedb-9f0babcb2f0c@6c48a',
            '09e16d3e-ab37-4b40-aff0-5085129b86df@6c48a',
        ]);
        assert.equal(entry.customerModelScale, 1.2);
        assert.equal(entry.customerModelYaw, 180);
        assert.equal(entry.carryAnchorName, undefined);
        assert.equal(entry.maleAnimationClips, undefined);
        assert.equal(entry.femaleAnimationClips, undefined);
    }

    const schedulers = scene.filter(entry =>
        Array.isArray(entry?.npcs) && entry.moveAnim === 'walk',
    );
    assert.deepEqual(schedulers.map(entry => entry.npcs.length).sort(), [5, 5, 6]);
    for (const scheduler of schedulers) {
        assert.ok(scheduler.fillTip?.__id__ >= 0, 'customer demand bubble must remain bound');
        assert.equal(scheduler.fillTipHeadOffsetY, 2.4, 'customer demand bubble must stay above the enlarged customer');
        assert.equal(scheduler.idleAnim, 'idle');
        assert.equal(scheduler.loadAnim, 'idle2_NaHeZi');
        assert.equal(scheduler.loadMoveAnim, 'walk_NaHeZi');

        for (const npcRef of scheduler.npcs) {
            const npc = scene[npcRef.__id__];
            const storage = npc._children
                .map(child => scene[child.__id__])
                .find(child => child?._name === 'StoragePoint');
            assert.ok(storage, 'original StoragePoint must remain on every customer');
            assert.deepEqual(
                [storage._lpos.x, storage._lpos.y, storage._lpos.z],
                [-0.199, 0.934, -0.426],
            );
            assert.deepEqual(
                [storage._lrot.x, storage._lrot.y, storage._lrot.z, storage._lrot.w],
                [0, -0.7071067811865475, 0, 0.7071067811865476],
            );
        }
    }

    for (const relativePath of [
        '../assets/_Scripts/NPCScheduler.ts',
        '../assets/_Scripts/CornCustomerScheduler.ts',
    ]) {
        const schedulerSource = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
        assert.match(schedulerSource, /this\.showFillTipForNpc\(npc\)/);
        assert.match(schedulerSource, /this\.fillTip\.setWorldPosition\(this\._fillTipWorldPosition\)/);
    }
});
