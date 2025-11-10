/**
 * YOLO推理服务管理器
 * 管理常驻的Python推理进程，提高推理速度
 */
const { spawn } = require('child_process')
const path = require('path')
const { app } = require('electron')
const fsSync = require('fs')
const pluginManager = require('./pluginManager')

class InferenceService {
  constructor() {
    this.process = null
    this.isReady = false
    this.requestQueue = []
    this.currentRequest = null
    this.envConfig = null
  }

  /**
   * 启动推理服务
   */
  async start() {
    if (this.process) {
      console.log('[InferenceService] Service already running')
      return true
    }

    try {
      // 加载Python环境配置（可选，仅用于GPU信息）
      // 注意：现在所有依赖都已打包进 exe，不再需要虚拟环境路径
      this.envConfig = this.loadEnvConfig()
      // 移除虚拟环境检查，因为依赖已打包，不再需要 venvPath

      // 获取推理插件
      const plugin = pluginManager.getPlugin('yolo-training-inference')
      if (!plugin) {
        console.error('[InferenceService] 推理插件未安装')
        return false
      }

      // 验证插件可执行文件存在
      if (!fsSync.existsSync(plugin.executablePath)) {
        console.error('[InferenceService] 插件可执行文件不存在:', plugin.executablePath)
        return false
      }

      console.log('[InferenceService] Starting inference server via plugin')

      // 使用插件启动推理服务器
      // 注意：所有依赖已打包进 exe，不再需要虚拟环境路径
      this.process = pluginManager.executeCommand(
        'yolo-training-inference',
        'inference-server',
        [],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: plugin.path,
          env: {
            ...process.env,
            // 移除 YOLOMARKFLOW_VENV_PATH，因为依赖已打包，不再需要虚拟环境
            PYTHONIOENCODING: 'utf-8',
            PYTHONUNBUFFERED: '1'
          }
        }
      )

      // 设置stdin/stdout/stderr编码
      this.process.stdin.setDefaultEncoding('utf-8')
      this.process.stdout.setEncoding('utf-8')
      this.process.stderr.setEncoding('utf-8')
      
      // 处理stdout
      this.process.stdout.on('data', (data) => {
        const lines = data.toString('utf-8').split('\n').filter(line => line.trim())
        lines.forEach(line => {
          // 过滤非JSON行（如调试信息、环境设置等）
          // JSON行通常以 { 或 [ 开头
          const trimmedLine = line.trim()
          if (!trimmedLine.startsWith('{') && !trimmedLine.startsWith('[')) {
            // 非JSON行，可能是调试信息，输出到stderr或忽略
            if (trimmedLine.startsWith('[Env]') || trimmedLine.startsWith('[Training]') || trimmedLine.startsWith('[Inference]')) {
              // 这些是Python脚本的调试信息，输出到控制台但不作为错误
              console.log('[InferenceService]', trimmedLine)
            }
            return
          }
          
          try {
            const response = JSON.parse(line)
            this.handleResponse(response)
          } catch (error) {
            // 如果看起来像JSON但解析失败，记录错误
            if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
              console.error('[InferenceService] Failed to parse JSON response:', line)
            }
          }
        })
      })

      // 处理stderr
      this.process.stderr.on('data', (data) => {
        const msg = data.toString('utf-8')
        if (!msg.includes('WARNING')) {
          console.error('[InferenceService] Stderr:', msg)
        }
      })

      // 处理进程退出
      this.process.on('exit', (code) => {
        console.log('[InferenceService] Process exited with code:', code)
        this.isReady = false
        this.process = null
        
        // 拒绝所有待处理的请求
        if (this.currentRequest) {
          this.currentRequest.reject(new Error('Inference service stopped'))
          this.currentRequest = null
        }
        this.requestQueue.forEach(req => {
          req.reject(new Error('Inference service stopped'))
        })
        this.requestQueue = []
      })

