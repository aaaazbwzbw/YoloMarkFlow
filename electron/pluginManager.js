/**
 * 插件管理器
 * 负责加载、管理和执行插件，以及子进程生命周期管理
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { app } = require('electron')

class PluginManager {
  constructor() {
    this.plugins = new Map() // name -> plugin metadata
    this.activeProcesses = new Set() // 跟踪所有活动子进程
    this.pluginsDir = null
  }

  /**
   * 初始化插件管理器
   */
  initialize() {
    // 确定插件目录路径
    if (app.isPackaged) {
      // 打包后：从 resources/app.asar.unpacked/plugins 加载
      this.pluginsDir = path.join(process.resourcesPath, 'app.asar.unpacked', 'plugins')
    } else {
      // 开发环境：从源码目录加载
      this.pluginsDir = path.join(__dirname, '..', 'plugins')
    }

    console.log('[PluginManager] Plugins directory:', this.pluginsDir)

    // 加载所有插件
    this.loadPlugins()
  }

  /**
   * 加载所有插件
   */
  loadPlugins() {
    try {
      // 检查插件目录是否存在
      if (!fs.existsSync(this.pluginsDir)) {
        console.warn('[PluginManager] Plugins directory not found, creating...')
        fs.mkdirSync(this.pluginsDir, { recursive: true })
        return
      }

      // 扫描插件目录
      const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          this.loadPlugin(entry.name)
        }
      }

      console.log(`[PluginManager] Loaded ${this.plugins.size} plugin(s)`)
    } catch (error) {
      console.error('[PluginManager] Failed to load plugins:', error)
    }
  }

  /**
   * 加载单个插件
   */
  loadPlugin(pluginName) {
    try {
      const pluginDir = path.join(this.pluginsDir, pluginName)
      const metadataPath = path.join(pluginDir, 'plugin.json')

      // 检查plugin.json是否存在
      if (!fs.existsSync(metadataPath)) {
        console.warn(`[PluginManager] Plugin ${pluginName} missing plugin.json`)
        return
      }

      // 读取元数据
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))

      // 验证必需字段
      if (!metadata.name || !metadata.executable) {
        console.warn(`[PluginManager] Plugin ${pluginName} has invalid metadata`)
        return
      }

      // 检查可执行文件是否存在
      const execPath = path.join(pluginDir, metadata.executable)
      if (!fs.existsSync(execPath)) {
        console.warn(`[PluginManager] Plugin ${pluginName} executable not found: ${execPath}`)
        // 不阻止插件加载，可能还未编译
      }

      // 存储插件信息
      this.plugins.set(metadata.name, {
        name: metadata.name,
        displayName: metadata.displayName || metadata.name,
        version: metadata.version,
        metadata: metadata,
        path: pluginDir,
        executablePath: execPath
      })

      console.log(`[PluginManager] Loaded plugin: ${metadata.displayName} v${metadata.version}`)
    } catch (error) {
      console.error(`[PluginManager] Failed to load plugin ${pluginName}:`, error)
    }
  }

  /**
   * 获取插件
   */
  getPlugin(name) {
    return this.plugins.get(name)
  }

  /**
   * 获取所有插件
   */
  getAllPlugins() {
    return Array.from(this.plugins.values())
  }

  /**
   * 执行插件命令
   */
  executeCommand(pluginName, command, args = [], options = {}) {
    const plugin = this.getPlugin(pluginName)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`)
    }

    // 检查可执行文件是否存在
    if (!fs.existsSync(plugin.executablePath)) {
      throw new Error(`Plugin executable not found: ${plugin.executablePath}`)
    }

    // 构建命令参数
    const cmdArgs = [command, ...args]

    console.log(`[PluginManager] Executing: ${plugin.executablePath} ${cmdArgs.join(' ')}`)

    // 启动子进程
    const childProcess = spawn(plugin.executablePath, cmdArgs, {
      cwd: plugin.path,
      ...options
    })

    // 自动跟踪进程
    this.trackProcess(childProcess)

    return childProcess
  }

  /**
   * 跟踪子进程
   */
  trackProcess(childProcess) {
    if (!childProcess || !childProcess.pid) {
      console.warn('[PluginManager] Cannot track process without PID')
      return
    }

    console.log(`[PluginManager] Tracking process PID: ${childProcess.pid}`)
    this.activeProcesses.add(childProcess)

    // 进程退出时自动移除
    childProcess.once('exit', (code, signal) => {
      console.log(`[PluginManager] Process ${childProcess.pid} exited with code ${code}, signal ${signal}`)
      this.activeProcesses.delete(childProcess)
    })
  }

  /**
   * 杀死单个进程
   */
  async killProcess(proc, timeout = 5000) {
    if (!proc || proc.killed) {
      return
    }

    const pid = proc.pid
    console.log(`[PluginManager] Killing process ${pid}...`)

    try {
      // 步骤1: 尝试优雅退出 (SIGTERM)
      proc.kill('SIGTERM')

      // 步骤2: 等待进程退出或超时
      const exitPromise = new Promise(resolve => {
        proc.once('exit', resolve)
      })

      const timeoutPromise = new Promise(resolve => {
        setTimeout(resolve, timeout)
      })

      await Promise.race([exitPromise, timeoutPromise])

      // 步骤3: 如果还未退出，强制杀死
      if (!proc.killed) {
        console.log(`[PluginManager] Process ${pid} did not exit gracefully, forcing kill...`)
        proc.kill('SIGKILL')

        // Windows下额外使用taskkill /T杀死进程树
        if (process.platform === 'win32' && pid) {
          try {
            const { execSync } = require('child_process')
            execSync(`taskkill /F /T /PID ${pid}`, { 
              stdio: 'ignore',
              windowsHide: true
            })
            console.log(`[PluginManager] Force killed process tree ${pid}`)
          } catch (e) {
            // 进程可能已退出，忽略错误
            console.log(`[PluginManager] taskkill for ${pid} failed (process may be gone): ${e.message}`)
          }
        }

        // 再等待一小段时间确认
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      console.log(`[PluginManager] Process ${pid} killed successfully`)
    } catch (error) {
      console.error(`[PluginManager] Error killing process ${pid}:`, error)
    }
  }

  /**
   * 杀死所有活动进程
   */
  async killAllProcesses() {
    if (this.activeProcesses.size === 0) {
      console.log('[PluginManager] No active processes to kill')
      return
    }

    console.log(`[PluginManager] Killing ${this.activeProcesses.size} active process(es)...`)
    
    const killPromises = Array.from(this.activeProcesses).map(proc => 
      this.killProcess(proc)
    )

    await Promise.all(killPromises)
    this.activeProcesses.clear()
    
    console.log('[PluginManager] All processes killed')
  }

  /**
   * 关闭插件管理器
   */
  async shutdown() {
    console.log('[PluginManager] Shutting down...')
    
    try {
      await this.killAllProcesses()
      this.plugins.clear()
      console.log('[PluginManager] Shutdown complete')
    } catch (error) {
      console.error('[PluginManager] Error during shutdown:', error)
    }
  }

  /**
   * 获取活动进程数量
   */
  getActiveProcessCount() {
    return this.activeProcesses.size
  }

  /**
   * 获取活动进程列表
   */
  getActiveProcesses() {
    return Array.from(this.activeProcesses).map(proc => ({
      pid: proc.pid,
      killed: proc.killed
    }))
  }
}

// 创建单例
const pluginManager = new PluginManager()

module.exports = pluginManager

