import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(
    new URL(relativePath, import.meta.url),
    'utf8',
);

const fieldSource = read('../assets/_Scripts/ResourceFieldSystem.ts');
const customerSource = read('../assets/_Scripts/CornCustomerScheduler.ts');
const haulerSource = read('../assets/_Scripts/CornHauler.ts');
const haulerBackpackSource = read('../assets/_Scripts/CornHaulerBackpack.ts');
const scene = JSON.parse(read('../assets/Scenes/DevScene.scene'));
const sceneAt = reference => scene[reference.__id__];
const leftField = scene.find(entry => entry?.__type__ === 'cc.Node' && entry._name === 'Finish');
const rightField = scene.find(entry => entry?.__type__ === 'cc.Node' && entry._name === 'Finish-001');
const leftChild = name => leftField._children.map(sceneAt).find(child => child._name === name);
const rightChild = name => rightField._children.map(sceneAt).find(child => child._name === name);

test('sunflower keeps its authored uniform display scale when entering the sell slot', () => {
    const depositMethod = fieldSource.match(
        /private updatePlayerDeposit[\s\S]*?\n    private updateCornSellHighlight/,
    )?.[0] ?? '';

    assert.doesNotMatch(depositMethod, /item\.setScale\(1,\s*1,\s*1\)/);
    assert.match(depositMethod, /this\.restoreResourcePrefabScale\(item,\s*field\.resourcePrefab\)/);
    assert.match(fieldSource, /private restoreResourcePrefabScale\(resource: Node,\s*prefab: Prefab \| null\): void/);
});

test('sunflower keeps its authored uniform display scale in customer hands', () => {
    const purchaseMethod = customerSource.match(
        /private movePurchasedProductToCustomer[\s\S]*?\n    private delay/,
    )?.[0] ?? '';

    assert.doesNotMatch(purchaseMethod, /resource\.setScale\(Vec3\.ONE\)/);
    assert.match(purchaseMethod, /const preservedScale = resource\.scale\.clone\(\)/);
    assert.match(purchaseMethod, /resource\.setScale\(preservedScale\)/);
});

test('sunflower keeps its authored display scale while carried by the hauler', () => {
    assert.doesNotMatch(haulerSource, /resource\.setScale\(1,\s*1,\s*1\)/);
    assert.match(haulerSource, /this\.restoreResourcePrefabScale\(resource\)/);
    assert.match(
        haulerSource,
        /const authoredScale = this\.carryStorage\?\.resourcePrefab\?\.data\?\.scale \?\? Vec3\.ONE/,
    );
    assert.match(haulerSource, /resource\.setScale\(authoredScale\)/);
    assert.match(haulerBackpackSource, /this\.restoreAuthoredWorldScale\(resource,\s*stackArea\)/);
    assert.match(
        haulerBackpackSource,
        /authoredScale\.x \/ Math\.max\(Math\.abs\(parentScale\.x\), 0\.0001\)/,
    );
});

test('the sunflower Sell1 is authored visible and remains visible when its field is revealed', () => {
    const revealMethod = fieldSource.match(
        /private revealCornSellPresentation[\s\S]*?private createField/,
    )?.[0] ?? '';

    assert.match(revealMethod, /restoreCornVisualHierarchy\(sellNode\)/);
    assert.match(revealMethod, /sellNode\.active = true/);
    assert.match(revealMethod, /sellNode\.setScale\(1,\s*1,\s*1\)/);
    assert.match(revealMethod, /sellRenderer\.enabled = true/);
    assert.match(
        fieldSource,
        /this\.scheduleOnce\([\s\S]*?this\.revealCornSellPresentation\(field\)/,
    );

    const sellNode = rightChild('Sell1');
    assert.equal(sellNode._active, true, 'sunflower Sell1 must be visible directly from the scene');
    assert.deepEqual(sellNode._lscale, { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 });
});

test('sunflower money uses SM_ZhiWuTai007 and removes the legacy cash-table visual', () => {
    const coinPlace = rightChild('CoinPlace');
    const legacyVisual = coinPlace._children.map(sceneAt)
        .find(child => child._name === 'tubiao_02_chaopiao-001');
    const table = scene.find(entry =>
        entry?.__type__ === 'cc.Node'
        && entry._name === 'SM_ZhiWuTai007'
    );

    assert.equal(coinPlace._active, false);
    assert.equal(legacyVisual._active, false);
    assert.equal(coinPlace._lpos.x + rightField._lpos.x, table._lpos.x);
    assert.equal(coinPlace._lpos.z + rightField._lpos.z, table._lpos.z);
    assert.match(
        customerSource,
        /const tableName = moduleRoot\.name === 'Finish' \? 'SM_ZhiWuTai006' : 'SM_ZhiWuTai007'/,
    );
    assert.match(customerSource, /anchor\.name === 'SM_ZhiWuTai007'/);
    assert.match(customerSource, /dropArea\.setScale\(1 \/ scaleX,\s*1 \/ scaleY,\s*1 \/ scaleZ\)/);
});

test('strawberry Sell1 and money use SM_ZhiWuTai006 without the legacy cash table', () => {
    const sellNode = leftChild('Sell1');
    const coinPlace = leftChild('CoinPlace');
    const legacyVisual = coinPlace._children.map(sceneAt)
        .find(child => child._name === 'tubiao_02_chaopiao-001');
    const table = scene.find(entry =>
        entry?.__type__ === 'cc.Node'
        && entry._name === 'SM_ZhiWuTai006'
    );

    assert.equal(sellNode._active, true, 'left-field Sell1 must be visible directly from the scene');
    assert.deepEqual(sellNode._lscale, { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 });
    assert.equal(coinPlace._active, false);
    assert.equal(legacyVisual._active, false);
    assert.equal(coinPlace._lpos.x + leftField._lpos.x, table._lpos.x);
    assert.equal(coinPlace._lpos.z + leftField._lpos.z, table._lpos.z);
    assert.match(customerSource, /'SM_ZhiWuTai006'/);
    assert.match(customerSource, /this\.isCoinPresentationTable\(anchor\)/);
});