      // 等待初始化完成
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('[InferenceService] Initialization timeout')
          resolve(false)
        }, 10000)

        const checkReady = () => {
          if (this.isReady) {
            clearTimeout(timeout)
            console.log('[InferenceService] Service ready')
            resolve(true)
          } else {
            setTimeout(checkReady, 100)
          }
        }
        checkReady()
      })

    } catch (error) {
      console.error('[InferenceService] Failed to start:', error)
      return false
    }
  }

  /**
   * 处理Python进程的响应
   */
  handleResponse(response) {
    const { type } = response

    switch (type) {
      case 'init':
        console.log('[InferenceService] Initialized, device:', response.device)
        this.isReady = true
        break

      case 'loading':
        console.log('[InferenceService] Loading model:', response.model)
        break

      case 'loaded':
        console.log('[InferenceService] Model loaded:', response.model)
        break

      case 'unloaded':
        console.log('[InferenceService] Model unloaded:', response.model)
        if (this.currentRequest) {
          this.currentRequest.resolve(response)
          this.currentRequest = null
        }
        this.processNextRequest()
        break

      case 'not_loaded':
        if (this.currentRequest) {
          this.currentRequest.resolve(response)
          this.currentRequest = null
        }
        this.processNextRequest()
        break

      case 'cleared':
        console.log('[InferenceService] Cleared', response.count, 'models')
        if (this.currentRequest) {
          this.currentRequest.resolve(response)
          this.currentRequest = null
        }
        this.processNextRequest()
        break

      case 'pong':
        if (this.currentRequest) {
          this.currentRequest.resolve({ success: true, type: 'pong' })
          this.currentRequest = null
        }
        this.processNextRequest()
        break

      case 'exit':
        console.log('[InferenceService] Exit acknowledged')
        break

      case 'error':
        console.error('[InferenceService] Error:', response.error)
        if (this.currentRequest) {
          this.currentRequest.reject(new Error(response.error))
          this.currentRequest = null
        }
        this.processNextRequest()
        break

      default:
        // 推理结果
        if (this.currentRequest) {
          this.currentRequest.resolve(response)
          this.currentRequest = null
        }
        this.processNextRequest()
        break
    }
  }

  /**
   * 处理下一个请求
   */
  processNextRequest() {
    if (this.requestQueue.length === 0 || this.currentRequest) {
      return
    }

    this.currentRequest = this.requestQueue.shift()
    
    try {
      const requestData = JSON.stringify(this.currentRequest.data) + '\n'
      this.process.stdin.write(requestData)
    } catch (error) {
      console.error('[InferenceService] Failed to send request:', error)
      this.currentRequest.reject(error)
      this.currentRequest = null
      this.processNextRequest()
    }
  }

  /**
   * 运行推理
   */
  async inference(modelPath, imagePath, confThreshold = 0.25) {
    if (!this.process || !this.isReady) {
      const started = await this.start()
      if (!started) {
        return {
          success: false,
          error: 'Failed to start inference service'
        }
      }
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        data: {
          command: 'inference',
          model_path: modelPath,
          image_path: imagePath,
          conf_threshold: confThreshold
        },
        resolve,
        reject
      })

      this.processNextRequest()
    })
  }

  /**
   * Ping检查服务是否存活
   */
  async ping() {
    if (!this.process || !this.isReady) {
      return false
    }

    try {
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Ping timeout')), 1000)
        
        this.requestQueue.push({
          data: { command: 'ping' },
          resolve: (res) => {
            clearTimeout(timeout)
            resolve(res)
          },
          reject: (err) => {
            clearTimeout(timeout)
            reject(err)
          }
        })

        this.processNextRequest()
      })

      return result.type === 'pong'
    } catch (error) {
      return false
    }
  }

  /**
   * 停止推理服务
   */
  async stop() {
    if (!this.process) {
      return
    }

    console.log('[InferenceService] Stopping service...')

    try {
      // 先尝试发送优雅退出命令
      try {
        const exitData = JSON.stringify({ command: 'exit' }) + '\n'
        this.process.stdin.write(exitData)
      } catch (e) {
        console.log('[InferenceService] Could not send exit command:', e.message)
      }

      // 使用 pluginManager 的 killProcess 方法强制清理
      await pluginManager.killProcess(this.process, 3000)
    } catch (error) {
      console.error('[InferenceService] Error stopping service:', error)
    }

    this.process = null
    this.isReady = false
    this.currentRequest = null
    this.requestQueue = []
    
    console.log('[InferenceService] Service stopped')
  }

  /**
   * 卸载指定模型（释放内存）
   */
  async unloadModel(modelPath) {
    if (!this.process || !this.isReady) {
      return { success: true }
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        data: {
          command: 'unload',
          model_path: modelPath
        },
        resolve,
        reject
      })

      this.processNextRequest()
    })
  }

  /**
   * 清空所有已加载的模型
   */
  async clearModels() {
    if (!this.process || !this.isReady) {
      return { success: true }
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        data: {
          command: 'clear'
        },
        resolve,
        reject
      })

      this.processNextRequest()
    })
  }

  /**
   * 加载Python环境配置（可选，仅用于GPU信息）
   * 注意：现在所有依赖都已打包进 exe，不再需要虚拟环境路径
   */
  loadEnvConfig() {
    try {
      const configPath = path.join(app.getPath('userData'), 'python_env_config.json')
      if (fsSync.existsSync(configPath)) {
        return JSON.parse(fsSync.readFileSync(configPath, 'utf-8'))
      }
      // 文件不存在是正常的，因为依赖已打包，不再需要虚拟环境配置
      console.log('[InferenceService] Env config not found (optional):', configPath)
      console.log('[InferenceService] Using default configuration (dependencies are bundled)')
    } catch (error) {
      // 读取或解析失败时，记录警告但不影响服务
      // 因为依赖已打包，配置文件是可选的
      console.warn('[InferenceService] Failed to load env config (optional):', error.message)
      console.log('[InferenceService] Using default configuration (dependencies are bundled)')
    }
    return null
  }
}

// 单例实例
const inferenceService = new InferenceService()

module.exports = inferenceService

