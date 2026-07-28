import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/MultiResourceBackpack.ts', import.meta.url),
    'utf8',
);

test('crops reserve space only for resources that are actually carried', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /const hasWood = this\.getWoodInventoryCount\(\) > 0/);
    assert.match(layout, /const hasCoin = this\.getCoinInventoryCount\(\) > 0/);
    assert.match(
        layout,
        /let nextResourceColumn = Number\(hasCoin\) \+ Number\(hasWood\)/,
        'cash alone must not reserve an empty future wood column',
    );

    const occupiedColumns = (hasCoin, hasWood) => Number(hasCoin) + Number(hasWood);
    assert.equal(occupiedColumns(false, false), 0);
    assert.equal(occupiedColumns(true, false), 1);
    assert.equal(occupiedColumns(false, true), 1);
    assert.equal(occupiedColumns(true, true), 2);
});

test('crop avoidance stays on the existing cash-compatible axis', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /target\.y -= column \* this\.resourceColumnSpacing/);
    assert.doesNotMatch(layout, /Vec3\.transformQuat|sidewaysOffset|target\.(?:x|z)\s*[+-]=/);
});
