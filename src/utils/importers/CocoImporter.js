import { BaseImporter } from './BaseImporter'
import { dbManager } from '../database'

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

      // 1. 检测数据集类型并验证
      const datasetInfo = await this.detectDatasetStructure(datasetPath)
      if (!datasetInfo.valid) {
        throw new Error(datasetInfo.message)
      }

      onProgress?.(5, 100, '读取数据集配置...')

      // 2. 初始化数据库
      await dbManager.init()

      // 3. 类别缓存
      const categoryCache = new Map()

      // 4. 处理每个JSON文件
      let processedImages = 0
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
        const result = await this.importImagesAndAnnotations(
          cocoData,
          jsonFile.imageDir,
          projectName,
          categoryCache,
          copyImages,
          (current, total) => {
            processedImages++
            const progress = 30 + (processedImages / (cocoData.images?.length || 1)) * 60
            onProgress?.(
              progress,
              100,
              `导入图片 ${processedImages}/${cocoData.images?.length || 0}...`
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
      { path: `${datasetPath}/annotations/instances_train.json`, split: 'train', imageDir: `${datasetPath}/images/train` },
      { path: `${datasetPath}/annotations/instances_val.json`, split: 'val', imageDir: `${datasetPath}/images/val` },
      { path: `${datasetPath}/annotations/instances_test.json`, split: 'test', imageDir: `${datasetPath}/images/test` }
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
      `${datasetPath}/annotations.json`,
      `${datasetPath}/instances.json`,
      `${datasetPath}/annotations/instances.json`
    ]

    for (const jsonPath of singleJsonPatterns) {
      if (await this.fileExists(jsonPath)) {
        // 查找图片目录
        const possibleImageDirs = [
          `${datasetPath}/images`,
          `${datasetPath}/img`,
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
      importedImages: 0,
      totalAnnotations: 0,
      importedAnnotations: 0,
      skippedImages: 0  // 添加跳过的图片统计
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

    // 导入每张图片
    for (let i = 0; i < cocoData.images.length; i++) {
      const cocoImage = cocoData.images[i]
      
      try {
        // 构建图片路径
        const imagePath = `${imageDir}/${cocoImage.file_name}`
        
        // 检查文件是否存在
        if (!await this.fileExists(imagePath)) {
          errors.push({
            image: cocoImage.file_name,
            error: '文件不存在'
          })
          continue
        }

        // 导入图片到图片池
        const imageResult = await this.importImageFile(projectName, imagePath, copyImages)
        
        // 添加到项目数据库
        const addResult = await dbManager.addProjectImage(imageResult.imageId, cocoImage.file_name)
        
        if (addResult.isNew) {
          stats.importedImages++
        } else {
          stats.skippedImages++
          console.log(`跳过重复图片: ${cocoImage.file_name}`)
        }

        // 获取该图片的标注
        const imageAnnotations = annotationsByImage.get(cocoImage.id) || []
        
        if (imageAnnotations.length > 0) {
          // 转换标注格式
          const convertedAnnotations = []
          
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
              
              stats.importedAnnotations++
            } catch (error) {
              console.error(`转换标注失败:`, error)
            }
          }

          // 保存标注
          if (convertedAnnotations.length > 0) {
            await this.saveAnnotations(imageResult.imageId, convertedAnnotations)
          }
        }

        onProgress?.(i + 1, cocoData.images.length)
      } catch (error) {
        errors.push({
          image: cocoImage.file_name,
          error: error.message
        })
        console.error(`导入图片失败 ${cocoImage.file_name}:`, error)
      }
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
   */
  async validateDataset(datasetPath) {
    return await this.detectDatasetStructure(datasetPath)
  }
}

