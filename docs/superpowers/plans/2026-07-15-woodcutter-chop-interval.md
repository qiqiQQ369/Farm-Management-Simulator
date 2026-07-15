# NPC 挥砍间隔实施计划

> **供自动化执行者使用：** 必须逐项执行本计划；步骤用复选框记录完成状态。

**目标：** 为伐木 NPC 增加默认 0.8 秒的可调挥砍间隔，避免连续挥斧过快。

**架构：** `Woodcutter` 增加序列化的 `chopInterval` 属性。每次挥斧动画结束后，`playAndRegisterChop()` 等待该间隔，再登记一次树木砍伐；计数仍由 `Tree` 统一处理。

**技术栈：** Cocos Creator 3.8.7、TypeScript、Cocos `Component` 与 `Vec3` API。

## 全局约束

- `chopInterval` 默认值为 `0.8` 秒，并可在 Inspector 调整。
- 不修改主角、车辆、掉落、树木状态或镜头逻辑。
- 不修改场景文件，保留用户当前未提交的场景编辑。

---

### 任务 1：增加 NPC 挥砍间隔并串联登记时机

**文件：**
- 修改：`assets/_Scripts/Woodcutter.ts:27-35,326-344`

**接口：**
- 使用：已有 `playAndRegisterChop(): Promise<void>`。
- 产出：公开序列化属性 `chopInterval: number = 0.8`，并在登记前等待该间隔。

- [ ] **步骤 1：确认当前 NPC 属性与循环入口**

运行：

```powershell
rg -n -C 3 'chopRange|waitAfterChop|playAndRegisterChop|registerWoodcutterChop' assets/_Scripts/Woodcutter.ts
```

预期：存在 `waitAfterChop` 属性和 `playAndRegisterChop()`，但没有 `chopInterval`。

- [ ] **步骤 2：增加可调间隔属性**

在 `waitAfterChop` 属性后加入：

```ts
@property({ tooltip: "每次挥砍之间的间隔（秒）" })
public chopInterval: number = 0.8;
```

- [ ] **步骤 3：在登记前等待间隔**

在 `playAndRegisterChop()` 中，`playChopAction()` 完成后、`registerWoodcutterChop()` 前加入：

```ts
await new Promise(resolve => setTimeout(resolve, Math.max(this.chopInterval, 0.1) * 1000));
```

顺序必须保持为：播放动画 → 等待 `chopInterval` → 登记一次砍伐。

- [ ] **步骤 4：静态验证**

运行：

```powershell
rg -n -C 5 'chopInterval|playChopAction|registerWoodcutterChop' assets/_Scripts/Woodcutter.ts
git diff --check
```

预期：属性默认值为 `0.8`，等待语句位于动画和登记之间；无空白错误。

- [ ] **步骤 5：手动预览验证**

在 Cocos Creator 中停止预览后重新运行，不重开项目。观察 NPC 连续砍树，相邻挥斧应约间隔 0.8 秒，第四次挥斧后树才砍倒。将 Inspector 的 `chopInterval` 改为 `1.2` 后再次运行，间隔应明显变慢。

- [ ] **步骤 6：提交实现**

运行：

```powershell
git add -- assets/_Scripts/Woodcutter.ts
git diff --cached --check
git commit -m "Add woodcutter chop interval"
git push origin main
```

预期：提交只包含 `assets/_Scripts/Woodcutter.ts`，不包含场景文件。
