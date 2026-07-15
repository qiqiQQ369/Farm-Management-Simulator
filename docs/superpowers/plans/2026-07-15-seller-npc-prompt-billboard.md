# 卖家 NPC 提示框朝向实施计划

> **供自动化执行者使用：** 必须逐项执行本计划；步骤用复选框记录完成状态。

**目标：** 让卖家 NPC 的 `emoji` 提示框在世界空间中始终正对当前摄像机。

**架构：** 新增 `CameraFacingUI` 组件，在 `NPCScheduler` 初始化 NPC 列表时动态挂载到每个 `emoji` 节点。组件在 `lateUpdate` 中同步摄像机世界旋转，不修改 NPC 本体和提示框显示条件。

**技术栈：** Cocos Creator 3.8.7、TypeScript、`Camera`、`Component`、`Node`。

## 全局约束

- 提示框继续跟随 NPC，不改为 Canvas 固定 UI。
- 只同步提示框朝向，不修改 NPC 移动、队列、库存或显示/隐藏逻辑。
- 不修改场景文件；运行时动态添加组件。

---

### 任务 1：新增摄像机朝向组件

**文件：**
- 创建：`assets/_Scripts/CameraFacingUI.ts`

**接口：**
- 产出：`CameraFacingUI` 组件，自动寻找 `Main Camera` 并同步自身世界旋转。

- [ ] **步骤 1：创建组件**

写入：

```ts
import { _decorator, Camera, Component, find } from 'cc';

const { ccclass } = _decorator;

@ccclass('CameraFacingUI')
export class CameraFacingUI extends Component {
    private _camera: Camera | null = null;

    protected onLoad(): void {
        const cameraNode = find('Main Camera');
        this._camera = cameraNode ? cameraNode.getComponent(Camera) : null;
    }

    protected lateUpdate(): void {
        if (!this._camera || !this._camera.node.isValid) return;
        this.node.setWorldRotation(this._camera.node.worldRotation);
    }
}
```

### 任务 2：动态挂载到 NPC 提示框

**文件：**
- 修改：`assets/_Scripts/NPCScheduler.ts:1,80-95`

**接口：**
- 使用：任务 1 的 `CameraFacingUI`。
- 产出：初始化的每个卖家 NPC `emoji` 节点都拥有朝向组件。

- [ ] **步骤 1：导入并挂载组件**

添加导入：

```ts
import { CameraFacingUI } from './CameraFacingUI';
```

在 NPC 初始化/排队循环中，已有 `npc.getChildByName('emoji').active = false;` 附近加入：

```ts
const emoji = npc.getChildByName('emoji');
if (emoji && !emoji.getComponent(CameraFacingUI)) {
    emoji.addComponent(CameraFacingUI);
}
```

- [ ] **步骤 2：静态验证**

运行：

```powershell
rg -n -C 4 'CameraFacingUI|emoji\.addComponent' assets/_Scripts/NPCScheduler.ts assets/_Scripts/CameraFacingUI.ts
git diff --check
```

预期：组件创建、导入和动态挂载路径完整；无空白错误。

- [ ] **步骤 3：手动预览验证**

在 Cocos Creator 中停止预览后重新运行，不重开项目。让卖家 NPC 提示框显示，旋转或移动摄像机，确认提示框始终正对摄像机并跟随 NPC；NPC 本体方向和队列行为不变。

- [ ] **步骤 4：提交实现**

运行：

```powershell
git add -- assets/_Scripts/CameraFacingUI.ts assets/_Scripts/NPCScheduler.ts
git diff --cached --check
git commit -m "Make seller NPC prompts face camera"
git push origin main
```

预期：提交只包含新组件和 NPC 调度脚本，不包含场景文件。
