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

test('forest and corn money collectors drain ready notes continuously without tween callback queues', () => {
    assert.match(
        forestCollectorSource,
        /public collectInterval:\s*number\s*=\s*0\.035/,
        'forest pickup must keep a short visual cadence between individual notes',
    );
    assert.match(
        collectorSource,
        /public collectInterval\s*=\s*0\.035/,
        'corn pickup must keep a short visual cadence between individual notes',
    );
    assert.match(forestCollectorSource, /private collectCoins\(\): void/);
    assert.match(forestCollectorSource, /private findReadyCoin\(\): Node \| null/);
    assert.match(
        forestCollectorSource,
        /if \(ResourceManager\.tweenDicCoin\.has\(coin\)\) continue/,
        'a falling note must be skipped, not queued repeatedly on its tween',
    );
    assert.doesNotMatch(
        forestCollectorSource,
        /tweenDicCoin\.get\(coin\)\.call/,
        'pickup must never append duplicate transfer callbacks to a falling note',
    );
    assert.match(collectorSource, /private collectCoins\(\): void/);
    for (const source of [forestCollectorSource, collectorSource]) {
        assert.match(
            source,
            /this\._collectTimer - collectionInterval/,
            'one-note cadence must retain elapsed time instead of restarting a full interval',
        );
        assert.match(
            source,
            /Math\.min\([\s\S]*?collectionInterval[\s\S]*?collectionInterval[\s\S]*?\)/,
            'slow frames must not build a burst that makes all notes fly at once',
        );
    }
    assert.doesNotMatch(
        collectorSource,
        /nextCoin\.scale\.lengthSqr\(\)/,
        'an unfinished top note must not block already-ready corn notes below it',
    );
    assert.match(
        collectorSource,
        /for \(let index = 0; index < batchSize; index\+\+\)/,
        'corn collector must process a continuous bounded batch each frame',
    );
});
