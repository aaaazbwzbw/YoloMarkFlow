# YoloMarkFlow

<div align="center">

![YoloMarkFlow Logo](build/icons/png/512x512.png)

**专业图像标注工具 - 支持YOLO训练**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/YOUR_USERNAME/YoloMarkFlow)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://www.microsoft.com/windows)

[English](./README_EN.md) | 简体中文

</div>

---

## 项目简介

YoloMarkFlow 是一款对非AI专业人士友好的桌面端YOLO标注与训练工具，采用极简的黑白设计风格，提供从图像标注到模型训练的端到端体验。

### 核心特性

✅ **完整的图像标注工作台**
- 矩形框绘制、编辑、删除
- 类别管理（创建、编辑、删除、颜色设置）
- 快捷键支持（Ctrl+S保存、方向键切换等）
- Canvas 缩放和拖拽
- 标注实时预览

✅ **统一图片池架构**
- 自动去重
- 多项目复用
- 高效的数据库存储

✅ **数据集管理**
- 项目创建与管理
- 数据集创建（支持多项目合并）
- 数据集版本管理与回滚
- 数据集统计信息展示

✅ **导入导出**
- YOLO 格式导入/导出
- COCO JSON 格式导入/导出
- 导出历史记录
- 导出进度实时显示

✅ **模型训练** (需插件支持)
- 训练任务创建与管理
- 训练进度实时监控
- 训练指标可视化
- 硬件资源监控
- 训练历史记录

✅ **插件化架构**
- 模块化设计
- 第三方插件支持
- 易于扩展

## 技术栈

- **前端框架**: Vue 3 + Composition API
- **UI组件库**: Element Plus
- **桌面框架**: Electron 26.2.1
- **构建工具**: Vite 4.4.9
- **数据库**: SQLite3 5.1.7
- **图形库**: Fabric.js 5.3.0
- **图表库**: ECharts 6.0.0

## 安装和运行

### 环境要求

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **操作系统**: Windows 10/11 (推荐) / macOS / Linux

### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/YoloMarkFlow.git
cd YoloMarkFlow/Electron+vue

# 安装依赖
npm install
```

### 开发模式运行

```bash
# 启动 Electron + Vue 开发环境
npm run electron:dev
```

开发服务器将在 `http://localhost:5173` 启动。

### 构建应用

```bash
# 构建 Windows 安装包
npm run electron:build
```

构建后的应用将在 `dist-electron` 目录中生成。

## 项目结构

```
Electron+vue/
├── electron/              # Electron 主进程代码
│   ├── main.js           # Electron 入口文件
│   ├── preload.js        # 预加载脚本
│   ├── pluginManager.js  # 插件管理器
│   ├── trainingController.js  # 训练控制器
│   └── inferenceService.js    # 推理服务
├── src/                   # Vue 应用源代码
│   ├── views/            # 页面组件
│   │   ├── MainLayout.vue
│   │   ├── Workbench.vue  # 标注工作台
│   │   ├── Training.vue   # 模型训练
│   │   ├── Datasets.vue   # 数据集管理
│   │   ├── ModelHub.vue
│   │   ├── Settings.vue
│   │   └── Help.vue
│   ├── components/        # 公共组件
│   ├── utils/            # 工具函数
│   │   ├── datasetManager.js
│   │   ├── trainingManager.js
│   │   └── exporters/    # 导出器
│   ├── router/           # 路由配置
│   └── styles/           # 全局样式
├── plugins/              # 插件目录
│   └── yolo-training-inference/  # 训练推理插件
├── models/               # 模型文件目录
├── build/                # 构建配置
└── package.json          # 项目配置
```

## 使用说明

### 快速开始

1. **创建项目**
   - 点击"新建项目"按钮
   - 输入项目名称
   - 点击"创建"

2. **导入图片**
   - 进入标注工作台
   - 点击"导入图片"按钮
   - 选择要标注的图片

3. **添加类别**
   - 在右侧面板添加类别
   - 每个类别自动分配颜色

4. **开始标注**
   - 选择类别
   - 在画布上拖动绘制标注框
   - 按 Ctrl+S 保存

### 插件安装

1. 下载插件压缩包
2. 在"设置"页面选择"导入插件"
3. 选择插件文件
4. 重启应用

更多详情请查看 [用户手册](用户手册.md)

## 设计特点

### 黑白极简风格

- 左侧菜单: 纯黑背景，白色文字
- 主内容区: 白色背景，浅灰色调点缀
- 按钮: 黑色主题按钮，简洁的悬停效果

### 响应式布局

- 虚拟滚动优化（支持1000+图片流畅加载）
- 自适应窗口大小
- 流畅的动画效果

## 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

详细贡献指南请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

## 许可证

本项目采用 [MIT License](LICENSE) 许可证。

## 致谢

感谢所有为 YoloMarkFlow 做出贡献的开发者！

- [Element Plus](https://element-plus.org/) - UI 组件库
- [Fabric.js](http://fabricjs.com/) - Canvas 图形库
- [ECharts](https://echarts.apache.org/) - 图表库
- [Electron](https://www.electronjs.org/) - 桌面框架

## 相关链接

- [用户手册](用户手册.md)
- [更新日志](CHANGELOG.md)
- [问题反馈](https://github.com/YOUR_USERNAME/YoloMarkFlow/issues)
- [功能建议](https://github.com/YOUR_USERNAME/YoloMarkFlow/issues)

---

<div align="center">

Made with ❤️ by YoloMarkFlow Team

</div>

