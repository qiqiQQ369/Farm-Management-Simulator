# 玉米区 HTML 安全构建实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不修改任何游戏逻辑和场景内容的前提下，生成与本地预览行为一致的 Web Mobile HTML 包。

**Architecture:** 通过受版本控制的 Cocos Creator 构建参数关闭会改变脚本结构的 Release 优化，并用单一 PowerShell 入口调用 `configPath` 构建。Node 回归测试验证配置和最终包中的第二关关键模块。

**Tech Stack:** Cocos Creator 3.8.6、JSON、PowerShell、Node.js `node:test`

## Global Constraints

- 不修改 `assets/_Scripts`。
- 不修改 `assets/Scenes/DevScene.scene`。
- 不改变森林区或玉米区游戏逻辑。
- 安全包输出到 `build/web-mobile-safe`。

---

### Task 1: 固定安全构建配置

**Files:**
- Create: `build-configs/web-mobile-safe.json`
- Test: `tests/web-mobile-safe-build-regression.test.mjs`

**Interfaces:**
- Consumes: Cocos Creator 3.8.6 `configPath` JSON 构建参数。
- Produces: 可被命令行构建直接读取的 `build-configs/web-mobile-safe.json`。

- [ ] **Step 1: 写失败测试**

测试读取 JSON 并断言 `platform === 'web-mobile'`、`debug === true`、`inlineEnum === false`、`mangleProperties === false`、`experimentalEraseModules === false`、`sourceMaps === true`，同时校验 DevScene UUID 和物理模块配置。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/web-mobile-safe-build-regression.test.mjs`

Expected: FAIL，提示 `build-configs/web-mobile-safe.json` 不存在。

- [ ] **Step 3: 创建最小构建配置**

从当前成功任务中复制场景、Web Mobile 和模块参数，只修改 Debug、Source Maps、Inline Enums 以及输出目录。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/web-mobile-safe-build-regression.test.mjs`

Expected: PASS。

### Task 2: 添加一键构建与产物检查

**Files:**
- Create: `scripts/build-web-mobile-safe.ps1`
- Modify: `tests/web-mobile-safe-build-regression.test.mjs`

**Interfaces:**
- Consumes: `build-configs/web-mobile-safe.json`。
- Produces: `build/web-mobile-safe` 和明确的成功/失败退出码。

- [ ] **Step 1: 扩展失败测试**

断言脚本调用 `CocosCreator.exe --project ... --build "configPath=..."`，并检查 `index.html`、`assets/main/index.js` 与四个第二关关键类名。断言脚本不读写 `assets/_Scripts` 或 `DevScene.scene`。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/web-mobile-safe-build-regression.test.mjs`

Expected: FAIL，提示构建脚本不存在。

- [ ] **Step 3: 实现 PowerShell 构建入口**

脚本解析项目根目录和 Cocos Creator 3.8.6 路径，调用配置构建并验证退出码 `36`。构建后检查第二关关键模块，任一缺失即返回非零退出码。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/web-mobile-safe-build-regression.test.mjs`

Expected: PASS。

### Task 3: 构建与网页验证

**Files:**
- Verify: `build/web-mobile-safe`

**Interfaces:**
- Consumes: Task 2 构建脚本。
- Produces: 可部署的 HTML 包。

- [ ] **Step 1: 运行完整测试**

Run: `node --test tests/*.test.mjs`

Expected: 全部通过。

- [ ] **Step 2: 生成安全 HTML 包**

Run: `powershell -ExecutionPolicy Bypass -File scripts/build-web-mobile-safe.ps1`

Expected: Cocos Creator 返回 `36`，脚本输出构建成功和四个关键模块检查通过。

- [ ] **Step 3: 启动本地 HTTP 验证**

Run: `python -m http.server 8126 --bind 127.0.0.1 --directory build/web-mobile-safe`

Expected: `http://127.0.0.1:8126/` 正常启动，无资源 404 或 Cocos 初始化错误。

- [ ] **Step 4: 检查工作区边界并提交**

Run: `git diff --name-only HEAD`

Expected: 只包含构建配置、构建脚本、测试和文档；`assets/Scenes/DevScene.scene` 保持为用户已有未提交修改，不纳入提交。
