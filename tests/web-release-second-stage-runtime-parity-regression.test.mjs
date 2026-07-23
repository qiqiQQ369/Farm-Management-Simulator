import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

function method(source, startName, endName) {
    const start = source.indexOf(`private ${startName}`);
    const end = source.indexOf(`private ${endName}`, start + 1);
    assert.notEqual(start, -1, `${startName} must exist`);
    assert.notEqual(end, -1, `${endName} must exist after ${startName}`);
    return source.slice(start, end);
}

function assertOrder(source, ...needles) {
    let previous = -1;
    for (const needle of needles) {
        const current = source.indexOf(needle);
        assert.ok(current >= 0, `missing ordered statement: ${needle}`);
        assert.ok(current > previous, `${needle} must appear after ${needles[Math.max(0, needles.indexOf(needle) - 1)]}`);
        previous = current;
    }
}

test('第二关角色在完整绑定和恢复模型后才激活', () => {
    const source = read('../assets/_Scripts/ResourceFieldSystem.ts');
    const workers = method(source, 'spawnWorkers', 'spawnVehicle');
    const vehicle = method(source, 'spawnVehicle', 'clampVehiclePath');
    const hauler = method(source, 'spawnHauler', 'clearInheritedHaulerCargo');

    assert.match(workers, /createActor\([\s\S]*?true,\s*false,\s*\)/);
    assertOrder(
        workers,
        'controller.setHarvestTargets',
        'restoreCornVisualHierarchy(actor, false)',
        'controller.enabled = true',
        'actor.active = true',
    );
    assertOrder(
        vehicle,
        'behavior.setPathPoints',
        'restoreCornVisualHierarchy(actor, false)',
        'behavior.enabled = true',
        'actor.active = true',
    );
    assertOrder(
        hauler,
        'behavior.carryStorage = carryStorage',
        'restoreCornVisualHierarchy(actor, false)',
        'behavior.enabled = true',
        'actor.active = true',
    );
});

test('每个玉米容器入口都恢复 Release 可视层级', () => {
    const helper = read('../assets/_Scripts/CornVisualState.ts');
    assert.match(helper, /activateRoot = true/);
    assert.match(helper, /if \(activateRoot\) root\.active = true/);

    for (const file of [
        'CornStoragePoint.ts',
        'CornHaulerBackpack.ts',
        'MultiResourceBackpack.ts',
        'CornCustomerScheduler.ts',
    ]) {
        assert.match(
            read(`../assets/_Scripts/${file}`),
            /restoreCornVisualHierarchy/,
            `${file} must restore corn visuals after cloning or transfer`,
        );
    }
});

test('成功转移后源存放点释放节点所有权', () => {
    const storage = read('../assets/_Scripts/CornStoragePoint.ts');
    const hauler = read('../assets/_Scripts/CornHauler.ts');
    const pickup = read('../assets/_Scripts/CornPickupDetector.ts');
    const customer = read('../assets/_Scripts/CornCustomerScheduler.ts');

    assert.match(storage, /public finalizeResourceTransfer\(resource: Node\): void/);
    assert.match(
        hauler,
        /from instanceof CornStoragePoint[\s\S]*?from\.finalizeResourceTransfer\(resource\)/,
    );
    assert.match(pickup, /collectionStorage\.finalizeResourceTransfer\(item\)/);
    assert.match(customer, /targetStoragePoint\.finalizeResourceTransfer\(resource\)/);
    assert.match(customer, /if \(moved\)[\s\S]*?dropCoins/);
});

test('HTML 第二关在顾客节点激活前直接绑定本区域售卖库存', () => {
    const fieldSystem = read('../assets/_Scripts/ResourceFieldSystem.ts');
    const customer = read('../assets/_Scripts/CornCustomerScheduler.ts');
    const createField = method(fieldSystem, 'createField', 'updatePlayerDeposit');

    assertOrder(
        createField,
        'const sellStorage = this.ensureSellStorage(sellNode, id)',
        'this.bindCornCustomerScheduler(root, sellStorage)',
    );
    assert.match(fieldSystem, /scheduler\.bindSellStorage\(sellStorage\)/);
    assert.match(customer, /public bindSellStorage\(storage: CornStoragePoint\): void/);
    assert.match(
        customer,
        /if \(this\.isValidStorage\(this\._boundSellStoragePoint\)\) return this\._boundSellStoragePoint/,
    );
});

test('HTML 第二关动态交互组件全部先配置再启用', () => {
    const fieldSystem = read('../assets/_Scripts/ResourceFieldSystem.ts');
    const unlock = method(fieldSystem, 'showUnlockStage', 'alignUnlockVisualToCornGround');
    const pickup = method(fieldSystem, 'configureCollectionPickup', 'bindCornCustomerScheduler');
    const unlockPad = read('../assets/_Scripts/CornUnlockPad.ts');

    assertOrder(unlock, 'unlockPad.enabled = false', 'unlockPad.configure({', 'unlockPad.enabled = true');
    assertOrder(pickup, 'pickupDetector.enabled = false', 'pickupDetector.configure({', 'pickupDetector.enabled = true');
    assertOrder(
        unlockPad,
        'const onCompleted = this._onCompleted',
        'this._onCompleted = null',
        'this.enabled = false',
        'onCompleted?.()',
    );
});
