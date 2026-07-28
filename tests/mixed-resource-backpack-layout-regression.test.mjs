import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/MultiResourceBackpack.ts', import.meta.url),
    'utf8',
);

test('wood and crop stacks use separate lateral backpack columns', () => {
    const layout = source.match(
        /private refreshColumnLayout[\s\S]*?\n    private getLayoutSignature/,
    )?.[0] ?? '';

    assert.match(layout, /const hasWood = this\.getWoodInventoryCount\(\) > 0/);
    assert.match(
        layout,
        /Vec3\.transformQuat\([^;]*slot\.mount\.rotation\)/,
        'the authored sideways offset must be converted from stack-local space into the mount parent space',
    );
    assert.doesNotMatch(
        layout,
        /target\.z\s*\+=\s*slot\.horizontalOffset/,
        'direct parent-Z movement follows the resource long axis and still intersects the other stack',
    );
});

test('each crop slot preserves its authored horizontal backpack offset', () => {
    assert.match(source, /horizontalOffset: number;/);
    assert.match(source, /horizontalOffset,\s*\n\s*items:/);
    assert.match(source, /existing\.horizontalOffset = horizontalOffset/);
});
