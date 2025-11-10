/**
 * 训练控制器
 * 管理Python训练子进程和Socket通信
 */

const { spawn } = require('child_process')
const net = require('net')
const fs = require('fs').promises
const fsSync = require('fs')
const path = require('path')
const os = require('os')
const pluginManager = require('./pluginManager')

class TrainingController {
  constructor() {
    // 存储活动的训练进程
    this.activeProcesses = new Map() // taskId -> { process, config, socketServer }
    this.socketServer = null
    this.socketPort = 9999
    this.eventHandlers = new Map() // taskId -> eventHandler
    this.socketConnections = new Map() // 存储每个任务的Socket连接
  }

  /**
   * 初始化Socket服务器
   */
  async initSocketServer() {
    if (this.socketServer) {
      return this.socketPort
    }

    return new Promise((resolve, reject) => {
      this.socketServer = net.createServer((socket) => {
        const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`
        console.log(`[TrainingController] Client connected to socket server from ${remoteAddress}`)

        let buffer = ''
        let taskId = null // 从第一条消息中获取taskId

        // 设置socket选项，防止连接被过早关闭
        socket.setKeepAlive(true, 10000) // 10秒后开始发送keepalive
        socket.setNoDelay(true) // 禁用Nagle算法，立即发送数据

        socket.on('data', (data) => {
          buffer += data.toString()

          // 处理换行分隔的JSON消息
          const lines = buffer.split('\n')
          buffer = lines.pop() // 保留最后一个不完整的消息

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line)
                
                // 从第一条消息中获取taskId并存储连接
                if (!taskId && message.taskId) {
                  taskId = message.taskId
                  this.socketConnections.set(taskId, socket)
                  console.log(`[TrainingController] Socket connection registered for task: ${taskId}`)
                }
                
                this.handleProgressMessage(message)
              } catch (e) {
                console.error('[TrainingController] Failed to parse message:', e, 'Line:', line)
              }
            }
          }
        })

        socket.on('end', () => {
          console.log(`[TrainingController] Client disconnected from socket server${taskId ? ` (task: ${taskId})` : ''} from ${remoteAddress}`)
          if (taskId) {
            this.socketConnections.delete(taskId)
          }
        })

        socket.on('close', () => {
          console.log(`[TrainingController] Socket closed${taskId ? ` (task: ${taskId})` : ''} from ${remoteAddress}`)
          if (taskId) {
            this.socketConnections.delete(taskId)
          }
        })

        socket.on('error', (err) => {
          console.error(`[TrainingController] Socket error${taskId ? ` (task: ${taskId})` : ''} from ${remoteAddress}:`, err)
          if (taskId) {
            this.socketConnections.delete(taskId)
          }
        })
      })

      this.socketServer.listen(this.socketPort, '127.0.0.1', () => {
        console.log(`[TrainingController] Socket server listening on 127.0.0.1:${this.socketPort}`)
        // 添加短暂延迟，确保Socket服务器完全准备好接收连接
        // 这可以解决某些设备上连接时机的问题
        setTimeout(() => {
          resolve(this.socketPort)
        }, 100)
      })

      this.socketServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // 端口被占用，尝试其他端口
          console.log(`[TrainingController] Port ${this.socketPort} in use, trying ${this.socketPort + 1}`)
          this.socketPort++
          this.socketServer.listen(this.socketPort, '127.0.0.1', () => {
            console.log(`[TrainingController] Socket server listening on 127.0.0.1:${this.socketPort}`)
            setTimeout(() => {
              resolve(this.socketPort)
            }, 100)
          })
        } else {
          console.error(`[TrainingController] Socket server error:`, err)
          reject(err)
        }
      })
    })
  }

  /**
   * 处理来自训练脚本的进度消息
   */
  handleProgressMessage(message) {
    const { type, taskId } = message

    console.log(`[TrainingController] Received ${type} message for task ${taskId}`)
    console.log(`[TrainingController] Message content:`, JSON.stringify(message, null, 2))

    const handler = this.eventHandlers.get(taskId)
    if (!handler) {
      console.warn(`[TrainingController] No handler for task ${taskId}`)
      console.warn(`[TrainingController] Available handlers:`, Array.from(this.eventHandlers.keys()))
      return
    }

    // 根据消息类型分发事件
    switch (type) {
      case 'status':
        console.log(`[TrainingController] Calling onStatus handler for task ${taskId}`)
        handler.onStatus && handler.onStatus(message)
        break
      case 'progress':
        console.log(`[TrainingController] Calling onProgress handler for task ${taskId}`)
        handler.onProgress && handler.onProgress(message)
        break
      case 'complete':
        console.log(`[TrainingController] Calling onComplete handler for task ${taskId}`)
        handler.onComplete && handler.onComplete(message)
        this.cleanup(taskId)
        break
      case 'error':
        console.log(`[TrainingController] Calling onError handler for task ${taskId}`)
        handler.onError && handler.onError(message)
        this.cleanup(taskId)
        break
      default:
        console.warn(`[TrainingController] Unknown message type: ${type}`)
    }
  }

  /**
   * 启动训练任务
   */
  async startTraining(taskId, config, eventHandler) {
    try {
      // 确保Socket服务器已启动
      const socketPort = await this.initSocketServer()
      console.log(`[TrainingController] Socket server ready on port ${socketPort}`)

      // 注册事件处理器（必须在启动训练进程之前注册，确保能接收到第一条消息）
      this.eventHandlers.set(taskId, eventHandler)
      console.log(`[TrainingController] Event handler registered for task: ${taskId}`)

      console.log('[TrainingController] Starting training for task:', taskId)

      // 获取Python环境配置（用于GPU检测，不再需要虚拟环境）
      // 注意：现在所有依赖都已打包进 exe，python_env_config.json 是可选的，仅用于 GPU 信息
      const envConfig = await this.loadEnvConfig()

      // 获取训练插件
      const plugin = pluginManager.getPlugin('yolo-training-inference')
      if (!plugin) {
        throw new Error('训练插件未安装，请检查插件目录')
      }

      // 验证插件可执行文件存在
      if (!fsSync.existsSync(plugin.executablePath)) {
        throw new Error(`插件可执行文件不存在: ${plugin.executablePath}`)
      }

      // 创建临时目录（在插件目录下，因为训练程序的工作目录是插件目录）
      // 这样相对路径就能正确解析了
      const tempDir = path.join(plugin.path, 'training_temp', taskId)
      await fs.mkdir(tempDir, { recursive: true })

      // 创建输出目录（使用任务名称作为子目录）
      const baseOutputPath = config.outputPath || 'D:\\YoloMarkFlow\\YoloMarkFlow_trainOut'
      
      // 清理任务名称，移除文件系统不支持的字符
      const taskName = config.taskName || taskId
      const safeTaskName = taskName.replace(/[<>:"/\\|?*]/g, '_')
      
      // 在基础路径下创建以任务名称命名的子目录
      const outputDir = path.join(baseOutputPath, safeTaskName)
      await fs.mkdir(outputDir, { recursive: true })
      
      console.log('[TrainingController] Training output directory:', outputDir)

      // 解析预训练模型目录（优先安装目录根目录的 model，其次工作空间的 model）
      let pretrainedModelsDir
      try {
        const { app } = require('electron')
        if (app && app.isPackaged) {
          // 打包环境：优先使用安装目录根目录下的 model 目录
          const installDirModelPath = path.join(path.dirname(app.getPath('exe')), 'model')
          if (fsSync.existsSync(installDirModelPath)) {
            pretrainedModelsDir = installDirModelPath
            console.log('[TrainingController] Using model directory from install root:', pretrainedModelsDir)
          } else {
            // 如果安装目录根目录没有 model，使用工作空间的 model
            // 直接从工作空间路径获取（不依赖 main.js）
            const workspacePath = 'D:\\YoloMarkFlow'
            const workspaceModelPath = path.join(workspacePath, 'model')
            if (fsSync.existsSync(workspaceModelPath)) {
              pretrainedModelsDir = workspaceModelPath
              console.log('[TrainingController] Using model directory from workspace:', pretrainedModelsDir)
            } else {
              // 最后回退到 app.asar.unpacked/models（兼容旧版本）
              pretrainedModelsDir = path.join(process.resourcesPath, 'app.asar.unpacked', 'models')
              console.log('[TrainingController] Using model directory from app.asar.unpacked:', pretrainedModelsDir)
            }
          }
        } else {
          // 开发环境：项目内 models 目录
          pretrainedModelsDir = path.join(__dirname, '..', 'models')
        }
      } catch (e) {
        pretrainedModelsDir = path.join(__dirname, '..', 'models')
      }

      // 准备训练配置文件
      // GPU 检测：优先使用配置文件中的信息，如果不存在则默认尝试使用 GPU
      // 因为依赖已打包，训练程序会自动检测并使用 GPU（如果可用）
      // 逻辑：如果配置文件明确指定了 NVIDIA GPU，使用它；否则默认尝试使用 GPU（训练程序会自动检测）
      let useGPU = true // 默认尝试使用 GPU
      if (envConfig?.gpu?.type === 'nvidia') {
        useGPU = true // 配置文件明确指定了 NVIDIA GPU
      } else if (envConfig?.gpu?.type) {
        useGPU = false // 配置文件明确指定了非 NVIDIA GPU（如 CPU）
      } else if (config.advanced?.useGPU === false) {
        useGPU = false // 用户明确禁用 GPU
      }
      // 如果 envConfig 为 null（配置文件不存在），默认 useGPU = true，让训练程序自动检测
      
      const trainingConfig = {
        taskId,
        dataYaml: config.dataYaml,
        modelSize: config.modelSize || 'n',
        epochs: config.epochs || 100,
        batchSize: config.batchSize || 16,
        imageSize: config.imageSize || 640,
        socketPort: this.socketPort,
        tempDir,
        outputDir,
        usePretrained: config.usePretrained !== false,
        useGPU, // 默认尝试使用 GPU，训练程序会自动检测
        optimizer: config.advanced?.optimizer || 'SGD',
        learningRate: config.advanced?.learningRate || 0.01,
        earlyStop: config.advanced?.earlyStop !== false, // 默认启用早停
        patience: config.advanced?.patience || 50,
        pretrainedModelsDir,
        resume: config.resume || false,  // 是否从checkpoint恢复训练
        resumePath: config.resumePath || null  // checkpoint文件路径（如果存在）
      }

      const configPath = path.join(tempDir, 'config.json')
      await fs.writeFile(configPath, JSON.stringify(trainingConfig, null, 2))

      console.log('[TrainingController] Training config:', trainingConfig)
      console.log('[TrainingController] Config saved to:', configPath)

      // 确定数据集目录（data.yaml所在的目录）
      // dataYaml 路径格式：.../training_temp/taskId/dataset/data.yaml
      const dataYamlDir = path.dirname(config.dataYaml)
      console.log('[TrainingController] Dataset directory (cwd):', dataYamlDir)

      // 使用插件启动训练进程
      // 注意：所有依赖已打包进 exe，不再需要虚拟环境路径
      // 工作目录设置为数据集目录，这样 data.yaml 中的相对路径 path: . 就能正确解析
      const pythonProcess = pluginManager.executeCommand(
        'yolo-training-inference',
        'train',
        ['--config', configPath],
        {
          cwd: dataYamlDir,  // 工作目录设置为数据集目录，而不是插件目录
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PYTHONIOENCODING: 'utf-8'  // 支持中文路径
          }
        }
      )

      // 设置编码
      pythonProcess.stdout.setEncoding('utf-8')
      pythonProcess.stderr.setEncoding('utf-8')

      // 存储进程信息
      this.activeProcesses.set(taskId, {
        process: pythonProcess,
        config: trainingConfig,
        tempDir,
        outputDir
      })

      // 监听stdout
      pythonProcess.stdout.on('data', (data) => {
        console.log(`[Training ${taskId}] ${data.toString('utf-8').trim()}`)
      })

      // 监听stderr
      pythonProcess.stderr.on('data', (data) => {
        console.error(`[Training ${taskId}] ERROR: ${data.toString('utf-8').trim()}`)
      })

      // 监听进程退出
      pythonProcess.on('close', (code) => {
        console.log(`[TrainingController] Training process exited with code ${code}`)
        
        if (code !== 0 && code !== null) {
          // 非正常退出
          const handler = this.eventHandlers.get(taskId)
          if (handler && handler.onError) {
            handler.onError({
              type: 'error',
              taskId,
              error: `训练进程异常退出，退出码: ${code}`
            })
          }
        }
        
        this.cleanup(taskId)
      })

      return { success: true, taskId }

    } catch (error) {
      console.error('[TrainingController] Failed to start training:', error)
      this.cleanup(taskId)
      throw error
    }
  }

  /**
   * 暂停训练
   */
  async pauseTraining(taskId) {
    const processInfo = this.activeProcesses.get(taskId)
    if (!processInfo) {
      throw new Error(`训练任务不存在: ${taskId}`)
    }

    // 创建暂停标志文件
    const pauseFile = path.join(processInfo.tempDir, `${taskId}.pause`)
    await fs.writeFile(pauseFile, '')

    console.log(`[TrainingController] Pause signal sent for task ${taskId}`)
    return { success: true }
  }

  /**
   * 恢复训练
   */
  async resumeTraining(taskId, config, eventHandler) {
    // 删除暂停标志文件
    const processInfo = this.activeProcesses.get(taskId)
    if (processInfo) {
      const pauseFile = path.join(processInfo.tempDir, `${taskId}.pause`)
      try {
        await fs.unlink(pauseFile)
      } catch (e) {
        // 文件可能不存在
      }
    }

    // 检查checkpoint文件是否存在
    // checkpoint文件路径：outputDir/taskId/weights/last.pt
    const baseOutputPath = config.outputPath || 'D:\\YoloMarkFlow\\YoloMarkFlow_trainOut'
    const taskName = config.taskName || taskId
    const safeTaskName = taskName.replace(/[<>:"/\\|?*]/g, '_')
    const outputDir = path.join(baseOutputPath, safeTaskName)
    const checkpointPath = path.join(outputDir, taskId, 'weights', 'last.pt')
    
    // 检查checkpoint文件是否存在
    let shouldResume = false
    try {
      if (fsSync.existsSync(checkpointPath)) {
        shouldResume = true
        console.log(`[TrainingController] Checkpoint found: ${checkpointPath}, will resume training`)
      } else {
        console.log(`[TrainingController] No checkpoint found at ${checkpointPath}, starting new training`)
      }
    } catch (e) {
      console.warn(`[TrainingController] Failed to check checkpoint: ${e.message}`)
    }

    // 标记为恢复训练
    config.resume = shouldResume
    if (shouldResume) {
      config.resumePath = checkpointPath
    }

    // 重新启动训练（从checkpoint恢复）
    return this.startTraining(taskId, config, eventHandler)
  }

  /**
   * 停止训练
   */
  async stopTraining(taskId) {
    const processInfo = this.activeProcesses.get(taskId)
    if (!processInfo) {
      throw new Error(`训练任务不存在: ${taskId}`)
    }

    // 杀死进程
    if (processInfo.process && !processInfo.process.killed) {
      processInfo.process.kill('SIGTERM')
      
      // 等待一段时间后强制杀死
      setTimeout(() => {
        if (!processInfo.process.killed) {
          processInfo.process.kill('SIGKILL')
        }
      }, 5000)
    }

    console.log(`[TrainingController] Training stopped for task ${taskId}`)
    
    // 清理
    await this.cleanup(taskId)
    
    return { success: true }
  }

  /**
   * 清理任务资源
   * 无论训练成功还是失败，都会清理临时目录
   */
  async cleanup(taskId) {
    const processInfo = this.activeProcesses.get(taskId)
    if (processInfo) {
      // 清理临时目录（无论训练成功还是失败）
      if (processInfo.tempDir && fsSync.existsSync(processInfo.tempDir)) {
        try {
          // 尝试删除临时目录，如果失败则重试
          let lastError = null
          const maxRetries = 3
          
          for (let i = 0; i < maxRetries; i++) {
            try {
              await fs.rm(processInfo.tempDir, { recursive: true, force: true })
              console.log(`[TrainingController] Cleaned up temp directory: ${processInfo.tempDir}`)
              break  // 成功删除，退出重试循环
            } catch (error) {
              lastError = error
              
              // 如果是文件被占用的错误，等待后重试
              if (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'ENOTEMPTY') {
                console.log(`[TrainingController] Cleanup failed, retrying ${i + 1}/${maxRetries}...`)
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))) // 递增等待时间
                continue
              }
              
              // 其他错误直接抛出
              throw error
            }
          }
          
          // 所有重试都失败
          if (lastError && lastError.code) {
            console.warn(`[TrainingController] Failed to cleanup temp directory after ${maxRetries} retries:`, lastError.message)
          }
        } catch (error) {
          // 记录错误但不影响其他清理逻辑
          console.error(`[TrainingController] Error cleaning up temp directory: ${error.message}`)
        }
      }
      
      this.activeProcesses.delete(taskId)
    }
    
    this.eventHandlers.delete(taskId)
  }

  /**
   * 加载环境配置
   */
  async loadEnvConfig() {
    try {
      // 使用Electron的userData路径（与main.js保持一致）
      const { app } = require('electron')
      const configPath = path.join(app.getPath('userData'), 'python_env_config.json')
      
      // 检查文件是否存在
      if (!fsSync.existsSync(configPath)) {
        // 文件不存在是正常的，因为依赖已打包，不再需要虚拟环境配置
        // 只在需要时记录信息级别的日志
        console.log('[TrainingController] Env config not found (optional):', configPath)
        console.log('[TrainingController] Using default GPU detection (dependencies are bundled)')
        return null
      }
      
      console.log('[TrainingController] Loading env config from:', configPath)
      const data = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(data)
      console.log('[TrainingController] Env config loaded:', config)
      
      return config
    } catch (e) {
      // 读取或解析失败时，记录警告但不影响训练
      // 因为依赖已打包，配置文件是可选的
      console.warn('[TrainingController] Failed to load env config (optional):', e.message)
      console.log('[TrainingController] Using default GPU detection (dependencies are bundled)')
      return null
    }
  }

  /**
   * 关闭控制器
   */
  async shutdown() {
    console.log('[TrainingController] Shutting down...')
    
    // 停止所有活动的训练
    const killPromises = []
    for (const [taskId, processInfo] of this.activeProcesses.entries()) {
      if (processInfo.process && !processInfo.process.killed) {
        console.log(`[TrainingController] Stopping training task: ${taskId}`)
        
        // 使用 pluginManager 的 killProcess 方法
        killPromises.push(
          pluginManager.killProcess(processInfo.process).catch(err => {
            console.error(`[TrainingController] Error killing process for task ${taskId}:`, err)
          })
        )
      }
    }

    // 等待所有进程退出
    await Promise.all(killPromises)

    // 关闭Socket服务器
    if (this.socketServer) {
      this.socketServer.close()
      this.socketServer = null
    }

    this.activeProcesses.clear()
    this.eventHandlers.clear()
    
    console.log('[TrainingController] Shutdown complete')
  }
}

// 创建单例
const trainingController = new TrainingController()

module.exports = trainingController

