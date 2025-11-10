# 更新日志 / Changelog

所有重要的项目更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [未发布 / Unreleased]

### 🔮 计划中 / Planned

- [ ] 云端训练功能 / Cloud training
- [ ] 模型评估工具 / Model evaluation tools
- [ ] 完整英文支持 / Full English localization
- [ ] AI 辅助标注 / AI-assisted annotation
- [ ] 多边形标注 / Polygon annotation
- [ ] 语义分割标注 / Semantic segmentation

---

## [1.0.4] - 2025-11-10

### 📝 版本说明 / Version Note

这是一个**次小版本更新**，主要修复了部分已知问题，提升了系统的稳定性。

**This is a minor patch release** that primarily fixes some known issues and improves system stability.

> 💡 **重要提示 / Important Notice**
> 
> 我们正在对 YoloMarkFlow 的底层架构进行**大量重构**，以提升代码质量、性能和可维护性。
> 
> 在下一个**大版本**（v1.1.0）中，您将看到：
> - ✨ 更多期待已久的功能
> - 🚀 所有功能的全面优化
> - 🎯 更好的用户体验
> - 🔧 更稳定的系统架构
> 
> 敬请期待！
> 
> We are currently conducting **extensive refactoring** of YoloMarkFlow's underlying architecture to improve code quality, performance, and maintainability.
> 
> In the next **major version** (v1.1.0), you can expect:
> - ✨ More long-awaited features
> - 🚀 Comprehensive optimization of all features
> - 🎯 Better user experience
> - 🔧 More stable system architecture
> 
> Stay tuned!

### 🐛 问题修复 / Fixed

- ✅ **修复数据集导出问题** - 修复了导出数据集时，即使配置了验证集或测试集，依然只导出了训练集的问题
  - 修复了导出配置参数传递不完整的问题，现在正确传递 `includeVal`、`includeTest` 和 `testRatio` 参数
  - 修复了数据集切分逻辑，确保验证集和测试集被正确创建和分配
  - 优化了切分算法，当验证集或测试集数量为0时，至少分配1张图片（满足YOLO训练要求）
  - 修复了测试集切分逻辑，明确指定切分范围避免错误
  - 添加了详细的调试日志，便于问题诊断
- ✅ **修复训练任务类别数量显示问题** - 修复了新建训练任务时选择数据集后类别数量无法正确获取的问题
  - 改进了 `listDatasets` 函数，确保返回的数据集对象始终包含 `categories` 数组
  - 当数据集有元数据但缺少类别信息时，自动从数据库查询类别信息
  - 在训练配置面板中添加了 `getCategoryCount` 方法，兼容不同的数据结构
  - 统一了数据集数据结构，确保类别数量能正确显示
- ✅ **修复导出目录重名问题** - 在导出数据集时，如果导出目录中已存在同名目录，自动在新导出的目录名中添加秒级时间戳
  - 添加了目录存在性检查，避免覆盖已有数据
  - 使用秒级时间戳确保目录名唯一性
  - 提供清晰的用户提示信息

### 🔧 优化改进 / Improved

- ✅ **优化数据集导出逻辑** - 改进了数据集导出的执行顺序和错误处理
  - 先读取数据并划分，再根据实际配置创建目录结构
  - 添加了验证集和测试集为空的检查和警告
  - 确保YOLO训练要求的验证集始终存在

---

## [1.0.3] - 2025-11-5

### 🐛 问题修复 / Fixed

- ✅ **修复训练路径解析问题** - 修复了训练时相对路径无法正确解析的问题
  - 将训练临时目录从系统临时目录改为插件目录，确保相对路径正确解析
  - 修改训练程序工作目录为数据集目录，使 `data.yaml` 中的 `path: .` 能正确解析
  - 修复了 `data.yaml` 路径解析错误导致的"images not found"错误
  - 优化了数据集导出路径处理，支持导入数据集等依赖相对路径的逻辑
- ✅ **修复训练临时目录清理** - 确保训练结束后自动清理临时文件
  - 无论训练成功还是失败，都会自动删除临时目录
  - 添加了重试机制（最多3次），处理文件被占用的情况
  - 改进了错误处理，确保清理失败不影响其他逻辑
  - 添加了详细的日志记录，便于问题诊断
