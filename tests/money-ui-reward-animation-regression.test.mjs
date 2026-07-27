import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const animatorUrl = new URL(
    '../assets/_Scripts/MoneyUIRewardAnimator.ts',
    import.meta.url,
);
const forestCollectorUrl = new URL(
    '../assets/_Scripts/CoinCollector.ts',
    import.meta.url,
);
const cornCollectorUrl = new URL(
    '../assets/_Scripts/CornCoinCollector.ts',
    import.meta.url,
);

test('money UI animator owns a restartable whole-node punch animation', async () => {
    const source = await readFile(animatorUrl, 'utf8');

    assert.match(source, /find\('Canvas\/CoinLabel'\)/);
    assert.match(source, /stop\(\)/);
    assert.match(source, /this\._baseScale/);
    assert.match(source, /\.to\(0\.1,/);
    assert.match(source, /\.to\(0\.15,/);
    assert.doesNotMatch(source, /constructor\.name/);
});

test('both money reward paths trigger the shared whole-UI animation', async () => {
    const [forestSource, cornSource] = await Promise.all([
        readFile(forestCollectorUrl, 'utf8'),
        readFile(cornCollectorUrl, 'utf8'),
    ]);

    for (const source of [forestSource, cornSource]) {
        assert.match(
            source,
            /import \{ MoneyUIRewardAnimator \} from '\.\/MoneyUIRewardAnimator';/,
        );
        assert.match(
            source,
            /coinAmountLabel\.string = String\(currentAmount \+ delta\);\s*MoneyUIRewardAnimator\.playForCurrentScene\(\);/,
        );
    }
});
