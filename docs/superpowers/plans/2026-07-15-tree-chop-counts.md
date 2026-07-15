# 树木砍伐次数调整实施计划

> **供自动化执行者使用：** 必须逐项执行本计划；步骤用复选框记录完成状态。

**目标：** 将当前 DevScene 中的树设置为主角一刀砍断、伐木 NPC 四刀砍断。

**架构：** `Tree` 组件已把不同砍伐者的次数存储在场景实例中。本计划只更新场景中每个 `Tree` 的 `playerChopCount` 与 `woodcutterChopCount`，不触及 TypeScript 砍伐逻辑。

**技术栈：** Cocos Creator 3.8.7 场景序列化数据、Git。

## 全局约束

- `playerChopCount` 必须为 `1`，`woodcutterChopCount` 必须为 `4`。
- `vehicleChopCount` 保持 `1`，砍伐时长、掉落、重生与脚本均不修改。
- `assets/Scenes/DevScene.scene` 已含用户未提交的镜头编辑；只修改上述两类字段，提交前核对差异。

---

### 任务 1：更新现有树实例的砍伐次数

**文件：**
- 修改：`assets/Scenes/DevScene.scene`

**接口：**
- 使用：`Tree` 组件的序列化字段 `playerChopCount: number`、`woodcutterChopCount: number`。
- 产出：所有现有树实例具有主角 1 次、伐木 NPC 4 次的砍伐阈值。

- [ ] **步骤 1：记录修改前实例数量**

运行：

```powershell
(rg -n '"playerChopCount": 3' assets/Scenes/DevScene.scene | Measure-Object).Count
(rg -n '"woodcutterChopCount": 3' assets/Scenes/DevScene.scene | Measure-Object).Count
```

预期：两项数量相同，代表需要更新的树组件实例数。

- [ ] **步骤 2：只替换目标字段**

在 `assets/Scenes/DevScene.scene` 中，将每一处：

```json
"playerChopCount": 3,
"woodcutterChopCount": 3,
```

替换为：

```json
"playerChopCount": 1,
"woodcutterChopCount": 4,
```

不得修改同一组件中的以下字段：

```json
"vehicleChopCount": 1,
"playerChopDuration": 0.5,
"woodcutterChopDuration": 1.6,
```

- [ ] **步骤 3：静态验证所有树实例**

运行：

```powershell
rg -n --pcre2 '"playerChopCount": (?!1)' assets/Scenes/DevScene.scene
rg -n --pcre2 '"woodcutterChopCount": (?!4)' assets/Scenes/DevScene.scene
rg -n --pcre2 '"vehicleChopCount": (?!1)' assets/Scenes/DevScene.scene
git diff --check
```

预期：前三条命令无匹配，最后一条命令无空白错误。

- [ ] **步骤 4：手动预览验证**

在 Cocos Creator 中停止预览后重新运行，不重开项目。让主角砍任意一棵完整树一次，预期树立即进入砍倒和掉落流程；观察伐木 NPC 对另一棵完整树砍伐，预期第四次砍击后才进入砍倒和掉落流程。

- [ ] **步骤 5：提交场景配置**

运行：

```powershell
git add -- assets/Scenes/DevScene.scene
git diff --cached --check
git commit -m "Adjust tree chop counts"
git push origin main
```

提交前核对 `git diff --cached -- assets/Scenes/DevScene.scene`，确认包含用户当前镜头角度的已有编辑及这两类砍伐次数调整，但不包含与本任务无关的手工回退操作。
