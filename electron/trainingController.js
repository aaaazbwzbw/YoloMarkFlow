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
        console.log('[TrainingController] Client connected to socket server')

        let buffer = ''

        socket.on('data', (data) => {
          buffer += data.toString()

          // 处理换行分隔的JSON消息
          const lines = buffer.split('\n')
          buffer = lines.pop() // 保留最后一个不完整的消息

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line)
                this.handleProgressMessage(message)
              } catch (e) {
                console.error('[TrainingController] Failed to parse message:', e)
              }
            }
          }
        })

        socket.on('end', () => {
          console.log('[TrainingController] Client disconnected from socket server')
        })

        socket.on('error', (err) => {
          console.error('[TrainingController] Socket error:', err)
        })
      })

      this.socketServer.listen(this.socketPort, () => {
        console.log(`[TrainingController] Socket server listening on port ${this.socketPort}`)
        resolve(this.socketPort)
      })

      this.socketServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // 端口被占用，尝试其他端口
          this.socketPort++
          this.socketServer.listen(this.socketPort)
        } else {
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

    const handler = this.eventHandlers.get(taskId)
    if (!handler) {
      console.warn(`[TrainingController] No handler for task ${taskId}`)
      return
    }

    // 根据消息类型分发事件
    switch (type) {
      case 'status':
        handler.onStatus && handler.onStatus(message)
        break
      case 'progress':
        handler.onProgress && handler.onProgress(message)
        break
      case 'complete':
        handler.onComplete && handler.onComplete(message)
        this.cleanup(taskId)
        break
      case 'error':
        handler.onError && handler.onError(message)
        this.cleanup(taskId)
        break
    }
  }

  /**
   * 启动训练任务
   */
  async startTraining(taskId, config, eventHandler) {
    try {
      // 确保Socket服务器已启动
      await this.initSocketServer()

      console.log('[TrainingController] Starting training for task:', taskId)

      // 注册事件处理器
      this.eventHandlers.set(taskId, eventHandler)

      // 获取Python环境配置（用于GPU检测，不再需要虚拟环境）
      const envConfig = await this.loadEnvConfig()
      // 注意：现在所有依赖都已打包进 exe，不再需要虚拟环境路径

      // 获取训练插件
      const plugin = pluginManager.getPlugin('yolo-training-inference')
      if (!plugin) {
        throw new Error('训练插件未安装，请检查插件目录')
      }

      // 验证插件可执行文件存在
      if (!fsSync.existsSync(plugin.executablePath)) {
        throw new Error(`插件可执行文件不存在: ${plugin.executablePath}`)
      }

      // 创建临时目录
      const tempDir = path.join(os.tmpdir(), 'yolomarkflow_training', taskId)
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
        useGPU: envConfig.gpu?.type === 'nvidia',
        optimizer: config.advanced?.optimizer || 'SGD',
        learningRate: config.advanced?.learningRate || 0.01,
        earlyStop: config.advanced?.earlyStop !== false, // 默认启用早停
        patience: config.advanced?.patience || 50,
        pretrainedModelsDir
      }

      const configPath = path.join(tempDir, 'config.json')
      await fs.writeFile(configPath, JSON.stringify(trainingConfig, null, 2))

      console.log('[TrainingController] Training config:', trainingConfig)
      console.log('[TrainingController] Config saved to:', configPath)

      // 使用插件启动训练进程
      // 注意：所有依赖已打包进 exe，不再需要虚拟环境路径
      const pythonProcess = pluginManager.executeCommand(
        'yolo-training-inference',
        'train',
        ['--config', configPath],
        {
          cwd: plugin.path,
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
   */
  async cleanup(taskId) {
    const processInfo = this.activeProcesses.get(taskId)
    if (processInfo) {
      // 清理临时文件（可选）
      // await fs.rm(processInfo.tempDir, { recursive: true, force: true })
      
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
      console.log('[TrainingController] Loading env config from:', configPath)
      
      const data = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(data)
      console.log('[TrainingController] Env config loaded:', config)
      
      return config
    } catch (e) {
      console.error('[TrainingController] Failed to load env config:', e.message)
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

