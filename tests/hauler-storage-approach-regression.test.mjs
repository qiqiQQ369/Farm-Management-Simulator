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

test('forest and corn haulers reset the full transfer state after storage progress stalls', () => {
    for (const [name, source] of [
        ['forest', forestSource],
        ['corn', cornSource],
    ]) {
        const monitor = source.match(
            /private monitorTransferProgress[\s\S]*?\n    private /,
        )?.[0] ?? '';
        assert.match(
            monitor,
            /this\.resetStalledRouteInPlace\(\)/,
            `${name} hauler must reset its full state when loading or unloading stops progressing`,
        );

        const reset = source.match(
            /private resetStalledRouteInPlace\(\): void[\s\S]*?\n    }/,
        )?.[0] ?? '';
        assert.match(
            reset,
            /this\.recoverAfterSceneTransition\(\)/,
            `${name} hauler stall recovery must rebuild storage and state like a scene transition`,
        );
        assert.match(
            reset,
            /const currentPosition = this\.node\.worldPosition\.clone\(\)[\s\S]*this\.node\.setWorldPosition\(currentPosition\)/,
            `${name} hauler state recovery must preserve its current world position`,
        );
    }
});
