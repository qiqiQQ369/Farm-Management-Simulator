import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));
const mapVisualPrefab = JSON.parse(readFileSync(
    new URL('../assets/Prefab/场景.prefab', import.meta.url),
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
const forestCoinConsumerSource = readFileSync(
    new URL('../assets/_Scripts/CoinConsumer.ts', import.meta.url),
    'utf8',
);
const forestPickupSource = readFileSync(
    new URL('../assets/_Scripts/PickupDetector.ts', import.meta.url),
    'utf8',
);
const finishNodeSource = readFileSync(
    new URL('../assets/_Scripts/FinishNode.ts', import.meta.url),
    'utf8',
);
const cornPickupPath = new URL('../assets/_Scripts/CornPickupDetector.ts', import.meta.url);
const cornPickupSource = existsSync(cornPickupPath)
    ? readFileSync(cornPickupPath, 'utf8')
    : '';
const multiResourceBackpackSource = readFileSync(
    new URL('../assets/_Scripts/MultiResourceBackpack.ts', import.meta.url),
    'utf8',
);

const nodeAt = (reference) => scene[reference.__id__];
const childrenOf = (node) => (node._children ?? []).map(nodeAt);
const childNamed = (node, name) => childrenOf(node).find((child) => child._name === name);
const nodeNamed = (name) => scene.find((entry) => entry?.__type__ === 'cc.Node' && entry._name === name);
const isDescendantOf = (node, ancestor) => {
    let current = node;
    while (current) {
        if (current === ancestor) return true;
        current = current._parent ? nodeAt(current._parent) : null;
    }
    return false;
};
const assertNear = (actual, expected, message) => assert.ok(
    Math.abs(actual - expected) < 0.001,
    `${message}: expected ${expected}, received ${actual}`,
);
const rootOverridesOf = (serialized, prefabNode) => {
    const prefabInfo = serialized[prefabNode._prefab.__id__];
    const instance = serialized[prefabInfo.instance.__id__];
    const overrides = (instance.propertyOverrides ?? []).map(reference => serialized[reference.__id__]);
    const nameOverride = overrides.find(override => override.propertyPath?.[0] === '_name');
    const rootTarget = JSON.stringify(serialized[nameOverride.targetInfo.__id__].localID);
    const valueAt = path => overrides.find((override) =>
        override.propertyPath?.[0] === path
        && JSON.stringify(serialized[override.targetInfo.__id__].localID) === rootTarget
    )?.value;
    return {
        assetUuid: prefabInfo.asset.__uuid__,
        name: nameOverride.value,
        position: valueAt('_lpos'),
        rotation: valueAt('_lrot'),
        scale: valueAt('_lscale'),
    };
};

const forestBoardInstance = mapVisualPrefab.find((entry) => {
    if (entry?.__type__ !== 'cc.Node' || !entry._prefab) return false;
    return mapVisualPrefab[entry._prefab.__id__]?.asset?.__uuid__
        === '602dfac6-7524-4034-83fa-af06e20e8337@71970';
});
assert.ok(forestBoardInstance, 'the map must expose the forest wood-board instance');
const forestBoardInfo = mapVisualPrefab[forestBoardInstance._prefab.__id__];
const forestBoardPrefabInstance = mapVisualPrefab[forestBoardInfo.instance.__id__];
const forestBoardOverrides = forestBoardPrefabInstance.propertyOverrides
    .map(reference => mapVisualPrefab[reference.__id__]);
const forestBoardRootName = forestBoardOverrides.find(override => override.propertyPath?.[0] === '_name');
const forestBoardRootTarget = JSON.stringify(
    mapVisualPrefab[forestBoardRootName.targetInfo.__id__].localID,
);
const forestBoardMeshPosition = forestBoardOverrides.find((override) =>
    override.propertyPath?.[0] === '_lpos'
    && JSON.stringify(mapVisualPrefab[override.targetInfo.__id__].localID) !== forestBoardRootTarget
)?.value;
assert.ok(forestBoardMeshPosition, 'the forest wood-board mesh position must be authored in the map');
const forestBoardPosition = {
    x: mapVisualPrefab[1]._lpos.x + forestBoardMeshPosition.x,
    y: mapVisualPrefab[1]._lpos.y + forestBoardMeshPosition.y,
    z: mapVisualPrefab[1]._lpos.z + forestBoardMeshPosition.z,
};
const forestBoardScale = {
    __type__: 'cc.Vec3',
    x: 0.009999999776482582,
    y: 0.009999999776482582,
    z: 0.009999999776482582,
};
const forestBoardRotation = {
    __type__: 'cc.Quat',
    x: 0,
    y: 0,
    z: 0,
    w: 1,
};
const forestBoardMeshUuid = '602dfac6-7524-4034-83fa-af06e20e8337@e2349';
const forestBoardMaterialUuid = '602dfac6-7524-4034-83fa-af06e20e8337@f8a20';

const cornDarkRegionCenters = mapVisualPrefab
    .filter((entry) => {
        if (entry?.__type__ !== 'cc.Node' || !entry._prefab) return false;
        return mapVisualPrefab[entry._prefab.__id__]?.asset?.__uuid__
            === '437556ad-49e6-446a-b1e8-27aba94f0efa@83ca4';
    })
    .map(entry => rootOverridesOf(mapVisualPrefab, entry))
    .filter(entry => entry.name.startsWith('解锁地暗'))
    .map(entry => entry.position)
    .sort((left, right) => left.x - right.x);
assert.equal(cornDarkRegionCenters.length, 2, 'the map must expose two corn dark regions');

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

test('corn storage board and unlock nodes use the forest layout inside each dark corn region', () => {
    const forestStorage = nodeNamed('woodStackArea');
    const forestUnlockPoints = {
        Worker: nodeNamed('unlockLevel1'),
        Vehicle: nodeNamed('unlockLevel2'),
        Hauler: nodeNamed('unlockLevel3'),
    };
    assert.ok(forestStorage, 'forest storage point must exist');
    for (const unlockPoint of Object.values(forestUnlockPoints)) {
        assert.ok(unlockPoint, 'every forest unlock point must exist');
    }

    for (const [index, [fieldRootRef, openingPadRef, , collectionStorageRef]] of unlockBindings.entries()) {
        const fieldRoot = nodeAt(fieldRootRef);
        const openingPad = nodeAt(openingPadRef);
        const collectionStorageComponent = nodeAt(collectionStorageRef);
        const collectionStorage = nodeAt(collectionStorageComponent.node);
        const collectionStack = childNamed(collectionStorage, 'StackArea');
        const openingLocalX = openingPad._lpos.x - fieldRoot._lpos.x;
        const storageBoard = childNamed(fieldRoot, 'CornStorageBoard');
        const darkRegionCenter = cornDarkRegionCenters[index];
        const worldTranslation = {
            x: darkRegionCenter.x,
            z: darkRegionCenter.z,
        };

        assert.equal(
            collectionStorage._name,
            'CornStorageArea',
            `${fieldRoot._name} must expose an authored corn storage node in Creator`,
        );
        assert.ok(collectionStack, `${fieldRoot._name} collection storage must expose StackArea`);
        assert.equal(
            collectionStack._parent.__id__,
            collectionStorageComponent.node.__id__,
            `${fieldRoot._name} StackArea must remain parented to its collection storage`,
        );
        assert.ok(storageBoard, `${fieldRoot._name} must expose a permanent corn storage board in Creator`);
        assert.equal(storageBoard._active, true, `${fieldRoot._name} storage board must stay visible before storage activation`);
        assert.deepEqual(collectionStorage._lscale, forestStorage._lscale);
        assertNear(collectionStorage._lpos.y, forestStorage._lpos.y, `${fieldRoot._name} storage height`);
        assertNear(
            storageBoard._lpos.x + fieldRoot._lpos.x,
            forestBoardPosition.x + worldTranslation.x,
            `${fieldRoot._name} board X must follow the dark-region layout origin`,
        );
        assertNear(
            storageBoard._lpos.y + fieldRoot._lpos.y,
            forestBoardPosition.y,
            `${fieldRoot._name} board Y must match the forest board`,
        );
        assertNear(
            storageBoard._lpos.z + fieldRoot._lpos.z,
            forestBoardPosition.z + worldTranslation.z,
            `${fieldRoot._name} board Z must follow the dark-region layout origin`,
        );
        assert.deepEqual(storageBoard._lrot, forestBoardRotation);
        assert.deepEqual(storageBoard._lscale, forestBoardScale);
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
        assert.equal(
            nodeAt(storageBoard._components[0])._mesh.__uuid__,
            forestBoardMeshUuid,
            `${fieldRoot._name} storage board must use the forest plank mesh, not the loose-log mesh`,
        );
        assert.equal(
            nodeAt(storageBoard._components[0])._materials[0].__uuid__,
            forestBoardMaterialUuid,
            `${fieldRoot._name} storage board must use the forest plank material`,
        );

        for (const axis of ['x', 'z']) {
            assertNear(
                collectionStorage._lpos[axis] + fieldRoot._lpos[axis],
                forestStorage._lpos[axis] + worldTranslation[axis],
                `${fieldRoot._name} storage ${axis.toUpperCase()} must stay inside its dark region`,
            );
        }

        assert.ok(
            collectionStorage._lpos.x < openingLocalX - 1,
            `${fieldRoot._name} collection storage must be inside the corn field, not in the forest`,
        );

        for (const stage of ['Worker', 'Vehicle', 'Hauler']) {
            const unlockPoint = nodeAt(fieldSystem[`${fieldRootRef === fieldSystem.leftFieldRoot ? 'left' : 'right'}${stage}UnlockPoint`]);
            const forestUnlockPoint = forestUnlockPoints[stage];
            const unlockVisual = rootOverridesOf(scene, nodeAt(unlockPoint._children[0]));
            const forestUnlockVisual = rootOverridesOf(scene, nodeAt(forestUnlockPoint._children[0]));
            const forestStorageToUnlock = {
                x: forestUnlockPoint._lpos.x - forestStorage._lpos.x,
                y: forestUnlockPoint._lpos.y - forestStorage._lpos.y,
                z: forestUnlockPoint._lpos.z - forestStorage._lpos.z,
            };

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
            assert.deepEqual(
                unlockVisual.position,
                forestUnlockVisual.position,
                `${fieldRoot._name} ${stage} visual must use the forest visual offset`,
            );
            const expectedVisualScale = stage === 'Worker'
                ? forestUnlockVisual.scale
                : {
                    __type__: 'cc.Vec3',
                    x: forestUnlockVisual.scale.y,
                    y: forestUnlockVisual.scale.y,
                    z: forestUnlockVisual.scale.y,
                };
            assert.deepEqual(
                unlockVisual.scale,
                expectedVisualScale,
                `${fieldRoot._name} ${stage} visual must use the forest visible scale`,
            );
            for (const axis of ['x', 'z']) {
                assertNear(
                    unlockPoint._lpos[axis] + fieldRoot._lpos[axis],
                    forestUnlockPoint._lpos[axis] + worldTranslation[axis],
                    `${fieldRoot._name} ${stage} ${axis.toUpperCase()} must stay inside its dark region`,
                );
            }
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
        /visual\?\.setPosition\(Vec3\.ZERO\)/,
        'runtime code must preserve the scene-authored forest unlock visual offset',
    );
    assert.match(
        resourceFieldSource,
        /const visualScale = stage === 'worker' \? 0\.9 : 0\.72/,
        'runtime entrance animation must end at the matching forest visual scale',
    );
});

test('corn storage collider stays active before field unlock and mirrors the forest blocker', () => {
    const forestStorage = nodeNamed('woodStackArea');
    const forestSolidCollider = forestStorage?._components
        ?.map(nodeAt)
        .find((component) => component.__type__ === 'cc.BoxCollider' && !component._isTrigger);
    const configureCollectionPickup = resourceFieldSource.match(
        /private configureCollectionPickup[\s\S]*?\n    private ensureSellStorage/,
    )?.[0] ?? '';
    const createField = resourceFieldSource.match(
        /private createField\([\s\S]*?\n    private configureStorage/,
    )?.[0] ?? '';

    assert.ok(forestSolidCollider, 'forest storage must expose a non-trigger blocking collider');
    assert.deepEqual(
        { x: forestSolidCollider._size.x, y: forestSolidCollider._size.y, z: forestSolidCollider._size.z },
        { x: 1.8, y: 1, z: 1.6 },
    );
    assert.doesNotMatch(resourceFieldSource, /configureStorageBoardCollider/);
    assert.match(configureCollectionPickup, /collectionStorage\.node\.getComponents\(BoxCollider\)/);
    assert.match(configureCollectionPickup, /solidCollider\.isTrigger = false/);
    assert.match(configureCollectionPickup, /solidCollider\.center\.set\(0, 0, 0\)/);
    assert.match(configureCollectionPickup, /solidCollider\.size\.set\(1\.8, 1, 1\.6\)/);
    assert.match(configureCollectionPickup, /solidCollider\.enabled = true/);
    assert.doesNotMatch(configureCollectionPickup, /RigidBody|ERigidBodyType/);
    assert.match(createField, /collectionStorage\.node\.active = true/);
    assert.doesNotMatch(createField, /collectionStorage\.node\.active = false/);

    for (const [fieldRootRef, , , collectionStorageRef] of unlockBindings) {
        const collectionStorageComponent = nodeAt(collectionStorageRef);
        const collectionStorageNode = nodeAt(collectionStorageComponent.node);
        const colliders = collectionStorageNode._components
            .map(nodeAt)
            .filter(component => component.__type__ === 'cc.BoxCollider');
        const triggerCollider = colliders.find(component => component._isTrigger);
        const blockingCollider = colliders.find(component => !component._isTrigger);

        assert.ok(triggerCollider, `${nodeAt(fieldRootRef)._name} must author the forest pickup trigger`);
        assert.ok(blockingCollider, `${nodeAt(fieldRootRef)._name} must author the forest blocking collider`);
        assert.equal(collectionStorageNode._active, true, `${nodeAt(fieldRootRef)._name} blocker must be active before unlock`);
        assert.deepEqual(triggerCollider._center, forestStorage._components.map(nodeAt)
            .find(component => component.__type__ === 'cc.BoxCollider' && component._isTrigger)._center);
        assert.deepEqual(triggerCollider._size, forestStorage._components.map(nodeAt)
            .find(component => component.__type__ === 'cc.BoxCollider' && component._isTrigger)._size);
        assert.deepEqual(blockingCollider._center, forestSolidCollider._center);
        assert.deepEqual(blockingCollider._size, forestSolidCollider._size);
    }
});

test('corn storage applies a post-movement barrier when inactive storage physics cannot block reliably', () => {
    const updateMethod = resourceFieldSource.match(
        /protected update\(deltaTime: number\)[\s\S]*?\n    protected onDestroy/,
    )?.[0] ?? '';
    const barrierMethod = resourceFieldSource.match(
        /private keepPlayerOutsideCollectionStorage[\s\S]*?\n    private createField/,
    )?.[0] ?? '';

    assert.match(resourceFieldSource, /const \{ ccclass, property, executionOrder \} = _decorator/);
    assert.match(resourceFieldSource, /@executionOrder\(50\)/);
    assert.match(updateMethod, /this\.keepPlayerOutsideCollectionStorage\(field\)/);
    assert.match(barrierMethod, /field\.collectionStorage\.node\.activeInHierarchy/);
    assert.match(barrierMethod, /getComponent\(CapsuleCollider\)\?\.radius \?\? 0\.25/);
    assert.match(barrierMethod, /const halfX = Math\.abs\(storageScale\.x\) \* 0\.9 \+ playerRadius/);
    assert.match(barrierMethod, /const halfZ = Math\.abs\(storageScale\.z\) \* 0\.8 \+ playerRadius/);
    assert.match(barrierMethod, /this\._player\.setWorldPosition\(correctedPosition\)/);
    assert.match(barrierMethod, /rigidBody\.setLinearVelocity\(velocity\)/);
});

test('corn unlock interaction distance follows the displayed unlock visual', () => {
    const showUnlockStage = resourceFieldSource.match(
        /private showUnlockStage[\s\S]*?\n    private resolveUnlockVisual/,
    )?.[0] ?? '';

    assert.match(
        showUnlockStage,
        /interactionNode: visual \?\? padNode/,
        'the unlock component must receive the displayed visual as its interaction node',
    );
    assert.match(
        cornUnlockSource,
        /interactionNode: Node/,
    );
    assert.match(cornUnlockSource, /this\._interactionNode = config\.interactionNode/);
    assert.match(
        cornUnlockSource,
        /this\._interactionNode\?\.worldPosition \?\? this\.node\.worldPosition/,
    );
    assert.doesNotMatch(
        cornUnlockSource,
        /Vec3\.distance\(this\._player\.worldPosition, this\.node\.worldPosition\)/,
    );
});

test('corn unlock pad contents keep the forest layout at the corn ground height', () => {
    const alignUnlockVisual = resourceFieldSource.match(
        /private alignUnlockVisualToCornGround[\s\S]*?\n    private resolveUnlockVisual/,
    )?.[0] ?? '';

    assert.match(
        resourceFieldSource,
        /this\.alignUnlockVisualToCornGround\(field, visual\)/,
        'each displayed corn unlock pad must use the forest layout at its own ground height',
    );
    assert.match(alignUnlockVisual, /visual\.getChildByName\('icon'\)/);
    assert.match(alignUnlockVisual, /iconGroup\.setPosition\(0, 0, 0\.088\)/);
    assert.match(alignUnlockVisual, /iconGroup\.setScale\(1\.6, 1\.6, 1\.6\)/);
    assert.match(alignUnlockVisual, /const groundHeight = field\.collectionStorage\.node\.worldPosition\.y/);
    assert.match(alignUnlockVisual, /iconWorldPosition\.y = groundHeight/);
    assert.match(alignUnlockVisual, /iconGroup\.setWorldPosition\(iconWorldPosition\)/);
    assert.doesNotMatch(alignUnlockVisual, /-0\.509/);
    assert.doesNotMatch(
        resourceFieldSource,
        /configureUnlockPadCollider/,
        'the step-on unlock pad must stay traversable like the forest pad',
    );
});

test('corn field reveal preserves its entry camera angle without changing internal unlock cameras', () => {
    const cameraMoveMethod = finishNodeSource.match(
        /private executeCameraMove[\s\S]*?\n    private onCameraMoveComplete/,
    )?.[0] ?? '';

    assert.match(cameraMoveMethod, /const preservedRotation = this\.camera\.node\.worldRotation\.clone\(\)/);
    assert.match(cameraMoveMethod, /this\.camera\.node\.setWorldRotation\(preservedRotation\)/);
    assert.match(cameraMoveMethod, /const fieldCenter = this\.getUnlockFieldCenter\(\)/);
    assert.match(cameraMoveMethod, /const cameraForward = this\.camera\.node\.forward\.clone\(\)/);
    assert.match(cameraMoveMethod, /const cameraController = this\.camera\.getComponent\(CameraController\)/);
    assert.match(cameraMoveMethod, /const focusDistance = cameraController\?\.followDistance/);
    assert.match(cameraMoveMethod, /Vec3\.scaleAndAdd\(endPosition, fieldCenter, cameraForward, -focusDistance\)/);
    assert.match(cameraMoveMethod, /Vec3\.subtract\(authoredMovement, this\.cameraEndPoint\.worldPosition, this\.cameraStartPoint\.worldPosition\)/);
    assert.match(cameraMoveMethod, /const forwardMovement = Vec3\.dot\(authoredMovement, cameraForward\)/);
    assert.match(cameraMoveMethod, /Vec3\.scaleAndAdd\(panMovement, authoredMovement, cameraForward, -forwardMovement\)/);
    assert.match(finishNodeSource, /public cornRevealPanScale(?:\s*:\s*number)?\s*=\s*0\.6/);
    assert.match(cameraMoveMethod, /Vec3\.multiplyScalar\(panMovement, panMovement, this\.cornRevealPanScale\)/);
    assert.match(cameraMoveMethod, /Vec3\.subtract\(startPosition, endPosition, panMovement\)/);
    assert.match(cameraMoveMethod, /this\.camera\.node\.setWorldPosition\(startPosition\)/);
    assert.match(cameraMoveMethod, /position: endPosition/);
    assert.doesNotMatch(cameraMoveMethod, /Vec3\.distance\(this\.cameraEndPoint\.worldPosition, fieldCenter\)/);
    assert.doesNotMatch(cameraMoveMethod, /rotation:|\.lookAt\(/);
    assert.doesNotMatch(resourceFieldSource, /playUnlockCameraFocus|maintainUnlockCameraAngle/);
    assert.match(resourceFieldSource, /cameraController\.target = focusWorker/);
    assert.match(resourceFieldSource, /cameraController\.target = field\.vehicle\.node/);
    assert.match(resourceFieldSource, /cameraController\.target = field\.hauler/);

    const revealComponents = scene.filter((entry) =>
        entry?.cameraStartPoint && entry?.cameraEndPoint && Array.isArray(entry?.targetNodes),
    );
    assert.equal(revealComponents.length, 2, 'left and right corn fields need separate reveal controllers');
    const fieldRoots = new Set();
    for (const reveal of revealComponents) {
        const controllerNode = nodeAt(reveal.node);
        const fieldRoot = nodeAt(controllerNode._parent);
        const focusField = nodeAt(reveal.targetNodes[0]);
        assert.ok(
            isDescendantOf(focusField, fieldRoot),
            `${fieldRoot._name} reveal must calculate focus from its own corn field`,
        );
        fieldRoots.add(fieldRoot);
    }
    assert.equal(fieldRoots.size, 2, 'left and right reveals must not share one field center');
});

test('corn field reveal only translates the camera without changing its view size', () => {
    const cameraMoveMethod = finishNodeSource.match(
        /private executeCameraMove[\s\S]*?\n    private onCameraMoveComplete/,
    )?.[0] ?? '';

    assert.match(cameraMoveMethod, /tween\(this\.camera\.node\)/);
    assert.match(cameraMoveMethod, /position: endPosition/);
    assert.doesNotMatch(cameraMoveMethod, /orthoHeight|\.fov\s*=|tween\(this\.camera\)/);
    assert.doesNotMatch(finishNodeSource, /cornRevealOrthoHeight|_cameraOriginalOrthoHeight/);
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
        /removeResourceWithAnimation\(interactionWorldPosition,\s*'parabola'\)/,
        'corn unlock must animate physical coins from the player stack to the displayed pad',
    );
    assert.equal(
        fieldSystem.coinsPerTick,
        5,
        'one physical coin must contribute the same five points used by forest unlock pads',
    );
});

test('corn unlock pads fill at the same per-coin cadence as forest unlock pads', () => {
    const forestCoinDelay = Number(
        forestCoinConsumerSource.match(
            /await new Promise\(resolve => setTimeout\(resolve, (\d+)\)\)/,
        )?.[1],
    );
    assert.equal(forestCoinDelay, 100, 'forest unlocks must transfer one physical coin every 100 ms');

    const expectedInterval = forestCoinDelay / 1000;
    assert.equal(
        fieldSystem.consumeInterval,
        expectedInterval,
        'corn unlocks must use the same per-coin fill interval as forest unlocks',
    );
    assert.match(cornUnlockSource, /public consumeInterval = 0\.1;/);
    assert.match(resourceFieldSource, /public consumeInterval = 0\.1;/);
    assert.match(cornUnlockSource, /scheduleOnce\(resolve, 0\.1\)/);
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
        /this\.revealCornSellPresentation\(field\)/,
        'corn fields must restore Sell1/CoinPlace unit scale before customer purchases',
    );
    assert.match(
        resourceFieldSource,
        /sellNode\.setScale\(1, 1, 1\)/,
        'collapsed corn Sell1 must expand to unit scale for product body display',
    );
    assert.match(
        resourceFieldSource,
        /item\.setScale\(1, 1, 1\)/,
        'corn products deposited into sell storage must use unit local scale',
    );

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

test('corn products use the sell storage node as their stack anchor like forest wood', () => {
    const ensureSellStorage = resourceFieldSource.match(
        /private ensureSellStorage[\s\S]*?\n    private finishGame/,
    )?.[0] ?? '';

    assert.match(ensureSellStorage, /storage\.stackAreaNode = storageNode/);
    assert.doesNotMatch(ensureSellStorage, /CornSellStack|stackArea\.setPosition/);
    assert.doesNotMatch(ensureSellStorage, /calculateStackPosition/);
});

test('corn collection storage independently mirrors forest player pickup behavior', () => {
    const forestCollectionInterval = scene.find((entry) =>
        entry?.__type__ === 'f7468Jhw5ZPE4Y8K1TE0aLr'
        && nodeAt(entry.node)?._name === 'woodStackArea',
    )?.collectionInterval;
    const forestIntervalMultiplier = Number(
        forestPickupSource.match(/this\.collectionInterval \* (\d+)/)?.[1],
    );
    const expectedCornCollectionInterval = forestCollectionInterval * forestIntervalMultiplier / 1000;

    assert.equal(forestCollectionInterval, 0.1, 'forest collection scene interval must remain 0.1 seconds');
    assert.equal(forestIntervalMultiplier, 500, 'forest pickup converts its interval to milliseconds');
    assert.equal(expectedCornCollectionInterval, 0.05, 'forest storage pickup cadence is 50 ms');
    assert.ok(existsSync(cornPickupPath), 'corn collection storage needs its own pickup component');
    assert.match(resourceFieldSource, /import \{ CornPickupDetector \} from '\.\/CornPickupDetector'/);
    assert.match(resourceFieldSource, /collectionStorage\.node\.getComponent\(CornPickupDetector\)/);
    assert.match(resourceFieldSource, /pickupDetector\.configure\(\{/);
    assert.match(resourceFieldSource, /collectionInterval:\s*0\.05/);
    assert.match(cornPickupSource, /public collectionInterval = 0\.05;/);
    const pickupAnimation = multiResourceBackpackSource.match(
        /private playPickupTransferAnimation[\s\S]*?\n    public takeResource/,
    )?.[0] ?? '';
    assert.match(pickupAnimation, /Vec3\.lerp\(controlPoint, startPosition, targetPosition, 0\.5\)/);
    assert.match(pickupAnimation, /controlPoint\.y \+= Math\.max\(1\.5, distance \* 0\.6\)/);
    assert.match(pickupAnimation, /\.to\(0\.15, \{ position: controlPoint, eulerAngles: halfRotation \}, \{ easing: 'sineOut' \}\)/);
    assert.match(pickupAnimation, /\.to\(0\.15, \{ position: targetPosition, eulerAngles: Vec3\.ZERO \}, \{ easing: 'sineIn' \}\)/);
    assert.match(pickupAnimation, /\.to\(0\.1, \{ scale: raisedScale \}, \{ easing: 'bounceOut' \}\)/);
    assert.match(pickupAnimation, /\.to\(0\.2, \{ scale: originalScale \}, \{ easing: 'bounceOut' \}\)/);
    assert.match(resourceFieldSource, /BoxCollider/);
    assert.match(cornPickupSource, /onTriggerEnter/);
    assert.match(cornPickupSource, /onTriggerExit/);
    assert.match(cornPickupSource, /this\.collectionStorage\.removeResource\(4\)/);
    assert.match(cornPickupSource, /this\.backpack\.addResource\(this\.resourceId, sourceWorldPosition\)/);
    assert.doesNotMatch(
        cornPickupSource,
        /from '\.\/PickupDetector'|from '\.\/Resource\/StoragePoint'|WoodBackpack/,
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
