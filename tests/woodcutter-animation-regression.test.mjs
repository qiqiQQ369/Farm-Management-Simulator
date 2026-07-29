import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/Woodcutter.ts', import.meta.url),
    'utf8',
);
const material = readFileSync(
    new URL('../assets/美术资源/FBX/tex/搬运工贴图/M_Woodcutter.mtl', import.meta.url),
    'utf8',
);
const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));

test('woodcutter installs the protagonist visual and resolves its skeletal animation', () => {
    const onLoad = source.match(
        /protected onLoad\(\): void \{[\s\S]*?\n    \}/,
    )?.[0] ?? '';

    assert.match(onLoad, /this\.installProtagonistVisual\(\)/);
    assert.match(onLoad, /this\.chopAction\.skeletonAnimation \?\?= this\.skeletalAnimation/);
    assert.match(source, /find\('Player\/PlayerVisual'\)/);
    assert.match(source, /instantiate\(sourceVisual\)/);
    assert.match(source, /const sourceWorldScale = sourceVisual\.worldScale/);
    assert.match(source, /const workerRootWorldScale = this\.node\.worldScale/);
    assert.match(source, /\(sourceVisual\.worldPosition\.y - this\.node\.worldPosition\.y\) \/ workerRootScaleY/);
    assert.match(source, /sourceWorldScale\.x \/ workerRootScaleX/);
    assert.match(source, /sourceWorldScale\.y \/ workerRootScaleY/);
    assert.match(source, /sourceWorldScale\.z \/ workerRootScaleZ/);
    assert.match(source, /workerVisual\.setRotationFromEuler\(0,\s*0,\s*0\)/);
    assert.match(source, /getComponentsInChildren\(SkinnedMeshRenderer\)/);
    assert.match(source, /renderer\.setMaterial\(this\.workerMaterial,\s*0\)/);
});

test('woodcutter animation changes use a null-safe playback helper', () => {
    const helper = source.match(
        /private playAnimation\(clipName: string\): void \{[\s\S]*?\n    \}/,
    )?.[0] ?? '';

    assert.match(helper, /if \(!this\.skeletalAnimation\)/);
    assert.match(helper, /this\.skeletalAnimation\.getState\(clipName\)/);
    assert.match(helper, /this\.skeletalAnimation\.play\(clipName\)/);
    assert.equal((source.match(/this\.skeletalAnimation\.play\(/g) ?? []).length, 1);
    assert.match(source, /private lastAnimation: string = ""/);
    assert.match(source, /private idleAnimName: string = "idle"/);
    assert.match(source, /this\.playAnimation\("run"\)/);
    assert.match(source, /this\.playAnimation\("sickle_harvest"\)/);
    assert.doesNotMatch(source, /idle1_FuTou|run2_FuTou|KanMuTou/);
});

test('woodcutter material uses the worker texture made for the protagonist UVs', () => {
    assert.match(
        material,
        /9f7ff782-5cdd-4f4b-8412-75406cbff80d@6c48a/,
    );
});

test('all authored woodcutters carry the worker material for template clones', () => {
    const woodcutters = scene.filter(
        item => item?.__type__ === '3fd0cPUPDRGUIGxTD9/Ww4e',
    );

    assert.equal(woodcutters.length, 3);
    for (const woodcutter of woodcutters) {
        assert.equal(
            woodcutter.workerMaterial?.__uuid__,
            'c4e9cb2e-2c5b-4d1a-a7a4-5d4d084a37bd',
        );
    }
});
