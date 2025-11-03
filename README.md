# YoloMarkFlow

<div align="center">

![YoloMarkFlow Logo](build/icons/png/512x512.png)

**专业图像标注工具 - 支持 YOLO 训练**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/aaaazbwzbw/YoloMarkFlow)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://www.microsoft.com/windows)

[English](./README_EN.md) | 简体中文

</div>

---

## 项目简介

YoloMarkFlow 是一款专业且易用的图像标注工具，采用极简的黑白设计风格，为 AI 训练提供高质量的数据标注支持。支持 YOLO/COCO 等主流格式，同时可集成插件实现模型训练功能。

**核心定位：**
- 🎯 **专注标注** - 专业、高效的图像标注工具
- 🤖 **可选训练** - 通过插件扩展，实现完整的训练流程
- 🔌 **插件化架构** - 模块化设计，易于扩展
- 🎨 **极简界面** - 黑白简约风格，专注工作效率

---

## ✨ 核心特性

### 📝 完整的图像标注工作台

**标注功能**
- **矩形框标注** - 点击图片空白处拖拽绘制边界框
- **标注框编辑** - 调整大小、移动位置、删除标注
- **标注框右键菜单** - 快速删除、复制等操作
- **标注框标签显示** - 显示类别名称和置信度
- **实时预览** - 标注框实时显示，所见即所得

**类别管理**
- **创建/编辑/删除类别** - 完整的类别管理
- **自动颜色分配** - 24 色预设，自动分配
- **自定义颜色** - 支持手动选择颜色
- **类别拖拽排序** - 调整类别顺序
- **类别统计** - 实时显示各类别标注数量

**图片管理**
- **导入图片** - 支持选择文件或文件夹批量导入
- **支持格式** - JPG、JPEG、PNG、BMP、WebP
- **自动去重** - 基于 MD5 文件哈希，避免重复存储
- **状态筛选** - 全部/已标注/未标注/负样本
- **展开/折叠模式** - 调整缩略图显示大小（50%-200%）
- **虚拟滚动** - 支持 1000+ 图片流畅加载
- **图片右键菜单** - 删除图片等操作

**画布操作**
- **缩放** - 10% - 500%（鼠标滚轮或 + - 键）
- **平移** - 空格键 + 鼠标左键拖拽
- **重置视图** - Ctrl+0 恢复到 100%
- **全屏模式** - 全屏标注工作台

**快捷键支持**
- `Enter` - 保存标注
- `Ctrl+Shift+S` - 保存为负样本
- `→` - 下一张图片
- `←` - 上一张图片
- `Ctrl+→` - 跳转到下一张未标注
- `Ctrl+←` - 跳转到上一张未标注
- `Backspace` / `Delete` - 删除选中标注框
- `+` / `-` - 放大/缩小
- `Ctrl+0` - 重置缩放

**工具栏**
- **自动保存** - 切换图片时自动保存标注
- **模型辅助** - 使用已训练模型自动识别（可选）
- **置信度阈值** - 调整模型推理阈值
- **快捷键设置** - 自定义快捷键
- **工具栏卡片** - 可拖拽悬浮工具栏

### 🗂️ 统一图片池架构

**图片池系统**
- **智能去重** - MD5 文件哈希自动识别重复图片
- **多项目复用** - 同一图片可在多个项目中使用
- **引用计数** - 自动管理图片引用关系
- **高效存储** - SQLite 数据库，性能优越
- **工作空间配置** - 自定义图片池存储路径

**项目管理**
- **创建项目** - 输入名称创建新项目
- **切换项目** - 在多个项目间快速切换
- **删除项目** - 支持仅删除记录或同时删除数据
- **项目统计** - 实时显示图片数量和标注进度

### 📊 数据集管理

**数据集创建**
- **多项目选择** - 从多个项目中选择类别
- **类别筛选** - 选择性合并特定类别
- **统计预览** - 显示合并后的统计数据
- **版本管理** - 自动版本号，支持多个版本

**数据集导出**
- **YOLO 格式**
  - Train/Val/Test 数据划分
  - 自定义划分比例（滑块配置）
  - 自动生成 `data.yaml` 配置文件
  - 归一化坐标格式
  - 目录结构：images/、labels/、data.yaml
  
- **COCO JSON 格式**
  - 标准 COCO 数据结构
  - categories、images、annotations
  - 坐标格式自动转换
  - 完整元数据支持
  
**数据集操作**
- **更新数据集** - 重新生成数据集内容
- **版本切换** - 切换到历史版本
- **导出历史** - 查看所有导出记录
- **删除操作** - 删除当前版本或所有版本

### 🤖 模型训练（需插件支持）

**支持模型**
- **YOLOv5** - yolov5n/s/m/l/x.pt
- **YOLOv8** - yolov8n/s/m/l/x.pt
- **YOLO11** - yolo11n/s/m/l/x.pt
- **预训练权重** - 支持使用预训练模型
- **从头训练** - 不使用预训练权重

