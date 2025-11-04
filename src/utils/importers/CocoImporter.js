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
 * COCO数据集导入器
 * 
 * 支持的数据集结构：
 * 1. 单个JSON文件 + 图片目录
 * 2. 标准COCO划分：
 *    - annotations/instances_train.json
 *    - annotations/instances_val.json
 *    - images/train/
 *    - images/val/
 */
export class CocoImporter extends BaseImporter {
  constructor() {
    super()
    this.format = 'COCO'
  }

  /**
   * 导入COCO数据集
   * @param {Object} options - 导入选项
   * @param {String} options.configFilePath - annotations.json 文件路径（新方式）
   * @param {String} options.datasetPath - 数据集目录（向后兼容）
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

      let datasetInfo = null
      
      // 如果提供了 configFilePath，使用新的基于配置文件的导入方式
      if (configFilePath) {
        // 新方式：从 JSON 文件读取配置
        if (!await this.fileExists(configFilePath)) {
          throw new Error(`配置文件不存在: ${configFilePath}`)
        }

        onProgress?.(5, 100, '读取配置文件...')
        const cocoData = await this.readJSON(configFilePath)
        
        // 计算数据集根目录：configFilePath 所在目录
        const jsonDir = pathDirname(configFilePath)
        
        // 从 JSON 文件中读取图片路径信息
        // COCO JSON 中，images 数组包含 file_name，需要确定图片目录
        // 如果 JSON 在 annotations 目录下，图片通常在上一级目录的 images 下
        const possibleImageDirs = [
          // 如果 JSON 在 annotations 目录下，尝试上一级目录的 images
          pathJoin(pathDirname(jsonDir), 'images', 'train'),
          pathJoin(pathDirname(jsonDir), 'images', 'val'),
          pathJoin(pathDirname(jsonDir), 'images'),
          pathJoin(pathDirname(jsonDir), 'img'),
          // 当前目录下的 images
          pathJoin(jsonDir, 'images'),
          pathJoin(jsonDir, 'img'),
          // 直接在当前目录
          jsonDir,
          // 上一级目录
          pathDirname(jsonDir)
        ]

        let imageDir = null
        for (const dir of possibleImageDirs) {
          if (cocoData.images && cocoData.images.length > 0) {
            const firstImage = cocoData.images[0]
            const testPath = pathJoin(dir, firstImage.file_name)
            if (await this.fileExists(testPath)) {
              imageDir = dir
              break
            }
          }
        }

        if (!imageDir) {
          throw new Error('无法确定图片目录位置，请检查 JSON 文件中的 file_name 路径')
        }

        datasetInfo = {
          valid: true,
          type: 'single',
          jsonFiles: [{ path: configFilePath, split: 'all', imageDir }]
        }
      } else if (datasetPath) {
        // 向后兼容：使用旧方式（从数据集目录读取）
        datasetInfo = await this.detectDatasetStructure(datasetPath)
      } else {
        throw new Error('必须提供 configFilePath 或 datasetPath')
      }

      if (!datasetInfo || !datasetInfo.valid) {
        throw new Error(datasetInfo?.message || '数据集验证失败')
      }

      onProgress?.(5, 100, '读取数据集配置...')

      // 2. 初始化数据库
      await dbManager.init()

      // 3. 类别缓存
      const categoryCache = new Map()

      // 4. 处理每个JSON文件，需要将进度映射到整个导入过程
      const totalFiles = datasetInfo.jsonFiles.length

      for (let i = 0; i < datasetInfo.jsonFiles.length; i++) {
        const jsonFile = datasetInfo.jsonFiles[i]
        const splitName = jsonFile.split || 'all'
        
        onProgress?.(
          10 + (i / totalFiles) * 20,
          100,
          `处理 ${splitName} 数据...`
        )

        // 读取COCO JSON
        const cocoData = await this.readJSON(jsonFile.path)
        
        // 导入类别
        if (i === 0) { // 只在第一个文件时导入类别
          stats.categories = await this.importCategories(cocoData.categories, categoryCache)
          onProgress?.(
            30,
            100,
            `已导入 ${stats.categories} 个类别`
          )
        }

        // 导入图片和标注
        const fileStartPercent = (i / totalFiles) * 100
        const fileEndPercent = ((i + 1) / totalFiles) * 100
        
        // 为每个 JSON 文件创建进度包装器，将文件的进度映射到整体进度范围
        const fileProgressWrapper = (percent, total, message) => {
          if (onProgress) {
            // 将文件的进度（0-100%）映射到整体进度范围
            const overallPercent = Math.round(fileStartPercent + (percent / 100) * (fileEndPercent - fileStartPercent))
            onProgress(overallPercent, 100, message)
          }
        }
        
        const result = await this.importImagesAndAnnotations(
          cocoData,
          jsonFile.imageDir,
          projectName,
          categoryCache,
          copyImages,
          fileProgressWrapper
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
      console.error('COCO导入失败:', error)
      return {
        success: false,
        error: error.message,
        stats,
        errors
      }
    }
  }

  /**
   * 检测数据集结构
   */
  async detectDatasetStructure(datasetPath) {
    const jsonFiles = []

    // 检查标准COCO结构
    const standardPaths = [
      { path: pathJoin(datasetPath, 'annotations', 'instances_train.json'), split: 'train', imageDir: pathJoin(datasetPath, 'images', 'train') },
      { path: pathJoin(datasetPath, 'annotations', 'instances_val.json'), split: 'val', imageDir: pathJoin(datasetPath, 'images', 'val') },
      { path: pathJoin(datasetPath, 'annotations', 'instances_test.json'), split: 'test', imageDir: pathJoin(datasetPath, 'images', 'test') }
    ]

    for (const item of standardPaths) {
      if (await this.fileExists(item.path)) {
        jsonFiles.push(item)
      }
    }

    // 如果找到标准结构，返回
    if (jsonFiles.length > 0) {
      return {
        valid: true,
        type: 'standard',
        jsonFiles
      }
    }

    // 检查单个JSON文件
    const singleJsonPatterns = [
      pathJoin(datasetPath, 'annotations.json'),
      pathJoin(datasetPath, 'instances.json'),
      pathJoin(datasetPath, 'annotations', 'instances.json')
    ]

    for (const jsonPath of singleJsonPatterns) {
      if (await this.fileExists(jsonPath)) {
        // 查找图片目录
        const possibleImageDirs = [
          pathJoin(datasetPath, 'images'),
          pathJoin(datasetPath, 'img'),
          datasetPath // 图片可能直接在根目录
        ]

        let imageDir = null
        for (const dir of possibleImageDirs) {
          const files = await this.listFiles(dir).catch(() => [])
          if (files.some(f => /\.(jpg|jpeg|png|bmp)$/i.test(f))) {
            imageDir = dir
            break
          }
        }

        if (!imageDir) {
          return {
            valid: false,
            message: '找不到图片目录'
          }
        }

        return {
          valid: true,
          type: 'single',
          jsonFiles: [{ path: jsonPath, split: 'all', imageDir }]
        }
      }
    }

    return {
      valid: false,
      message: '未找到有效的COCO JSON文件。请确保数据集包含 annotations/instances_*.json 或 annotations.json'
    }
  }

