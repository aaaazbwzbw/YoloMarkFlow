import { importImage } from '../imagePool'
import { dbManager } from '../database'

/**
 * 数据集导入基类
 * 提供通用的导入流程和工具方法
 */
export class BaseImporter {
  constructor() {
    this.format = 'base'
  }

  /**
   * 导入方法（需要子类实现）
   * @param {Object} options - 导入选项
   * @param {String} options.datasetPath - 数据集路径
   * @param {String} options.projectPath - 目标项目路径
   * @param {String} options.projectName - 项目名称
   * @param {Boolean} options.copyImages - 是否复制图片到图片池
   * @param {Function} options.onProgress - 进度回调 (current, total, message)
   * @returns {Promise<Object>} - { success, stats, errors }
   */
  async import(options) {
    throw new Error('子类必须实现 import 方法')
  }

  /**
   * 导入图片文件
   * @param {String} projectName - 项目名称
   * @param {String} imagePath - 图片路径
   * @param {Boolean} copyToPool - 是否复制到图片池
   * @returns {Promise<Object>} - { imageId, filename, originalPath }
   */
  async importImageFile(projectName, imagePath, copyToPool = true) {
    if (copyToPool) {
      // 复制到图片池
      const result = await importImage(projectName, imagePath)
      return {
        imageId: result.imageId,
        filename: result.filename,
        originalPath: imagePath
      }
    } else {
      // 引用原始路径
      // TODO: 实现引用模式（需要修改数据库结构支持外部路径）
      throw new Error('引用模式暂未实现')
    }
  }

  /**
   * 创建或获取类别
   * @param {String} categoryName - 类别名称
   * @param {Map} categoryCache - 类别缓存 { name: id }
   * @returns {Promise<Number>} - 类别ID
   */
  async getOrCreateCategory(categoryName, categoryCache) {
    // 检查缓存
    if (categoryCache.has(categoryName)) {
      return categoryCache.get(categoryName)
    }

    // 检查数据库中是否已存在
    const existingCategories = await dbManager.getCategories()
    const existing = existingCategories.find(cat => cat.name === categoryName)
    
    if (existing) {
      categoryCache.set(categoryName, existing.id)
      return existing.id
    }

    // 创建新类别
    const color = this.generateRandomColor()
    const categoryId = await dbManager.addCategory(categoryName, color)
    categoryCache.set(categoryName, categoryId)
    
    return categoryId
  }

  /**
   * 生成随机颜色
   * @returns {String} - 十六进制颜色值
   */
  generateRandomColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
      '#EF476F', '#06FFA5', '#118AB2', '#FFD166', '#06D6A0'
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  /**
   * 保存图片标注到数据库
   * @param {Number} imageId - 图片ID
   * @param {Array} annotations - 标注数组
   */
  async saveAnnotations(imageId, annotations) {
    // 转换为数据库格式
    const dbAnnotations = annotations.map(ann => ({
      classId: ann.categoryId,
      position: {
        centerX: ann.bbox.center_x,
        centerY: ann.bbox.center_y,
        width: ann.bbox.width,
        height: ann.bbox.height
      }
    }))

    await dbManager.saveImageAnnotations(imageId, dbAnnotations)
  }

  /**
   * 检查文件是否存在
   * @param {String} filePath - 文件路径
   * @returns {Promise<Boolean>}
   */
  async fileExists(filePath) {
    const result = await window.electronAPI.fileExists(filePath)
    return result.exists || false
  }

  /**
   * 读取JSON文件
   * @param {String} filePath - 文件路径
   * @returns {Promise<Object>}
   */
  async readJSON(filePath) {
    const result = await window.electronAPI.readJSON(filePath)
    if (!result.success) {
      throw new Error(`读取JSON文件失败: ${result.error}`)
    }
    return result.data
  }

  /**
   * 读取文本文件
   * @param {String} filePath - 文件路径
   * @returns {Promise<String>}
   */
  async readText(filePath) {
    const result = await window.electronAPI.readText(filePath)
    if (!result.success) {
      throw new Error(`读取文本文件失败: ${result.error}`)
    }
    return result.data
  }

  /**
   * 列出目录下的文件
   * @param {String} dirPath - 目录路径
   * @param {String} extension - 文件扩展名过滤（可选）
   * @returns {Promise<Array<String>>}
   */
  async listFiles(dirPath, extension = null) {
    const result = await window.electronAPI.listFiles(dirPath)
    if (!result.success) {
      throw new Error(`列出文件失败: ${result.error}`)
    }
    
    if (extension) {
      return result.files.filter(file => file.endsWith(extension))
    }
    
    return result.files
  }

  /**
   * 获取图片尺寸
   * @param {String} imagePath - 图片路径
   * @returns {Promise<Object>} - { width, height }
   */
  async getImageSize(imagePath) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.width, height: img.height })
      }
      img.onerror = () => {
        reject(new Error(`无法加载图片: ${imagePath}`))
      }
      // 使用file协议加载本地图片
      img.src = `file:///${imagePath.replace(/\\/g, '/')}`
    })
  }

  /**
   * 验证数据集结构
   * @param {String} datasetPath - 数据集路径
   * @returns {Promise<Object>} - { valid, message }
   */
  async validateDataset(datasetPath) {
    throw new Error('子类必须实现 validateDataset 方法')
  }

  /**
   * 并发控制工具：限制并发数量
   * @param {Number} limit - 最大并发数
   * @returns {Function} - 返回一个函数，用于包装需要并发控制的异步函数
   */
  createConcurrencyLimiter(limit = 5) {
    let running = 0
    const queue = []

    const execute = async (fn) => {
      if (running >= limit) {
        // 如果达到并发限制，等待
        await new Promise(resolve => queue.push(resolve))
      }

      running++
      try {
        return await fn()
      } finally {
        running--
        // 执行队列中的下一个任务
        if (queue.length > 0) {
          const next = queue.shift()
          next()
        }
      }
    }

    return execute
  }

  /**
   * 批量导入图片（并行处理）
   * @param {Array} imageTasks - 图片导入任务数组 [{ imagePath, fileName, ... }]
   * @param {Function} importTaskFn - 单个图片导入任务函数 (task) => Promise<result>
   * @param {Number} concurrency - 并发数，默认 5
   * @param {Function} onProgress - 进度回调 (completed, total) => void
   * @returns {Promise<Object>} - { results, errors }
   */
  async importBatch(imageTasks, importTaskFn, concurrency = 5, onProgress) {
    const limiter = this.createConcurrencyLimiter(concurrency)
    const results = []
    const errors = []
    let completed = 0

    // 创建所有任务
    const tasks = imageTasks.map((task, index) => 
      limiter(async () => {
        try {
          const result = await importTaskFn(task)
          results.push({ success: true, index, result })
          completed++
          onProgress?.(completed, imageTasks.length)
          return { success: true, index, result }
        } catch (error) {
          const errorInfo = {
            image: task.fileName || task.imagePath || task.cocoImage?.file_name || 'unknown',
            error: error.message
          }
          errors.push(errorInfo)
          results.push({ success: false, index, error: errorInfo })
          completed++
          onProgress?.(completed, imageTasks.length)
          return { success: false, index, error: errorInfo }
        }
      })
    )

    // 等待所有任务完成
    await Promise.all(tasks)

    return { results, errors }
  }
}

