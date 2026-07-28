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
