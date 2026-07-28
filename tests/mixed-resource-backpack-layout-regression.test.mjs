import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/MultiResourceBackpack.ts', import.meta.url),
    'utf8',
);

test('crops give wood the same clearance already used for carried cash', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /const hasWood = this\.getWoodInventoryCount\(\) > 0/);
    assert.match(layout, /const hasCoin = this\.getCoinInventoryCount\(\) > 0/);
    assert.match(
        layout,
        /let nextResourceColumn = hasCoin \|\| hasWood \? 2 : 0/,
        'wood must reserve the same crop clearance as cash',
    );
});

test('crop avoidance stays on the existing cash-compatible axis', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /target\.y -= column \* this\.resourceColumnSpacing/);
    assert.doesNotMatch(layout, /Vec3\.transformQuat|sidewaysOffset|target\.(?:x|z)\s*[+-]=/);
});
