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
    assert.match(collectMethod, /this\.movePurchasedProductToCustomer\(/);
    assert.match(source, /resource\.setScale\(Vec3\.ONE\)/);
    assert.match(source, /npcStoragePoint\.addResource\(resource, 4, Vec3\.ZERO\)/);
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

test('玉米入出售槽的动画完成前不可被顾客购买', () => {
    const addResourceMethod = cornStorageSource.match(
        /public addResource[\s\S]*?\n    public removeResource/,
    )?.[0] ?? '';

    assert.match(
        addResourceMethod,
        /canMove: animationType < 1 \|\| animationType > 4/,
        'animated corn must stay locked until its sell-slot tween completes',
    );
    for (const animationType of [1, 2, 3, 4]) {
        const branchPrefix = animationType === 1 ? 'if' : 'else if';
        const branch = addResourceMethod.match(
            new RegExp(`${branchPrefix} \\(animationType === ${animationType}\\)[\\s\\S]*?(?=else if \\(animationType ===|else \\{|return true;)`),
        )?.[0] ?? '';
        assert.match(
            branch,
            /current\.canMove = true/,
            `animation type ${animationType} must unlock only after its tween completes`,
        );
    }
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

test('玉米顾客购买后的背负位置和堆叠间距与森林顾客一致', () => {
    const forestSchedulerNode = scene.find((entry) =>
        entry?.__type__ === 'cc.Node' && entry._name === 'NPCScheduler' && entry._active,
    );
    assert.ok(forestSchedulerNode, 'central forest scheduler must exist');
    const forestScheduler = componentOf(forestSchedulerNode);
    const forestNpc = nodeAt(forestScheduler.npcs[0]);
    const forestCarryNode = childNamed(forestNpc, 'StoragePoint');
    const forestCarryStorage = componentOf(forestCarryNode);
    const layoutProperties = [
        'layers',
        'layerHeight',
        'resourcePerRow',
        'resourceRowSpacing',
        'resourcePerCol',
        'resourceColSpacing',
    ];

    for (const rootName of ['Finish', 'Finish-001']) {
        const root = scene.find((entry) => entry?.__type__ === 'cc.Node' && entry._name === rootName);
        const scheduler = componentOf(childNamed(root, 'NPCScheduler-001'));
        for (const npcReference of scheduler.npcs) {
            const npc = nodeAt(npcReference);
            const carryNode = childNamed(npc, 'StoragePoint');
            const carryStorage = componentOf(carryNode);
            assert.deepEqual(carryNode._lpos, forestCarryNode._lpos, `${rootName}/${npc._name} carry position`);
            assert.deepEqual(carryNode._lrot, forestCarryNode._lrot, `${rootName}/${npc._name} carry rotation`);
            assert.deepEqual(carryNode._lscale, forestCarryNode._lscale, `${rootName}/${npc._name} carry scale`);
            for (const property of layoutProperties) {
                assert.equal(
                    carryStorage[property],
                    forestCarryStorage[property],
                    `${rootName}/${npc._name} ${property}`,
                );
            }
        }
    }

    const source = readFileSync(scriptUrl, 'utf8');
    const ensureCarryStorage = source.match(
        /private ensureNpcCarryStorage[\s\S]*?\n    private findStorageLikeInNode/,
    )?.[0] ?? '';
    assert.match(source, /private configureNpcCarryLayout/);
    assert.match(ensureCarryStorage, /this\.configureNpcCarryLayout\(existing\)/);
    assert.match(ensureCarryStorage, /this\.configureNpcCarryLayout\(storage\)/);
});

test('玉米顾客购买完成后显示与森林顾客相同的完成提示', () => {
    const forestSchedulerNode = scene.find((entry) =>
        entry?.__type__ === 'cc.Node' && entry._name === 'NPCScheduler' && entry._active,
    );
    const forestScheduler = componentOf(forestSchedulerNode);
    const forestNpc = nodeAt(forestScheduler.npcs[0]);
    const forestEmoji = childNamed(forestNpc, 'emoji');
    const forestEmojiSprite = forestEmoji._components
        .map(nodeAt)
        .find(component => component.__type__ === 'cc.Sprite');
    assert.ok(forestEmojiSprite?._spriteFrame?.__uuid__, 'forest completion emoji must expose its sprite frame');

    for (const rootName of ['Finish', 'Finish-001']) {
        const root = scene.find((entry) => entry?.__type__ === 'cc.Node' && entry._name === rootName);
        const scheduler = componentOf(childNamed(root, 'NPCScheduler-001'));
        assert.equal(
            scheduler.completionEmojiFrame?.__uuid__,
            forestEmojiSprite._spriteFrame.__uuid__,
            `${rootName} must bind the forest-style completion emoji asset`,
        );
    }

    const source = readFileSync(scriptUrl, 'utf8');
    assert.match(source, /@property\(\{ type: SpriteFrame \}\) public completionEmojiFrame/);
    assert.match(source, /this\.prepareNpcCompletionEmojis\(\)/);
    assert.match(source, /new Node\('emoji'\)/);
    assert.match(source, /sprite\.spriteFrame = this\.completionEmojiFrame/);
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
    assert.match(collectorSource, /currentAmount \+ delta/);

    assert.match(schedulerSource, /storage\.capacity = 54/);
    assert.match(schedulerSource, /dropArea\.addComponent\(CornCoinCollector\)/);
    assert.match(schedulerSource, /storage\.addResource\(coin, 1\)/);
    assert.match(
        collectorSource,
        /public configure\([\s\S]*playerNode: Node \| null,[\s\S]*playerCoinBackpack: CoinBackpack \| null/,
    );
    assert.match(collectorSource, /this\._playerNode = playerNode/);
    assert.match(collectorSource, /this\._playerCoinBackpack = playerCoinBackpack/);
    assert.match(
        schedulerSource,
        /const playerController = this\.node\.scene\?\.getComponentInChildren\(PlayerController\)/,
    );
    assert.match(
        schedulerSource,
        /collector\.configure\(storage, stackArea, playerController\?\.node \?\? null, playerCoinBackpack\)/,
    );
    assert.match(collectorSource, /private _isPlayerInTrigger = false/);
    assert.match(collectorSource, /private _isPlayerWithinBounds = false/);
    assert.match(collectorSource, /this\.refreshPlayerProximity\(\)/);
    assert.match(
        collectorSource,
        /if \(!this\._isPlayerInTrigger && !this\._isPlayerWithinBounds\) return/,
    );
    assert.match(
        collectorSource,
        /this\.node\.inverseTransformPoint\(localPlayerPosition, player\.worldPosition\)/,
    );
    assert.match(
        collectorSource,
        /Math\.abs\(localPlayerPosition\.x - center\.x\) <= size\.x \* 0\.5/,
    );
    assert.match(
        collectorSource,
        /Math\.abs\(localPlayerPosition\.z - center\.z\) <= size\.z \* 0\.5/,
    );
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


test('customer-carried corn products use unit local scale after purchase', () => {
    const source = readFileSync(scriptUrl, 'utf8');
    assert.match(source, /private movePurchasedProductToCustomer/);
    assert.match(source, /resource\.setScale\(Vec3\.ONE\)/);
    assert.match(
        source,
        /movePurchasedProductToCustomer\([\s\S]*?addResource\(resource, 4, Vec3\.ZERO\)/,
    );
    assert.doesNotMatch(source, /from '\.\/NPCScheduler'|from '\.\/Resource\/StoragePoint'/);
});
