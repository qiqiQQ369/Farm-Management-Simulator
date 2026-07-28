import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const cameraSource = readFileSync(
    new URL('../assets/_Scripts/CameraController.ts', import.meta.url),
    'utf8',
);
const forestSource = readFileSync(
    new URL('../assets/_Scripts/CoinConsumer.ts', import.meta.url),
    'utf8',
);
const cornSource = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);
const fieldRevealSource = readFileSync(
    new URL('../assets/_Scripts/FinishNode.ts', import.meta.url),
    'utf8',
);

test('camera controller owns an unlock pan that ordinary follow cannot overwrite', () => {
    assert.match(cameraSource, /public panToTarget\(\s*target: Node,\s*duration: number,\s*onArrived\?: \(\) => void/);
    assert.match(cameraSource, /private _isTargetPanning(?:\s*:\s*boolean)?\s*=\s*false/);
    assert.match(cameraSource, /if \(this\._isTargetPanning\) return/);
    assert.match(cameraSource, /\.to\(duration,\s*\{\s*worldPosition:/);
    assert.match(cameraSource, /easing:\s*'sineInOut'/);
    assert.match(cameraSource, /this\.target = target/);
    assert.match(cameraSource, /onArrived\?\.\(\)/);
});

test('forest unlocks pan before revealing workers, machine, and hauler', () => {
    const unlockMethod = forestSource.match(
        /private spawnBuildings[\s\S]*?\n    private spawnHaulerUnlockPointAt/,
    )?.[0] ?? '';

    assert.equal((unlockMethod.match(/\.panToTarget\(/g) ?? []).length, 3);
    assert.equal((unlockMethod.match(/,\s*0\.6,\s*\(\) =>/g) ?? []).length, 3);
    assert.match(unlockMethod, /panToTarget\(loggerFocus,\s*0\.6,\s*\(\) => \{\s*this\.loggerNode\.active = true/);
    assert.match(unlockMethod, /panToTarget\(machineFocus,\s*0\.6,\s*\(\) => \{\s*this\.machineNode\.active = true/);
    assert.match(unlockMethod, /panToTarget\(this\.finishNode,\s*0\.6,\s*\(\) => \{\s*if \(this\.finishNode\) this\.finishNode\.active = true/);
});

test('corn unlocks pan before revealing workers, tractor, and hauler', () => {
    const workerUnlock = cornSource.match(
        /private completeWorkerUnlock[\s\S]*?\n    private completeVehicleUnlock/,
    )?.[0] ?? '';
    const vehicleUnlock = cornSource.match(
        /private completeVehicleUnlock[\s\S]*?\n    private completeHaulerUnlock/,
    )?.[0] ?? '';
    const haulerUnlock = cornSource.match(
        /private completeHaulerUnlock[\s\S]*?\n    private showUnlockStage/,
    )?.[0] ?? '';

    assert.match(workerUnlock, /for \(const worker of field\.workers\) worker\.node\.active = false/);
    assert.match(workerUnlock, /panToTarget\(focusWorker,\s*0\.6,\s*\(\) => \{\s*for \(const worker of field\.workers\) worker\.node\.active = true/);
    assert.match(vehicleUnlock, /field\.vehicle\.node\.active = false/);
    assert.match(vehicleUnlock, /panToTarget\(field\.vehicle\.node,\s*0\.6,\s*\(\) => \{\s*if \(field\.vehicle\) field\.vehicle\.node\.active = true/);
    assert.match(haulerUnlock, /field\.hauler\.active = false/);
    assert.match(haulerUnlock, /panToTarget\(field\.hauler,\s*0\.6,\s*\(\) => \{\s*if \(field\.hauler\) field\.hauler\.active = true/);
});

test('field reveal keeps its existing camera animation', () => {
    assert.doesNotMatch(fieldRevealSource, /panToTarget/);
});

test('field purchase activates its reveal node without waiting for the hauler camera pan', () => {
    const unlockMethod = forestSource.match(
        /private spawnBuildings[\s\S]*?\n    private spawnHaulerUnlockPointAt/,
    )?.[0] ?? '';

    assert.match(
        unlockMethod,
        /if \(this\.targetLevel === UpgradeTarget\.HAULER\) \{\s*this\.finishNode\.active = false;\s*\} else \{\s*this\.finishNode\.active = true;/,
    );
});
