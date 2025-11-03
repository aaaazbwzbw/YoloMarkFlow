import { BaseImporter } from './BaseImporter'
import { dbManager } from '../database'

/**
 * YOLO数据集导入器
 * 
 * 支持的数据集结构：
 * - data.yaml (包含类别信息和路径配置)
 * - images/train/, images/val/, images/test/
 * - labels/train/, labels/val/, labels/test/
 * - 或 classes.txt (类别列表)
 */
export class YoloImporter extends BaseImporter {
  constructor() {
    super()
    this.format = 'YOLO'
  }

  /**
   * 导入YOLO数据集
   */
  async import(options) {
    const {
      datasetPath,
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

      // 1. 验证数据集结构
      const validation = await this.validateDataset(datasetPath)
      if (!validation.valid) {
        throw new Error(validation.message)
      }

      onProgress?.(5, 100, '读取类别信息...')

      // 2. 读取类别信息
      const categories = await this.readCategories(datasetPath)
      if (!categories || categories.length === 0) {
        throw new Error('未找到类别信息。请确保数据集包含 data.yaml 或 classes.txt')
      }

      onProgress?.(10, 100, '初始化数据库...')

      // 3. 初始化数据库
      await dbManager.init()

      // 4. 导入类别
      const categoryCache = new Map()
      for (let i = 0; i < categories.length; i++) {
        const categoryId = await this.getOrCreateCategory(categories[i], categoryCache)
        // 保存索引到ID的映射
        categoryCache.set(i, categoryId)
      }
      stats.categories = categories.length

      onProgress?.(15, 100, `已导入 ${stats.categories} 个类别`)

      // 5. 检测数据划分
      const splits = await this.detectSplits(datasetPath)
      
      // 6. 导入每个划分的数据
      let processedImages = 0
      
      for (const split of splits) {
        onProgress?.(
          20 + (processedImages / (stats.totalImages || 1)) * 70,
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
            const progress = 20 + (processedImages / total) * 70
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
   */
  async detectSplits(datasetPath) {
    const splits = []
    const possibleSplits = ['train', 'val', 'test']

    for (const splitName of possibleSplits) {
      const imageDir = `${datasetPath}/images/${splitName}`
      const labelDir = `${datasetPath}/labels/${splitName}`

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
      const imageDir = `${datasetPath}/images`
      const labelDir = `${datasetPath}/labels`

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
   */
  async validateDataset(datasetPath) {
    // 检查是否有类别信息
    const hasYaml = await this.fileExists(`${datasetPath}/data.yaml`)
    const hasClasses = await this.fileExists(`${datasetPath}/classes.txt`)

    if (!hasYaml && !hasClasses) {
      return {
        valid: false,
        message: '未找到类别信息文件 (data.yaml 或 classes.txt)'
      }
    }

    // 检查是否有图片目录
    const possibleDirs = [
      `${datasetPath}/images/train`,
      `${datasetPath}/images/val`,
      `${datasetPath}/images`
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

