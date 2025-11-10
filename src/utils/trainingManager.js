/**
 * 训练管理工具类
 * 负责训练任务的创建、管理和历史记录
 */

import { YoloExporter } from './exporters/YoloExporter'

class TrainingManager {
  constructor() {
    this.tasks = []
    this.listeners = new Map()
    this.initialized = false
    this.eventListenersSetup = false
  }

  /**
   * 初始化训练管理器
   */
  async init() {
    if (this.initialized) return
    
    try {
      await this.loadTaskHistory()
      this.setupEventListeners()
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize TrainingManager:', error)
    }
  }

  /**
   * 设置主进程事件监听器
   */
  setupEventListeners() {
    if (this.eventListenersSetup) return
    
    // 监听训练状态变化
    window.electronAPI.training.onStatus((data) => {
      console.log('[TrainingManager] Received status update:', data)
      const { taskId, status } = data
      this._handleStatusUpdate(taskId, status)
    })
    
    // 监听训练进度更新
    window.electronAPI.training.onProgress((data) => {
      console.log('[TrainingManager] Received progress update:', data)
      const { taskId, epoch, totalEpochs, eta, speed, trainLoss, valLoss, metrics } = data
      
      this.updateProgress(taskId, {
        currentEpoch: epoch,
        totalEpochs,
        eta,
        speed: speed || 0  // 保存原始数字，让组件负责格式化
      })
      
      this.updateMetrics(taskId, {
        epoch,
        trainLoss,
        valLoss,
        ...metrics
      })
    })
    
    // 监听训练完成
    window.electronAPI.training.onComplete((data) => {
      console.log('[TrainingManager] Training completed:', data)
      const { taskId, metrics, outputPath } = data
      this.completeTask(taskId, { metrics, outputPath })
    })
    
    // 监听训练错误
    window.electronAPI.training.onError((data) => {
      console.log('[TrainingManager] Training error:', data)
      const { taskId, error } = data
      this.failTask(taskId, error)
    })
    
    this.eventListenersSetup = true
  }

  /**
   * 处理状态更新
   */
  _handleStatusUpdate(taskId, status) {
    const task = this.getTask(taskId)
    if (!task) return
    
    if (status === 'started') {
      task.status = 'running'
      task.startedAt = new Date().toISOString()
    } else if (status === 'paused') {
      task.status = 'paused'
    }
    
    task.updatedAt = new Date().toISOString()
    this._emit('statusChange', { taskId, status: task.status })
  }

