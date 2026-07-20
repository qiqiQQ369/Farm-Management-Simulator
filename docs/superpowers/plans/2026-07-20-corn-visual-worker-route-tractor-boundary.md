# 玉米模型、工人路线与拖拉机边界实施计划

**目标：** 修复玉米重生模型不显示，令玉米区三名工人按田垄往返收割，并将玉米拖拉机路线限制在实际田地范围内。

**架构：** CornFieldProduction 负责玉米的重生、可见性和田地边界；ResourceFieldSystem 负责工人和拖拉机配置；Woodcutter 仅在外部玉米目标分支中执行有界往返，森林树木目标分支保持原状。

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
- 修改：assets/_Scripts/Woodcutter.ts
- 修改：tests/corn-worker-parity-regression.test.mjs

**实现：** 以玉米局部坐标的 X 值划分田垄，并为每名工人分配一条完整田垄。Woodcutter 的外部目标列表在首尾翻转方向，扫描范围不离开自己的列表。森林 assignedTrees、Tree 状态判断和 setAssignedTrees 分支不改变。

**先写失败检查：**

~~~js
assert.match(cornProductionSource, /private orderPlantsForWorkers/);
assert.match(cornProductionSource, /Math\.round\(value \* 100\)/);
assert.match(cornProductionSource, /return orderedPlants\.slice\(start, end\)/);
assert.match(forestWorkerSource, /this\._dir = -1/);
assert.match(forestWorkerSource, /this\._dir = 1/);
~~~

**排序实现：**

~~~ts
private orderPlantsForWorkers(): CornPlantRuntime[] {
    const quantize = (value: number): number => Math.round(value * 100);
    return [...this._plants].sort((left, right) => {
        const row = quantize(right.node.position.z) - quantize(left.node.position.z);
        return row !== 0 ? row : quantize(left.node.position.x) - quantize(right.node.position.x);
    });
}
~~~

运行：node --test tests/corn-worker-parity-regression.test.mjs tests/corn-production-parity-regression.test.mjs

## 任务 3：拖拉机田内路径

**文件：**
- 修改：assets/_Scripts/CornFieldProduction.ts
- 修改：assets/_Scripts/ResourceFieldSystem.ts
- 修改：tests/corn-vehicle-hauler-parity-regression.test.mjs

**实现：** CornFieldProduction 返回所有有效玉米的世界坐标边界。ResourceFieldSystem 创建或复用田根节点下的临时起终点，夹紧场景配置端点的 X/Z 坐标后再赋给 LoggingTruck。无有效边界或端点重合时不启用拖拉机。

**先写失败检查：**

~~~js
assert.match(cornProductionSource, /public getVehiclePathBounds\(\)/);
assert.match(resourceFieldSource, /private clampVehiclePath\(field: FieldRuntime/);
assert.match(resourceFieldSource, /const path = this\.clampVehiclePath\(field, actor\)/);
assert.match(resourceFieldSource, /behavior\.startPoint = path\.start/);
assert.match(resourceFieldSource, /behavior\.endPoint = path\.end/);
~~~

**边界实现：**

~~~ts
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
start.setWorldPosition(clamp(startWorld.x, bounds.minX, bounds.maxX), actor.worldPosition.y, clamp(startWorld.z, bounds.minZ, bounds.maxZ));
end.setWorldPosition(clamp(endWorld.x, bounds.minX, bounds.maxX), actor.worldPosition.y, clamp(endWorld.z, bounds.minZ, bounds.maxZ));
~~~

运行：node --test tests/corn-vehicle-hauler-parity-regression.test.mjs

## 任务 4：完整验证

运行：

~~~powershell
node --test tests/*.test.mjs
node -e "JSON.parse(require('fs').readFileSync('assets/Scenes/DevScene.scene', 'utf8'))"
git diff --check
~~~

检查变更中无临时调试日志；将本轮实际修改建立本地 Git checkpoint 并推送 origin/main。
