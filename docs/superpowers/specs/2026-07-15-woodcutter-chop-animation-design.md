# NPC 挥斧动画恢复设计

## 问题

伐木 NPC 的 `ChopAction` 未绑定骨骼动画，原本依赖 `Woodcutter.skeletalAnimation.play("KanMuTou")` 显示挥斧。为消除未登记的首刀而移除该直接播放后，NPC 的砍伐计数仍运行，但画面不再显示挥斧。

## 目标

NPC 每次登记砍伐前都显示一次 `KanMuTou` 挥斧动画，四次可见挥斧后砍倒树。

## 方案

只修改 `Woodcutter.playAndRegisterChop()`：在等待 `ChopAction.playChopAction()` 前，若 `skeletalAnimation` 存在则播放 `KanMuTou`。该方法是当前每一轮 NPC 砍伐的唯一入口，因此动画和计数保持一对一，不需修改预制体绑定或场景数据。

## 验证

停止预览后重新运行：观察 NPC 砍一棵完整树，应连续显示四次挥斧，第四次之后树被砍倒；主角和车辆行为不变。
