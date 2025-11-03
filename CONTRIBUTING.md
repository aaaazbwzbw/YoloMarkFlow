# 贡献指南

感谢您考虑为 YoloMarkFlow 做出贡献！

## 如何贡献

### 报告 Bug

如果您发现了 Bug，请创建一个 Issue，并包含以下信息：

- **Bug 描述**：清晰描述问题
- **复现步骤**：详细的复现步骤
- **预期行为**：您期望发生什么
- **实际行为**：实际发生了什么
- **系统环境**：
  - 操作系统（Windows 10/11, macOS, Linux）
  - 应用版本号
  - 是否使用 GPU
- **截图/日志**：如果可能，提供截图或错误日志

### 提出功能建议

我们欢迎功能建议！请创建一个 Issue，并说明：

- **功能描述**：您希望添加什么功能
- **使用场景**：这个功能解决什么问题
- **建议实现**：（可选）您认为如何实现

### 提交代码

1. **Fork 项目**
   - 点击右上角的 Fork 按钮

2. **克隆到本地**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YoloMarkFlow.git
   cd YoloMarkFlow
   ```

3. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

4. **安装依赖**
   ```bash
   cd Electron+vue
   npm install
   ```

5. **进行开发**
   - 保持代码风格一致
   - 添加必要的注释
   - 测试您的更改

6. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 添加XXX功能"
   # 或
   git commit -m "fix: 修复XXX问题"
   ```

7. **推送到 GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **创建 Pull Request**
   - 在 GitHub 上打开您的 Fork
   - 点击 "New Pull Request"
   - 填写 PR 描述

## 代码规范

### 提交信息规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式（不影响代码运行）
- `refactor:` 重构
- `perf:` 性能优化
- `test:` 测试
- `chore:` 构建过程或辅助工具变动

示例：
```
feat: 添加批量导出功能
fix: 修复标注框无法删除的问题
docs: 更新 README 安装说明
```

### Vue 组件规范

- 组件名使用 PascalCase（如 `TrainingMonitor.vue`）
- Props 使用 camelCase
- 事件名使用 kebab-case
- 组件结构顺序：
  ```vue
  <template>
  </template>

  <script>
  // 1. 导入
  // 2. export default
  // 3. name
  // 4. components
  // 5. props
  // 6. data
  // 7. computed
  // 8. watch
  // 9. lifecycle hooks
  // 10. methods
  </script>

  <style scoped>
  </style>
  ```

### JavaScript 规范

- 使用 2 空格缩进
- 使用单引号
- 结尾不加分号
- 使用 `const` / `let`，避免 `var`
- 优先使用箭头函数
- 添加必要的注释

### 文件命名

- Vue 组件：`PascalCase.vue`
- 工具类：`camelCase.js`
- 常量：`UPPER_CASE.js`

## 开发流程

### 启动开发环境

```bash
# 启动 Vue + Electron 开发环境
npm run electron:dev

# 仅启动 Vue 开发服务器
npm run dev
```

### 构建

```bash
# 构建 Vue 应用
npm run build

# 构建 Electron 桌面应用
npm run electron:build
```

### 项目结构

```
Electron+vue/
├── electron/              # Electron 主进程
│   ├── main.js           # 入口文件
│   ├── preload.js        # 预加载脚本
│   ├── pluginManager.js  # 插件管理器
│   ├── trainingController.js  # 训练控制器
│   └── inferenceService.js    # 推理服务
├── src/
│   ├── views/            # 页面组件
│   ├── components/       # 公共组件
│   ├── utils/            # 工具函数
│   ├── router/           # 路由配置
│   └── styles/           # 全局样式
├── plugins/              # 插件目录
└── models/               # 模型文件
```

## 测试

在提交 PR 前，请确保：

- [ ] 代码能正常运行
- [ ] 没有控制台错误
- [ ] 在 Windows 上测试通过
- [ ] 核心功能正常工作
- [ ] 没有明显的性能问题

## 需要帮助？

- 查看 [README](README.md)
- 查看现有的 [Issues](../../issues)
- 加入我们的社区讨论

## 行为准则

- 尊重所有贡献者
- 接受建设性批评
- 专注于对项目最有利的事情
- 表现出对社区其他成员的同理心

感谢您的贡献！🎉

