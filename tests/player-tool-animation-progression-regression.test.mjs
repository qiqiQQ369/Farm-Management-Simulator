import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const playerSource = readFileSync(
    new URL('../assets/_Scripts/PlayerController.ts', import.meta.url),
    'utf8',
);
const fieldSource = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);
const productionSource = readFileSync(
    new URL('../assets/_Scripts/CornFieldProduction.ts', import.meta.url),
    'utf8',
);
const treeSource = readFileSync(
    new URL('../assets/_Scripts/Tree.ts', import.meta.url),
    'utf8',
);
const femaleMeta = JSON.parse(readFileSync(
    new URL('../assets/美术资源/FBX/女主角.fbx.meta', import.meta.url),
    'utf8',
));
const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));

const femaleUuid = '9dd96310-acfb-4481-8e0c-80c4c0202608';
const expectedSplits = {
    idle: [0, 51 / 30],
    run: [51 / 30, 72 / 30],
    sickle_run: [73 / 30, 89 / 30],
    hand_mower_run: [90 / 30, 110 / 30],
    sickle_harvest: [111 / 30, 130 / 30],
    hand_mower_idle: [131 / 30, 151 / 30],
    ride_mower: [152 / 30, 176 / 30],
};

test('player starts with the sickle and exposes all three tool stages', () => {
    assert.match(playerSource, /export enum PlayerToolStage\s*\{[\s\S]*?Sickle[\s\S]*?HandMower[\s\S]*?RideMower/);
    assert.match(playerSource, /private _toolStage(?:\s*:\s*PlayerToolStage)?\s*=\s*PlayerToolStage\.Sickle/);
    assert.match(playerSource, /public setToolStage\(stage: PlayerToolStage\): void/);
});

test('sickle swings while harvesting crops or chopping trees, but not while moving', () => {
    assert.match(playerSource, /private _isHarvestingCrop(?:\s*:\s*boolean)?\s*=\s*false/);
    assert.match(playerSource, /private _isChoppingTree(?:\s*:\s*boolean)?\s*=\s*false/);
    assert.match(playerSource, /public setCropHarvesting\(active: boolean\): void/);
    assert.match(
        playerSource,
        /this\._isHarvestingCrop \|\| this\._isChoppingTree \|\| this\.chopAction\?\.isPlaying\(\)/,
    );
    assert.match(
        playerSource,
        /return isMoving\s*\?\s*PlayerVisualAnimationName\.Run\s*:\s*PlayerVisualAnimationName\.SickleHarvest/,
    );
    assert.match(productionSource, /setCropHarvesting\(true\)/);
    assert.match(productionSource, /finally\s*\{[\s\S]*?setCropHarvesting\(false\)/);
    assert.match(treeSource, /onChopAnimationStarted\?\.\(\)/);
    assert.match(
        treeSource,
        /onChopAnimationStarted\?\.\(\)[\s\S]*?await new Promise\(resolve => setTimeout\(resolve, 500\)\)[\s\S]*?finally\s*\{[\s\S]*?onChopAnimationFinished\?\.\(\)/,
    );
    assert.match(playerSource, /state\.time = 0/);
    assert.match(playerSource, /state\.sample\(\)/);
    assert.match(playerSource, /private shouldHoldSicklePose/);
    assert.match(playerSource, /private _currentAnimation: string = PlayerVisualAnimationName\.Idle/);
});

test('opening side fields advances hand mower then ride mower', () => {
    const revealMethod = fieldSource.match(
        /private onFieldRevealCompleted[\s\S]*?\n    \/\*\* Restore corn sell/,
    )?.[0] ?? '';

    assert.match(revealMethod, /this\._openedSideFields\+\+/);
    assert.match(revealMethod, /PlayerToolStage\.HandMower/);
    assert.match(revealMethod, /PlayerToolStage\.RideMower/);
    assert.match(revealMethod, /setToolStage/);
});

test('both mower models are authored in the player scene so tool progression is visible', () => {
    const sceneText = JSON.stringify(scene);
    assert.match(
        sceneText,
        /87306553-b1a8-41b9-bb96-f965d9351f40@/,
        'the hand mower mesh must be present in the scene',
    );
    assert.match(
        sceneText,
        /a30bd112-0794-40da-9b76-6626c38d2c33@/,
        'the ride mower mesh must be present in the scene',
    );
    assert.match(
        playerSource,
        /handMowerNode\.active\s*=\s*this\._toolStage\s*===\s*PlayerToolStage\.HandMower/,
    );
    assert.match(
        playerSource,
        /rideMowerNode\.active\s*=\s*this\._toolStage\s*===\s*PlayerToolStage\.RideMower/,
    );

    const controller = scene.find(item =>
        item?.node?.__id__ === 5
        && item?.handMowerNode?.__id__ !== undefined
        && item?.rideMowerNode?.__id__ !== undefined);
    assert.ok(controller);
    assert.equal(scene[controller.handMowerNode.__id__]._name, 'SM_割草机_Player');
    assert.equal(scene[controller.rideMowerNode.__id__]._name, 'SM_大型割草机_Player');
    assert.equal(scene[controller.handMowerNode.__id__]._active, false);
    assert.equal(scene[controller.rideMowerNode.__id__]._active, false);
});

test('female FBX is split according to the supplied frame range table', () => {
    const splits = femaleMeta.userData.animationImportSettings[0].splits;
    assert.equal(splits.length, Object.keys(expectedSplits).length);

    for (const split of splits) {
        const expected = expectedSplits[split.name];
        assert.ok(expected, `unexpected animation split ${split.name}`);
        assert.ok(Math.abs(split.from - expected[0]) < 1e-9, `${split.name} start frame differs`);
        assert.ok(Math.abs(split.to - expected[1]) < 1e-9, `${split.name} end frame differs`);
        assert.equal(split.wrapMode, 2);
    }
});

test('PlayerVisual binds every animation clip from the requested female FBX', () => {
    const visualIndex = scene.findIndex(item =>
        item?.__type__ === 'cc.Node' && item._name === 'PlayerVisual');
    assert.notEqual(visualIndex, -1);

    const visual = scene[visualIndex];
    const animation = visual._components
        .map(reference => scene[reference.__id__])
        .find(component => component?.__type__ === 'cc.SkeletalAnimation');
    assert.ok(animation);

    const clipUuids = animation._clips.map(reference => reference.__uuid__);
    assert.equal(clipUuids.length, 7);
    assert.ok(clipUuids.every(uuid => uuid.startsWith(`${femaleUuid}@`)));
});

test('the player starts with the sickle model visible', () => {
    const sickleIndex = scene.findIndex(item =>
        item?.__type__ === 'cc.Node' && item._name === 'SM_镰刀');
    assert.notEqual(sickleIndex, -1);

    const sickle = scene[sickleIndex];
    assert.equal(sickle._active, true);
    assert.deepEqual(
        [sickle._lpos.x, sickle._lpos.y, sickle._lpos.z],
        [0, 0, 0],
        'the sickle must stay centered on the hand socket instead of behind the player',
    );
    assert.deepEqual(
        [sickle._euler.x, sickle._euler.y, sickle._euler.z],
        [0, 180, 0],
        'the imported sickle needs a 180-degree local Y flip',
    );
    assert.deepEqual(
        [sickle._lscale.x, sickle._lscale.y, sickle._lscale.z],
        [1, 1, 1],
    );
    const renderer = sickle._components
        .map(reference => scene[reference.__id__])
        .find(component => component?.__type__ === 'cc.MeshRenderer');
    assert.equal(renderer._mesh.__uuid__, '42f3cb8d-2ee0-446e-b1a5-17bb94b8f3d4@9177b');
    assert.equal(renderer._materials[0].__uuid__, '42f3cb8d-2ee0-446e-b1a5-17bb94b8f3d4@55b43');
});
