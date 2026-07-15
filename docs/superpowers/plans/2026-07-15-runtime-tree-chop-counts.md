# 运行时树木砍伐次数实施计划

> **供自动化执行者使用：** 必须逐项执行本计划；步骤用复选框记录完成状态。

**目标：** 修复 `Tree.onLoad()` 覆盖场景配置的问题，使主角一刀砍断、伐木 NPC 四刀砍断。

**架构：** 保留 `Tree` 现有的运行时初始化模式，只替换其中三种砍伐者的次数常量。`identifyChopper()` 已从对应字段读取次数，因此无需改动砍伐状态机。

**技术栈：** Cocos Creator 3.8.7、TypeScript、Git。

## 全局约束

- 运行时值必须为主角 `1`、伐木 NPC `4`、车辆 `1`。
- 不修改砍伐时长、掉落、重生、状态机或相机配置。
- 不暂存当前未提交的 `assets/Scenes/DevScene.scene`。

---

### 任务 1：修复 Tree 运行时初始化值

**文件：**
- 修改：`assets/_Scripts/Tree.ts:142-144`

**接口：**
- 使用：`Tree.onLoad(): void` 的 `playerChopCount`、`woodcutterChopCount`、`vehicleChopCount` 字段。
- 产出：`identifyChopper()` 创建的 Player、Woodcutter、Vehicle `ChopperInfo.chopCount` 分别为 1、4、1。

- [ ] **步骤 1：确认当前覆盖值**

运行：

```powershell
rg -n -C 2 'this\.(playerChopCount|woodcutterChopCount|vehicleChopCount) =' assets/_Scripts/Tree.ts
```

预期：`onLoad()` 中存在主角 `3`、伐木 NPC `2`、车辆 `1` 的赋值。

- [ ] **步骤 2：替换运行时砍伐次数**

在 `Tree.onLoad()` 中将：

```ts
this.playerChopCount = 3;
this.woodcutterChopCount = 2;
this.vehicleChopCount = 1;
```

替换为：

```ts
this.playerChopCount = 1;
this.woodcutterChopCount = 4;
this.vehicleChopCount = 1;
```

- [ ] **步骤 3：静态验证实际读取路径**

运行：

```powershell
rg -n -C 3 'this\.playerChopCount = 1|this\.woodcutterChopCount = 4|chopCount: this\.(playerChopCount|woodcutterChopCount|vehicleChopCount)' assets/_Scripts/Tree.ts
git diff --check
```

预期：主角、NPC 初始化值分别为 1、4；`identifyChopper()` 继续从对应字段赋给 `ChopperInfo.chopCount`；无空白错误。

- [ ] **步骤 4：手动预览验证**

在 Cocos Creator 中停止预览后重新运行，不重开项目。主角砍一棵完整树一次，预期立即完成；伐木 NPC 砍另一棵完整树，预期第四次砍击后完成；车辆一次完成。

- [ ] **步骤 5：提交脚本修复**

运行：

```powershell
git add -- assets/_Scripts/Tree.ts
git diff --cached --check
git commit -m "Fix runtime tree chop counts"
git push origin main
```

预期：提交只包含 `assets/_Scripts/Tree.ts`，不包含未提交的场景文件。