- ✅ **修复训练进度回调显示问题** - 改进了Socket连接处理，解决部分设备上进度不更新的问题
  - 添加了Socket服务器启动延迟，确保服务器完全就绪后再接收连接
  - 改进了Socket连接的错误处理和日志记录
  - 优化了事件处理器注册时机，确保能接收到第一条消息
  - 添加了Socket连接状态追踪，便于诊断连接问题
  - 增强了Socket选项配置（keepalive、noDelay），保持连接稳定

### 🔧 优化改进 / Improved

- ✅ **移除虚拟环境依赖检查** - 简化了训练启动流程
  - 移除了对 `python_env_config.json` 的必需检查，因为所有依赖已打包进 exe
  - `python_env_config.json` 现在是可选的，仅用于 GPU 信息（如果存在）
  - 改进了错误日志级别，配置文件不存在时记录 INFO 而非 ERROR
  - 优化了 GPU 检测逻辑，默认尝试使用 GPU，训练程序会自动检测
- ✅ **优化Socket连接处理** - 改进了训练进度回调的可靠性
  - 添加了详细的连接日志，包括远程地址信息
  - 改进了端口占用处理，自动尝试其他端口
  - 优化了消息解析错误处理，记录原始消息内容便于调试
  - 增强了Socket连接状态管理，支持多任务并发训练

---

## [1.0.2] - 2025-11-4

### ✨ 新增功能 / Added

- ✅ **标注工作台十字光标和虚线尺** - 实现了实时跟随鼠标的十字光标和虚线尺功能
  - 添加了水平线和垂直线的虚线尺，实时跟随鼠标位置
  - 虚线尺仅在图片显示区域内显示，超出范围自动隐藏
  - 使用白色虚线样式，清晰可见且不干扰标注操作
  - 虚线尺自动置于所有对象之上，确保始终可见
- ✅ **数据集回溯功能** - 支持将某个数据集一键回溯到当前项目
  - 在数据集管理界面添加了"回溯"功能，可将数据集内容快速导入到当前项目
  - 支持实时进度显示，使用统一的加载遮罩层展示回溯进度
  - 回溯完成后自动导航到标注工作台并加载数据
- ✅ **分类标注工作台** - 新增图片分类标注功能
  - 支持创建分类标注项目，为图片添加类别标签
  - 实现了多选类别功能，可为单张图片添加多个类别标签
  - 点击已选中的类别可取消选中，保存后图片将不包含该类别
  - 分类工作台具有独立的界面和快捷键系统
  - 支持图片列表的展开/折叠、状态筛选、虚拟滚动等功能
  - 类别标签样式与目标检测工作台保持一致，提供统一的视觉体验

### 🐛 问题修复 / Fixed

- ✅ **修复分类项目恢复问题** - 修复了分类工作台关闭窗口后重新打开时错误加载为目标检测工作台的问题
  - 修复了项目配置读取时类型为 `undefined` 的问题
  - 添加了项目配置修复逻辑，确保 `type` 字段正确读取
  - 改进了项目恢复逻辑，根据项目类型自动跳转到对应工作台
  - 添加了旧项目兼容处理，缺失 `type` 字段时自动补充默认值
  - 修复了配置修复函数，确保修复后的配置包含 `type` 字段

### 🔧 优化改进 / Improved

- ✅ **统一加载UI样式** - 统一了所有操作的加载提示界面
  - 数据集导入、创建、更新、删除、回溯等操作统一使用相同的加载遮罩层样式
  - 使用全局 `Loading.vue` 组件，提供一致的加载体验
  - 加载遮罩层显示实时进度，包括当前操作和完成百分比
  - 优化了加载遮罩层的显示逻辑，确保在所有操作中都能正确显示和关闭
- ✅ **优化虚线尺渲染性能** - 大幅提升虚线尺的渲染效率和流畅度
  - 使用 `requestAnimationFrame` 自动匹配屏幕刷新率（支持60Hz/120Hz等高刷新率显示器）
  - 移除了手动时间节流，让浏览器自动优化渲染频率
  - 优化了位置更新逻辑，减少不必要的重绘操作
  - 修复了虚线尺拖影问题，确保每次位置变化时旧线条被正确清除
  - 添加了位置变化检测，仅在位置实际改变时更新，避免无效渲染
  - 在绘制状态下延迟渲染，与绘制操作统一处理，避免冲突
- ✅ **优化分类工作台用户体验** - 改进了分类标注的交互体验
  - 类别标签支持多选，提供更灵活的标注方式
  - 选中状态清晰可见，支持点击取消选中
  - 保存逻辑优化，只有选中的类别会被保存到图片标注中
  - 图片状态标签显示多个类别名称（用逗号分隔）

