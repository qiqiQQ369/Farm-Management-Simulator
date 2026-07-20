# 玉米模型、工人路线与拖拉机边界实施计划

**目标：** 修复玉米重生模型不显示，令玉米区三名工人按田垄往返收割，并将玉米拖拉机路线限制在实际田地范围内。

**架构：** CornFieldProduction 负责玉米的重生、可见性和田地边界；ResourceFieldSystem 只负责玉米区接线；CornWorker、CornTractor、CornHauler、CornStoragePoint 与 CornUnlockPad 分别复制森林区对应行为，但不导入或挂载森林运行脚本。

## 任务 1：玉米重生模型

**文件：**
- 修改：assets/_Scripts/CornFieldProduction.ts
- 修改：tests/corn-production-parity-regression.test.mjs

**实现：** 扩展 CornPlantRuntime，记录每个植株的可视子节点。重生时先调用 restorePlantVisual，再恢复根节点缩放并播放现有补间。

**先写失败检查：**

~~~js
const respawn = cornSource.match(
    /private updateRespawns[\s\S]*?\n    private addToCollection/,
)?.[0] ?? '';
assert.match(respawn, /this\.restorePlantVisual\(plant\)/);
assert.ok(respawn.indexOf('this.restorePlantVisual(plant)') < respawn.indexOf('tween(plant.node)'));
assert.match(cornSource, /private restorePlantVisual\(plant: CornPlantRuntime\): void/);
~~~

**最小实现：**

~~~ts
private restorePlantVisual(plant: CornPlantRuntime): void {
    plant.node.active = true;
    for (const visualNode of plant.visualNodes) {
        if (visualNode?.isValid) visualNode.active = true;
    }
}
~~~

运行：node --test tests/corn-production-parity-regression.test.mjs

## 任务 2：玉米工人田垄往返

**文件：**
- 修改：assets/_Scripts/CornFieldProduction.ts
- 创建：assets/_Scripts/CornWorker.ts
- 修改：tests/corn-worker-parity-regression.test.mjs

**实现：** 以玉米局部坐标的 X 值划分田垄，并为每名工人分配一条完整田垄。CornWorker 复制森林的空闲、移动、砍伐和等待循环；在首尾翻转方向，扫描范围不离开自己的列表。工人从本田垄首株开始，收割站位不偏移到相邻田垄。森林 Woodcutter、Tree 状态判断和 setAssignedTrees 分支不改变。

**先写失败检查：**

~~~js
assert.match(cornProductionSource, /private getWorkerLanes\(\): CornPlantRuntime\[\]\[\]/);
assert.match(cornProductionSource, /Math\.round\(value \* 100\)/);
assert.match(cornProductionSource, /const lane = lanes\[index\] \?\? \[\]/);
assert.match(cornWorkerSource, /CornWorkerState\.Moving/);
assert.match(cornWorkerSource, /private findNextTargetInLane/);
~~~

**排序实现：**

~~~ts
private getWorkerLanes(): CornPlantRuntime[][] {
    const quantize = (value: number): number => Math.round(value * 100);
    const lanes = new Map<number, CornPlantRuntime[]>();
    for (const plant of this._plants) {
        const laneKey = quantize(plant.node.position.x);
        const lane = lanes.get(laneKey) ?? [];
        lane.push(plant);
        lanes.set(laneKey, lane);
    }
    return [...lanes.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, lane]) => lane.sort((left, right) =>
            quantize(right.node.position.z) - quantize(left.node.position.z),
        ));
}
~~~

运行：node --test tests/corn-worker-parity-regression.test.mjs tests/corn-production-parity-regression.test.mjs

## 任务 3：拖拉机田内路径

**文件：**
- 修改：assets/_Scripts/CornFieldProduction.ts
- 修改：assets/_Scripts/ResourceFieldSystem.ts
- 创建：assets/_Scripts/CornTractor.ts
- 修改：tests/corn-vehicle-hauler-parity-regression.test.mjs

**实现：** CornFieldProduction 返回所有有效玉米的世界坐标边界。ResourceFieldSystem 克隆车辆外观模板后，先递归停用模板内的 LoggingTruck 等森林玩法组件，再挂载并启用 CornTractor；随后创建或复用田根节点下的临时起终点，夹紧场景配置端点的 X/Z 坐标后再赋给 CornTractor。无有效边界或端点重合时不启用拖拉机。

**先写失败检查：**

~~~js
assert.match(cornProductionSource, /public getVehiclePathBounds\(\)/);
assert.match(resourceFieldSource, /private clampVehiclePath\(field: FieldRuntime/);
assert.match(resourceFieldSource, /const path = this\.clampVehiclePath\(field, actor\)/);
assert.match(vehicleSpawn, /this\.disableActorGameplayComponents\(actor\)/);
assert.ok(vehicleSpawn.indexOf('this.disableActorGameplayComponents(actor)') < vehicleSpawn.indexOf('actor.getComponent(CornTractor)'));
assert.match(resourceFieldSource, /behavior\.startPoint = path\.start/);
assert.match(resourceFieldSource, /behavior\.endPoint = path\.end/);
~~~

**边界实现：**

~~~ts
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
this.disableActorGameplayComponents(actor);
start.setWorldPosition(clamp(startWorld.x, bounds.minX, bounds.maxX), actor.worldPosition.y, clamp(startWorld.z, bounds.minZ, bounds.maxZ));
end.setWorldPosition(clamp(endWorld.x, bounds.minX, bounds.maxX), actor.worldPosition.y, clamp(endWorld.z, bounds.minZ, bounds.maxZ));
~~~

运行：node --test tests/corn-vehicle-hauler-parity-regression.test.mjs

## 任务 4：玉米专用搬运、库存与解锁

**文件：**
- 创建：assets/_Scripts/CornHauler.ts
- 创建：assets/_Scripts/CornStoragePoint.ts
- 创建：assets/_Scripts/CornUnlockPad.ts
- 修改：assets/_Scripts/ResourceFieldSystem.ts
- 修改：tests/corn-vehicle-hauler-parity-regression.test.mjs

**实现：** CornHauler 复制森林搬运工的等待、装载、运送、卸载和返回状态；CornStoragePoint 复制容量、网格堆叠、可移动资源和中断恢复，左右存放节点在 DevScene 中直接把组件类型迁移为 CornStoragePoint；CornUnlockPad 复制接近扣币、进度条和数字更新，并按 `Sprite.Type.FILLED` 更新实际名为 `splash2` 的填充节点。玉米区只实例化这些专用组件，森林 HaulerNPC、StoragePoint 和 CoinConsumer 不参与玉米运行时。

运行：node --test tests/corn-vehicle-hauler-parity-regression.test.mjs tests/corn-area-placement-regression.test.mjs

## 任务 5：完整验证

运行：

~~~powershell
node --test tests/*.test.mjs
node -e "JSON.parse(require('fs').readFileSync('assets/Scenes/DevScene.scene', 'utf8'))"
git diff --check
~~~

检查变更中无临时调试日志；在 Cocos Creator 中运行场景，逐项确认玉米重生可见、三名工人各沿一条直线田垄往返、拖拉机不越界，以及搬运、存放和解锁流程只由玉米专用组件驱动。
