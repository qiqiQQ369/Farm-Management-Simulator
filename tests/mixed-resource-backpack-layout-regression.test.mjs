import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getFirstCropColumn } from '../assets/_Scripts/BackpackResourceLayout.ts';

const source = readFileSync(
    new URL('../assets/_Scripts/MultiResourceBackpack.ts', import.meta.url),
    'utf8',
);

test('wood keeps crops at the same safe clearance with or without cash', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /const hasWood = this\.getWoodInventoryCount\(\) > 0/);
    assert.match(layout, /const hasCoin = this\.getCoinInventoryCount\(\) > 0/);
    assert.match(layout, /getFirstCropColumn\(hasCoin, hasWood\)/);

    assert.equal(getFirstCropColumn(false, false), 0);
    assert.equal(getFirstCropColumn(true, false), 1);
    assert.equal(getFirstCropColumn(false, true), 2);
    assert.equal(getFirstCropColumn(true, true), 2);
});

test('crop avoidance stays on the existing cash-compatible axis', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /target\.y -= column \* this\.resourceColumnSpacing/);
    assert.doesNotMatch(layout, /Vec3\.transformQuat|sidewaysOffset|target\.(?:x|z)\s*[+-]=/);
});
