import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const helperUrl = new URL('../assets/_Scripts/CornVisualState.ts', import.meta.url);

test('HTML 中动态创建的玉米角色在启用前恢复完整模型层级', () => {
    assert.ok(existsSync(helperUrl), 'CornVisualState.ts must exist');
    const helper = read('../assets/_Scripts/CornVisualState.ts');
    const field = read('../assets/_Scripts/ResourceFieldSystem.ts');

    assert.match(helper, /export function restoreCornVisualHierarchy/);
    assert.match(helper, /node\.active = true/);
    assert.match(field, /restoreCornVisualHierarchy\(actor\)/);

    const spawnWorkers = field.match(/private spawnWorkers[\s\S]*?\n    private spawnVehicle/)?.[0] ?? '';
    const spawnVehicle = field.match(/private spawnVehicle[\s\S]*?\n    private clampVehiclePath/)?.[0] ?? '';
    const spawnHauler = field.match(/private spawnHauler[\s\S]*?\n    private clearInheritedHaulerCargo/)?.[0] ?? '';
    for (const method of [spawnWorkers, spawnVehicle, spawnHauler]) {
        assert.match(method, /restoreCornVisualHierarchy\(actor\)/);
    }
});

test('HTML 中进入售卖槽和顾客身上的玉米都会恢复模型', () => {
    const storage = read('../assets/_Scripts/CornStoragePoint.ts');
    const customer = read('../assets/_Scripts/CornCustomerScheduler.ts');

    assert.match(storage, /restoreCornVisualHierarchy\(resource\)/);
    assert.match(customer, /restoreCornVisualHierarchy\(resource\)/);
});

test('第二关作物根节点使用稳定组件类型而不是字符串反射', () => {
    const field = read('../assets/_Scripts/ResourceFieldSystem.ts');

    assert.match(field, /const cropRoot = root\.children\[0\] \?\? null/);
    assert.doesNotMatch(field, /getComponentInChildren\('FinishNode'\)/);
});
