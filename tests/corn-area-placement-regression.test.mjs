import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));
const forestVisualPrefab = JSON.parse(readFileSync(
    new URL('../assets/_Assets/Prefab/shoujimucai.prefab', import.meta.url),
    'utf8',
));
const resourceFieldSource = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);
const cornProductionSource = readFileSync(
    new URL('../assets/_Scripts/CornFieldProduction.ts', import.meta.url),
    'utf8',
);
const cornUnlockSource = readFileSync(
    new URL('../assets/_Scripts/CornUnlockPad.ts', import.meta.url),
    'utf8',
);
const finishNodeSource = readFileSync(
    new URL('../assets/_Scripts/FinishNode.ts', import.meta.url),
    'utf8',
);

const nodeAt = (reference) => scene[reference.__id__];
const childrenOf = (node) => (node._children ?? []).map(nodeAt);
const childNamed = (node, name) => childrenOf(node).find((child) => child._name === name);
const nodeNamed = (name) => scene.find((entry) => entry?.__type__ === 'cc.Node' && entry._name === name);
const assertNear = (actual, expected, message) => assert.ok(
    Math.abs(actual - expected) < 0.001,
    `${message}: expected ${expected}, received ${actual}`,
);

const forestBoardRenderer = forestVisualPrefab.find((entry) =>
    entry?.__type__ === 'cc.MeshRenderer'
    && entry?._mesh?.__uuid__?.endsWith('@90ee8'),
);
assert.ok(forestBoardRenderer, 'forest wood-board renderer must exist in the authored prefab');
const forestBoardNode = forestVisualPrefab[forestBoardRenderer.node.__id__];
// The forest prefab root is placed at (0, -0.514, -0.014) in DevScene.
// Subtracting woodStackArea gives the board's exact storage-relative position.
const forestBoardRelativeToStorage = {
    x: 0.0162388286590575,
    y: 0.06452477729320526,
    z: -0.2766022787094116,
};

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
    [
        fieldSystem.leftFieldRoot,
        fieldSystem.leftOpeningPad,
        fieldSystem.leftWorkerUnlockPoint,
        fieldSystem.leftCollectionStorage,
    ],
    [
        fieldSystem.rightFieldRoot,
        fieldSystem.rightOpeningPad,
        fieldSystem.rightWorkerUnlockPoint,
        fieldSystem.rightCollectionStorage,
    ],
];