  /**
   * 创建新的训练任务
   */
  async createTask(config) {
    const taskId = `training_${Date.now()}`
    
    const task = {
      id: taskId,
      name: config.name,
      status: 'pending',
      dataset: config.dataset,
      config: {
        yoloVersion: config.yoloVersion,
        modelSize: config.modelSize,
        epochs: config.epochs,
        batchSize: config.batchSize,
        imageSize: config.imageSize,
        usePretrained: config.usePretrained,
        augmentation: config.augmentation,
        advanced: config.advanced,
        outputPath: config.outputPath  // 添加outputPath到config中
      },
      progress: {
        currentEpoch: 0,
        totalEpochs: config.epochs,
        eta: '--:--',
        speed: '0'
      },
      metrics: {
        trainLoss: null,
        valLoss: null,
        map50: null,
        map5095: null,
        precision: null,
        recall: null
      },
      charts: {
        lossHistory: [],
        metricsHistory: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      outputPath: null,
      tempDataPath: null  // 存储导出的数据集路径
    }

    this.tasks.unshift(task)
    await this.saveTaskHistory()
    
    return task
  }

  /**
   * 检查是否有正在运行的任务
   */
  hasRunningTask() {
    return this.tasks.some(t => t.status === 'running')
  }

  /**
   * 导出数据集到临时目录
   */
  async exportDatasetForTraining(task) {
    const { dataset } = task
    
    if (!dataset || !dataset.dbPath) {
      throw new Error('数据集信息不完整')
    }

    try {
      // 创建临时目录路径（使用字符串拼接而不是path.join）
      const tempDirBase = `yolomarkflow_training/${task.id}/dataset`
      
      // 使用Electron API创建临时目录
      const dirResult = await window.electronAPI.ensureDirectory(tempDirBase)
      if (!dirResult.success) {
        throw new Error('创建临时目录失败')
      }
      
      const tempDir = dirResult.path  // 获取返回的路径
      
      console.log(`[TrainingManager] Exporting dataset to: ${tempDir}`)
      
      // 导出数据集
      const exporter = new YoloExporter()
      const trainRatio = task.config.advanced?.trainRatio || 80
      const valRatio = 100 - trainRatio
      
      // YoloExporter.export(datasetPath, outputPath, config, onProgress)
      const result = await exporter.export(
        dataset.path,  // 数据集路径
        tempDir,       // 输出路径
        {              // 配置
          includeVal: valRatio > 0,
          includeTest: false,
          trainRatio,
          valRatio
        },
        (current, total, message) => {
          // 进度回调（可选）
          console.log(`[TrainingManager] Export progress: ${message} (${current}/${total})`)
        }
      )
      
      if (!result.success) {
        throw new Error(result.error || '数据集导出失败')
      }
      
      // 返回data.yaml路径（使用字符串拼接）
      const dataYamlPath = `${tempDir}/data.yaml`
      task.tempDataPath = tempDir
      
      console.log(`[TrainingManager] Dataset exported successfully, data.yaml: ${dataYamlPath}`)
      
      return dataYamlPath
      
    } catch (error) {
      console.error('[TrainingManager] Failed to export dataset:', error)
      throw new Error(`数据集导出失败: ${error.message}`)
    }
  }

  /**
   * 启动训练任务
   */
  async startTask(taskId) {
    const task = this.getTask(taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    // 检查是否已有正在运行的任务
    if (this.hasRunningTask()) {
      console.log(`[TrainingManager] Cannot start task ${taskId}, another task is running`)
      throw new Error('已有任务正在运行，请等待当前任务完成')
    }

    try {
      // 1. 导出数据集
      const dataYamlPath = await this.exportDatasetForTraining(task)
      
      // 2. 准备训练配置
      const trainingConfig = {
        taskId: task.id,
        taskName: task.name,  // 添加任务名称
        dataYaml: dataYamlPath,
        outputPath: task.config.outputPath || 'D:\\YoloMarkFlow\\YoloMarkFlow_trainOut',
        modelSize: task.config.modelSize || 'n',
        epochs: task.config.epochs || 100,
        batchSize: task.config.batchSize || 16,
        imageSize: task.config.imageSize || 640,
        usePretrained: task.config.usePretrained !== false,
        optimizer: task.config.advanced?.optimizer || 'SGD',
        learningRate: task.config.advanced?.learningRate || 0.01,
        patience: task.config.advanced?.patience || 50
      }
      
      console.log('[TrainingManager] Starting training with config:', trainingConfig)
      
      // 3. 调用 Electron API 启动训练
      if (window.electronAPI?.training?.start) {
        const result = await window.electronAPI.training.start(trainingConfig)
        
        if (!result.success) {
          throw new Error(result.error || '启动训练失败')
        }
      } else {
        throw new Error('训练API不可用，请检查环境配置')
      }
      
      task.status = 'running'
      task.startedAt = new Date().toISOString()
      task.updatedAt = new Date().toISOString()
      await this.saveTaskHistory()
      
      // 触发状态变化回调
      this._emit('statusChange', { taskId, status: 'running' })
      
      return task
    } catch (error) {
      task.status = 'failed'
      task.error = error.message
      await this.saveTaskHistory()
      
      // 清理临时文件
      this.cleanupTempData(task)
      
      throw error
    }
  }

  /**
   * 暂停训练任务
   */
  async pauseTask(taskId) {
    const task = this.getTask(taskId)
    if (!task) return

    try {
      if (window.electronAPI?.training?.pause) {
        await window.electronAPI.training.pause(taskId)
      }
      
      task.status = 'paused'
      task.updatedAt = new Date().toISOString()
      await this.saveTaskHistory()
      
      this._emit('statusChange', { taskId, status: 'paused' })
      
      // 自动启动下一个等待中的任务
      await this.startNextPendingTask()
    } catch (error) {
      console.error('Failed to pause task:', error)
      throw error
    }
  }

  /**
   * 恢复训练任务
   */
  async resumeTask(taskId) {
    const task = this.getTask(taskId)
    if (!task) return

    // 检查是否已有正在运行的任务
    if (this.hasRunningTask()) {
      console.log(`[TrainingManager] Cannot resume task ${taskId}, another task is running`)
      throw new Error('已有任务正在运行，请等待当前任务完成')
    }

    try {
      // 检查数据集路径是否存在，如果不存在则重新导出
      let dataYamlPath = task.tempDataPath ? `${task.tempDataPath}/data.yaml` : null
      
      // 验证数据集路径是否存在（通过Electron API检查）
      if (dataYamlPath && window.electronAPI?.fileExists) {
        try {
          const result = await window.electronAPI.fileExists(dataYamlPath)
          if (!result || !result.exists) {
            console.log(`[TrainingManager] Dataset path not found: ${dataYamlPath}, re-exporting...`)
            // 重新导出数据集
            dataYamlPath = await this.exportDatasetForTraining(task)
          }
        } catch (error) {
          console.warn(`[TrainingManager] Failed to check dataset path: ${error.message}, re-exporting...`)
          // 如果检查失败，重新导出数据集
          dataYamlPath = await this.exportDatasetForTraining(task)
        }
      } else {
        // 如果没有保存的路径，重新导出
        console.log(`[TrainingManager] No saved dataset path, exporting...`)
        dataYamlPath = await this.exportDatasetForTraining(task)
      }
      
      // 准备训练配置（从之前的配置恢复）
      const trainingConfig = {
        taskId: task.id,
        taskName: task.name,  // 添加任务名称
        dataYaml: dataYamlPath,
        outputPath: task.config.outputPath || 'D:\\YoloMarkFlow\\YoloMarkFlow_trainOut',
        yoloVersion: task.config.yoloVersion || 'yolov8',  // 添加YOLO版本
        modelSize: task.config.modelSize || 'n',
        epochs: task.config.epochs || 100,
        batchSize: task.config.batchSize || 16,
        imageSize: task.config.imageSize || 640,
        usePretrained: task.config.usePretrained !== false,
        optimizer: task.config.advanced?.optimizer || 'SGD',
        learningRate: task.config.advanced?.learningRate || 0.01,
        patience: task.config.advanced?.patience || 50,
        advanced: task.config.advanced || {}  // 传递完整的advanced配置
      }
      
      if (window.electronAPI?.training?.resume) {
        await window.electronAPI.training.resume(taskId, trainingConfig)
      }
      
      task.status = 'running'
      task.updatedAt = new Date().toISOString()
      await this.saveTaskHistory()
      
      this._emit('statusChange', { taskId, status: 'running' })
    } catch (error) {
      console.error('Failed to resume task:', error)
      throw error
    }
  }

  /**
   * 停止训练任务
   */
  async stopTask(taskId) {
    const task = this.getTask(taskId)
    if (!task) return

    try {
      if (window.electronAPI?.training?.stop) {
        await window.electronAPI.training.stop(taskId)
      }
      
      task.status = 'cancelled'
      task.updatedAt = new Date().toISOString()
      await this.saveTaskHistory()
      
      // 清理临时文件
      this.cleanupTempData(task)
      
      this._emit('statusChange', { taskId, status: 'cancelled' })
      
      // 自动启动下一个等待中的任务
      await this.startNextPendingTask()
    } catch (error) {
      console.error('Failed to stop task:', error)
      throw error
    }
  }

  /**
   * 清理临时数据
   */
  async cleanupTempData(task) {
    // 临时数据清理可以异步进行，不阻塞主流程
    if (task.tempDataPath && window.electronAPI?.deleteDirectory) {
      try {
        await window.electronAPI.deleteDirectory(task.tempDataPath)
        console.log(`[TrainingManager] Cleaned up temp data: ${task.tempDataPath}`)
      } catch (error) {
        console.warn(`[TrainingManager] Failed to cleanup temp data: ${error.message}`)
      }
    }
  }

  /**
   * 自动启动下一个等待中的任务
   */
  async startNextPendingTask() {
    // 如果已有任务在运行，不启动新任务
    if (this.hasRunningTask()) {
      console.log('[TrainingManager] A task is already running, skipping auto-start')
      return
    }

    // 查找最早创建的 pending 任务
    const pendingTasks = this.tasks
      .filter(t => t.status === 'pending')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    if (pendingTasks.length > 0) {
      const nextTask = pendingTasks[0]
      console.log(`[TrainingManager] Auto-starting next pending task: ${nextTask.id}`)
      try {
        await this.startTask(nextTask.id)
        this._emit('autoStart', { taskId: nextTask.id })
      } catch (error) {
        console.error('Failed to auto-start next task:', error)
      }
    } else {
      console.log('[TrainingManager] No pending tasks in queue')
    }
  }

  /**
   * 更新任务进度
   */
  updateProgress(taskId, progress) {
    const task = this.getTask(taskId)
    if (!task) return

    task.progress = { ...task.progress, ...progress }
    task.updatedAt = new Date().toISOString()
    
    this._emit('progressUpdate', { taskId, progress })
  }

  /**
   * 更新任务指标
   */
  updateMetrics(taskId, metrics) {
    const task = this.getTask(taskId)
    if (!task) return

    task.metrics = { ...task.metrics, ...metrics }
    task.updatedAt = new Date().toISOString()
    
    // 更新图表数据
    if (metrics.epoch !== undefined) {
      if (metrics.trainLoss !== undefined || metrics.valLoss !== undefined) {
        task.charts.lossHistory.push([
          metrics.epoch,
          metrics.trainLoss ?? task.metrics.trainLoss,
          metrics.valLoss ?? task.metrics.valLoss
        ])
      }
      
      if (metrics.map50 !== undefined || metrics.precision !== undefined || metrics.recall !== undefined) {
        task.charts.metricsHistory.push([
          metrics.epoch,
          metrics.map50 ?? task.metrics.map50,
          metrics.precision ?? task.metrics.precision,
          metrics.recall ?? task.metrics.recall
        ])
      }
    }
    
    this._emit('metricsUpdate', { taskId, metrics })
  }

  /**
   * 完成训练任务
   */
  async completeTask(taskId, result) {
    const task = this.getTask(taskId)
    if (!task) return

    task.status = 'completed'
    task.completedAt = new Date().toISOString()
    task.updatedAt = new Date().toISOString()
    
    if (result) {
      if (result.metrics) {
        task.metrics = { ...task.metrics, ...result.metrics }
      }
      if (result.outputPath) {
        task.outputPath = result.outputPath
      }
    }
    
    // 清理临时文件
    this.cleanupTempData(task)
    
    await this.saveTaskHistory()
    this._emit('complete', { taskId, result })
    
    // 自动启动下一个等待中的任务
    await this.startNextPendingTask()
  }

  /**
   * 标记任务失败
   */
  async failTask(taskId, error) {
    const task = this.getTask(taskId)
    if (!task) return

    task.status = 'failed'
    task.error = error
    task.updatedAt = new Date().toISOString()
    
    // 清理临时文件
    this.cleanupTempData(task)
    
    await this.saveTaskHistory()
    this._emit('failed', { taskId, error })
    
    // 自动启动下一个等待中的任务
    await this.startNextPendingTask()
  }

  /**
   * 删除训练任务
   */
  async deleteTask(taskId) {
    try {
      const task = this.getTask(taskId)
      
      // 清理临时文件
      if (task) {
        this.cleanupTempData(task)
      }
      
      if (window.electronAPI?.training?.deleteTask) {
        await window.electronAPI.training.deleteTask(taskId)
      }
      
      const index = this.tasks.findIndex(t => t.id === taskId)
      if (index !== -1) {
        this.tasks.splice(index, 1)
        await this.saveTaskHistory()
        this._emit('deleted', { taskId })
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
      throw error
    }
  }

  /**
   * 获取单个任务
   */
  getTask(taskId) {
    return this.tasks.find(t => t.id === taskId)
  }

  /**
   * 获取所有任务（返回深拷贝以确保Vue响应式更新）
   */
  getAllTasks() {
    // 返回深拷贝，确保Vue的响应式系统能检测到变化
    return JSON.parse(JSON.stringify(this.tasks))
  }

  /**
   * 获取正在运行的任务
   */
  getRunningTasks() {
    return this.tasks.filter(t => t.status === 'running' || t.status === 'pending' || t.status === 'paused')
  }

  /**
   * 获取已完成的任务
   */
  getCompletedTasks() {
    return this.tasks.filter(t => t.status === 'completed')
  }

  /**
   * 获取历史任务（completed + failed + cancelled）
   */
  getHistoryTasks() {
    return this.tasks.filter(t => 
      t.status === 'completed' || 
      t.status === 'failed' || 
      t.status === 'cancelled'
    )
  }

  /**
   * 加载训练历史
   */
  async loadTaskHistory() {
    try {
      console.log('[TrainingManager] Loading task history...')
      
      if (window.electronAPI?.training?.listTasks) {
        const tasks = await window.electronAPI.training.listTasks()
        this.tasks = (tasks || []).map(task => {
          // 清理旧数据格式：确保speed是数字而不是字符串
          if (task.progress && task.progress.speed) {
            const speed = task.progress.speed
            // 如果是字符串格式（如 "12.5 img/s"），转换为数字
            if (typeof speed === 'string') {
              const numSpeed = parseFloat(speed.replace(' img/s', '').trim())
              task.progress.speed = isNaN(numSpeed) ? 0 : numSpeed
            }
          }
          return task
        })
        console.log(`[TrainingManager] Loaded ${this.tasks.length} tasks from history`)
      } else {
        console.warn('[TrainingManager] Training API not available')
        this.tasks = []
      }
    } catch (error) {
      console.error('[TrainingManager] Failed to load task history:', error)
      this.tasks = []
    }
  }

  /**
   * 保存训练历史
   */
  async saveTaskHistory() {
    try {
      if (!window.electronAPI?.training?.saveTasks) {
        console.warn('[TrainingManager] Training API not available for saving')
        return
      }
      
      // 使用JSON序列化确保完全可克隆，过滤掉不需要的字段
      const serializableTasks = JSON.parse(JSON.stringify(this.tasks.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        config: task.config || {},
        dataset: task.dataset || null,
        progress: task.progress || {},
        metrics: task.metrics || {},
        charts: task.charts || { lossHistory: [], metricsHistory: [] },
        createdAt: task.createdAt,
        startedAt: task.startedAt || null,
        completedAt: task.completedAt || null,
        updatedAt: task.updatedAt,
        error: task.error || null,
        outputPath: task.outputPath || null,
        tempDataPath: task.tempDataPath || null
      }))))
      
      await window.electronAPI.training.saveTasks(serializableTasks)
      console.log(`[TrainingManager] Saved ${serializableTasks.length} tasks to history`)
    } catch (error) {
      console.error('[TrainingManager] Failed to save task history:', error)
    }
  }

  /**
   * 注册事件监听器
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return
    
    const callbacks = this.listeners.get(event)
    const index = callbacks.indexOf(callback)
    if (index !== -1) {
      callbacks.splice(index, 1)
    }
  }

  /**
   * 触发事件
   */
  _emit(event, data) {
    if (!this.listeners.has(event)) {
      return
    }
    
    const callbacks = this.listeners.get(event)
    callbacks.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error('Error in event listener:', error)
      }
    })
  }
}

// 创建单例
const trainingManager = new TrainingManager()
export default trainingManager
