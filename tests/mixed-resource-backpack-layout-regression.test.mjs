import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/MultiResourceBackpack.ts', import.meta.url),
    'utf8',
);

test('cash never creates a gap before crops; only wood inserts a column', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /const hasWood = this\.getWoodInventoryCount\(\) > 0/);
    assert.match(
        layout,
        /let nextResourceColumn = hasWood \? 1 : 0/,
        'cash uses an independent mount and must not move the crop stack',
    );

    const cropColumn = (_hasCoin, hasWood) => hasWood ? 1 : 0;
    assert.equal(cropColumn(false, false), 0);
    assert.equal(cropColumn(true, false), 0);
    assert.equal(cropColumn(false, true), 1);
    assert.equal(cropColumn(true, true), 1);
});

test('crop avoidance stays on the existing cash-compatible axis', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /target\.y -= column \* this\.resourceColumnSpacing/);
    assert.doesNotMatch(layout, /Vec3\.transformQuat|sidewaysOffset|target\.(?:x|z)\s*[+-]=/);
});
