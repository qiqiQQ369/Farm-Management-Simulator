import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scripts = [
    '../assets/_Scripts/NPCScheduler.ts',
    '../assets/_Scripts/CornCustomerScheduler.ts',
];

for (const relativePath of scripts) {
    test(`${relativePath} keeps every waiting customer in one line behind the head`, async () => {
        const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');

        assert.match(
            source,
            /private resolveQueueDirection\(\): Vec3[\s\S]*?gameCamera\.worldToScreen\(buyerPosition\)[\s\S]*?gameCamera\.screenPointToRay\([\s\S]*?buyerScreenPosition\.x[\s\S]*?screenVerticalGroundPoint\.subtract\(buyerPosition\)/,
        );
        assert.match(
            source,
            /private resolveGameCamera\(\): Camera \| null[\s\S]*?camera\.node\.name === 'Main Camera'[\s\S]*?camera\.visibility & this\.node\.layer/,
        );
        assert.match(
            source,
            /@executionOrder\(200\)[\s\S]*?protected start\(\): void \{[\s\S]*?this\.initializeQueue\(\)/,
        );
        assert.match(
            source,
            /this\._queueDirection = this\.resolveQueueDirection\(\)/,
        );
        assert.doesNotMatch(
            source,
            /lateUpdate|maintainQueueScreenAlignment/,
        );
        assert.match(
            source,
            /syncQueueMove[\s\S]*?const target = this\.getQueueSlot\(i(?:ndex)?\)/,
        );
        assert.match(
            source,
            /initializeQueue[\s\S]*?setWorldPosition\(this\.getQueueSlot\(i(?:ndex)?\)\)/,
        );
        assert.doesNotMatch(
            source,
            /from\.clone\(\)\.add\(direction\.multiplyScalar\((?:headDist|travelDistance)\)\)/,
        );
    });
}
