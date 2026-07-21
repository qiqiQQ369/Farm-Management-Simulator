import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/CoinConsumer.ts', import.meta.url),
    'utf8',
);

test('forest hauler unlock uses the same reveal sequence as corn hauler unlock', () => {
    const unlockMethod = source.match(
        /private spawnBuildings[\s\S]*?\n    private spawnHaulerUnlockPointAt/,
    )?.[0] ?? '';

    assert.match(unlockMethod, /this\.finishNode = this\.createHaulerNode\(this\.node\)/);
    assert.match(unlockMethod, /this\.finishNode\.active = true/);
    assert.match(unlockMethod, /\.to\(0\.5, \{ scale: new Vec3\(0, 0, 0\) \}/);
    assert.match(unlockMethod, /cameraController\.target = this\.finishNode/);
    assert.match(unlockMethod, /joystickController\._lock = true/);
    assert.match(unlockMethod, /find\('Player'\)\.getComponent\(PlayerController\)\.stopMovement\(\)/);
    assert.match(unlockMethod, /cameraController\.target = find\('Player'\)/);
    assert.match(unlockMethod, /}, 6\)/);
});
