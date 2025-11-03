# 插件目录

此目录用于存放 YoloMarkFlow 的功能插件。

## 可用插件

### 训练插件（官方）

提供完整的 YOLO 模型训练功能。

**下载地址**: https://yolomarkflow.com/plugins/training

**安装方法**:
```bash
# 1. 下载插件压缩包
# 2. 解压到此目录
cd YoloMarkFlow/Electron+vue/plugins
unzip training-plugin.zip

# 3. 重启应用
```

**包含功能**:
- ✅ 本地训练（CPU/GPU）
- ✅ 训练进度实时监控
- ✅ 训练指标可视化
- ✅ 模型导出
- ✅ 推理测试

---

## 插件开发

想开发自己的插件？查看：
- [插件开发指南](../docs/PLUGIN_API.md)
- [示例插件](https://github.com/YOUR_USERNAME/YoloMarkFlow-Plugin-Example)

### 插件结构

```
plugins/
└── your-plugin/
    ├── plugin.json        # 插件元数据
    ├── main.js            # 入口文件
    ├── package.json       # 依赖配置
    └── README.md          # 插件说明
```

### plugin.json 示例

```json
{
  "name": "your-plugin",
  "version": "1.0.0",
  "description": "Your plugin description",
  "author": "Your Name",
  "main": "main.js",
  "type": "training",
  "permissions": [
    "filesystem",
    "process"
  ]
}
```

---

**更多信息**: https://github.com/YOUR_USERNAME/YoloMarkFlow

