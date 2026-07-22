# 玉米区 HTML Release 模型恢复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将玉米重生时使用的模型恢复原则覆盖到第二关其他动态角色和售卖链。

**Architecture:** 用独立的 `CornVisualState` 工具按稳定组件类型恢复可视节点。调用者仍使用原有玩法流程，只在对象正式展示或转移前恢复模型状态。

**Tech Stack:** Cocos Creator 3.8.6、TypeScript、Node.js `node:test`

## Global Constraints

- 不修改森林区脚本。
- 不改变路线、数值、库存容量或解锁顺序。
- 不提交编辑器自动修改的 `DevScene.scene`。

---

### Task 1: 建立 Release 模型恢复回归测试

- [x] 创建 `tests/web-release-visual-reactivation-regression.test.mjs`。
- [x] 运行测试并确认角色、售卖玉米和字符串反射三项失败。

### Task 2: 实现统一模型恢复

- [x] 创建 `assets/_Scripts/CornVisualState.ts` 及 meta。
- [x] 在三类玉米角色正式激活前恢复模型层级。
- [x] 在玉米进入售卖槽和顾客背包前恢复模型层级。
- [x] 删除 `FinishNode` 字符串组件查找。
- [x] 运行针对性测试并确认通过。

### Task 3: 验证真实 Release

- [x] 运行全部 Node 测试。
- [x] 生成 `debug=false` Web Mobile 包到 `build/web-mobile-release-fixed`。
- [x] 检查压缩包包含 `CornVisualState` 和所有调用点。
- [x] 通过 HTTP 启动包并检查页面初始化错误。
