import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const forestSource = readFileSync(
    new URL('../assets/_Scripts/HaulerNPC.ts', import.meta.url),
    'utf8',
);
const cornSource = readFileSync(
    new URL('../assets/_Scripts/CornHauler.ts', import.meta.url),
    'utf8',
);
const fieldSource = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);
const coinConsumerSource = readFileSync(
    new URL('../assets/_Scripts/CoinConsumer.ts', import.meta.url),
    'utf8',
);

test('forest hauler stops outside its solid collection storage footprint', () => {
    assert.match(
        forestSource,
        /collectionStopDistance\s*=\s*1\.8/,
        'the working forest hauler behavior must remain unchanged',
    );

    assert.match(
        coinConsumerSource,
        /behavior\.collectionStopDistance = 1\.8/,
        'runtime forest hauler configuration must preserve the safe approach distance',
    );
});

test('forest hauler stands at the wood sell point center before unloading', () => {
    assert.match(
        coinConsumerSource,
        /const sellPoint = arrow\?\.sellWoodGuideNode \?\? sellStorage\?\.node \?\? null/,
    );
    assert.match(coinConsumerSource, /behavior\.sellStopDistance = 0\.01/);
    assert.match(forestSource, /this\.moveTowards\(this\.sellPoint\.worldPosition, deltaTime, this\.sellStopDistance\)/);
    assert.match(forestSource, /sellPointPosition\) <= Math\.max\(this\.sellStopDistance, 0\.01\)/);
    assert.match(forestSource, /clampedStopDistance = Math\.max\(stopDistance, 0\.01\)/);
    assert.doesNotMatch(forestSource, /isNearSellPoint|enterSellPoint|snapToSellPoint/);
    const unloadingBranch = forestSource.match(/case HaulerState\.Unloading:[\s\S]*?break;/)?.[0] ?? '';
    assert.doesNotMatch(unloadingBranch, /setWorldPosition/);
    assert.doesNotMatch(unloadingBranch, /this\._state = HaulerState\.Delivering/);
    assert.match(forestSource, /Math\.max\(this\.transferStallTimeout, 0\.7\) \* 1000/);
    assert.doesNotMatch(forestSource, /sellStoragePosition\) <= Math\.max\(this\.sellStopDistance, 0\.2\) \+ 0\.8/);
    assert.match(forestSource, /setSellZoneHaulerHighlight\(this\._state === HaulerState\.Unloading\)/);
});

test('forest unload recovery keeps the hauler at the sell point', () => {
    const monitor = forestSource.match(/private monitorTransferProgress[\s\S]*?\n    private resetTransferProgressMonitor/)?.[0] ?? '';
    assert.match(monitor, /from\.recoverInterruptedTransfers\(\)/);
    assert.doesNotMatch(monitor, /this\.resetStalledRouteInPlace\(\)/);
});

test('corn hauler keeps the forest 1.8-unit collection clearance on a fixed open side', () => {
    assert.match(cornSource, /collectionStopDistance\s*=\s*0\.05/);
    assert.match(fieldSource, /private createCornHaulerCollectionServicePoint\(/);
    assert.match(fieldSource, /const collectionServicePoint = this\.createCornHaulerCollectionServicePoint\(field, spawnAnchor\)/);
    assert.match(fieldSource, /direction\.multiplyScalar\(1\.8\)/);
    assert.match(fieldSource, /behavior\.collectionPoint = collectionServicePoint/);
    assert.match(fieldSource, /behavior\.collectionStopDistance = 0\.05/);
    assert.doesNotMatch(fieldSource, /behavior\.collectionPoint = field\.collectionStorage\.node/);
});

test('forest and corn haulers reset a blocked route in place after half a second', () => {
    for (const [name, source] of [
        ['forest', forestSource],
        ['corn', cornSource],
    ]) {
        assert.match(source, /private _moveStallTimer = 0/, `${name} hauler needs its own progress timer`);
        assert.match(source, /private _lastMoveDistance = Number\.POSITIVE_INFINITY/);
        assert.match(source, /this\.recoverStalledMovement\(/);
        assert.match(source, /private recoverStalledMovement\(/);
        assert.match(source, /routeStallResetSeconds = 0\.5/);
        assert.match(source, /this\._moveStallTimer < Math\.max\(this\.routeStallResetSeconds, 0\.05\)/);
        assert.doesNotMatch(
            source,
            /this\.node\.setWorldPosition\(safePosition\)/,
            `${name} hauler must never relocate after a route stall`,
        );
        assert.match(
            source,
            /this\.playIdleAnimation\(\);\s*return false;/,
            `${name} hauler must retry its current route instead of advancing state`,
        );
    }
});

test('forest and corn haulers treat floating-point near-arrival as reaching the sell point', () => {
    for (const [name, source, stopName] of [
        ['forest', forestSource, 'clampedStopDistance'],
        ['corn', cornSource, 'stop'],
    ]) {
        const moveMethod = source.match(/private moveTowards[\s\S]*?\n    private /)?.[0] ?? '';
        assert.match(
            moveMethod,
            new RegExp(`const arrivalTolerance = ${stopName} \\+ 0\\.001`),
            `${name} hauler must not let a sub-millimeter floating-point remainder restart delivery forever`,
        );
        assert.match(
            moveMethod,
            /if \(distance <= arrivalTolerance\)/,
            `${name} hauler must enter unloading once it is visually at the sell point`,
        );
    }
});

test('corn hauler leaves a transfer phase after recovery removes a stale source count', () => {
    const transferMethod = cornSource.match(/private transferCorn[\s\S]*?\n    private tryRecoverBlockedStorage/)?.[0] ?? '';
    assert.match(
        transferMethod,
        /if \(from\.amount === 0\) \{\s*this\._state = completedState;\s*return;\s*\}[\s\S]*?if \(!from\.hasMovableResource\(\)\)/,
        'the corn hauler must advance after recovery proves no physical resource remains',
    );
});

test('forest and corn haulers recover only the blocked transfer after storage progress stalls', () => {
    for (const [name, source] of [
        ['forest', forestSource],
        ['corn', cornSource],
    ]) {
        const monitor = source.match(
            /private monitorTransferProgress[\s\S]*?\n    private /,
        )?.[0] ?? '';
        assert.match(
            monitor,
            /from\.recoverInterruptedTransfers\(\)/,
            `${name} hauler must recover the blocked source stack without leaving its route`,
        );
        assert.doesNotMatch(
            monitor,
            /this\.resetStalledRouteInPlace\(\)/,
            `${name} hauler must not reset its route during a blocked unload`,
        );
    }
});
