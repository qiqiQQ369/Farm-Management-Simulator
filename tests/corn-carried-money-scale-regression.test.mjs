import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const collectorSource = readFileSync(
    new URL('../assets/_Scripts/CornCoinCollector.ts', import.meta.url),
    'utf8',
);
const forestCollectorSource = readFileSync(
    new URL('../assets/_Scripts/CoinCollector.ts', import.meta.url),
    'utf8',
);

test('corn-area money uses the same backpack-local scale as forest money', () => {
    assert.match(
        forestCollectorSource,
        /storagePoint\.addResource\(coin, 4, new Vec3\(0, 0, 360\), false\)/,
        'the forest reference path transfers the full-size physical coin into the backpack',
    );
    assert.match(
        collectorSource,
        /private normalizeCarriedMoneyScale\(money: Node\): void/,
        'corn money collection must define one scale-normalization seam',
    );
    assert.match(
        collectorSource,
        /this\.normalizeCarriedMoneyScale\(money\)/,
        'every collected corn money visual must be normalized after mounting',
    );
    assert.match(
        collectorSource,
        /money\.setScale\(Vec3\.ONE\)/,
        'corn money must use the same full-size local scale as transferred forest money',
    );
    assert.doesNotMatch(
        collectorSource,
        /coinScale \?\? 0\.5/,
        'the display-only CoinBackpack scale must not shrink transferred physical money',
    );

    const normalizationIndex = collectorSource.indexOf('this.normalizeCarriedMoneyScale(money)');
    const addToBackpackIndex = collectorSource.indexOf('destination.addResource(money');
    assert.ok(
        normalizationIndex >= 0 && normalizationIndex < addToBackpackIndex,
        'money must be normalized before the transfer animation captures its scale',
    );
    assert.match(
        collectorSource,
        /money\.setScale\(sourceScale\);\s*sourceStorage\.addResource\(money, 1\)/,
        'a rejected backpack transfer must restore the source display scale',
    );
});