---

## [1.0.1] - 2025-11-4

### 🐛 问题修复 / Fixed

- ✅ **修复删除图片逻辑异常** - 修复了删除图片、项目、数据集时图片文件被误删的问题
  - 修复了删除图片时无法正确检测项目引用的问题
  - 修复了删除数据集时未正确扫描所有版本引用的问题
  - 实现了项目路径注册系统，确保引用检查能找到所有项目（无论存储位置）
  - 添加了二次验证机制，在删除前再次确认图片引用状态，防止误删被引用的图片
  - 优化了删除流程，支持多版本数据集（有多个版本时直接删除，不扫描引用）
  - 添加了删除进度显示，使用加载卡片实时显示删除进度，并移除了关闭按钮
- ✅ **修复模型路径问题** - 修改训练时使用的模型路径，优先使用安装目录根目录下的 `model` 目录
  - 训练时优先使用安装目录根目录的 `model` 目录
  - 打包时将模型文件复制到安装目录根目录的 `model` 目录
  - 支持工作空间的 `model` 目录作为备选路径

---

## [1.0.0] - 2025-11-3

**第一个正式版本 / First Stable Release**

🎉 YoloMarkFlow 1.0.0 正式发布！这是项目的第一个稳定版本，提供了完整的图像标注功能以及可扩展的插件化架构。

YoloMarkFlow 1.0.0 is now available! This is the first stable release with complete image annotation features and an extensible plugin architecture.

### ✨ 新增功能 / Added

#### 🎨 标注功能 / Annotation Features

- ✅ **矩形框标注系统** - 绘制、编辑、删除边界框
- ✅ **类别管理** - 创建、编辑、删除，24 色自动分配
- ✅ **快捷键支持** - Enter 保存、方向键切换、Backspace 删除等，支持自定义
- ✅ **画布操作** - 缩放（10%-500%）、平移（空格+左键）、全屏模式
- ✅ **图片管理** - 批量导入（JPG/JPEG/PNG/BMP/WebP）、MD5 去重、状态筛选
- ✅ **虚拟滚动** - 支持 1000+ 图片流畅加载
- ✅ **负样本标注** - 标记无目标图片
- ✅ **实时预览** - 标注框实时显示、Toast 提示

#### 🗂️ 图片池架构 / Image Pool

- ✅ **智能去重** - MD5 文件哈希检测，避免重复存储
- ✅ **多项目复用** - 同一图片跨项目使用，引用计数管理
- ✅ **SQLite 存储** - 高效数据库，自动索引优化

#### 📊 数据集管理 / Dataset Management

- ✅ **多项目合并** - 选择项目合并生成数据集
- ✅ **版本管理** - 数据集版本控制与回滚
- ✅ **YOLO 导出** - images/、labels/、data.yaml，Train/Val/Test 划分
- ✅ **COCO 导出** - 标准 COCO JSON 格式
- ✅ **导出历史** - 导出记录与进度显示

#### 🤖 模型训练 / Model Training（需插件）

- ✅ **模型支持** - YOLOv5/v8/11，n/s/m/l/x 五种规模
- ✅ **训练配置** - Epochs（10-500）、Batch（1-64）、Image Size（640/800/1024）
- ✅ **数据增强** - Mosaic、MixUp、HSV、翻转
- ✅ **实时监控** - 损失曲线、评估指标、硬件使用率、训练速度
- ✅ **可视化图表** - ECharts 实时绘制训练曲线
- ✅ **任务管理** - 创建、暂停、恢复、停止、重新训练
- ✅ **模型导出** - 导出训练好的权重文件

#### 🔌 插件系统 / Plugin System

- ✅ **插件导入** - ZIP/RAR 压缩包自动解压安装
- ✅ **插件接口** - 标准化插件规范
- ✅ **模块化架构** - 训练/推理插件独立

#### 🎨 UI/UX

- ✅ **黑白极简设计** - 统一设计语言，清晰的层次结构
- ✅ **响应式布局** - 三栏式布局，侧边栏折叠，自适应窗口
- ✅ **性能优化** - 虚拟滚动、懒加载、Canvas 复用
- ✅ **用户体验** - Toast 提示、加载指示、快捷键系统

#### 🛠️ 技术栈 / Tech Stack

- ✅ **Electron + Vue 3** - 主进程 + 渲染进程架构
- ✅ **SQLite** - 本地数据库存储
- ✅ **Vite + electron-builder** - 快速构建与打包
- ✅ **插件化架构** - 训练/推理功能模块化