test('corn storage board and unlock nodes are authored in the scene with the forest layout', () => {
    const forestStorage = nodeNamed('woodStackArea');
    const forestUnlockPoint = nodeNamed('unlockLevel1');
    assert.ok(forestStorage, 'forest storage point must exist');
    assert.ok(forestUnlockPoint, 'forest unlock point must exist');

    const forestStorageToUnlock = {
        x: forestUnlockPoint._lpos.x - forestStorage._lpos.x,
        y: forestUnlockPoint._lpos.y - forestStorage._lpos.y,
        z: forestUnlockPoint._lpos.z - forestStorage._lpos.z,
    };

    for (const [fieldRootRef, openingPadRef, , collectionStorageRef] of unlockBindings) {
        const fieldRoot = nodeAt(fieldRootRef);
        const openingPad = nodeAt(openingPadRef);
        const collectionStorageComponent = nodeAt(collectionStorageRef);
        const collectionStorage = nodeAt(collectionStorageComponent.node);
        const openingLocalX = openingPad._lpos.x - fieldRoot._lpos.x;
        const storageBoard = childNamed(collectionStorage, 'CornStorageBoard');

        assert.equal(
            collectionStorage._name,
            'CornStorageArea',
            `${fieldRoot._name} must expose an authored corn storage node in Creator`,
        );
        assert.ok(storageBoard, `${fieldRoot._name} must expose an authored corn storage board in Creator`);
        assert.deepEqual(
            storageBoard._lscale,
            forestBoardNode._lscale,
            `${fieldRoot._name} storage board must use the forest board size`,
        );
        for (const axis of ['x', 'y', 'z']) {
            assertNear(
                storageBoard._lpos[axis],
                forestBoardRelativeToStorage[axis],
                `${fieldRoot._name} storage board must use the forest ${axis.toUpperCase()} offset`,
            );
        }
        assert.equal(
            storageBoard._components.length,
            1,
            `${fieldRoot._name} storage board must contain visual rendering only`,
        );
        assert.equal(
            nodeAt(storageBoard._components[0]).__type__,
            'cc.MeshRenderer',
            `${fieldRoot._name} storage board must not copy forest storage or trigger logic`,
        );

        assert.ok(
            collectionStorage._lpos.x < openingLocalX - 1,
            `${fieldRoot._name} collection storage must be inside the corn field, not in the forest`,
        );

        for (const stage of ['Worker', 'Vehicle', 'Hauler']) {
            const unlockPoint = nodeAt(fieldSystem[`${fieldRootRef === fieldSystem.leftFieldRoot ? 'left' : 'right'}${stage}UnlockPoint`]);

            assert.ok(
                unlockPoint._lpos.x < openingLocalX - 1,
                `${fieldRoot._name} ${stage} unlock must be inside the corn field, not in the forest`,
            );
            assertNear(
                unlockPoint._lpos.x - collectionStorage._lpos.x,
                forestStorageToUnlock.x,
                `${fieldRoot._name} ${stage} unlock must use the forest X spacing`,
            );
            assertNear(
                unlockPoint._lpos.y - collectionStorage._lpos.y,
                forestStorageToUnlock.y,
                `${fieldRoot._name} ${stage} unlock must use the forest Y spacing`,
            );
            assertNear(
                unlockPoint._lpos.z - collectionStorage._lpos.z,
                forestStorageToUnlock.z,
                `${fieldRoot._name} ${stage} unlock must use the forest Z spacing`,
            );
            assert.deepEqual(
                unlockPoint._lscale,
                forestUnlockPoint._lscale,
                `${fieldRoot._name} ${stage} unlock must use the forest unlock scale`,
            );
        }
    }

    assert.notEqual(
        nodeAt(fieldSystem.leftCollectionStorage).node.__id__,
        nodeAt(fieldSystem.rightCollectionStorage).node.__id__,
        'left and right corn storage nodes must be independent scene objects',
    );
    assert.notEqual(
        fieldSystem.leftWorkerUnlockPoint.__id__,
        fieldSystem.rightWorkerUnlockPoint.__id__,
        'left and right corn unlock nodes must be independent scene objects',
    );

    assert.doesNotMatch(
        resourceFieldSource,
        /padNode\.setWorldPosition\(field\.openingPad\.worldPosition\)/,
        'runtime code must not move corn unlock icons back to the forest-side opening pad',
    );
    assert.doesNotMatch(
        resourceFieldSource,
        /visual\?\.setScale\(/,
        'runtime code must preserve the scene-authored forest unlock scale',
    );
});

test('corn storage uses the forest capacity and stack rules without sharing inventory', () => {
    const forestStorageNode = nodeNamed('woodStackArea');
    const forestStorage = forestStorageNode._components
        .map(nodeAt)
        .find(component => component && 'storageName' in component);
    assert.ok(forestStorage, 'forest StoragePoint component must exist');

    const storageProperties = [
        'capacity',
        'layers',
        'layerHeight',
        'resourcePerRow',
        'resourceRowSpacing',
        'resourcePerCol',
        'resourceColSpacing',
        'autoStack',
        'showCapacityInfo',
    ];

    const cornStorages = [
        nodeAt(fieldSystem.leftCollectionStorage),
        nodeAt(fieldSystem.rightCollectionStorage),
    ];
    for (const cornStorage of cornStorages) {
        for (const propertyName of storageProperties) {
            assert.equal(
                cornStorage[propertyName],
                forestStorage[propertyName],
                `${cornStorage.storageName} must match forest ${propertyName}`,
            );
        }
        assert.deepEqual(
            nodeAt(cornStorage.stackAreaNode)._lpos,
            nodeAt(forestStorage.stackAreaNode)._lpos,
            `${cornStorage.storageName} must use the forest stack anchor`,
        );
        assert.equal(cornStorage.capacity, 200, 'corn storage must stop accepting resources at 200');
    }

    assert.notEqual(cornStorages[0].node.__id__, cornStorages[1].node.__id__);
    assert.notEqual(cornStorages[0].storageName, cornStorages[1].storageName);
    assert.notEqual(cornStorages[0].node.__id__, forestStorage.node.__id__);

    const addToCollection = cornProductionSource.match(
        /private addToCollection[\s\S]*?\n    private createResourceVisual/,
    )?.[0] ?? '';
    assert.match(
        addToCollection,
        /if \(!this\.collectionStorage\.addResource\(item, 1\)\) \{\s*item\.destroy\(\);/,
        'overflow corn visuals must be recycled instead of accumulating outside a full storage',
    );
    assert.match(
        resourceFieldSource,
        /node\.getChildByName\('StackArea'\) \?\? node/,
        'corn storage must keep resources inside the authored stack area, not the board container',
    );
});

test('corn unlock pads consume the same mounted coin storage as forest pads', () => {
    assert.match(
        cornUnlockSource,
        /coinBackpackMount\?\.components\.find/,
        'corn unlock must read physical coins through the mounted coin-store interface',
    );
    assert.match(
        cornUnlockSource,
        /removeResourceWithAnimation\(this\.node\.worldPosition,\s*'parabola'\)/,
        'corn unlock must animate physical coins from the player stack to the pad',
    );
    assert.equal(
        fieldSystem.coinsPerTick,
        5,
        'one physical coin must contribute the same five points used by forest unlock pads',
    );
});

test('the first corn field stays playable and opening the second ends the game', () => {
    const revealMethod = resourceFieldSource.match(
        /private onFieldRevealCompleted[\s\S]*?\n    private createField/,
    )?.[0] ?? '';
    const completeMethod = resourceFieldSource.match(
        /private completeUnlockStage[\s\S]*?\n    private showUnlockStage/,
    )?.[0] ?? '';

    assert.match(
        revealMethod,
        /if \(this\._openedSideFields >= 2\) \{\s*this\.finishGame\(\);/,
        'the first corn field must stay playable and the second field reveal must end the game',
    );
    assert.doesNotMatch(
        completeMethod,
        /finishGame\(\)/,
        'purchasing a corn-field worker, vehicle, or hauler must not independently end the game',
    );
});

test('corn storage and unlock points activate before optional reveal decorations', () => {
    const cameraCompleteMethod = finishNodeSource.match(
        /private onCameraMoveComplete[\s\S]*?\n    private restoreGameplayAfterSequence/,
    )?.[0] ?? '';
    const notifyIndex = cameraCompleteMethod.indexOf('ResourceFieldSystem.notifyFieldRevealCompleted');
    const decorationIndex = cameraCompleteMethod.indexOf('tween(this.tableNode)');

    assert.ok(notifyIndex >= 0, 'camera reveal completion must notify ResourceFieldSystem');
    assert.ok(
        decorationIndex < 0 || notifyIndex < decorationIndex,
        'field storage and unlock points must activate before optional table decoration tweens',
    );
});