**训练配置**
- **任务名称** - 自定义训练任务名称
- **数据集选择** - 选择已创建的数据集
- **YOLO 版本** - 选择模型版本
- **模型规模** - n/s/m/l/x 五种规模
- **预训练权重** - 开关控制是否使用预训练
- **输出目录** - 自定义训练输出路径
- **Epochs** - 10-500（步长 10）
- **Batch Size** - 1-64（步长 1）
- **Image Size** - 640/800/1024
- **数据增强** - Mosaic、MixUp、HSV、翻转

**高级配置**
- **学习率** - 0.0001-0.1
- **优化器** - SGD、Adam、AdamW
- **Train/Val 比例** - 自定义划分比例
- **早停** - 自动停止训练
- **Patience** - 5-100（步长 5）

**训练监控**
- **实时进度** - 当前轮次、总轮次、预计时间
- **损失曲线** - Train Loss、Val Loss
- **评估指标** - mAP、mAP50、Precision、Recall
- **硬件监控** - CPU、内存、GPU 使用率
- **训练速度** - images/sec
- **图表可视化** - ECharts 实时绘制

**训练管理**
- **任务队列** - 显示所有训练任务
- **任务控制** - 开始、暂停、恢复、停止
- **重新训练** - 使用相同配置重新训练
- **训练历史** - 查看所有已完成任务
- **模型导出** - 导出训练好的权重文件
- **模型评估** - 评估模型性能
- **打开目录** - 查看训练输出文件

### 🔌 插件系统

**插件管理**
- **插件导入** - 支持 ZIP、RAR 压缩包
- **自动解压** - 静默解压到插件目录
- **插件验证** - 检查插件完整性
- **插件扫描** - 自动扫描可用插件

**插件接口**
- **训练插件** - yolo-training-inference
- **推理服务** - 模型推理接口
- **标准化接口** - 统一的插件规范

---

## 🛠️ 技术栈

**前端框架**
- Vue 3.3.4 + Composition API
- Vue Router 4.2.4
- Element Plus 2.4.1
- Arco Design 2.57.0

**图形与可视化**
- Fabric.js 5.3.0 - Canvas 标注绘图
- ECharts 6.0.0 - 训练曲线可视化

**桌面应用**
- Electron 26.2.1
- Node.js 运行时

**数据存储**
- SQLite3 5.1.7 - 本地数据库

**构建工具**
- Vite 4.4.9
- electron-builder 24.6.4

**虚拟滚动**
- vue3-virtual-scroll-list
- vue3-virtual-scroller
- vue-virtual-scroll-grid

**其他依赖**
- adm-zip 0.5.16 - 文件解压

---

## 📦 安装和运行

### 环境要求

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **操作系统**: Windows 10/11（推荐）

### 从源码构建

```bash
# 1. 克隆仓库
git clone https://github.com/aaaazbwzbw/YoloMarkFlow.git
cd YoloMarkFlow/Electron+vue

# 2. 安装依赖
npm install

# 3. 开发模式运行
npm run dev

# 或分别启动
npm run vue-dev  # 启动 Vue 开发服务器（http://localhost:5173）
npm run electron # 启动 Electron 应用
```

### 下载预编译版本