### 🐛 问题修复 / Fixed

- ✅ 修复大量图片加载卡顿（实现虚拟滚动）
- ✅ 修复内存泄漏（Canvas/事件监听器/数据库连接）
- ✅ 修复 FabricJS 响应式冲突（Vue 3 Proxy 兼容性）
- ✅ 修复标注保存失败（数据序列化问题）
- ✅ 修复 CSS 语法警告（嵌套 @keyframes）

### 🔧 优化改进 / Improved

- ✅ 图片池架构优化（去重、复用、引用计数）
- ✅ 数据库优化（索引、查询、连接池）
- ✅ 代码重构与规范化
- ✅ 用户体验优化

---

## 📊 统计信息 / Statistics

### 代码规模 / Code Size

- **总代码行数**: ~15,000+ lines
- **Vue 组件**: 20+ components
- **工具函数**: 30+ utilities
- **主进程模块**: 6 modules

### 功能模块 / Feature Modules

- **标注功能**: ✅ 完整
- **项目管理**: ✅ 完整
- **数据集管理**: ✅ 完整
- **训练功能**: ✅ 完整（插件）
- **插件系统**: ✅ 完整

### 技术覆盖 / Technology Coverage

- **前端技术**: Vue 3, Element Plus, Fabric.js, ECharts
- **后端技术**: Electron, Node.js, SQLite
- **构建工具**: Vite, electron-builder
- **开发工具**: ESLint, Git

---

## 🔮 未来规划 / Future Plans

### v1.1.0 计划 / v1.1.0 Plans

- [ ] 多边形标注支持
- [ ] 语义分割标注
- [ ] 关键点标注
- [ ] 自动标注（AI 辅助）
- [ ] 云端训练支持

### v1.2.0 计划 / v1.2.0 Plans

- [ ] 协作标注功能
- [ ] 标注质量审核
- [ ] 标注统计报表
- [ ] 导入其他格式
- [ ] 模型评估工具

### 长期规划 / Long-term Plans

- [ ] 云端部署版本
- [ ] 企业版功能
- [ ] 社区插件市场
- [ ] AI 模型集成

---

## 🤝 贡献者 / Contributors

感谢所有为 YoloMarkFlow 做出贡献的人！

Thanks to all contributors who helped make YoloMarkFlow possible!

---

## 📞 支持 / Support

**遇到问题？/ Having Issues?**

我们提供多种反馈渠道，欢迎随时联系我们：

We provide multiple feedback channels, feel free to contact us anytime:

### 🐛 提交 Issue / Submit Issues

- **GitHub Issues**: [提交问题](https://github.com/aaaazbwzbw/YoloMarkFlow/issues)
- 这是最推荐的反馈方式，便于跟踪和管理问题
- This is the most recommended feedback method for tracking and managing issues

### 📧 邮件反馈 / Email Feedback

- **邮箱 / Email**: [1526196180@qq.com](mailto:1526196180@qq.com)
- 适合详细的问题描述、功能建议或技术支持请求
- Suitable for detailed problem descriptions, feature suggestions, or technical support requests

### 💬 QQ 反馈 / QQ Feedback

- **QQ 号 / QQ Number**: `1526196180`
- 适合快速沟通和实时反馈
- Suitable for quick communication and real-time feedback

### 📖 其他资源 / Other Resources

- 查看 [文档](README.md) / Check [Documentation](README.md)
- 加入社区讨论 / Join the community discussion

### 📝 反馈建议 / Feedback Suggestions

为了更好地帮助您解决问题，建议在反馈时包含以下信息：

To better help you resolve issues, please include the following information in your feedback:

- **问题描述 / Problem Description**: 详细描述遇到的问题
- **复现步骤 / Reproduction Steps**: 如何重现这个问题
- **环境信息 / Environment**: 操作系统版本、YoloMarkFlow 版本、相关配置信息
- **错误信息 / Error Messages**: 如果有错误提示，请提供完整的错误信息
- **截图 / Screenshots**: 如果可能，请提供相关截图
- **日志文件 / Log Files**: **请附上程序安装目录中的 `.log` 文件**（如 `YoloMarkFlow.log`），这有助于我们快速定位问题
  - **Please attach the `.log` file from the program installation directory** (e.g., `YoloMarkFlow.log`), which helps us quickly identify issues

---

**© 2025 YoloMarkFlow. All rights reserved.**
