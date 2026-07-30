import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const AN_ARROW_PREFAB = '46a0b473-da88-449f-b17b-ad8e495cfaa8@46c5f';
const ORIGINAL_ARROW_DRIVER = 'e79ce566-57f9-4fcb-8d4b-5aa838008f30@34b2c';

test('rotating guide arrow uses the An_箭头 animated asset', async () => {
    const [controller, arrowPrefab, targetPrefab] = await Promise.all([
        readFile(new URL('../assets/_Scripts/ArrowTipController.ts', import.meta.url), 'utf8'),
        readFile(new URL('../assets/_Assets/Prefab/箭头.prefab', import.meta.url), 'utf8'),
        readFile(new URL('../assets/_Assets/Prefab/立体箭头.prefab', import.meta.url), 'utf8'),
    ]);

    assert.match(controller, /targetArrowVisualPrefab: Prefab/);
    assert.match(controller, /instantiate\(this\.targetArrowVisualPrefab\)/);
    assert.match(controller, /visual\.name = 'An_箭头'/);
    assert.match(controller, /getComponent\(SkeletalAnimation\)/);
    assert.match(controller, /instantiate\(this\.originalArrowAnimationPrefab\)/);
    assert.match(controller, /renderer\.enabled = false/);
    assert.match(controller, /driverAnimation\.playOnLoad = true;[\s\S]*?driverAnimation\.play\(\)/);
    assert.match(controller, /this\._arrowDriverBone = driver\.getChildByName\('Bone001'\)/);
    assert.match(controller, /protected lateUpdate\(\): void/);
    assert.match(controller, /this\._arrowVisualBone\.setRotation\(this\._animationRotation\)/);
    assert.match(controller, /if \(!state\?\.isPlaying\) this\._arrowDriverAnimation\.play\(\)/);
    assert.doesNotMatch(controller, /tween\(visual\)/);

    const arrowController = JSON.parse(arrowPrefab)[7];
    assert.equal(arrowController.targetArrowVisualPrefab.__uuid__, AN_ARROW_PREFAB);
    assert.equal(arrowController.originalArrowAnimationPrefab.__uuid__, ORIGINAL_ARROW_DRIVER);
    assert.equal(JSON.parse(targetPrefab)[3].asset.__uuid__, AN_ARROW_PREFAB);
    assert.doesNotMatch(targetPrefab, /dc35bc00-da90-471d-84d7-0bb926e13209/);
});