  /**
   * 导入类别
   */
  async importCategories(categories, categoryCache) {
    if (!categories || categories.length === 0) {
      throw new Error('COCO数据集中没有类别信息')
    }

    for (const category of categories) {
      const categoryId = await this.getOrCreateCategory(category.name, categoryCache)
      // 保存COCO ID到我们的ID的映射
      categoryCache.set(`coco_${category.id}`, categoryId)
    }

    return categories.length
  }

  /**
   * 导入图片和标注
   */
  async importImagesAndAnnotations(cocoData, imageDir, projectName, categoryCache, copyImages, onProgress) {
    const stats = {
      totalImages: cocoData.images?.length || 0,
      importedImages: 0,  // 实际导入到项目的图片数（在阶段3统计）
      totalAnnotations: 0,
      importedAnnotations: 0,
      skippedImages: 0   // 跳过的图片数（比如因为某些原因没有导入的）
    }
    const errors = []

    if (!cocoData.images || cocoData.images.length === 0) {
      return { ...stats, errors }
    }

    // 构建标注索引 { imageId: [annotations] }
    const annotationsByImage = new Map()
    if (cocoData.annotations) {
      for (const ann of cocoData.annotations) {
        if (!annotationsByImage.has(ann.image_id)) {
          annotationsByImage.set(ann.image_id, [])
        }
        annotationsByImage.get(ann.image_id).push(ann)
      }
      stats.totalAnnotations = cocoData.annotations.length
    }

    // 准备图片导入任务数组（先过滤掉不存在的文件）
    const imageTasks = []
    for (const cocoImage of cocoData.images) {
      const imagePath = `${imageDir}/${cocoImage.file_name}`
      
      // 检查文件是否存在（提前检查，避免在并发任务中重复检查）
      if (await this.fileExists(imagePath)) {
        imageTasks.push({
          cocoImage,
          imagePath,
          imageAnnotations: annotationsByImage.get(cocoImage.id) || []
        })
      } else {
        errors.push({
          image: cocoImage.file_name,
          error: '文件不存在'
        })
      }
    }

    // 阶段1：并行复制所有文件（不写入数据库）
    const { prepareImageImport } = await import('../imagePool')
    const concurrency = 5
    
    const prepareTaskFn = async (task) => {
      const { cocoImage, imagePath, imageAnnotations } = task
      
      try {
        // 准备图片导入（仅复制文件，不写入数据库）
        const prepared = await prepareImageImport(projectName, imagePath)
        
        // 转换标注格式（如果存在）
        const convertedAnnotations = []
        if (imageAnnotations.length > 0) {
          for (const ann of imageAnnotations) {
            try {
              // 获取类别ID（从COCO ID映射到我们的ID）
              const categoryId = categoryCache.get(`coco_${ann.category_id}`)
              if (!categoryId) {
                console.warn(`未找到类别 ${ann.category_id}`)
                continue
              }

              // 转换COCO bbox到YOLO格式
              const bbox = this.cocoBboxToYolo(
                ann.bbox,
                cocoImage.width,
                cocoImage.height
              )

              convertedAnnotations.push({
                categoryId,
                bbox
              })
            } catch (error) {
              console.error(`转换标注失败:`, error)
            }
          }
        }
        
        return {
          prepared,
          fileName: cocoImage.file_name,
          annotations: convertedAnnotations
        }
      } catch (error) {
        console.error(`准备图片导入失败 ${cocoImage.file_name}:`, error)
        throw error
      }
    }
    
      // 定义各阶段的进度范围
      const PROGRESS_STAGE1_END = 40  // 阶段1：0-40%
      const PROGRESS_STAGE2_END = 50  // 阶段2：40-50%
      const PROGRESS_STAGE3_END = 100 // 阶段3和4并行：50-100%

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

    // 批量插入新图片到数据库
    let newImageResults = []
    if (newImages.length > 0) {
      onProgress?.(PROGRESS_STAGE1_END, 100, '写入数据库...')
      const { batchInsertImages } = await import('../imagePool')
      newImageResults = await batchInsertImages(newImages)
      // 注意：这里不统计 importedImages，因为图片只是添加到图片池，还没有添加到项目
      // importedImages 应该在阶段3（添加项目引用）时统计
      onProgress?.(PROGRESS_STAGE2_END, 100, `已写入 ${newImageResults.length} 张图片到数据库`)
    } else {
      onProgress?.(PROGRESS_STAGE2_END, 100, '跳过数据库写入（无新图片）')
    }

    // 合并所有图片结果（新导入 + 已存在）
    const allImageResults = []
    
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
      }
    }
    
    // 添加已存在的图片
    for (const existing of existingImages) {
      allImageResults.push(existing)
      // 注意：已存在的图片如果被添加到项目中，也应该计入 importedImages
      // skippedImages 应该表示"跳过的图片"（比如因为某些原因没有导入的），而不是"已存在但成功导入的"
      // 所以这里不增加 skippedImages，而是在后面统计实际添加到项目的图片数
    }

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

    return { ...stats, errors }
  }

  /**
   * 将COCO bbox转换为YOLO格式
   * @param {Array} cocoBbox - [x, y, width, height] (左上角，绝对坐标)
   * @param {Number} imgWidth - 图片宽度
   * @param {Number} imgHeight - 图片高度
   * @returns {Object} - { center_x, center_y, width, height } (归一化)
   */
  cocoBboxToYolo(cocoBbox, imgWidth, imgHeight) {
    const [x, y, width, height] = cocoBbox

    // 计算中心点
    const centerX = x + width / 2
    const centerY = y + height / 2

    // 归一化
    return {
      center_x: centerX / imgWidth,
      center_y: centerY / imgHeight,
      width: width / imgWidth,
      height: height / imgHeight
    }
  }

  /**
   * 验证数据集
   * @param {String} configFilePathOrDatasetPath - annotations.json 文件路径或数据集目录（向后兼容）
   */
  async validateDataset(configFilePathOrDatasetPath) {
    // 检查是否是文件路径（JSON）
    const isFile = configFilePathOrDatasetPath.endsWith('.json')
    
    if (isFile) {
      // 新方式：验证配置文件
      if (!await this.fileExists(configFilePathOrDatasetPath)) {
        return {
          valid: false,
          message: `配置文件不存在: ${configFilePathOrDatasetPath}`
        }
      }

      try {
        const cocoData = await this.readJSON(configFilePathOrDatasetPath)
        
        // 验证 JSON 结构
        if (!cocoData.images || cocoData.images.length === 0) {
          return {
            valid: false,
            message: 'JSON 文件中没有图片信息'
          }
        }

        // 计算数据集根目录
        const jsonDir = pathDirname(configFilePathOrDatasetPath)
        
        // 检查是否能找到图片目录
        // 如果 JSON 在 annotations 目录下，图片通常在上一级目录的 images 下
        const possibleImageDirs = [
          // 如果 JSON 在 annotations 目录下，尝试上一级目录的 images
          pathJoin(pathDirname(jsonDir), 'images', 'train'),
          pathJoin(pathDirname(jsonDir), 'images', 'val'),
          pathJoin(pathDirname(jsonDir), 'images'),
          pathJoin(pathDirname(jsonDir), 'img'),
          // 当前目录下的 images
          pathJoin(jsonDir, 'images'),
          pathJoin(jsonDir, 'img'),
          // 直接在当前目录
          jsonDir,
          // 上一级目录
          pathDirname(jsonDir)
        ]

        let hasImages = false
        if (cocoData.images && cocoData.images.length > 0) {
          const firstImage = cocoData.images[0]
          for (const dir of possibleImageDirs) {
            const testPath = pathJoin(dir, firstImage.file_name)
            if (await this.fileExists(testPath)) {
              hasImages = true
              break
            }
          }
        }

        if (!hasImages) {
          return {
            valid: false,
            message: '无法找到图片目录，请检查 JSON 文件中的 file_name 路径'
          }
        }

        const categoryCount = cocoData.categories?.length || 0
        return {
          valid: true,
          message: `数据集验证通过 (${cocoData.images.length} 张图片, ${categoryCount} 个类别)`
        }
      } catch (error) {
        return {
          valid: false,
          message: `解析配置文件失败: ${error.message}`
        }
      }
    } else {
      // 向后兼容：验证数据集目录
      return await this.detectDatasetStructure(configFilePathOrDatasetPath)
    }
  }
}

