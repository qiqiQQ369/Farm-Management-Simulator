# 森林搬运工木头挂点对齐设计

## 目标

让森林区 `HaulerNPC` 携带的木头在角色身上的位置、旋转、缩放和堆叠布局与主角携带木头一致，同时保持搬运工与主角的资源模块完全独立。

## 范围

本次只修改森林搬运工创建和配置路径中的私有 `carryStorage` 挂点。不会修改 `WoodBackpack`、主角的 `backpackMount`、主角资源数量或森林/玉米的资源转移状态机。

## 架构

主角 `WoodBackpack.backpackMount` 是视觉布局模板，而不是搬运工的资源容器。创建或复用森林搬运工时，`CoinConsumer` 从主角模板读取背包挂点的局部位置、局部旋转、局部缩放以及 `StoragePoint` 的堆叠参数。随后仅将这些视觉与布局配置复制到搬运工自己的挂点和搬运工自己的 `carryStorage`。

搬运工优先使用克隆体自身 `WoodBackpack.backpackMount` 作为私有木头挂点；该挂点不存在时，创建 `HaulerCarryStorage` 并附加在搬运工节点下。无论走哪条分支，`HaulerNPC.carryStorage` 始终引用搬运工私有 `StoragePoint`，主角的 `StoragePoint` 只读，不会作为搬运目标、资源父节点或状态来源。

## 数据流

搬运工在收集点装载木头时，`HaulerNPC` 仍调用现有 `ResourceManager.MoveResource(...)` 将资源移动到 `carryStorage`。`StoragePoint` 会把木头挂到该存储点的 `stackAreaNode`；该节点位于搬运工自身的视觉挂点，因此木头跟随搬运工移动，并以和主角相同的相对位置、方向、尺寸、层高和网格间距堆叠。

卸货时，资源仍从搬运工私有 `carryStorage` 转移到森林售卖点存储。主角 `WoodBackpack` 没有参与装载、卸货或恢复逻辑。

## 异常处理

若场景中找不到主角背包挂点，搬运工保持自身已有挂点；只有在没有可用挂点时才使用当前默认局部位置创建私有挂点。若主角挂点没有 `StoragePoint`，只复制其空间变换，不改变搬运工既有的容量与堆叠参数。搬运工已有资源时不重设挂点，避免重设父节点导致在途资源丢失或跳位。

## 验证

回归测试应断言：搬运工的 `carryStorage` 是私有实例；其挂点会从主角 `backpackMount` 复制位置、旋转、缩放；主角 `WoodBackpack` 和主角 `StoragePoint` 不会被搬运工写入；搬运工继续沿用原有 `HaulerNPC` 转移路径。验证还包括现有搬运工恢复测试、TypeScript 诊断、`git diff --check` 和完整 Node 回归测试。
