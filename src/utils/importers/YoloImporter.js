import { BaseImporter } from './BaseImporter'
import { dbManager } from '../database'

/**
 * 路径处理工具函数（替代 Node.js path 模块）
 */
function pathDirname(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/')
  parts.pop()
  return parts.join('/')
}

function pathJoin(...paths) {
  return paths
    .filter(p => p)
    .join('/')
    .replace(/\/+/g, '/')
}

function pathResolve(basePath, relativePath) {
  if (relativePath.startsWith('/')) {
    return relativePath
  }
  
  const base = basePath.replace(/\\/g, '/')
  const relative = relativePath.replace(/\\/g, '/')
  
  if (relative === '.' || relative === '') {
    return base
  }
  
  const baseParts = base.split('/').filter(p => p)
  const relativeParts = relative.split('/').filter(p => p && p !== '.')
  
  for (const part of relativeParts) {
    if (part === '..') {
      baseParts.pop()
    } else {
      baseParts.push(part)
    }
  }
  
  return baseParts.join('/')
}

/**
 * YOLO数据集导入器
 * 
 * 支持的数据集结构：
 * - data.yaml (包含类别信息和路径配置)
 * - 根据 data.yaml 中的路径配置导入图片和标注
 * - 或 classes.txt (类别列表，向后兼容)
 */
export class YoloImporter extends BaseImporter {
  constructor() {
    super()
    this.format = 'YOLO'
  }

  /**
   * 导入YOLO数据集
   * @param {Object} options - 导入选项
   * @param {String} options.configFilePath - data.yaml 配置文件路径
   * @param {String} options.projectPath - 目标项目路径
   * @param {String} options.projectName - 项目名称
   * @param {Boolean} options.copyImages - 是否复制图片到图片池
   * @param {Function} options.onProgress - 进度回调
   */
  async import(options) {
    const {
      configFilePath,
      datasetPath, // 向后兼容：如果提供了数据集目录，则使用旧逻辑
      projectPath,
      projectName,
      copyImages = true,
      onProgress
    } = options

    const stats = {
      totalImages: 0,
      importedImages: 0,
      totalAnnotations: 0,
      importedAnnotations: 0,
      categories: 0
    }
    const errors = []

    try {
      onProgress?.(0, 100, '验证数据集结构...')

      // 如果提供了 configFilePath，使用新的基于配置文件的导入方式
      let datasetRoot = null
      let yamlConfig = null
      
      if (configFilePath) {
        // 新方式：从 data.yaml 读取配置
        if (!await this.fileExists(configFilePath)) {
          throw new Error(`配置文件不存在: ${configFilePath}`)
        }

        onProgress?.(5, 100, '读取配置文件...')
        const yamlContent = await this.readText(configFilePath)
        yamlConfig = this.parseYamlConfig(yamlContent)
        
        // 计算数据集根目录：configFilePath 所在目录
        const configDir = pathDirname(configFilePath)
        
        // 如果 yaml 中指定了 path，使用它
        if (yamlConfig.path && yamlConfig.path !== '.') {
          // 判断是绝对路径还是相对路径
          // Windows: 以 C:, D: 等开头或 / 开头
          // Linux/Mac: 以 / 开头
          const isAbsolute = /^([a-zA-Z]:|[/\\])/.test(yamlConfig.path)
          
          if (isAbsolute) {
            // 绝对路径：直接使用
            datasetRoot = yamlConfig.path.replace(/\\/g, '/')
          } else {
            // 相对路径：相对于 configFilePath 所在目录
            datasetRoot = pathResolve(configDir, yamlConfig.path)
          }
        } else {
          // path 为 . 或未指定，使用 configFilePath 所在目录
          datasetRoot = configDir
        }
      } else if (datasetPath) {
        // 向后兼容：使用旧方式（从数据集目录读取）
        datasetRoot = datasetPath
        const yamlPath = `${datasetPath}/data.yaml`
        if (await this.fileExists(yamlPath)) {
          const yamlContent = await this.readText(yamlPath)
          yamlConfig = this.parseYamlConfig(yamlContent)
        }
      } else {
        throw new Error('必须提供 configFilePath 或 datasetPath')
      }

      onProgress?.(10, 100, '读取类别信息...')

      // 读取类别信息
      let categories = null
      if (yamlConfig && yamlConfig.names && yamlConfig.names.length > 0) {
        categories = yamlConfig.names
      } else {
        // 向后兼容：尝试从文件读取
        categories = await this.readCategories(datasetRoot)
      }
      
      if (!categories || categories.length === 0) {
        throw new Error('未找到类别信息。请确保 data.yaml 包含 names 字段或存在 classes.txt')
      }

      onProgress?.(15, 100, '初始化数据库...')

      // 初始化数据库
      await dbManager.init()

      // 导入类别
      const categoryCache = new Map()
      for (let i = 0; i < categories.length; i++) {
        const categoryId = await this.getOrCreateCategory(categories[i], categoryCache)
        // 保存索引到ID的映射
        categoryCache.set(i, categoryId)
      }
      stats.categories = categories.length

      onProgress?.(20, 100, `已导入 ${stats.categories} 个类别`)

      // 检测数据划分（优先使用 yaml 配置）
      const splits = await this.detectSplits(datasetRoot, yamlConfig)
      
      // 导入每个划分的数据
      let processedImages = 0
      
      for (const split of splits) {
        onProgress?.(
          25 + (processedImages / (stats.totalImages || 1)) * 70,
          100,
          `处理 ${split.name} 数据...`
        )

        const result = await this.importSplit(
          split,
          projectName,
          categoryCache,
          copyImages,
          (current, total) => {
            processedImages++
            const progress = 25 + (processedImages / total) * 70
            onProgress?.(
              progress,
              100,
              `导入图片 ${processedImages}/${total}...`
            )
          }
        )

        stats.totalImages += result.totalImages
        stats.importedImages += result.importedImages
        stats.totalAnnotations += result.totalAnnotations
        stats.importedAnnotations += result.importedAnnotations
        errors.push(...result.errors)
      }

      onProgress?.(100, 100, '导入完成！')

      return {
        success: true,
        stats,
        errors
      }
    } catch (error) {
      console.error('YOLO导入失败:', error)
      return {
        success: false,
        error: error.message,
        stats,
        errors
      }
    }
  }

