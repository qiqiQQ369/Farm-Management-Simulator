# 玉米区 HTML 安全构建设计

## 边界

本次只修复 Cocos Creator 构建出的 HTML 包。编辑器预览和本地运行已经正确，因此：

- 不修改 `assets/_Scripts` 中的任何游戏逻辑。
- 不修改森林区或玉米区的玩法、数值、路线、动画代码。
- 不修改 `assets/Scenes/DevScene.scene` 的场景内容。
- 只新增可复现的 Web 构建配置、构建命令和构建产物验证。

## 已确认差异

当前 Web Mobile 任务使用：

- `debug: false`
- `inlineEnum: true`
- Release 脚本与 UUID 压缩

Cocos Creator 3.8 官方说明指出，关闭 Debug Mode 会压缩并混淆引擎脚本、项目脚本和资源 UUID；开启 Debug Mode 则保留调试结构。第二关依赖的动态组件和运行时对象明显多于第一关，因此只在压缩后的 HTML 中出现工人缺失、玉米入槽异常和顾客不购买，而编辑器预览正常。

## 方案

项目新增一份受版本控制的 Web Mobile 安全构建配置：

- `platform: web-mobile`
- `debug: true`
- `inlineEnum: false`
- `mangleProperties: false`
- `experimentalEraseModules: false`
- `sourceMaps: true`
- 保持当前起始场景、参与构建场景、物理模块、异步函数兼容和 Web Mobile 方向配置不变。

再新增一个 PowerShell 构建入口，固定调用本机 Cocos Creator 3.8.6，并通过 `configPath` 使用上述配置。脚本在构建前清理自己的目标目录，在构建后验证退出码、`index.html`、项目脚本包、场景包以及第二关关键类名是否存在。

构建输出写到独立目录 `build/web-mobile-safe`，不会覆盖用户现有的 `build/web-mobile`，验证通过后再由用户选择使用安全包。

## 验证

自动测试检查：

- 安全配置必须开启 Debug Mode，并关闭枚举内联、属性混淆和模块擦除。
- 起始场景仍为 `DevScene`。
- 配置仍包含 Web Mobile 所需物理模块与 Async Functions polyfill。
- 构建脚本必须使用 `configPath`，且不能修改或复制游戏脚本。
- 构建产物必须包含 `ResourceFieldSystem`、`CornWorker`、`CornStoragePoint` 和 `CornCustomerScheduler`。

最终通过本地 HTTP 启动 `build/web-mobile-safe`，检查页面启动、资源请求和控制台错误。
