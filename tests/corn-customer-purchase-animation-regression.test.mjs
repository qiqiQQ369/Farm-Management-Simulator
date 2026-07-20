import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const scriptUrl = new URL('../assets/_Scripts/CornCustomerScheduler.ts', import.meta.url);
const cornCollectorUrl = new URL('../assets/_Scripts/CornCoinCollector.ts', import.meta.url);
const scene = JSON.parse(readFileSync(
    new URL('../assets/Scenes/DevScene.scene', import.meta.url),
    'utf8',
));
const cornStorageSource = readFileSync(
    new URL('../assets/_Scripts/CornStoragePoint.ts', import.meta.url),
    'utf8',
);
const resourceFieldSource = readFileSync(
    new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
    'utf8',
);

const forestSchedulerType = '02bb1EDDzpPP62dqNJ8NH/n';
const forestStorageType = '42deanWpudHU7d3CW249VLG';
const cornStorageType = '548f0yQrgFOlZ7XOImfQyZC';
const nodeAt = (reference) => scene[reference.__id__];
const childrenOf = (node) => (node?._children ?? []).map(nodeAt);
const childNamed = (node, name) => childrenOf(node).find((child) => child?._name === name);
const componentOf = (node) => nodeAt(node._components[0]);

test('玉米顾客使用独立调度器且只读取所属玉米田的 Sell1', () => {
    assert.ok(existsSync(scriptUrl), 'CornCustomerScheduler.ts must exist');
    const source = readFileSync(scriptUrl, 'utf8');

    assert.match(source, /@ccclass\('CornCustomerScheduler'\)/);
    assert.match(source, /import\s*\{\s*CornStoragePoint\s*\}\s*from\s*'\.\/CornStoragePoint'/);
    assert.doesNotMatch(source, /from\s*'\.\/NPCScheduler'/);
    assert.doesNotMatch(source, /from\s*'\.\/Resource\/StoragePoint'/);
    assert.doesNotMatch(source, /from\s*'\.\/Resource\/ResourceManager'/);
    assert.doesNotMatch(source, /from\s*'\.\/WoodBackpack'/);

    const resolveMethod = source.match(
        /private resolveSellAnchor[\s\S]*?\n    private resolveModuleRoot/,
    )?.[0] ?? '';
    assert.match(resolveMethod, /moduleRoot\.name === 'Finish' \|\| moduleRoot\.name === 'Finish-001'/);
    assert.match(resolveMethod, /moduleRoot\.getChildByName\('Sell1'\)/);
    assert.doesNotMatch(resolveMethod, /LandObj|centralSell|closestAnchor|new Node/);
    assert.match(source, /getComponent\(CornStoragePoint\)/);
});

test('玉米顾客买满四个玉米后生成三枚金币', () => {
    const source = readFileSync(scriptUrl, 'utf8');
    const collectMethod = source.match(
        /private async tryCollectItem[\s\S]*?\n    private getNpcEmoji/,
    )?.[0] ?? '';
    const dropMethod = source.match(
        /private dropCoins[\s\S]*?\n    private createCoin/,
    )?.[0] ?? '';

    assert.match(source, /coinReward:\s*number\s*=\s*3/);
    assert.match(collectMethod, /capacity\s*=\s*4|capacity:\s*4/);
    assert.match(collectMethod, /removeResource\(4\)/);
    assert.match(collectMethod, /addResource\(resource,\s*4,\s*Vec3\.ZERO\)/);
    assert.match(collectMethod, /this\.dropCoins\(\)/);
    assert.match(dropMethod, /for\s*\(let i = 0; i < this\.coinReward; i\+\+\)/);
    assert.match(dropMethod, /i \* 0\.1/);
    assert.match(dropMethod, /const coinStorage = this\.ensureLocalCoinDropArea\(\)/);
    assert.match(dropMethod, /coinStorage\.hasSpace\(1\)/);
    assert.match(dropMethod, /this\.createCoin\(coinStorage\)/);
    assert.doesNotMatch(dropMethod, /coinStorage\.amount\+\+/);
});

test('CornStoragePoint 独立实现四种入槽动画', () => {
    for (const animationType of [1, 2, 3, 4]) {
        assert.match(
            cornStorageSource,
            new RegExp(`animationType === ${animationType}`),
            `animation type ${animationType} must have an independent branch`,
        );
    }
    assert.doesNotMatch(cornStorageSource, /ResourceManager|Resource\/StoragePoint/);
    assert.match(cornStorageSource, /heightPosition\.y \+= 3/);
    assert.match(cornStorageSource, /easing:\s*'bounceOut'/);
    assert.match(cornStorageSource, /controlPoint\.y \+= Math\.max\(1\.5, distance \* 0\.6\)/);

    const transferBranch = cornStorageSource.match(
        /if \(animationType === 4\)[\s\S]*?\n        } else/,
    )?.[0] ?? '';
    assert.match(transferBranch, /current\.canMove = true/);
    assert.ok(
        transferBranch.indexOf('current.canMove = true') > transferBranch.indexOf('.call('),
        'type 4 resource must unlock only in the completion callback',
    );
    assert.match(resourceFieldSource, /sellStorage\.addResource\(item,\s*2\)/);
});

