import { BaseExporter } from './BaseExporter'
import { getImagePath } from '../imagePool'

/**
 * COCO JSON 格式导出器
 * 
 * 输出结构：
 * outputPath/
 * ├── images/
 * │   ├── train/
 * │   └── val/
 * └── annotations/
 *     ├── instances_train.json
 *     └── instances_val.json
 */
export class CocoExporter extends BaseExporter {
  constructor() {
    super()
    this.format = 'COCO'
  }

  /**
   * 导出 COCO 格式数据集
   */
  async export(datasetPath, outputPath, config, onProgress) {
    try {
      onProgress?.(0, 100, '初始化导出...')
      
      // 1. 创建目录结构
      await this.createDirectories(outputPath, config)
      onProgress?.(5, 100, '创建目录结构...')
      
      // 2. 读取数据集数据库
      const dbPath = `${datasetPath}/annotations.db`
      
      // 打开数据库
      const openResult = await window.electronAPI.openDatabase(dbPath)
      if (!openResult.success) {
        throw new Error(`打开数据库失败: ${openResult.error}`)
      }
      
      try {
        // 获取所有图片
        const imagesResult = await window.electronAPI.allSQL(dbPath, 'SELECT * FROM dataset_images')
        if (!imagesResult.success) {
          throw new Error(`查询图片失败: ${imagesResult.error}`)
        }
        const images = imagesResult.data || []
        onProgress?.(10, 100, `加载数据 (${images.length} 张图片)...`)
        
        // 获取所有类别
        const categoriesResult = await window.electronAPI.allSQL(dbPath, 'SELECT * FROM categories ORDER BY id')
        if (!categoriesResult.success) {
          throw new Error(`查询类别失败: ${categoriesResult.error}`)
        }
        const categories = categoriesResult.data || []
        
        // 获取所有标注
        const annotationsResult = await window.electronAPI.allSQL(dbPath, 'SELECT * FROM annotations')
        if (!annotationsResult.success) {
          throw new Error(`查询标注失败: ${annotationsResult.error}`)
        }
        const annotations = annotationsResult.data || []
        
        // 3. 随机划分图片
        const splits = this.randomSplit(images, config)
        onProgress?.(15, 100, '划分数据集...')
        
        // 4. 处理每个划分
        let processed = 0
        const totalImages = images.length
        
        for (const [splitName, splitImages] of Object.entries(splits)) {
          // 复制图片并生成 COCO JSON
          const cocoData = await this.processSplit(
            splitImages,
            annotations,
            categories,
            outputPath,
            splitName,
            (current, total) => {
              processed++
              onProgress?.(15 + (processed / totalImages) * 70, 100, `处理 ${splitName} ${current}/${total}...`)
            }
          )
          
          // 保存 JSON 文件
          const jsonPath = `${outputPath}/annotations/instances_${splitName}.json`
          const result = await window.electronAPI.writeJSON(jsonPath, cocoData)
          if (!result.success) {
            throw new Error(`写入 COCO JSON 失败: ${result.error}`)
          }
        }
        
        // 5. 保存导出历史
        const stats = {
          totalImages: images.length,
          train: splits.train.length,
          categories: categories.length
        }
        
        if (config.includeVal) {
          stats.val = splits.val.length
        }
        
        if (config.includeTest) {
          stats.test = splits.test.length
        }
        
        await this.saveExportHistory(datasetPath, {
          format: this.format,
          outputPath,
          config,
          stats
        })
        
        onProgress?.(100, 100, '导出完成！')
        
        return {
          success: true,
          stats
        }
      } catch (innerError) {
        throw innerError
      } finally {
        // 关闭数据库连接
        try {
          await window.electronAPI.closeDatabase(dbPath)
          console.log('已关闭数据集数据库连接')
        } catch (closeError) {
          console.warn('关闭数据库连接失败:', closeError)
        }
      }
    } catch (error) {
      console.error('COCO 导出失败:', error)
      throw error
    }
  }

  /**
   * 创建目录结构
   */
  async createDirectories(outputPath, config) {
    const dirs = [
      'images/train',
      'annotations'
    ]
    
    if (config.includeVal) {
      dirs.push('images/val')
    }
    
    if (config.includeTest) {
      dirs.push('images/test')
    }
    
    for (const dir of dirs) {
      await this.ensureDirectory(`${outputPath}/${dir}`)
    }
  }

  /**
   * 处理单个划分（train/val）
   */
  async processSplit(images, allAnnotations, categories, outputPath, splitName, onProgress) {
    const cocoImages = []
    const cocoAnnotations = []
    let annotationId = 1
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      
      // 复制图片
      const sourcePath = await getImagePath(image.image_id)
      const filename = sourcePath.split(/[\\/]/).pop()
      const destPath = `${outputPath}/images/${splitName}/${filename}`
      
      const copyResult = await window.electronAPI.copyFile(sourcePath, destPath)
      if (!copyResult.success) {
        throw new Error(`复制图片失败: ${copyResult.error}`)
      }
      
      // 获取图片尺寸
      const size = await this.getImageSize(sourcePath)
      
      // COCO image 对象
      cocoImages.push({
        id: image.image_id,
        file_name: filename,
        width: size.width,
        height: size.height
      })
      
      // 获取该图片的所有标注
      const imageAnnotations = allAnnotations.filter(ann => ann.image_id === image.image_id)
      
      // 转换为 COCO annotation 对象
      for (const ann of imageAnnotations) {
        const position = JSON.parse(ann.position)
        
        // 将归一化坐标转换为绝对坐标
        const bbox = this.normalizedToCocoBbox(position, size.width, size.height)
        
        cocoAnnotations.push({
          id: annotationId++,
          image_id: image.image_id,
          category_id: ann.category_id,
          bbox: [bbox.x, bbox.y, bbox.width, bbox.height],
          area: bbox.width * bbox.height,
          iscrowd: 0
        })
      }
      
      onProgress?.(i + 1, images.length)
    }
    
    // 构建 COCO 格式数据
    return {
      info: {
        description: `YoloMarkFlow Dataset - ${splitName}`,
        version: '1.0',
        year: new Date().getFullYear(),
        date_created: new Date().toISOString()
      },
      images: cocoImages,
      annotations: cocoAnnotations,
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        supercategory: 'object'
      }))
    }
  }

  /**
   * 将归一化坐标（中心点+宽高）转换为 COCO bbox（左上角+宽高）
   * @param {Object} position - { center_x, center_y, width, height } (归一化)
   * @param {Number} imgWidth - 图片宽度
   * @param {Number} imgHeight - 图片高度
   * @returns {Object} - { x, y, width, height } (绝对坐标)
   */
  normalizedToCocoBbox(position, imgWidth, imgHeight) {
    const { center_x, center_y, width, height } = position
    
    const absWidth = width * imgWidth
    const absHeight = height * imgHeight
    const x = (center_x * imgWidth) - (absWidth / 2)
    const y = (center_y * imgHeight) - (absHeight / 2)
    
    return {
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
      width: Math.round(absWidth),
      height: Math.round(absHeight)
    }
  }
}

