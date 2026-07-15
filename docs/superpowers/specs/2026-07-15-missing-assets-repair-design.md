# 缺失资源引用修复设计

## 目标

消除 DevScene 预览中由过期 UUID 引起的资源 404，并防止缺失广告 UI 子节点导致 MainUI 启动抛出 TypeError。

## 范围

- 只使用项目 `assets` 中已有的资源，不下载或提取外部素材。
- 保留现有资源收集、车辆投币、结算和 UI 事件逻辑。
- 修复 `money`、`logo-001`、`winShow`、`vehicle-001`、`moneyMod`、`chaopiao`、`箭头` 中的失效资源引用。
- 为 `UIBase.SetText` 增加缺失节点与 Label 的安全返回。

## 替换策略

- 广告 Logo、按钮与手势节点改用项目内 `Logo.png`、`btn.png`、`手.png` 的 SpriteFrame。
- 金币 UI Sprite 改用项目内可用的金币 SpriteFrame；车辆投币引用改为现有 `money.prefab`。
- 钱币 3D Prefab 的旧网格与材质改为 `钱.FBX` 当前 meta 中声明的网格 `dcb65033-a8fe-4f50-9a5f-5b2c4fed0b9d@46540` 和材质 `dcb65033-a8fe-4f50-9a5f-5b2c4fed0b9d@7c855`。
- 箭头材质改为 `5d55b2d0-61fd-4725-b94b-be8e6accf58f@9d093`，保留现有箭头网格。
- 删除指向不存在 normalMap 子资源的材质属性；基础贴图和主色保持不变。
- `UIBase.SetText` 在节点、子路径或 Label 缺失时输出警告并返回，不中断场景启动。

## 验证

重新导入并预览 DevScene，控制台不得出现 `assets/general/import` 404、`The asset ... is missing` 或 `UIBase.SetText` 的 `getChildByPath` TypeError；金币、按钮、Logo、结算和车辆投币应可正常显示或继续运行。
