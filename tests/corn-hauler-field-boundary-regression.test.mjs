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

test('corn hauler stands at its own sell point center before unloading', () => {
    assert.match(
        fieldSystemSource,
        /private createCornHaulerSellServicePoint\(field: FieldRuntime\): Node[\s\S]*?field\.sellNode\.worldPosition/,
    );
    assert.match(fieldSystemSource, /const sellServicePoint = this\.createCornHaulerSellServicePoint\(field\)/);
    assert.match(fieldSystemSource, /behavior\.sellPoint = sellServicePoint/);
    assert.match(fieldSystemSource, /behavior\.sellStopDistance = 0\.01/);
    assert.match(haulerSource, /point\) <= Math\.max\(this\.sellStopDistance, 0\.01\)/);
    assert.match(haulerSource, /const stop = Math\.max\(stopDistance, 0\.01\)/);
    assert.doesNotMatch(haulerSource, /isNearSellPoint|enterSellPoint|snapToSellPoint/);
    const unloadingBranch = haulerSource.match(/case CornHaulerState\.Unloading:[\s\S]*?break;/)?.[0] ?? '';
    assert.doesNotMatch(unloadingBranch, /setWorldPosition/);
    assert.doesNotMatch(unloadingBranch, /this\._state = CornHaulerState\.Delivering/);
    assert.match(haulerSource, /Math\.max\(this\.transferStallTimeout, 0\.7\) \* 1000/);
    assert.doesNotMatch(haulerSource, /storagePosition\) <= Math\.max\(this\.sellStopDistance, 0\.2\) \+ 0\.8/);
});

test('corn sell point uses the forest player highlight while the hauler unloads', () => {
    assert.match(haulerSource, /public isUnloadingAtSellPoint\(\): boolean/);
    assert.match(haulerSource, /this\._state === CornHaulerState\.Unloading/);
    assert.match(fieldSystemSource, /field\.haulerBehavior\?\.isUnloadingAtSellPoint\(\)/);
    assert.match(fieldSystemSource, /find\('LandObj\/Sell'\)\?\.getComponent\(PlayerDetectionZone\)/);
    assert.match(fieldSystemSource, /highlighted \? forestSellZone\?\.material : forestSellZone\?\.material1/);
});

test('corn unload recovery keeps the hauler at its sell point', () => {
    const monitor = haulerSource.match(/private monitorTransferProgress[\s\S]*?\n    private isAtSellTarget/)?.[0] ?? '';
    assert.match(monitor, /from\.recoverInterruptedTransfers\(\)/);
    assert.doesNotMatch(monitor, /this\.resetStalledRouteInPlace\(\)/);
});
