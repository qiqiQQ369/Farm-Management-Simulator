import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/FinishNode.ts', import.meta.url),
    'utf8',
);

test('corn field unlock reveal does not automatically move or rotate the player', () => {
    const cameraComplete = source.match(
        /private onCameraMoveComplete[\s\S]*?\n    private restoreGameplayAfterSequence/,
    )?.[0] ?? '';

    assert.doesNotMatch(cameraComplete, /tween\(player\)/);
    assert.doesNotMatch(cameraComplete, /player\.lookAt\(/);
    assert.doesNotMatch(cameraComplete, /player\.eulerAngles\s*=/);
    assert.doesNotMatch(cameraComplete, /AnimationName\.Run/);
});

test('corn field unlock still restores normal player control after the reveal', () => {
    assert.match(source, /playerController\.enabled = false/);
    assert.match(source, /playerController\.enabled = true/);
    assert.match(source, /joystickController\._lock = false/);
});

test('camera returns to the player as soon as the lock animation finishes', () => {
    const cameraComplete = source.match(
        /private onCameraMoveComplete[\s\S]*?\n    private restoreGameplayAfterSequence/,
    )?.[0] ?? '';

    assert.match(cameraComplete, /lockAnimation\.once\(Animation\.EventType\.FINISHED/);
    assert.match(
        cameraComplete,
        /Animation\.EventType\.FINISHED[\s\S]*?restoreGameplayAfterSequence\(player, playerController\)/,
    );
    assert.doesNotMatch(cameraComplete, /setTimeout/);
    assert.doesNotMatch(
        cameraComplete,
        /scheduleOnce\(\(\) => \{\s*this\.restoreGameplayAfterSequence/,
    );
});

test('corn reveal skips optional table decoration when its nodes are absent', () => {
    const cameraComplete = source.match(
        /private onCameraMoveComplete[\s\S]*?\n    private restoreGameplayAfterSequence/,
    )?.[0] ?? '';

    assert.match(cameraComplete, /const grayNode = this\.tableNode\?\.getChildByName\("gray"\)/);
    assert.match(cameraComplete, /const redNode = this\.tableNode\?\.getChildByName\("red"\)/);
    assert.match(cameraComplete, /const lockAnimation = this\.tableNode\?\.getChildByName\("锁"\)\?\.getComponent\(Animation\)/);
    assert.match(
        cameraComplete,
        /if \(!grayNode \|\| !redNode \|\| !lockAnimation\) \{\s*this\.restoreGameplayAfterSequence\(player, playerController\);\s*return;/,
    );
    assert.doesNotMatch(cameraComplete, /getChildByName\("gray"\)\.active/);
});