  /**
   * 解析 YAML 配置文件
   * @param {String} yamlContent - YAML 文件内容
   * @returns {Object} - { path, train, val, test, names, nc }
   */
  parseYamlConfig(yamlContent) {
    const config = {
      path: '.',
      train: null,
      val: null,
      test: null,
      names: [],
      nc: 0
    }

    const lines = yamlContent.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // 跳过注释和空行
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      // 解析 path
      if (trimmed.startsWith('path:')) {
        const match = trimmed.match(/path:\s*(.+)/)
        if (match) {
          config.path = match[1].trim().replace(/['"]/g, '').split('#')[0].trim()
        }
        continue
      }

      // 解析 train/val/test
      if (trimmed.startsWith('train:')) {
        const match = trimmed.match(/train:\s*(.+)/)
        if (match) {
          config.train = match[1].trim().split('#')[0].trim()
        }
        continue
      }

      if (trimmed.startsWith('val:')) {
        const match = trimmed.match(/val:\s*(.+)/)
        if (match) {
          config.val = match[1].trim().split('#')[0].trim()
        }
        continue
      }

      if (trimmed.startsWith('test:')) {
        const match = trimmed.match(/test:\s*(.+)/)
        if (match) {
          config.test = match[1].trim().split('#')[0].trim()
        }
        continue
      }

      // 解析 nc (类别数量)
      if (trimmed.startsWith('nc:')) {
        const match = trimmed.match(/nc:\s*(\d+)/)
        if (match) {
          config.nc = parseInt(match[1])
        }
        continue
      }

      // 解析 names (类别列表)
      if (trimmed.startsWith('names:')) {
        // 单行格式: names: ['class1', 'class2']
        const inlineMatch = trimmed.match(/names:\s*\[([^\]]+)\]/)
        if (inlineMatch) {
          config.names = inlineMatch[1]
            .split(',')
            .map(name => name.trim().replace(/['"]/g, ''))
            .filter(name => name.length > 0)
        } else {
          // 多行格式，在下面解析
          config._parsingNames = true
        }
        continue
      }

      // 多行格式 names
      if (config._parsingNames) {
        if (trimmed.startsWith('-')) {
          const name = trimmed.substring(1).trim().replace(/['"]/g, '')
          if (name) {
            config.names.push(name)
          }
        } else if (trimmed && !trimmed.startsWith('#')) {
          // 遇到其他内容，结束解析
          config._parsingNames = false
        }
      }
    }

    delete config._parsingNames
    return config
  }

  /**
   * 读取类别信息
   */
  async readCategories(datasetPath) {
    // 优先尝试读取 data.yaml
    const yamlPath = `${datasetPath}/data.yaml`
    if (await this.fileExists(yamlPath)) {
      try {
        const yamlContent = await this.readText(yamlPath)
        const categories = this.parseYamlCategories(yamlContent)
        if (categories && categories.length > 0) {
          console.log('从 data.yaml 读取到类别:', categories)
          return categories
        }
      } catch (error) {
        console.warn('读取 data.yaml 失败:', error)
      }
    }

    // 尝试读取 classes.txt
    const classesPath = `${datasetPath}/classes.txt`
    if (await this.fileExists(classesPath)) {
      try {
        const content = await this.readText(classesPath)
        const categories = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
        
        if (categories.length > 0) {
          console.log('从 classes.txt 读取到类别:', categories)
          return categories
        }
      } catch (error) {
        console.warn('读取 classes.txt 失败:', error)
      }
    }

    return null
  }

  /**
   * 解析YAML中的类别信息
   */
  parseYamlCategories(yamlContent) {
    try {
      // 简单的YAML解析（只解析names字段）
      const namesMatch = yamlContent.match(/names:\s*\[([^\]]+)\]/)
      if (namesMatch) {
        // 格式: names: ['class1', 'class2', 'class3']
        return namesMatch[1]
          .split(',')
          .map(name => name.trim().replace(/['"]/g, ''))
      }

      // 尝试多行格式
      // names:
      //   - class1
      //   - class2
      const lines = yamlContent.split('\n')
      let inNames = false
      const categories = []
      
      for (const line of lines) {
        const trimmed = line.trim()
        
        if (trimmed.startsWith('names:')) {
          inNames = true
          // 检查是否是单行格式
          const inlineMatch = trimmed.match(/names:\s*\[([^\]]+)\]/)
          if (inlineMatch) {
            return inlineMatch[1]
              .split(',')
              .map(name => name.trim().replace(/['"]/g, ''))
          }
          continue
        }
        
        if (inNames) {
          if (trimmed.startsWith('-')) {
            const name = trimmed.substring(1).trim().replace(/['"]/g, '')
            if (name) {
              categories.push(name)
            }
          } else if (trimmed && !trimmed.startsWith('#')) {
            // 遇到非注释的其他内容，结束names解析
            break
          }
        }
      }

      if (categories.length > 0) {
        return categories
      }

      return null
    } catch (error) {
      console.error('解析YAML失败:', error)
      return null
    }
  }

  /**
   * 检测数据划分
   * @param {String} datasetRoot - 数据集根目录
   * @param {Object} yamlConfig - YAML 配置对象（可选）
   * @returns {Array} - splits 数组
   */
  async detectSplits(datasetRoot, yamlConfig = null) {
    const splits = []

    // 如果提供了 yaml 配置，优先使用配置中的路径
    if (yamlConfig) {
      const splitConfigs = [
        { key: 'train', name: 'train' },
        { key: 'val', name: 'val' },
        { key: 'test', name: 'test' }
      ]

      for (const splitConfig of splitConfigs) {
        const splitPath = yamlConfig[splitConfig.key]
        if (!splitPath) continue

        // 构建图片目录路径（相对于 datasetRoot）
        const imageDir = pathResolve(datasetRoot, splitPath)
        
        // 构建标注目录路径（将 images 替换为 labels）
        const labelPath = splitPath.replace(/images/g, 'labels')
        const labelDir = pathResolve(datasetRoot, labelPath)

        // 检查图片目录是否存在
        if (await this.fileExists(imageDir)) {
          splits.push({
            name: splitConfig.name,
            imageDir,
            labelDir: (await this.fileExists(labelDir)) ? labelDir : null
          })
        }
      }

      // 如果找到了配置中的划分，直接返回
      if (splits.length > 0) {
        return splits
      }
    }

    // 向后兼容：使用固定结构检测
    const possibleSplits = ['train', 'val', 'test']

    for (const splitName of possibleSplits) {
      const imageDir = pathJoin(datasetRoot, 'images', splitName)
      const labelDir = pathJoin(datasetRoot, 'labels', splitName)

      // 检查目录是否存在
      const imageDirExists = await this.fileExists(imageDir).catch(() => false)
      const labelDirExists = await this.fileExists(labelDir).catch(() => false)

      if (imageDirExists) {
        splits.push({
          name: splitName,
          imageDir,
          labelDir: labelDirExists ? labelDir : null
        })
      }
    }

    // 如果没有找到标准划分，尝试查找根目录
    if (splits.length === 0) {
      const imageDir = pathJoin(datasetRoot, 'images')
      const labelDir = pathJoin(datasetRoot, 'labels')

      const imageDirExists = await this.fileExists(imageDir).catch(() => false)
      const labelDirExists = await this.fileExists(labelDir).catch(() => false)

      if (imageDirExists) {
        splits.push({
          name: 'all',
          imageDir,
          labelDir: labelDirExists ? labelDir : null
        })
      }
    }

    return splits
  }

  /**
   * 导入单个划分的数据
   */
  async importSplit(split, projectName, categoryCache, copyImages, onProgress) {
    const stats = {
      totalImages: 0,
      importedImages: 0,
      totalAnnotations: 0,
      importedAnnotations: 0,
      skippedImages: 0  // 添加跳过的图片统计
    }
    const errors = []

    try {
      // 获取所有图片文件（返回完整路径）
      const imageFiles = await this.listFiles(split.imageDir)
      const validImages = imageFiles.filter(file => 
        /\.(jpg|jpeg|png|bmp)$/i.test(file)
      )

      stats.totalImages = validImages.length

      // 导入每张图片
      for (let i = 0; i < validImages.length; i++) {
        const imagePath = validImages[i] // 这已经是完整路径
        const fileName = imagePath.split(/[\\/]/).pop() // 提取文件名
        
        try {
          // 导入图片到图片池
          const imageResult = await this.importImageFile(projectName, imagePath, copyImages)
          
          // 添加到项目数据库（使用文件名）
          const addResult = await dbManager.addProjectImage(imageResult.imageId, fileName)
          
          if (addResult.isNew) {
            stats.importedImages++
          } else {
            stats.skippedImages++
            console.log(`跳过重复图片: ${fileName}`)
          }

          // 查找对应的标注文件
          if (split.labelDir) {
            const labelFileName = fileName.replace(/\.(jpg|jpeg|png|bmp)$/i, '.txt')
            const labelPath = `${split.labelDir}/${labelFileName}`

            if (await this.fileExists(labelPath)) {
              try {
                // 读取并解析标注
                const annotations = await this.parseYoloLabel(
                  labelPath,
                  categoryCache
                )

                if (annotations.length > 0) {
                  await this.saveAnnotations(imageResult.imageId, annotations)
                  stats.totalAnnotations += annotations.length
                  stats.importedAnnotations += annotations.length
                }
              } catch (error) {
                console.warn(`解析标注文件失败 ${labelFileName}:`, error)
              }
            }
          }

          onProgress?.(i + 1, validImages.length)
        } catch (error) {
          errors.push({
            image: fileName,
            error: error.message
          })
          console.error(`导入图片失败 ${fileName}:`, error)
        }
      }
    } catch (error) {
      console.error(`导入 ${split.name} 失败:`, error)
      errors.push({
        split: split.name,
        error: error.message
      })
    }

    return { ...stats, errors }
  }

  /**
   * 解析YOLO标注文件
   * 格式：class_index center_x center_y width height (归一化坐标)
   */
  async parseYoloLabel(labelPath, categoryCache) {
    const content = await this.readText(labelPath)
    const lines = content.split('\n').filter(line => line.trim())

    const annotations = []

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) {
        console.warn(`无效的标注行: ${line}`)
        continue
      }

      const classIndex = parseInt(parts[0])
      const centerX = parseFloat(parts[1])
      const centerY = parseFloat(parts[2])
      const width = parseFloat(parts[3])
      const height = parseFloat(parts[4])

      // 验证数据
      if (isNaN(classIndex) || isNaN(centerX) || isNaN(centerY) || 
          isNaN(width) || isNaN(height)) {
        console.warn(`无效的标注数据: ${line}`)
        continue
      }

      // 获取类别ID
      const categoryId = categoryCache.get(classIndex)
      if (!categoryId) {
        console.warn(`未找到类别索引 ${classIndex}`)
        continue
      }

      annotations.push({
        categoryId,
        bbox: {
          center_x: centerX,
          center_y: centerY,
          width: width,
          height: height
        }
      })
    }

    return annotations
  }

  /**
   * 验证数据集
   * @param {String} configFilePathOrDatasetPath - data.yaml 文件路径或数据集目录（向后兼容）
   */
  async validateDataset(configFilePathOrDatasetPath) {
    // 检查是否是文件路径（data.yaml）
    const isFile = configFilePathOrDatasetPath.endsWith('.yaml') || 
                   configFilePathOrDatasetPath.endsWith('.yml')
    
    if (isFile) {
      // 新方式：验证配置文件
      if (!await this.fileExists(configFilePathOrDatasetPath)) {
        return {
          valid: false,
          message: `配置文件不存在: ${configFilePathOrDatasetPath}`
        }
      }

      try {
        const yamlContent = await this.readText(configFilePathOrDatasetPath)
        const yamlConfig = this.parseYamlConfig(yamlContent)
        
        // 计算数据集根目录
        const configDir = pathDirname(configFilePathOrDatasetPath)
        
        // 如果 yaml 中指定了 path，使用它
        let actualRoot = configDir
        if (yamlConfig.path && yamlConfig.path !== '.') {
          // 判断是绝对路径还是相对路径
          const isAbsolute = /^([a-zA-Z]:|[/\\])/.test(yamlConfig.path)
          
          if (isAbsolute) {
            // 绝对路径：直接使用
            actualRoot = yamlConfig.path.replace(/\\/g, '/')
          } else {
            // 相对路径：相对于 configFilePath 所在目录
            actualRoot = pathResolve(configDir, yamlConfig.path)
          }
        }

        // 检查配置中的路径是否存在
        const pathsToCheck = []
        if (yamlConfig.train) pathsToCheck.push(pathResolve(actualRoot, yamlConfig.train))
        if (yamlConfig.val) pathsToCheck.push(pathResolve(actualRoot, yamlConfig.val))
        if (yamlConfig.test) pathsToCheck.push(pathResolve(actualRoot, yamlConfig.test))

        let hasImages = false
        for (const imagePath of pathsToCheck) {
          if (await this.fileExists(imagePath)) {
            hasImages = true
            break
          }
        }

        if (!hasImages && pathsToCheck.length > 0) {
          return {
            valid: false,
            message: '配置文件中指定的图片目录不存在'
          }
        }

        if (!yamlConfig.names || yamlConfig.names.length === 0) {
          return {
            valid: false,
            message: '配置文件中缺少类别信息 (names 字段)'
          }
        }

        return {
          valid: true,
          message: `数据集验证通过 (${yamlConfig.names.length} 个类别)`
        }
      } catch (error) {
        return {
          valid: false,
          message: `解析配置文件失败: ${error.message}`
        }
      }
    } else {
      // 向后兼容：验证数据集目录
      const datasetPath = configFilePathOrDatasetPath
      
      // 检查是否有类别信息
      const hasYaml = await this.fileExists(pathJoin(datasetPath, 'data.yaml'))
      const hasClasses = await this.fileExists(pathJoin(datasetPath, 'classes.txt'))

      if (!hasYaml && !hasClasses) {
        return {
          valid: false,
          message: '未找到类别信息文件 (data.yaml 或 classes.txt)'
        }
      }

      // 检查是否有图片目录
      const possibleDirs = [
        pathJoin(datasetPath, 'images', 'train'),
        pathJoin(datasetPath, 'images', 'val'),
        pathJoin(datasetPath, 'images')
      ]

      let hasImages = false
      for (const dir of possibleDirs) {
        if (await this.fileExists(dir)) {
          hasImages = true
          break
        }
      }

      if (!hasImages) {
        return {
          valid: false,
          message: '未找到图片目录 (images/train 或 images/)'
        }
      }

      return {
        valid: true,
        message: '数据集验证通过'
      }
    }
  }
}

