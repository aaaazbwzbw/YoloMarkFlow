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

- 提交 [Issue](https://github.com/aaaazbwzbw/YoloMarkFlow/issues)
- 查看 [文档](README.md)
- 加入社区讨论

- Submit [Issues](https://github.com/aaaazbwzbw/YoloMarkFlow/issues)
- Check [Documentation](README.md)
- Join the community discussion

---

**© 2025 YoloMarkFlow. All rights reserved.**
