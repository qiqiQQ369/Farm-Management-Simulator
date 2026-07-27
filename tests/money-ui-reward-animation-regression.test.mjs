import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const animatorUrl = new URL(
    '../assets/_Scripts/MoneyUIRewardAnimator.ts',
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
