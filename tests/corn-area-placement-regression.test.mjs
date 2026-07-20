import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));
const resourceFieldSource = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);

const nodeAt = (reference) => scene[reference.__id__];
const childrenOf = (node) => (node._children ?? []).map(nodeAt);
const childNamed = (node, name) => childrenOf(node).find((child) => child._name === name);

const fieldSystem = scene.find((entry) =>
    entry?.leftFieldRoot && entry?.rightFieldRoot && entry?.leftWorkerUnlockPoint,
);
assert.ok(fieldSystem, 'ResourceFieldSystem scene binding must exist');

const centralScheduler = scene.find((entry) =>
    entry?.__type__ === 'cc.Node' && entry._name === 'NPCScheduler' && entry._active,
);
assert.ok(centralScheduler, 'active ground-aligned customer scheduler must exist');
const groundY = centralScheduler._lpos.y;

test('corn-area customers use the scene ground height', () => {
    for (const fieldRootRef of [fieldSystem.leftFieldRoot, fieldSystem.rightFieldRoot]) {
        const fieldRoot = nodeAt(fieldRootRef);
        const customerScheduler = childNamed(fieldRoot, 'NPCScheduler-001');
        assert.ok(customerScheduler, `${fieldRoot._name} customer scheduler must exist`);
        assert.equal(
            customerScheduler._lpos.y,
            groundY,
            `${fieldRoot._name} customers must use the scene ground height`,
        );
    }
});

const unlockBindings = [
    [fieldSystem.leftFieldRoot, fieldSystem.leftOpeningPad, fieldSystem.leftWorkerUnlockPoint],
    [fieldSystem.rightFieldRoot, fieldSystem.rightOpeningPad, fieldSystem.rightWorkerUnlockPoint],
];

test('corn unlock icons stay inside their field', () => {
    for (const [fieldRootRef, openingPadRef, unlockPointRef] of unlockBindings) {
        const fieldRoot = nodeAt(fieldRootRef);
        const openingPad = nodeAt(openingPadRef);
        const unlockPoint = nodeAt(unlockPointRef);
        const openingLocalX = openingPad._lpos.x - fieldRoot._lpos.x;

        assert.ok(
            unlockPoint._lpos.x < openingLocalX - 1,
            `${fieldRoot._name} corn unlock icon must be placed inside the field, not at the forest entrance`,
        );
    }

    assert.doesNotMatch(
        resourceFieldSource,
        /padNode\.setWorldPosition\(field\.openingPad\.worldPosition\)/,
        'runtime code must not move corn unlock icons back to the forest-side opening pad',
    );
});
