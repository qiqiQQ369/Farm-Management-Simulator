import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/MultiResourceBackpack.ts', import.meta.url),
    'utf8',
);

test('wood keeps crops at the same safe clearance with or without cash', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /const hasWood = this\.getWoodInventoryCount\(\) > 0/);
    assert.match(
        layout,
        /let nextResourceColumn = hasWood \? 2 : 0/,
        'cash must not leave an extra empty column before crops',
    );
});

test('crop avoidance stays on the existing cash-compatible axis', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /target\.y -= column \* this\.resourceColumnSpacing/);
    assert.doesNotMatch(layout, /Vec3\.transformQuat|sidewaysOffset|target\.(?:x|z)\s*[+-]=/);
});
