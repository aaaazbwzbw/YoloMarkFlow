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
    
    // 计算实际使用的比例（归一化为0-1）
    let actualTrainRatio = trainRatio / 100
    let actualValRatio = includeVal ? (valRatio / 100) : 0
    let actualTestRatio = includeTest ? (testRatio / 100) : 0
    
    // 验证比例总和（允许一定误差）
    const sum = actualTrainRatio + actualValRatio + actualTestRatio
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`比例总和必须为 100%，当前为 ${(sum * 100).toFixed(1)}%`)
    }
    
    // 按比例切分（优先分配验证集和测试集，剩余全部给训练集）
    const valCount = includeVal ? Math.floor(total * actualValRatio) : 0
    const testCount = includeTest ? Math.floor(total * actualTestRatio) : 0
    const trainCount = total - valCount - testCount  // 训练集获得所有剩余
    
    const result = {
      train: shuffled.slice(0, trainCount)
    }
    
    let offset = trainCount
    
    if (includeVal) {
      result.val = shuffled.slice(offset, offset + valCount)
      offset += valCount
    }
    
    if (includeTest) {
      result.test = shuffled.slice(offset)
    }
    
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