访问 [GitHub Releases](https://github.com/aaaazbwzbw/YoloMarkFlow/releases) 下载最新版本安装包。

---

## 🏗️ 构建应用

```bash
# 构建 Windows 安装包
npm run electron:build

# 构建产物位于 D:/temp-build-output/
```

**注意事项：**
- 建议在纯英文路径下构建，避免 NSIS 打包因中文路径失败
- 如路径含中文导致打包失败，可修改 `package.json` 中的输出目录为纯英文路径

---

## 📁 项目结构

```
Electron+vue/
├── electron/                 # Electron 主进程
│   ├── main.js              # 主进程入口，IPC 接口
│   ├── preload.js           # 预加载脚本
│   ├── pluginManager.js     # 插件管理器
│   ├── trainingController.js # 训练控制器
│   ├── inferenceService.js  # 推理服务
│   └── modelScanner.js      # 模型扫描器
├── src/                      # Vue 应用源码
│   ├── views/               # 页面组件
│   │   ├── MainLayout.vue   # 主布局
│   │   ├── Workbench.vue    # 标注工作台 ⭐
│   │   ├── Training.vue     # 模型训练
│   │   ├── Datasets.vue     # 数据集管理
│   │   ├── Welcome.vue      # 欢迎页
│   │   ├── ModelHub.vue     # 模型中心
│   │   ├── Settings.vue     # 设置
│   │   └── Help.vue         # 帮助
│   ├── components/          # 公共组件
│   │   ├── TrainingTaskCard.vue    # 训练任务卡片
│   │   ├── TrainingConfigPanel.vue # 训练配置面板
│   │   ├── TrainingMonitor.vue     # 训练监控器
│   │   ├── HardwareMonitor.vue     # 硬件监控
│   │   ├── Modal.vue        # 模态框
│   │   ├── Toast.vue        # 消息提示
│   │   └── Loading.vue      # 加载指示器
│   ├── utils/               # 工具函数
│   │   ├── imagePool.js     # 图片池管理 ⭐
│   │   ├── datasetManager.js # 数据集管理
│   │   ├── trainingManager.js # 训练管理器
│   │   ├── projectManager.js # 项目管理
│   │   ├── annotation.js    # 标注工具
│   │   ├── canvas.js        # Canvas 封装
│   │   ├── database.js      # 数据库工具
│   │   └── exporters/       # 导出器
│   │       ├── BaseExporter.js
│   │       ├── YoloExporter.js
│   │       └── CocoExporter.js
│   ├── router/              # 路由配置
│   └── styles/              # 全局样式
├── plugins/                  # 插件目录
│   └── README.md            # 插件说明
├── models/                   # 模型文件目录
├── build/                    # 构建配置
│   ├── icons/               # 应用图标
│   └── installer-hooks.nsh  # NSIS 脚本
├── package.json             # 项目配置
└── vite.config.js           # Vite 配置
```

---

## 🚀 快速开始

### 1. 创建项目

1. 启动应用，在欢迎页点击"新建项目"
2. 输入项目名称（如：人脸检测项目）
3. 点击"创建"

### 2. 导入图片

1. 进入标注工作台
2. 点击左侧"导入图片"按钮
3. 选择导入方式：
   - **选择文件** - 批量选择图片文件
   - **选择文件夹** - 导入整个文件夹
4. 系统自动去重并导入图片

**支持格式**：JPG、JPEG、PNG、BMP、WebP

### 3. 添加类别

1. 在右侧类别面板点击"添加"按钮
2. 输入类别名称（如：face）
3. 按回车或点击确认
4. 系统自动分配颜色

### 4. 开始标注

1. **选择类别** - 在右侧类别列表点击目标类别
2. **绘制标注框** - 在画布上点击空白处拖拽绘制矩形框
3. **调整标注框** - 拖拽边缘调整大小，拖拽中心移动位置
4. **保存标注** - 按 `Enter` 键或点击顶部"保存标注"按钮
5. **切换图片** - 使用 `←` `→` 方向键或点击左侧缩略图

### 5. 导出数据集

1. 进入数据集管理页面
2. 点击"创建数据集"
3. **选择项目** - 勾选要包含的项目和类别
4. **设置划分** - 配置训练/验证/测试集比例
5. **选择格式** - YOLO 或 COCO JSON
6. **选择路径** - 选择导出目录
7. 点击"开始导出"

### 6. 开始训练（需插件）

1. 安装训练插件（见下方说明）
2. 进入模型训练页面
3. 点击"新建训练"
4. **配置参数** - 选择数据集、模型、超参数
5. 点击"开始训练"
6. 监控训练进度和指标

---

## 🔌 插件安装

### 训练插件

1. **下载插件** - 获取训练插件压缩包（ZIP 或 RAR）
2. **导入插件** - 进入设置页面，点击"导入插件"
3. **选择文件** - 选择下载的插件压缩包
4. **自动安装** - 系统自动解压并安装
5. **重启应用** - 安装完成后重启应用

### 插件目录结构

```
plugins/
└── yolo-training-inference/
    ├── plugin.json         # 插件元数据
    ├── yolomarkflow.exe    # 可执行文件
    ├── yolo11n.pt         # 模型文件
    └── README.md           # 插件说明
```

---

## 🎨 设计特点

### 黑白极简风格

- **左侧菜单** - 黑色背景，白色文字
- **主内容区** - 白色背景，浅灰色调
- **按钮** - 黑色主题，简洁悬停效果
- **响应式** - 自适应窗口大小

### 性能优化

- **虚拟滚动** - 1000+ 图片流畅加载
- **图片池去重** - 节省存储空间
- **Canvas 复用** - 优化内存占用
- **懒加载** - 按需加载缩略图

### 用户体验

- **快捷键系统** - 提高标注效率
- **自动保存** - 防止数据丢失
- **Toast 提示** - 实时操作反馈
- **加载指示** - 清晰的处理状态

---

## 📚 文档

- 📖 [用户手册](用户手册.md) - 详细使用说明
- 📝 [更新日志](CHANGELOG.md) - 版本变更记录
- 🤝 [贡献指南](CONTRIBUTING.md) - 参与贡献
- 📄 [许可证](LICENSE) - MIT License

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

详细贡献指南请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。

---

## 🙏 致谢

感谢以下优秀的开源项目：

- [Electron](https://www.electronjs.org/) - 跨平台桌面框架
- [Vue.js](https://vuejs.org/) - 渐进式前端框架
- [Element Plus](https://element-plus.org/) - Vue 3 UI 组件库
- [Fabric.js](http://fabricjs.com/) - Canvas 图形库
- [ECharts](https://echarts.apache.org/) - 数据可视化库
- [Vite](https://vitejs.dev/) - 前端构建工具

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/aaaazbwzbw/YoloMarkFlow)
- [问题反馈](https://github.com/aaaazbwzbw/YoloMarkFlow/issues)
- [功能建议](https://github.com/aaaazbwzbw/YoloMarkFlow/issues)

---

<div align="center">

Made with ❤️ by YoloMarkFlow Team

© 2025 YoloMarkFlow. All rights reserved.

</div>
