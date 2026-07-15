# 树木砍伐次数调整设计

## 目标

将当前场景中每棵树的砍伐次数调整为：主角一刀砍断，伐木 NPC 四刀砍断。

## 方案

现有 `Tree` 组件已经分别序列化 `playerChopCount` 与 `woodcutterChopCount`。仅修改 `assets/Scenes/DevScene.scene` 中所有 `Tree` 组件实例的这两个字段：

- `playerChopCount` 从 `3` 改为 `1`。
- `woodcutterChopCount` 从 `3` 改为 `4`。

不改 `Tree.ts`、砍伐动画时长、掉落数量、树木重生逻辑或车辆的 `vehicleChopCount`。因此主角与 NPC 会沿用现有完整砍伐流程，只是完成所需次数不同。

## 范围与验证

本修改覆盖当前 `DevScene` 已放置的所有树。预览时主角靠近任意树后应一次砍断；伐木 NPC 对任意树应在第四次砍伐后完成。Cocos 编辑器可能会同时保存用户当前镜头角度，因此提交前必须只暂存目标字段，不覆盖无关场景编辑。
