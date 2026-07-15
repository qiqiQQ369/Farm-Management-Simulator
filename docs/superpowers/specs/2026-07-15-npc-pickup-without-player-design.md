# NPC 自动取货条件设计

## 问题

`NPCScheduler.tryCollectItem()` 当前要求玩家仍在售卖点触发区内，才会从售卖点库存取货。玩家离开后，即使售卖点已经有木材，NPC 也不会继续购买。

## 目标

售卖点库存大于 0 时，NPC 可以自动取货，不再要求玩家站在售卖点上。玩家将木材放入售卖点的行为仍保留原有位置限制。

## 方案

仅修改 `assets/_Scripts/NPCScheduler.ts` 的取货循环条件：将 `playerDetectionZone._isPlayerInZone && targetStoragePoint.amount > 0` 改为 `targetStoragePoint.amount > 0`。保留售卖点库存、NPC 容量、资源移动、装满结算和金币掉落逻辑不变。

## 验证

玩家在售卖点放入木材后离开触发区，NPC 仍应继续取货；售卖点为空时 NPC 不取货；NPC 装满后仍正常结算并生成金币。
