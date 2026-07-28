import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const randomizerUrl = new URL(
    '../assets/_Scripts/CustomerAppearanceRandomizer.ts',
    import.meta.url,
);

test('customer products sit above the wrist midpoint by the shared support offset', async () => {
    const source = await readFile(randomizerUrl, 'utf8');

    assert.match(source, /@property public carryHeightOffset = 0\.12;/);
    assert.match(
        source,
        /this\._carryPosition\.y \+= this\._handCenter\.y\s*\+ this\.carryHeightOffset\s*- bounds\.minY;/,
    );
    assert.match(source, /Vec3\.lerp\(\s*this\._handCenter,/);
    assert.match(source, /this\._carryCenter\.x/);
    assert.match(source, /this\._carryCenter\.z/);
});