test('场景中仅玉米区迁移为 CornCustomerScheduler 且奖励为三枚金币', () => {
    const cornRoots = ['Finish', 'Finish-001'].map((name) =>
        scene.find((entry) => entry?.__type__ === 'cc.Node' && entry._name === name),
    );

    for (const root of cornRoots) {
        assert.ok(root, 'corn field root must exist');
        const schedulerNode = childNamed(root, 'NPCScheduler-001');
        assert.ok(schedulerNode, `${root._name} scheduler node must exist`);
        const scheduler = componentOf(schedulerNode);
        assert.notEqual(scheduler.__type__, forestSchedulerType);
        assert.equal(scheduler.coinReward, 3);
        for (const npcReference of scheduler.npcs) {
            const npc = nodeAt(npcReference);
            const carryNode = childrenOf(npc).find((child) => child?._name === 'StoragePoint');
            assert.ok(carryNode, `${npc._name} carry node must exist`);
            const carryStorage = componentOf(carryNode);
            assert.equal(carryStorage.__type__, cornStorageType);
            assert.notEqual(carryStorage.__type__, forestStorageType);
            assert.equal(carryStorage.capacity, 4);
        }
    }

    const forestNode = scene.find((entry) =>
        entry?.__type__ === 'cc.Node' && entry._name === 'NPCScheduler' && entry._active,
    );
    assert.ok(forestNode, 'central forest scheduler must exist');
    assert.equal(componentOf(forestNode).__type__, forestSchedulerType);
});

test('左右玉米顾客只把金币生成到所属玉米区', () => {
    const cornRoots = ['Finish', 'Finish-001'].map((name) =>
        scene.find((entry) => entry?.__type__ === 'cc.Node' && entry._name === name),
    );

    for (const root of cornRoots) {
        assert.ok(root, 'corn field root must exist');
        const schedulerNode = childNamed(root, 'NPCScheduler-001');
        const scheduler = componentOf(schedulerNode);
        const coinAnchor = nodeAt(scheduler.coinDropArea);
        assert.equal(nodeAt(coinAnchor._parent), root);
        assert.equal(coinAnchor._name, 'CoinPlace');
    }

    const [leftScheduler, rightScheduler] = cornRoots.map((root) =>
        componentOf(childNamed(root, 'NPCScheduler-001')),
    );
    assert.notEqual(leftScheduler.coinDropArea.__id__, rightScheduler.coinDropArea.__id__);

    const forestNode = scene.find((entry) =>
        entry?.__type__ === 'cc.Node' && entry._name === 'NPCScheduler' && entry._active,
    );
    assert.equal(componentOf(forestNode).coinDropArea.__id__, 170);
});

test('玉米金币使用独立库存和收集逻辑', () => {
    assert.ok(existsSync(cornCollectorUrl), 'CornCoinCollector.ts must exist');
    const collectorSource = readFileSync(cornCollectorUrl, 'utf8');
    const schedulerSource = readFileSync(scriptUrl, 'utf8');

    assert.match(collectorSource, /@ccclass\('CornCoinCollector'\)/);
    assert.doesNotMatch(collectorSource, /from\s*'\.\/CoinCollector'/);
    assert.doesNotMatch(collectorSource, /Resource\/StoragePoint|ResourceManager/);
    assert.match(collectorSource, /sourceStorage\.removeResource\(4\)/);
    assert.match(collectorSource, /currentAmount \+ 5/);

    assert.match(schedulerSource, /storage\.capacity = 54/);
    assert.match(schedulerSource, /dropArea\.addComponent\(CornCoinCollector\)/);
    assert.match(schedulerSource, /storage\.addResource\(coin, 1\)/);
});

test('玉米金币堆对齐本地白色底板中心', () => {
    const schedulerSource = readFileSync(scriptUrl, 'utf8');
    const coinAreaMethod = schedulerSource.match(
        /private ensureLocalCoinDropArea[\s\S]*?\n    private resolveSellStoragePoint/,
    )?.[0] ?? '';

    assert.match(coinAreaMethod, /const visualCenter = this\.resolveCoinVisualCenter\(anchor\)/);
    assert.match(
        coinAreaMethod,
        /dropArea\.setPosition\(visualCenter\.x - 0\.017, 0\.03, visualCenter\.z \+ 0\.086\)/,
    );
    assert.match(coinAreaMethod, /stackArea\.setPosition\(0\.5, 0, 0\)/);
});
