# 贡献指南 / Contributing Guide

感谢您考虑为 YoloMarkFlow 做出贡献！我们欢迎所有形式的贡献。

Thanks for considering contributing to YoloMarkFlow! We welcome contributions of all kinds.

---

## 📋 目录 / Table of Contents

- [行为准则 / Code of Conduct](#行为准则--code-of-conduct)
- [如何贡献 / How to Contribute](#如何贡献--how-to-contribute)
- [开发环境 / Development Environment](#开发环境--development-environment)
- [代码规范 / Code Standards](#代码规范--code-standards)
- [提交流程 / Submission Process](#提交流程--submission-process)
- [获取帮助 / Getting Help](#获取帮助--getting-help)

---

## 🤝 如何贡献 / How to Contribute

### 🐛 报告 Bug / Report Bugs

如果您发现了 Bug，请创建一个 Issue，并包含以下信息：

If you find a bug, please create an Issue with the following information:

**必需信息 / Required Information:**

- **Bug 描述 / Description**: 清晰描述问题 / Clear description of the problem
- **复现步骤 / Steps to Reproduce**: 详细的复现步骤 / Detailed steps to reproduce
- **预期行为 / Expected Behavior**: 您期望发生什么 / What you expected to happen
- **实际行为 / Actual Behavior**: 实际发生了什么 / What actually happened
- **系统环境 / Environment**:
  - 操作系统 / OS (Windows 10/11, macOS, Linux)
  - 应用版本 / App Version
  - Node.js 版本 / Node.js Version
  - 是否使用 GPU / GPU Usage
- **截图/日志 / Screenshots/Logs**: 如果可能，提供截图或错误日志 / If possible, provide screenshots or error logs

**模板 / Template:**

```markdown
**环境 / Environment:**
- OS: Windows 11
- Version: 1.0.4
- Node.js: 18.0.0

**问题描述 / Description:**
简明扼要地描述问题 / Briefly describe the issue

**复现步骤 / Steps to Reproduce:**
1. 执行第一步 / Execute first step
2. 执行第二步 / Execute second step
3. 问题出现 / Problem occurs

**预期行为 / Expected:**
应该发生什么 / What should happen

**实际行为 / Actual:**
实际发生了什么 / What actually happened

**截图 / Screenshots:**
如果适用 / If applicable
```

### 💡 提出功能建议 / Suggest Features

我们欢迎功能建议！请创建一个 Issue，并说明：

We welcome feature suggestions! Please create an Issue and describe:

- **功能描述 / Feature Description**: 您希望添加什么功能 / What feature you want
- **使用场景 / Use Case**: 这个功能解决什么问题 / What problem does it solve
- **建议实现 / Proposed Implementation**: （可选）您认为如何实现 / (Optional) How you think it should be implemented

**模板 / Template:**

```markdown
**功能描述 / Feature:**
这个功能应该做什么 / What should this feature do

**使用场景 / Use Case:**
为什么需要这个功能 / Why is this feature needed

**建议实现 / Implementation:**
您认为如何实现 / How it could be implemented

**截图 / Mockups:**
如果适用 / If applicable
```

### 💻 提交代码 / Submit Code

1. **Fork 项目 / Fork the Repository**
   - 点击右上角的 Fork 按钮 / Click the Fork button

2. **克隆到本地 / Clone to Local**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YoloMarkFlow.git
   cd YoloMarkFlow/Electron+vue
   ```

3. **添加上游仓库 / Add Upstream**
   ```bash
   git remote add upstream https://github.com/aaaazbwzbw/YoloMarkFlow.git
   ```

4. **创建分支 / Create Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # 或 / or
   git checkout -b fix/your-bug-fix
   ```

5. **安装依赖 / Install Dependencies**
   ```bash
   npm install
   ```

6. **进行开发 / Make Changes**
   - 保持代码风格一致 / Keep code style consistent
   - 添加必要的注释 / Add necessary comments
   - 测试您的更改 / Test your changes

7. **提交更改 / Commit Changes**
   ```bash
   git add .
   git commit -m "feat: 添加XXX功能 / Add XXX feature"
   # 或 / or
   git commit -m "fix: 修复XXX问题 / Fix XXX issue"
   ```

8. **更新代码 / Update Code**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

9. **推送到 GitHub / Push to GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```

10. **创建 Pull Request / Create PR**
    - 在 GitHub 上打开您的 Fork / Open your Fork on GitHub
    - 点击 "New Pull Request" / Click "New Pull Request"
    - 填写 PR 描述 / Fill PR description

---

## 🛠️ 开发环境 / Development Environment

### 环境要求 / Requirements

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **Git**: Latest version

### 安装依赖 / Install Dependencies

```bash
# 安装 npm 依赖 / Install npm dependencies
npm install

# 如果需要重建 sqlite3 / If need to rebuild sqlite3
npm run rebuild
```

### 启动开发环境 / Start Development

```bash
# 同时启动 Vue 和 Electron / Start both Vue and Electron
npm run dev

# 或分别启动 / Or start separately
npm run vue-dev  # 启动 Vue 开发服务器 / Start Vue dev server
npm run electron # 启动 Electron 应用 / Start Electron app
```

### 构建应用 / Build Application

```bash
# 构建 Vue 应用 / Build Vue app
npm run build

# 构建 Electron 桌面应用 / Build Electron desktop app
npm run electron:build
```

**注意 / Note:** 
构建路径建议使用纯英文路径，避免中文路径导致的 NSIS 打包问题。
It's recommended to build in a path with only English characters to avoid NSIS packaging issues.

### 项目结构 / Project Structure

```
Electron+vue/
├── electron/                 # Electron 主进程 / Main Process
│   ├── main.js              # 入口文件 / Entry file
│   ├── preload.js           # 预加载脚本 / Preload script
│   ├── pluginManager.js     # 插件管理器 / Plugin manager
│   ├── trainingController.js # 训练控制器 / Training controller
│   ├── inferenceService.js  # 推理服务 / Inference service
│   └── modelScanner.js      # 模型扫描器 / Model scanner
├── src/                      # Vue 应用源代码 / Vue App Source
│   ├── views/               # 页面组件 / Page components
│   │   ├── MainLayout.vue   # 主布局 / Main layout
│   │   ├── Workbench.vue    # 标注工作台 / Annotation workspace
│   │   ├── Training.vue     # 模型训练 / Model training
│   │   ├── Datasets.vue     # 数据集管理 / Dataset management
│   │   ├── Welcome.vue      # 欢迎页 / Welcome page
│   │   ├── ModelHub.vue     # 模型中心 / Model hub
│   │   ├── Settings.vue     # 设置 / Settings
│   │   └── Help.vue         # 帮助 / Help
│   ├── components/          # 公共组件 / Common components
│   │   ├── TrainingTaskCard.vue    # 训练任务卡片
│   │   ├── TrainingConfigPanel.vue # 训练配置面板
│   │   ├── TrainingMonitor.vue     # 训练监控器
│   │   ├── HardwareMonitor.vue     # 硬件监控
│   │   ├── Modal.vue        # 模态框
│   │   ├── Toast.vue        # 消息提示
│   │   └── Loading.vue      # 加载指示器
│   ├── utils/               # 工具函数 / Utility functions
│   │   ├── imagePool.js     # 图片池管理
│   │   ├── datasetManager.js # 数据集管理
│   │   ├── trainingManager.js # 训练管理器
│   │   ├── projectManager.js # 项目管理
│   │   ├── annotation.js    # 标注工具
│   │   ├── canvas.js        # Canvas 工具
│   │   ├── database.js      # 数据库封装
│   │   └── exporters/       # 导出器 / Exporters
│   │       ├── YoloExporter.js
│   │       └── CocoExporter.js
│   ├── router/              # 路由配置 / Router config
│   └── styles/              # 全局样式 / Global styles
├── plugins/                  # 插件目录 / Plugin directory
│   └── README.md            # 插件说明
├── models/                   # 模型文件目录 / Model files
├── build/                    # 构建配置 / Build config
│   ├── icons/               # 应用图标 / App icons
│   └── installer-hooks.nsh  # NSIS 安装脚本
├── loading.html             # 加载页面
├── package.json             # 项目配置
└── vite.config.js           # Vite 配置
```

---

## 📝 代码规范 / Code Standards

### 提交信息规范 / Commit Message Convention

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

We use the [Conventional Commits](https://www.conventionalcommits.org/) specification:

**类型 / Types:**

- `feat:` 新功能 / New feature
- `fix:` Bug 修复 / Bug fix
- `docs:` 文档更新 / Documentation update
- `style:` 代码格式（不影响代码运行）/ Code style (no code changes)
- `refactor:` 重构 / Code refactoring
- `perf:` 性能优化 / Performance improvement
- `test:` 测试相关 / Test changes
- `chore:` 构建过程或辅助工具变动 / Build process or auxiliary tool changes

**格式 / Format:**

```
<type>: <subject>

<body>

<footer>
```

**示例 / Examples:**

```bash
feat: 添加批量导出功能 / Add batch export feature

fix: 修复标注框无法删除的问题 / Fix issue where bounding box cannot be deleted

docs: 更新 README 安装说明 / Update README installation instructions

perf: 优化大量图片加载性能 / Optimize bulk image loading performance

refactor: 重构图片池管理逻辑 / Refactor image pool management logic
```

### Vue 组件规范 / Vue Component Standards

**命名规范 / Naming:**

- 组件名：`PascalCase`（如 `TrainingMonitor.vue`）
- Props：`camelCase`
- 事件名：`kebab-case`
- 方法名：`camelCase`

**文件结构 / File Structure:**

```vue
<template>
  <!-- 模板内容 / Template content -->
</template>

<script>
// 1. 导入 / Imports
import { ref, computed } from 'vue'

// 2. export default
export default {
  // 3. name
  name: 'ComponentName',
  
  // 4. components
  components: {},
  
  // 5. props
  props: {},
  
  // 6. emits
  emits: ['event-name'],
  
  // 7. setup (Composition API)
  setup() {
    // 8. reactive data
    const data = ref(null)
    
    // 9. computed
    const computedValue = computed(() => {})
    
    // 10. watch
    watch(() => {}, () => {})
    
    // 11. lifecycle hooks
    onMounted(() => {})
    
    // 12. methods
    const method = () => {}
    
    // 13. return
    return {
      data,
      computedValue,
      method
    }
  }
}
</script>

<style scoped>
/* 样式 / Styles */
</style>
```

### JavaScript 规范 / JavaScript Standards

**代码风格 / Code Style:**

- 缩进：2 空格 / Indentation: 2 spaces
- 引号：单引号 / Quotes: Single quotes
- 分号：不使用 / Semicolons: Not used
- 变量声明：优先使用 `const`，其次 `let`，避免 `var` / Prefer `const`, then `let`, avoid `var`
- 函数：优先使用箭头函数 / Prefer arrow functions
- 注释：添加必要的注释说明 / Add necessary comments

**示例 / Example:**

```javascript
// ✅ 推荐 / Good
const data = ref(null)
const computedValue = computed(() => data.value * 2)

const handleClick = () => {
  console.log('Clicked')
}

// ❌ 不推荐 / Bad
var data = null
const computedValue = computed(function() {
  return data * 2
})

function handleClick() {
  console.log('Clicked')
}
```

### 文件命名规范 / File Naming Convention

- Vue 组件：`PascalCase.vue`（如 `TrainingMonitor.vue`）
- 工具文件：`camelCase.js`（如 `datasetManager.js`）
- 常量文件：`UPPER_CASE.js`（如 `CONSTANTS.js`）
- 配置文件：`camelCase` 或 `kebab-case`（如 `vite.config.js`）

---

## ✅ 测试 / Testing

在提交 PR 前，请确保：

Before submitting a PR, please ensure:

- [ ] 代码能正常运行 / Code runs without errors
- [ ] 没有控制台错误 / No console errors
- [ ] 在 Windows 上测试通过 / Tested on Windows
- [ ] 核心功能正常工作 / Core features work properly
- [ ] 没有明显的性能问题 / No obvious performance issues
- [ ] 代码符合项目规范 / Code follows project standards
- [ ] 添加了必要的测试 / Added necessary tests

### 测试清单 / Testing Checklist

**标注功能 / Annotation:**

- [ ] 图片导入正常 / Image import works
- [ ] 类别管理正常 / Category management works
- [ ] 标注框绘制/编辑/删除正常 / Bounding box draw/edit/delete works
- [ ] 保存功能正常 / Save function works
- [ ] 负样本功能正常 / Negative sample works

**数据集管理 / Dataset:**

- [ ] 数据集创建正常 / Dataset creation works
- [ ] YOLO 导出正常 / YOLO export works
- [ ] COCO 导出正常 / COCO export works
- [ ] 历史记录正常 / History works

**训练功能 / Training (if plugin available):**

- [ ] 训练配置正常 / Training config works
- [ ] 训练启动正常 / Training starts properly
- [ ] 进度监控正常 / Progress monitoring works
- [ ] 可视化图表正常 / Visualization charts work

---

## 📝 Pull Request 流程 / PR Process

### PR 检查清单 / PR Checklist

- [ ] 从 `main` 分支的最新代码创建 / Created from latest `main`
- [ ] 提交信息符合规范 / Commit messages follow convention
- [ ] 代码符合项目规范 / Code follows project standards
- [ ] 测试通过 / Tests pass
- [ ] 没有合并冲突 / No merge conflicts
- [ ] 已更新相关文档 / Updated relevant documentation
- [ ] PR 描述清晰 / PR description is clear

### PR 模板 / PR Template

```markdown
**变更类型 / Change Type:**
- [ ] Bug 修复 / Bug fix
- [ ] 新功能 / New feature
- [ ] 性能优化 / Performance improvement
- [ ] 文档更新 / Documentation update
- [ ] 代码重构 / Code refactoring

**问题描述 / Description:**
描述这个 PR 解决了什么问题 / Describe what this PR solves

**变更内容 / Changes:**
- 变更项 1 / Change 1
- 变更项 2 / Change 2
- 变更项 3 / Change 3

**测试 / Testing:**
描述如何测试这些更改 / Describe how to test these changes

**截图 / Screenshots:**
如果适用 / If applicable

**检查清单 / Checklist:**
- [ ] 代码符合规范 / Code follows standards
- [ ] 测试通过 / Tests pass
- [ ] 文档已更新 / Documentation updated
```

---

## 🤝 行为准则 / Code of Conduct

所有贡献者应遵守以下行为准则：

All contributors should follow these principles:

- **尊重他人 / Respect Others**：尊重所有贡献者 / Respect all contributors
- **接受建设性批评 / Accept Constructive Criticism**：以开放的心态接受反馈 / Accept feedback with an open mind
- **专注项目 / Focus on the Project**：专注于对项目最有利的事情 / Focus on what's best for the project
- **同理心 / Empathy**：表现出对社区其他成员的同理心 / Show empathy towards other community members
- **包容性 / Inclusivity**：欢迎所有背景的人参与 / Welcome people of all backgrounds

### 需要帮助？/ Need Help?

**资源 / Resources:**

- 📖 [README](README.md) - 项目介绍 / Project introduction
- 📝 [用户手册](用户手册.md) - 使用指南 / Usage guide
- 📊 [更新日志](CHANGELOG.md) - 版本历史 / Version history
- 🐛 [Issues](https://github.com/aaaazbwzbw/YoloMarkFlow/issues) - 问题反馈 / Issue tracker
- 💬 [Discussions](https://github.com/aaaazbwzbw/YoloMarkFlow/discussions) - 社区讨论 / Community discussions

**联系方式 / Contact:**

- 提交 [Issue](https://github.com/aaaazbwzbw/YoloMarkFlow/issues)
- 加入 Discussions
- 查看文档

---

## 🙏 致谢 / Acknowledgments

感谢所有贡献者！您的贡献让 YoloMarkFlow 变得更好。

Thank you to all contributors! Your contributions make YoloMarkFlow better.

---

**感谢您的贡献！🎉**

**Thank you for contributing! 🎉**
