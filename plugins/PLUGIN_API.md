# YoloMarkFlow 插件 API 文档

本文档详细说明了 YoloMarkFlow 插件系统的 API，帮助开发者创建训练和推理插件。

> ⚠️ **重要提示 / Important Notice**
> 
> **当前插件 API 处于不稳定状态，未来随时可能会有重大变更。**
> 
> **The plugin API is currently unstable and may undergo significant changes in the future.**
> 
> 我们建议：
> - 不要立即着手开发插件，等待 API 稳定后再开始
> - 如果您是内部开发者或有特殊需求，请先联系项目维护者
> - 我们会尽快发布稳定的插件 API 版本
> 
> We recommend:
> - Do not start developing plugins immediately, wait for the API to stabilize
> - If you are an internal developer or have special requirements, please contact the project maintainer first
> - We will release a stable plugin API version as soon as possible

## 📚 目录

- [概述](#概述)
- [插件结构](#插件结构)
- [插件元数据](#插件元数据)
- [插件执行机制](#插件执行机制)
- [训练功能 API](#训练功能-api)
- [推理功能 API](#推理功能-api)
- [事件监听](#事件监听)
- [插件开发指南](#插件开发指南)
- [示例](#示例)

---

## 概述

YoloMarkFlow 采用插件化架构，通过插件扩展训练和推理功能。插件系统的主要特点：

- **插件是可执行文件**：插件是一个独立的可执行文件（如 `.exe`），通过命令行参数调用
- **两种通信方式**：
  - **训练**：通过 Socket 通信（JSON 格式，换行分隔）
  - **推理**：通过 stdin/stdout 通信（JSON 格式，换行分隔）
- **进程管理**：主进程负责管理插件进程的生命周期

### 插件类型

- **训练插件** (`training`): 提供模型训练功能
- **推理插件** (`inference`): 提供模型推理功能

### 插件目录

- **开发环境**: `plugins/`
- **打包环境**: `resources/app.asar.unpacked/plugins/`

---

## 插件结构

插件必须遵循以下目录结构：

```
your-plugin/
├── plugin.json          # 插件元数据（必需）
├── README.md            # 插件说明文档（可选）
├── your-executable.exe  # 插件可执行文件（必需）
└── ...                  # 其他资源文件
```

---

## 插件元数据

### plugin.json

每个插件必须包含 `plugin.json` 文件，定义插件的基本信息：

```json
{
  "name": "yolo-training-inference",
  "displayName": "YOLO训练与推理插件",
  "version": "1.0.0",
  "author": "YoloMarkFlow",
  "description": "提供YOLO模型训练和推理功能，支持YOLOv5/v8/v11，自动检测GPU硬件",
  "executable": "yolomarkflow.exe",
  "type": "official",
  "permissions": [
    "filesystem",
    "process",
    "network"
  ],
  "requirements": {
    "python": ">=3.8",
    "dependencies": {
      "torch": ">=2.0.0",
      "ultralytics": ">=8.0.0"
    }
  },
  "commands": {
    "train": {
      "description": "执行训练任务",
      "args": ["--config"]
    },
    "inference-server": {
      "description": "启动推理服务器",
      "args": []
    },
    "inference-once": {
      "description": "单次推理",
      "args": ["--model-path", "--image-path", "--conf-threshold"]
    }
  }
}
```

### 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 插件唯一标识符（小写，使用连字符） |
| `displayName` | string | ✅ | 插件的显示名称 |
| `version` | string | ✅ | 插件版本号（遵循语义化版本） |
| `author` | string | ✅ | 插件作者 |
| `description` | string | ✅ | 插件功能描述 |
| `executable` | string | ✅ | 插件可执行文件名（相对于插件目录） |
| `type` | string | ❌ | 插件类型：`official`、`community` |
| `permissions` | array | ❌ | 插件所需权限列表 |
| `requirements` | object | ❌ | 插件依赖要求 |
| `commands` | object | ❌ | 插件支持的命令定义 |

---

## 插件执行机制

### 插件调用方式

插件通过 `pluginManager.executeCommand()` 调用：

```javascript
const childProcess = pluginManager.executeCommand(
  'plugin-name',     // 插件名称
  'command-name',    // 命令名称
  ['--arg1', 'value1', '--arg2', 'value2'],  // 命令参数
  {
    cwd: plugin.path,  // 工作目录
    env: { ...process.env, ... }  // 环境变量
  }
)
```

### 训练插件通信协议

训练插件通过 **Socket** 与主进程通信：

1. **主进程启动 Socket 服务器**（默认端口 9999）
2. **插件连接 Socket 服务器**
3. **插件发送 JSON 消息**（换行分隔）

**消息格式**：
```json
{
  "type": "status|progress|complete|error",
  "taskId": "task-id",
  "data": { ... }
}
```

**消息类型**：
- `status`: 状态更新
- `progress`: 进度更新（包含 epoch、loss 等）
- `complete`: 训练完成（包含模型路径）
- `error`: 错误信息

**示例消息**：
```json
{"type":"status","taskId":"task-123","status":"running"}
{"type":"progress","taskId":"task-123","epoch":10,"loss":0.5,"metrics":{"mAP":0.85}}
{"type":"complete","taskId":"task-123","modelPath":"/path/to/best.pt"}
{"type":"error","taskId":"task-123","error":"训练失败"}
```

### 推理插件通信协议

推理插件通过 **stdin/stdout** 与主进程通信：

1. **主进程启动插件进程**（常驻进程）
2. **主进程通过 stdin 发送 JSON 命令**（换行分隔）
3. **插件通过 stdout 返回 JSON 响应**（换行分隔）

**命令格式**：
```json
{
  "command": "inference|load|unload|clear|ping|exit",
  "model_path": "/path/to/model.pt",
  "image_path": "/path/to/image.jpg",
  "conf_threshold": 0.25
}
```

**响应格式**：
```json
{
  "type": "result|init|loading|loaded|unloaded|cleared|pong|error",
  "data": { ... }
}
```

**示例通信**：
```json
// 主进程发送推理请求
{"command":"inference","model_path":"/path/to/model.pt","image_path":"/path/to/image.jpg","conf_threshold":0.25}

// 插件返回推理结果
{"type":"result","boxes":[{"x1":100,"y1":100,"x2":200,"y2":200,"conf":0.9,"class":0}],"image_path":"/path/to/image.jpg"}
```

---

## 训练功能 API

### 前端 API

#### `window.electronAPI.training.start(config)`

启动训练任务。

**参数**:
```typescript
{
  taskId: string;           // 任务ID（必需）
  taskName: string;         // 任务名称（必需）
  dataYaml: string;         // 数据集配置文件路径（必需）
  modelSize: string;        // 模型大小：'n'|'s'|'m'|'l'|'x'（默认：'n'）
  epochs: number;           // 训练轮数（默认：100）
  batchSize: number;        // 批次大小（默认：16）
  imageSize: number;        // 图片尺寸（默认：640）
  outputPath?: string;      // 输出路径（默认：'D:\\YoloMarkFlow\\YoloMarkFlow_trainOut'）
  usePretrained?: boolean;  // 是否使用预训练模型（默认：true）
  advanced?: {
    optimizer?: string;     // 优化器（默认：'SGD'）
    learningRate?: number;  // 学习率（默认：0.01）
    earlyStop?: boolean;    // 是否早停（默认：true）
    patience?: number;      // 早停耐心值（默认：50）
  }
}
```

**返回值**:
```typescript
{
  success: boolean;
  taskId?: string;
  error?: string;
}
```

**示例**:
```javascript
const result = await window.electronAPI.training.start({
  taskId: 'task-123',
  taskName: 'YOLOv8训练',
  dataYaml: 'D:\\YoloMarkFlow\\datasets\\my-dataset\\data.yaml',
  modelSize: 'n',
  epochs: 100,
  batchSize: 16,
  imageSize: 640
})

if (result.success) {
  console.log('训练任务已启动:', result.taskId)
}
```

#### `window.electronAPI.training.pause(taskId)`

暂停训练任务。

**参数**:
- `taskId` (string): 任务ID

**返回值**:
```typescript
{
  success: boolean;
  error?: string;
}
```

**示例**:
```javascript
const result = await window.electronAPI.training.pause('task-123')
if (result.success) {
  console.log('训练任务已暂停')
}
```

#### `window.electronAPI.training.resume(taskId, config)`

恢复训练任务。

**参数**:
- `taskId` (string): 任务ID
- `config` (object): 训练配置（与 `start` 相同）

**返回值**:
```typescript
{
  success: boolean;
  taskId?: string;
  error?: string;
}
```

**示例**:
```javascript
const result = await window.electronAPI.training.resume('task-123', {
  taskId: 'task-123',
  taskName: 'YOLOv8训练',
  dataYaml: 'D:\\YoloMarkFlow\\datasets\\my-dataset\\data.yaml',
  // ... 其他配置
})
```

#### `window.electronAPI.training.stop(taskId)`

停止训练任务。

**参数**:
- `taskId` (string): 任务ID

**返回值**:
```typescript
{
  success: boolean;
  error?: string;
}
```

**示例**:
```javascript
const result = await window.electronAPI.training.stop('task-123')
if (result.success) {
  console.log('训练任务已停止')
}
```

#### `window.electronAPI.training.getStatus(taskId)`

获取训练任务状态。

**参数**:
- `taskId` (string): 任务ID

**返回值**:
```typescript
{
  status: string;  // 'running'|'paused'|'stopped'|'completed'|'error'
  progress?: number;
  error?: string;
}
```

#### `window.electronAPI.training.listTasks()`

列出所有训练任务。

**返回值**:
```typescript
{
  success: boolean;
  tasks?: Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
    createdAt: string;
    updatedAt: string;
  }>;
  error?: string;
}
```

#### `window.electronAPI.training.getTask(taskId)`

获取训练任务详情。

**参数**:
- `taskId` (string): 任务ID

**返回值**:
```typescript
{
  success: boolean;
  task?: {
    id: string;
    name: string;
    status: string;
    config: object;
    progress: object;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
}
```

#### `window.electronAPI.training.deleteTask(taskId)`

删除训练任务。

**参数**:
- `taskId` (string): 任务ID

**返回值**:
```typescript
{
  success: boolean;
  error?: string;
}
```

#### `window.electronAPI.training.scanModels()`

扫描可用的预训练模型。

**返回值**:
```typescript
{
  success: boolean;
  models?: Array<{
    name: string;
    path: string;
    size: string;
  }>;
  error?: string;
}
```

---

## 推理功能 API

### 前端 API

#### `window.electronAPI.model.inference(params)`

执行单次推理。

**参数**:
```typescript
{
  modelPath: string;      // 模型路径（必需）
  imagePath: string;      // 图片路径（必需）
  confThreshold?: number;  // 置信度阈值（默认：0.25）
}
```

**返回值**:
```typescript
{
  success: boolean;
  boxes?: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    conf: number;
    class: number;
    className?: string;
  }>;
  imagePath?: string;
  error?: string;
}
```

**示例**:
```javascript
const result = await window.electronAPI.model.inference({
  modelPath: 'D:\\YoloMarkFlow\\YoloMarkFlow_trainOut\\my-model\\weights\\best.pt',
  imagePath: 'D:\\images\\test.jpg',
  confThreshold: 0.25
})

if (result.success) {
  console.log('检测到', result.boxes.length, '个目标')
  result.boxes.forEach(box => {
    console.log(`类别: ${box.className}, 置信度: ${box.conf.toFixed(2)}`)
  })
}
```

#### `window.electronAPI.model.unloadModel(modelPath)`

卸载已加载的模型（释放内存）。

**参数**:
- `modelPath` (string): 模型路径

**返回值**:
```typescript
{
  success: boolean;
  error?: string;
}
```

#### `window.electronAPI.model.clearModels()`

清空所有已加载的模型。

**返回值**:
```typescript
{
  success: boolean;
  error?: string;
}
```

#### `window.electronAPI.model.getInfo(modelPath)`

获取模型信息。

**参数**:
- `modelPath` (string): 模型路径

**返回值**:
```typescript
{
  success: boolean;
  info?: {
    name: string;
    size: number;
    created: string;
    modified: string;
  };
  error?: string;
}
```

#### `window.electronAPI.model.export(sourcePath, modelName)`

导出模型。

**参数**:
- `sourcePath` (string): 源模型路径
- `modelName` (string): 模型名称

**返回值**:
```typescript
{
  success: boolean;
  exportPath?: string;
  error?: string;
}
```

#### `window.electronAPI.model.evaluate(task)`

评估模型。

**参数**:
```typescript
{
  modelPath: string;
  dataYaml: string;
  confThreshold?: number;
  iouThreshold?: number;
}
```

**返回值**:
```typescript
{
  success: boolean;
  metrics?: {
    mAP50: number;
    mAP50_95: number;
    precision: number;
    recall: number;
  };
  error?: string;
}
```

---

## 事件监听

### 训练事件

#### `window.electronAPI.training.onStatus(callback)`

监听训练状态更新。

**回调参数**:
```typescript
{
  type: 'status';
  taskId: string;
  status: string;  // 'running'|'paused'|'stopped'|'completed'|'error'
}
```

**示例**:
```javascript
window.electronAPI.training.onStatus((data) => {
  console.log('训练状态更新:', data.taskId, data.status)
})
```

#### `window.electronAPI.training.onProgress(callback)`

监听训练进度更新。

**回调参数**:
```typescript
{
  type: 'progress';
  taskId: string;
  epoch: number;
  totalEpochs: number;
  loss: number;
  metrics?: {
    mAP?: number;
    precision?: number;
    recall?: number;
  };
  lr?: number;  // 学习率
}
```

**示例**:
```javascript
window.electronAPI.training.onProgress((data) => {
  const progress = (data.epoch / data.totalEpochs) * 100
  console.log(`训练进度: ${progress.toFixed(1)}%`)
  console.log(`当前损失: ${data.loss.toFixed(4)}`)
  if (data.metrics) {
    console.log(`mAP: ${data.metrics.mAP?.toFixed(4)}`)
  }
})
```

#### `window.electronAPI.training.onComplete(callback)`

监听训练完成事件。

**回调参数**:
```typescript
{
  type: 'complete';
  taskId: string;
  modelPath: string;  // 模型保存路径
  metrics?: {
    mAP?: number;
    precision?: number;
    recall?: number;
  };
}
```

**示例**:
```javascript
window.electronAPI.training.onComplete((data) => {
  console.log('训练完成！')
  console.log('模型路径:', data.modelPath)
  if (data.metrics) {
    console.log('最终指标:', data.metrics)
  }
})
```

#### `window.electronAPI.training.onError(callback)`

监听训练错误事件。

**回调参数**:
```typescript
{
  type: 'error';
  taskId: string;
  error: string;
}
```

**示例**:
```javascript
window.electronAPI.training.onError((data) => {
  console.error('训练出错:', data.taskId, data.error)
})
```

---

## 插件开发指南

### 开发训练插件

#### 1. 创建插件结构

```
your-training-plugin/
├── plugin.json
├── your-executable.exe
└── README.md
```

#### 2. 实现 Socket 通信

训练插件需要连接到主进程的 Socket 服务器（默认端口 9999），并发送 JSON 消息：

```python
import socket
import json

# 连接到 Socket 服务器
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(('localhost', 9999))

# 发送状态更新
def send_status(task_id, status):
    message = {
        'type': 'status',
        'taskId': task_id,
        'status': status
    }
    sock.send((json.dumps(message) + '\n').encode('utf-8'))

# 发送进度更新
def send_progress(task_id, epoch, total_epochs, loss, metrics=None):
    message = {
        'type': 'progress',
        'taskId': task_id,
        'epoch': epoch,
        'totalEpochs': total_epochs,
        'loss': loss,
        'metrics': metrics
    }
    sock.send((json.dumps(message) + '\n').encode('utf-8'))

# 发送完成消息
def send_complete(task_id, model_path, metrics=None):
    message = {
        'type': 'complete',
        'taskId': task_id,
        'modelPath': model_path,
        'metrics': metrics
    }
    sock.send((json.dumps(message) + '\n').encode('utf-8'))

# 发送错误消息
def send_error(task_id, error):
    message = {
        'type': 'error',
        'taskId': task_id,
        'error': str(error)
    }
    sock.send((json.dumps(message) + '\n').encode('utf-8'))
```

#### 3. 处理训练命令

插件通过命令行参数接收训练配置：

```python
import argparse
import json

parser = argparse.ArgumentParser()
parser.add_argument('--config', type=str, required=True)
args = parser.parse_args()

# 读取配置文件
with open(args.config, 'r') as f:
    config = json.load(f)

task_id = config['taskId']
data_yaml = config['dataYaml']
model_size = config['modelSize']
epochs = config['epochs']
batch_size = config['batchSize']
image_size = config['imageSize']
socket_port = config['socketPort']
output_dir = config['outputDir']

# 执行训练
# ...
```

### 开发推理插件

#### 1. 实现 stdin/stdout 通信

推理插件需要从 stdin 读取命令，并向 stdout 写入响应：

```python
import sys
import json

def read_command():
    """从 stdin 读取命令"""
    line = sys.stdin.readline()
    if not line:
        return None
    return json.loads(line.strip())

def send_response(response):
    """向 stdout 发送响应"""
    print(json.dumps(response))
    sys.stdout.flush()

# 主循环
while True:
    command = read_command()
    if not command:
        break
    
    cmd_type = command.get('command')
    
    if cmd_type == 'inference':
        # 执行推理
        model_path = command['model_path']
        image_path = command['image_path']
        conf_threshold = command.get('conf_threshold', 0.25)
        
        # ... 推理逻辑 ...
        
        result = {
            'type': 'result',
            'boxes': [
                {
                    'x1': 100,
                    'y1': 100,
                    'x2': 200,
                    'y2': 200,
                    'conf': 0.9,
                    'class': 0
                }
            ],
            'image_path': image_path
        }
        send_response(result)
    
    elif cmd_type == 'ping':
        send_response({'type': 'pong'})
    
    elif cmd_type == 'exit':
        send_response({'type': 'exit'})
        break
```

#### 2. 处理初始化消息

推理插件启动后，应该发送初始化消息：

```python
def send_init():
    """发送初始化消息"""
    response = {
        'type': 'init',
        'device': 'cuda' if torch.cuda.is_available() else 'cpu'
    }
    send_response(response)

# 启动时发送初始化消息
send_init()
```

---

## 示例

### 示例 1: 启动训练任务

```javascript
// 启动训练
const result = await window.electronAPI.training.start({
  taskId: 'task-001',
  taskName: 'YOLOv8训练',
  dataYaml: 'D:\\YoloMarkFlow\\datasets\\my-dataset\\data.yaml',
  modelSize: 'n',
  epochs: 100,
  batchSize: 16,
  imageSize: 640
})

if (result.success) {
  console.log('训练任务已启动:', result.taskId)
  
  // 监听训练进度
  window.electronAPI.training.onProgress((data) => {
    if (data.taskId === result.taskId) {
      const progress = (data.epoch / data.totalEpochs) * 100
      console.log(`训练进度: ${progress.toFixed(1)}%`)
      console.log(`当前损失: ${data.loss.toFixed(4)}`)
    }
  })
  
  // 监听训练完成
  window.electronAPI.training.onComplete((data) => {
    if (data.taskId === result.taskId) {
      console.log('训练完成！')
      console.log('模型路径:', data.modelPath)
    }
  })
  
  // 监听训练错误
  window.electronAPI.training.onError((data) => {
    if (data.taskId === result.taskId) {
      console.error('训练出错:', data.error)
    }
  })
}
```

### 示例 2: 执行推理

```javascript
// 执行推理
const result = await window.electronAPI.model.inference({
  modelPath: 'D:\\YoloMarkFlow\\YoloMarkFlow_trainOut\\my-model\\weights\\best.pt',
  imagePath: 'D:\\images\\test.jpg',
  confThreshold: 0.25
})

if (result.success) {
  console.log('检测到', result.boxes.length, '个目标')
  result.boxes.forEach((box, index) => {
    console.log(`目标 ${index + 1}:`)
    console.log(`  位置: (${box.x1}, ${box.y1}) - (${box.x2}, ${box.y2})`)
    console.log(`  置信度: ${(box.conf * 100).toFixed(2)}%`)
    console.log(`  类别: ${box.className || box.class}`)
  })
}
```

### 示例 3: 完整的训练监控

```javascript
class TrainingMonitor {
  constructor(taskId) {
    this.taskId = taskId
    this.setupListeners()
  }
  
  setupListeners() {
    // 状态监听
    window.electronAPI.training.onStatus((data) => {
      if (data.taskId === this.taskId) {
        this.onStatusUpdate(data)
      }
    })
    
    // 进度监听
    window.electronAPI.training.onProgress((data) => {
      if (data.taskId === this.taskId) {
        this.onProgressUpdate(data)
      }
    })
    
    // 完成监听
    window.electronAPI.training.onComplete((data) => {
      if (data.taskId === this.taskId) {
        this.onComplete(data)
      }
    })
    
    // 错误监听
    window.electronAPI.training.onError((data) => {
      if (data.taskId === this.taskId) {
        this.onError(data)
      }
    })
  }
  
  onStatusUpdate(data) {
    console.log('状态更新:', data.status)
  }
  
  onProgressUpdate(data) {
    const progress = (data.epoch / data.totalEpochs) * 100
    console.log(`进度: ${progress.toFixed(1)}%, 损失: ${data.loss.toFixed(4)}`)
  }
  
  onComplete(data) {
    console.log('训练完成！模型路径:', data.modelPath)
  }
  
  onError(data) {
    console.error('训练出错:', data.error)
  }
}

// 使用示例
const monitor = new TrainingMonitor('task-001')
```

---

## 插件开发检查清单

- [ ] 创建 `plugin.json` 文件，包含所有必需字段
- [ ] 确保可执行文件位于插件目录根目录
- [ ] 实现 Socket 通信（训练插件）或 stdin/stdout 通信（推理插件）
- [ ] 实现错误处理和日志记录
- [ ] 测试所有命令和通信协议
- [ ] 编写 README.md 说明文档
- [ ] 测试插件在不同环境下的运行（开发/打包）
- [ ] 验证插件权限设置

---

## 支持与反馈

如果您在开发插件时遇到问题，请：

1. 查看本文档的 [插件开发指南](#插件开发指南) 部分
2. 参考官方插件示例：`plugins/yolo-training-inference/`
3. 提交 [Issue](https://github.com/aaaazbwzbw/YoloMarkFlow/issues)
4. 查看 [项目文档](../README.md)

---

**© 2025 YoloMarkFlow. All rights reserved.**
