# Web 发布版第二关组件筛选修复设计

## 问题

第二关在解锁时动态创建员工、拖拉机、搬运工和玉米产物。创建后代码通过 `component.constructor.name` 判断哪些组件需要保留。Web Release 构建会压缩 JavaScript 类名，导致渲染、动画、砍伐动作和音频组件被误关闭。第一关对象由场景直接配置，不经过这套动态筛选，所以表现正常。

## 设计

保留现有动态创建流程和第一关逻辑，只把以下四处字符串类名判断改为 Cocos 类型判断：

- `ResourceFieldSystem`：员工、拖拉机、搬运工。
- `CornFieldProduction`：收获后生成的玉米产物。
- `CornHaulerBackpack`：搬运工携带的玉米。
- `MultiResourceBackpack`：玩家携带的玉米。

渲染和动画组件使用基类 `instanceof Animation`、`instanceof Renderer` 判断，因此同时覆盖 `SkeletalAnimation`、`MeshRenderer` 和 `SkinnedMeshRenderer`。需要保留砍伐能力时，额外使用 `instanceof ChopAction` 和 `instanceof AudioSource`。不依赖构造函数名称，因此调试版和压缩发布版行为一致。

## 验证

1. 回归测试扫描四个动态组件筛选入口，禁止出现 `constructor.name`。
2. 完整 Node 回归测试通过。
3. TypeScript 检查确认本轮文件无新增错误。
4. 重新生成 `debug: false` 的 Web Mobile 构建，确认构建脚本中不再包含基于类名的筛选逻辑，并用浏览器运行验证无初始化错误。
