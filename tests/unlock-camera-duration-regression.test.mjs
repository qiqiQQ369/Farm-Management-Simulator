import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const forestSource = readFileSync(
    new URL('../assets/_Scripts/CoinConsumer.ts', import.meta.url),
    'utf8',
);
const cornSource = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);

const unlockMethods = [
    forestSource.match(/if \(this\.targetLevel === UpgradeTarget\.LOGGER\)[\s\S]*?return;/)?.[0] ?? '',
    forestSource.match(/if \(this\.targetLevel === UpgradeTarget\.MACHINE\)[\s\S]*?return;/)?.[0] ?? '',
    forestSource.match(/if \(this\.targetLevel === UpgradeTarget\.FACTORY \|\| this\.targetLevel === UpgradeTarget\.HAULER\)[\s\S]*?(?=    private spawnHaulerUnlockPointAt)/)?.[0] ?? '',
    cornSource.match(/private completeWorkerUnlock[\s\S]*?\n    private completeVehicleUnlock/)?.[0] ?? '',
    cornSource.match(/private completeVehicleUnlock[\s\S]*?\n    private completeHaulerUnlock/)?.[0] ?? '',
    cornSource.match(/private completeHaulerUnlock[\s\S]*?\n    private showUnlockStage/)?.[0] ?? '',
];

test('all forest and corn unlock camera locks last exactly three seconds', () => {
    assert.equal(unlockMethods.length, 6);
    for (const unlockMethod of unlockMethods) {
        assert.match(unlockMethod, /(?:joystickController|joystick)\._lock = true/);
        assert.match(unlockMethod, /scheduleOnce\([\s\S]*?\}, 3\)/);
        assert.doesNotMatch(unlockMethod, /\}, (?:4|6)\)/);
    }
});
