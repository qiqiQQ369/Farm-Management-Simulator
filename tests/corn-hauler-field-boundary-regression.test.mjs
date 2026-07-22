import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const haulerSource = readFileSync(
    new URL('../assets/_Scripts/CornHauler.ts', import.meta.url),
    'utf8',
);
const fieldSystemSource = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);

test('corn hauler is bound to its own field root and never accepts forest anchors', () => {
    assert.match(haulerSource, /public homeFieldRoot: Node = null!/);
    assert.match(haulerSource, /private hasValidFieldBindings\(\): boolean/);
    assert.match(haulerSource, /private belongsToHomeField\(node: Node \| null\): boolean/);
    assert.match(haulerSource, /this\.belongsToHomeField\(this\.collectionPoint\)/);
    assert.match(haulerSource, /this\.belongsToHomeField\(this\.sellPoint\)/);
    assert.match(haulerSource, /this\.belongsToHomeField\(this\.idlePoint\)/);
    assert.match(fieldSystemSource, /behavior\.homeFieldRoot = field\.root/);
});

test('corn hauler validates its own anchors instead of resetting its route position', () => {
    assert.doesNotMatch(
        haulerSource,
        /private recoverOutsideHomeField\(\): void/,
        'a second corn-only position recovery fights the shared hauler route state machine',
    );

    const updateStart = haulerSource.indexOf('protected update(deltaTime: number): void');
    const updateEnd = haulerSource.indexOf('public recoverAfterSceneTransition(): void', updateStart);
    const updateBody = haulerSource.slice(updateStart, updateEnd);
    assert.doesNotMatch(
        updateBody,
        /this\.recoverOutsideHomeField\(\)/,
        'normal route updates must not repeatedly teleport a corn hauler',
    );
});
