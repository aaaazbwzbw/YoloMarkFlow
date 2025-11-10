/**
 * 数据集导出基类
 * 提供通用的划分和工具方法
 */
export class BaseExporter {
  constructor() {
    this.format = 'base'
  }

  /**
   * 随机划分数据集
   * @param {Array} items - 要划分的项目数组
   * @param {Object} config - 划分配置 { trainRatio, valRatio, testRatio, includeVal, includeTest }
   * @returns {Object} - { train: [], val: [], test: [] }
   */
  randomSplit(items, config) {
    const { 
      trainRatio = 100, 
      valRatio = 0, 
      testRatio = 0,
      includeVal = false,
      includeTest = false
    } = config
    
    // 复制数组并打乱（Fisher-Yates 洗牌算法）
    const shuffled = [...items]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    
    const total = shuffled.length
    
    // 如果不包含验证集和测试集，所有数据都是训练集
    if (!includeVal && !includeTest) {
      return {
        train: shuffled
      }
    }
    
    // 按比例切分（优先分配验证集和测试集，剩余全部给训练集）
    // 注意：当有验证集或测试集时，训练集应该获得剩余的所有图片，而不是按照 trainRatio
    let valCount = includeVal ? Math.floor(total * valRatio / 100) : 0
    let testCount = includeTest ? Math.floor(total * testRatio / 100) : 0
    
    // YOLO训练要求必须有验证集，如果验证集为空，至少分配1张图片
    // 但前提是总图片数大于1，且 includeVal 为 true
    if (includeVal && valCount === 0) {
      if (total === 1) {
        // 如果只有1张图片，无法同时分配给训练集和验证集
        throw new Error('数据集只有1张图片，无法同时创建训练集和验证集。YOLO训练至少需要2张图片。')
      } else {
        console.warn('[BaseExporter] 验证集数量为0，但YOLO训练要求必须有验证集，将至少分配1张图片到验证集')
        valCount = 1
      }
    }
    
    // 如果 includeTest 为 true 但 testCount 为 0，至少分配1张图片（如果总图片数足够）
    if (includeTest && testCount === 0 && total > valCount + 1) {
      console.warn('[BaseExporter] 测试集数量为0，将至少分配1张图片到测试集')
      testCount = 1
    }
    
    const trainCount = total - valCount - testCount  // 训练集获得所有剩余
    
    // 确保训练集数量不为负数或0
    if (trainCount <= 0) {
      throw new Error(`计算错误：训练集数量为 ${trainCount}，需要至少1张图片 (total=${total}, valCount=${valCount}, testCount=${testCount}, valRatio=${valRatio}, testRatio=${testRatio})`)
    }
    
    console.log('[BaseExporter] randomSplit config:', {
      total,
      trainRatio,
      valRatio,
      testRatio,
      includeVal,
      includeTest,
      valCount,
      testCount,
      trainCount
    })
    
    const result = {
      train: shuffled.slice(0, trainCount)
    }
    
    let offset = trainCount
    
    if (includeVal) {
      result.val = shuffled.slice(offset, offset + valCount)
      offset += valCount
    }
    
    if (includeTest) {
      result.test = shuffled.slice(offset, offset + testCount)
    }
    
    console.log('[BaseExporter] randomSplit result:', {
      train: result.train.length,
      val: result.val?.length || 0,
      test: result.test?.length || 0,
      total: result.train.length + (result.val?.length || 0) + (result.test?.length || 0)
    })
    
    return result
  }

  /**
   * 归一化坐标转换为绝对坐标
   * @param {Object} position - { center_x, center_y, width, height } (归一化)
   * @param {Number} imgWidth - 图片宽度
   * @param {Number} imgHeight - 图片高度
   * @returns {Object} - { x, y, width, height } (绝对坐标，左上角)
   */
  normalizedToAbsolute(position, imgWidth, imgHeight) {
    const { center_x, center_y, width, height } = position
    
    const absWidth = width * imgWidth
    const absHeight = height * imgHeight
    const x = (center_x * imgWidth) - (absWidth / 2)
    const y = (center_y * imgHeight) - (absHeight / 2)
    
    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: absWidth,
      height: absHeight
    }
  }

  /**
   * 确保目录存在
   * @param {String} dirPath - 目录路径
   */
  async ensureDirectory(dirPath) {
    const result = await window.electronAPI.ensureDirectory(dirPath)
    if (!result.success) {
      throw new Error(`创建目录失败: ${result.error}`)
    }
  }

  /**
   * 导出方法（需要子类实现）
   * @param {String} datasetPath - 数据集路径
   * @param {String} outputPath - 输出路径
   * @param {Object} config - 导出配置
   * @param {Function} onProgress - 进度回调 (current, total, message)
   */
  async export(datasetPath, outputPath, config, onProgress) {
    throw new Error('子类必须实现 export 方法')
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
      img.src = `file://${imagePath}`
    })
  }

  /**
   * 保存导出历史
   * @param {String} datasetPath - 数据集路径
   * @param {Object} exportInfo - 导出信息
   */
  async saveExportHistory(datasetPath, exportInfo) {
    const historyPath = `${datasetPath}/export_history.json`
    
    // 读取现有历史
    let history = { exports: [] }
    const readResult = await window.electronAPI.readJSON(historyPath)
    if (readResult.success && readResult.data) {
      history = readResult.data
    }
    
    // 添加新记录
    history.exports.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...exportInfo
    })
    
    // 只保留最近 20 条
    history.exports = history.exports.slice(0, 20)
    
    // 保存
    const writeResult = await window.electronAPI.writeJSON(historyPath, history)
    if (!writeResult.success) {
      console.error('保存导出历史失败:', writeResult.error)
    }
  }
}

