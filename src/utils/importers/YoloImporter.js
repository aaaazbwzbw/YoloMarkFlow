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
      
      // 导入每个划分的数据，需要将进度映射到整个导入过程
      const totalSplits = splits.length
      for (let i = 0; i < splits.length; i++) {
        const split = splits[i]
        const splitStartPercent = (i / totalSplits) * 100
        const splitEndPercent = ((i + 1) / totalSplits) * 100
        
        // 为每个 split 创建进度包装器，将 split 的进度映射到整体进度范围
        const splitProgressWrapper = (percent, total, message) => {
          if (onProgress) {
            // 将 split 的进度（0-100%）映射到整体进度范围
            const overallPercent = Math.round(splitStartPercent + (percent / 100) * (splitEndPercent - splitStartPercent))
            onProgress(overallPercent, 100, message)
          }
        }
        
        const result = await this.importSplit(
          split,
          projectName,
          categoryCache,
          copyImages,
          splitProgressWrapper
        )

        stats.totalImages += result.totalImages
        stats.importedImages += result.importedImages
        stats.skippedImages += result.skippedImages
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
      importedImages: 0,  // 实际导入到项目的图片数（在阶段3统计）
      totalAnnotations: 0,
      importedAnnotations: 0,
      skippedImages: 0   // 跳过的图片数（比如因为某些原因没有导入的）
    }
    const errors = []

    try {
      // 获取所有图片文件（返回完整路径）
      const imageFiles = await this.listFiles(split.imageDir)
      const validImages = imageFiles.filter(file => 
        /\.(jpg|jpeg|png|bmp)$/i.test(file)
      )

      stats.totalImages = validImages.length

      // 准备图片导入任务数组
      const imageTasks = validImages.map(imagePath => {
        const fileName = imagePath.split(/[\\/]/).pop()
        const labelFileName = split.labelDir 
          ? fileName.replace(/\.(jpg|jpeg|png|bmp)$/i, '.txt')
          : null
        const labelPath = split.labelDir && labelFileName
          ? `${split.labelDir}/${labelFileName}`
          : null
        
        return {
          imagePath,
          fileName,
          labelPath,
          labelFileName
        }
      })

      // 阶段1：并行复制所有文件（不写入数据库）
      const { prepareImageImport } = await import('../imagePool')
      const concurrency = 5
      
      // 定义各阶段的进度范围
      const PROGRESS_STAGE1_END = 40  // 阶段1：0-40%
      const PROGRESS_STAGE2_END = 50  // 阶段2：40-50%
      const PROGRESS_STAGE3_END = 100 // 阶段3和4并行：50-100%
      
      const prepareTaskFn = async (task) => {
        const { imagePath, fileName, labelPath, labelFileName } = task
        
        try {
          // 准备图片导入（仅复制文件，不写入数据库）
          const prepared = await prepareImageImport(projectName, imagePath)
          
          // 读取标注（如果存在）
          let annotations = []
          if (labelPath && await this.fileExists(labelPath)) {
            try {
              annotations = await this.parseYoloLabel(labelPath, categoryCache)
            } catch (error) {
              console.warn(`解析标注文件失败 ${labelFileName}:`, error)
            }
          }
          
          return {
            prepared,
            fileName,
            annotations
          }
        } catch (error) {
          console.error(`准备图片导入失败 ${fileName}:`, error)
          throw error
        }
      }
      
      const prepareResult = await this.importBatch(
        imageTasks,
        prepareTaskFn,
        concurrency,
        (completed, total) => {
          const percent = Math.round((completed / total) * PROGRESS_STAGE1_END)
          onProgress?.(percent, 100, `复制文件 ${completed}/${total}`)
        }
      )
      
      errors.push(...prepareResult.errors)

      // 阶段2：批量写入数据库
      console.log('[YoloImporter] prepareResult:', {
        totalResults: prepareResult.results.length,
        successResults: prepareResult.results.filter(r => r.success).length,
        errorResults: prepareResult.results.filter(r => !r.success).length
      })
      
      const newImages = prepareResult.results
        .filter(r => r.success && r.result && r.result.prepared && r.result.prepared.isNewFile)
        .map(r => ({
          hash: r.result.prepared.hash,
          filename: r.result.prepared.filename,
          destPath: r.result.prepared.destPath,
          projectName
        }))

      const existingImages = prepareResult.results
        .filter(r => r.success && r.result && r.result.prepared && !r.result.prepared.isNewFile)
        .map(r => ({
          imageId: r.result.prepared.existingImageId,
          fileName: r.result.fileName,
          annotations: r.result.annotations
        }))

      console.log('[YoloImporter] 准备批量写入数据库:', {
        newImagesCount: newImages.length,
        existingImagesCount: existingImages.length
      })

      // 批量插入新图片到数据库
      let newImageResults = []
      if (newImages.length > 0) {
        console.log('[YoloImporter] 开始批量插入图片到数据库...')
        onProgress?.(PROGRESS_STAGE1_END, 100, '写入数据库...')
        const { batchInsertImages } = await import('../imagePool')
        newImageResults = await batchInsertImages(newImages)
        console.log('[YoloImporter] 批量插入完成:', {
          insertedCount: newImageResults.length,
          images: newImageResults.map(r => ({ imageId: r.imageId, filename: r.filename }))
        })
        // 注意：这里不统计 importedImages，因为图片只是添加到图片池，还没有添加到项目
        // importedImages 应该在阶段3（添加项目引用）时统计
        onProgress?.(PROGRESS_STAGE2_END, 100, `已写入 ${newImageResults.length} 张图片到数据库`)
      } else {
        console.log('[YoloImporter] 没有新图片需要插入数据库')
        onProgress?.(PROGRESS_STAGE2_END, 100, '跳过数据库写入（无新图片）')
      }

      // 合并所有图片结果（新导入 + 已存在）
      const allImageResults = []
      const imageMap = new Map() // fileName -> { imageId, fileName, annotations }
      
      // 添加新导入的图片
      for (let i = 0; i < newImageResults.length; i++) {
        const imageResult = newImageResults[i]
        const taskResult = prepareResult.results.find(r => 
          r.success && r.result.prepared.hash === imageResult.hash
        )
        if (taskResult) {
          allImageResults.push({
            imageId: imageResult.imageId,
            fileName: taskResult.result.fileName,
            annotations: taskResult.result.annotations
          })
          imageMap.set(taskResult.result.fileName, {
            imageId: imageResult.imageId,
            fileName: taskResult.result.fileName,
            annotations: taskResult.result.annotations
          })
        }
      }
      
      // 添加已存在的图片
      for (const existing of existingImages) {
        allImageResults.push(existing)
        imageMap.set(existing.fileName, existing)
        // 注意：已存在的图片如果被添加到项目中，也应该计入 importedImages
        // skippedImages 应该表示"跳过的图片"（比如因为某些原因没有导入的），而不是"已存在但成功导入的"
        // 所以这里不增加 skippedImages，而是在后面统计实际添加到项目的图片数
      }

      console.log('[YoloImporter] 合并图片结果:', {
        totalImages: allImageResults.length,
        newImages: newImageResults.length,
        existingImages: existingImages.length
      })
      
      // 统计实际导入的图片数（所有成功添加到项目的图片）
      // 注意：这里不直接使用 allImageResults.length，因为可能有些图片没有被成功添加到项目
      // 我们会在阶段3（添加项目引用）时统计实际添加成功的图片数

      // 阶段3和4：并行执行 - 批量添加项目引用和批量保存标注
      const projectImageTasks = allImageResults.map(img => ({
        imageId: img.imageId,
        fileName: img.fileName
      }))
      
      const annotationTasks = allImageResults
        .filter(img => img.annotations && img.annotations.length > 0)
        .map(img => ({
          imageId: img.imageId,
          annotations: img.annotations
        }))
      
      const addProjectImageTaskFn = async (task) => {
        const addResult = await dbManager.addProjectImage(task.imageId, task.fileName)
        // 统计实际添加到项目的图片数（不管是新图片还是已存在的图片，只要成功添加到项目，就计入导入）
        if (addResult.isNew) {
          // 新添加到项目的图片引用
          stats.importedImages++
        } else {
          // 已存在的图片引用（图片池中已有，但项目中没有，现在添加到了项目）
          // 这种情况也应该计入导入，因为这是"导入到项目"的操作
          stats.importedImages++
        }
        return { task, addResult }
      }
      
      const saveAnnotationTaskFn = async (task) => {
        try {
          await this.saveAnnotations(task.imageId, task.annotations)
          stats.totalAnnotations += task.annotations.length
          stats.importedAnnotations += task.annotations.length
        } catch (error) {
          console.warn(`保存标注失败 imageId=${task.imageId}:`, error)
          // 标注保存失败不影响整体导入
        }
      }
      
      // 并行执行两个任务，使用统一的进度跟踪
      let projectImageCompleted = 0
      let annotationCompleted = 0
      const projectImageTotal = projectImageTasks.length
      const annotationTotal = annotationTasks.length
      const totalTasks = projectImageTotal + annotationTotal
      
      const updateProgress = () => {
        const totalCompleted = projectImageCompleted + annotationCompleted
        const progress = totalCompleted / totalTasks
        const percent = Math.round(PROGRESS_STAGE2_END + progress * (PROGRESS_STAGE3_END - PROGRESS_STAGE2_END))
        
        // 构建进度消息
        const messages = []
        if (projectImageCompleted < projectImageTotal) {
          messages.push(`添加项目引用 ${projectImageCompleted}/${projectImageTotal}`)
        }
        if (annotationCompleted < annotationTotal) {
          messages.push(`保存标注 ${annotationCompleted}/${annotationTotal}`)
        }
        const message = messages.length > 0 ? messages.join(' | ') : '完成'
        
        onProgress?.(percent, 100, message)
      }
      
      const [projectImageResult, annotationResult] = await Promise.all([
        // 任务1：添加项目引用
        this.importBatch(
          projectImageTasks,
          addProjectImageTaskFn,
          concurrency,
          (completed, total) => {
            projectImageCompleted = completed
            updateProgress()
          }
        ),
        // 任务2：保存标注
        annotationTasks.length > 0
          ? this.importBatch(
              annotationTasks,
              saveAnnotationTaskFn,
              concurrency,
              (completed, total) => {
                annotationCompleted = completed
                updateProgress()
              }
            )
          : Promise.resolve({ results: [], errors: [] })
      ])
      
      errors.push(...projectImageResult.errors)
      errors.push(...annotationResult.errors)
      
      // 如果两个任务都完成，显示完成消息
      if (projectImageTasks.length > 0 || annotationTasks.length > 0) {
        onProgress?.(PROGRESS_STAGE3_END, 100, '导入完成')
      } else {
        onProgress?.(PROGRESS_STAGE3_END, 100, '导入完成')
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

