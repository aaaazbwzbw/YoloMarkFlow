import { BaseExporter } from './BaseExporter'
import { getImagePath } from '../imagePool'

/**
 * YOLO 格式导出器
 * 
 * 输出结构：
 * outputPath/
 * ├── images/
 * │   ├── train/
 * │   └── val/
 * ├── labels/
 * │   ├── train/
 * │   └── val/
 * └── data.yaml
 */
export class YoloExporter extends BaseExporter {
  constructor() {
    super()
    this.format = 'YOLO'
  }

  /**
   * 导出 YOLO 格式数据集
   * @param {String} datasetPath - 数据集路径
   * @param {String} outputPath - 输出路径
   * @param {Object} config - { trainRatio, valRatio }
   * @param {Function} onProgress - 进度回调
   */
  async export(datasetPath, outputPath, config, onProgress) {
    try {
      onProgress?.(0, 100, '初始化导出...')
      
      // 1. 读取数据集数据库（先读取数据以确定实际配置）
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
        
        // 2. 随机划分图片
        console.log('[YoloExporter] Export config:', config)
        console.log('[YoloExporter] Total images:', images.length)
        const splits = this.randomSplit(images, config)
        console.log('[YoloExporter] Split result:', {
          train: splits.train?.length || 0,
          val: splits.val?.length || 0,
          test: splits.test?.length || 0
        })
        onProgress?.(15, 100, '划分数据集...')
        
        // YOLO训练要求必须有验证集，所以确保验证集不为空
        // 如果验证集为空，randomSplit 应该已经至少分配了1张图片
        const actualConfig = { ...config }
        
        // 验证切分结果
        if (actualConfig.includeVal && (!splits.val || splits.val.length === 0)) {
          throw new Error('验证集为空，但YOLO训练要求必须有验证集。请检查数据集大小和验证集比例设置。')
        }
        
        // 3. 根据实际配置创建目录结构
        await this.createDirectories(outputPath, actualConfig)
        onProgress?.(20, 100, '创建目录结构...')
        
        // 4. 处理每个划分
        let processed = 0
        const totalImages = images.length
        
        for (const [splitName, splitImages] of Object.entries(splits)) {
          // 跳过空的划分（理论上不应该发生，因为已经在 randomSplit 中处理）
          if (!splitImages || splitImages.length === 0) {
            console.warn(`[YoloExporter] 跳过空的划分: ${splitName}`)
            continue
          }
          
          for (const image of splitImages) {
            // 复制图片
            await this.copyImage(image, outputPath, splitName)
            
            // 生成标注文件
            const imageAnnotations = annotations.filter(ann => ann.image_id === image.image_id)
            await this.createLabelFile(image, imageAnnotations, categories, outputPath, splitName)
            
            processed++
            onProgress?.(20 + (processed / totalImages) * 70, 100, `处理图片 ${processed}/${totalImages}...`)
          }
        }
        
        // 5. 生成 data.yaml（使用调整后的配置）
        await this.createDataYaml(categories, splits, outputPath, actualConfig)
        onProgress?.(90, 100, '生成配置文件...')
        
        // 6. 保存导出历史
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
      console.error('YOLO 导出失败:', error)
      throw error
    }
  }

  /**
   * 创建目录结构
   */
  async createDirectories(outputPath, config) {
    const dirs = [
      'images/train',
      'labels/train'
    ]
    
    if (config.includeVal) {
      dirs.push('images/val', 'labels/val')
    }
    
    if (config.includeTest) {
      dirs.push('images/test', 'labels/test')
    }
    
    for (const dir of dirs) {
      await this.ensureDirectory(`${outputPath}/${dir}`)
    }
  }

  /**
   * 复制图片文件
   */
  async copyImage(image, outputPath, splitName) {
    // 获取图片池中的源文件路径
    const sourcePath = await getImagePath(image.image_id)
    
    // 构建目标路径
    const filename = sourcePath.split(/[\\/]/).pop()
    const destPath = `${outputPath}/images/${splitName}/${filename}`
    
    // 复制文件
    const result = await window.electronAPI.copyFile(sourcePath, destPath)
    if (!result.success) {
      throw new Error(`复制图片失败: ${result.error}`)
    }
  }

  /**
   * 创建 YOLO 标注文件
   * 格式：每行一个标注框
   * class_index center_x center_y width height (归一化坐标)
   */
  async createLabelFile(image, annotations, categories, outputPath, splitName) {
    if (annotations.length === 0) {
      return // 负样本不需要标注文件
    }
    
    // 构建类别 ID 到索引的映射
    const categoryIdToIndex = {}
    categories.forEach((cat, index) => {
      categoryIdToIndex[cat.id] = index
    })
    
    // 生成标注内容
    const lines = annotations.map(ann => {
      const position = JSON.parse(ann.position)
      const classIndex = categoryIdToIndex[ann.category_id] ?? 0
      
      // YOLO 格式：class_index center_x center_y width height
      return `${classIndex} ${position.center_x} ${position.center_y} ${position.width} ${position.height}`
    })
    
    // 获取源文件名（不含扩展名）
    const sourcePath = await getImagePath(image.image_id)
    const filename = sourcePath.split(/[\\/]/).pop()
    const basename = filename.replace(/\.[^.]+$/, '')
    
    // 写入标注文件
    const labelPath = `${outputPath}/labels/${splitName}/${basename}.txt`
    const content = lines.join('\n')
    
    const result = await window.electronAPI.writeFile(labelPath, content)
    if (!result.success) {
      throw new Error(`写入标注文件失败: ${result.error}`)
    }
  }

  /**
   * 生成 data.yaml 配置文件
   */
  async createDataYaml(categories, splits, outputPath, config) {
    const yamlLines = [
      '# YOLO Dataset Configuration',
      '# Generated by YoloMarkFlow',
      '',
      'path: .  # 数据集根目录（相对于此yaml文件）',
      'train: images/train'
    ]
    
    if (config.includeVal) {
      yamlLines.push('val: images/val')
    }
    
    if (config.includeTest) {
      yamlLines.push('test: images/test')
    }
    
    yamlLines.push('')
    yamlLines.push(`nc: ${categories.length}`)
    yamlLines.push(`names: [${categories.map(c => `'${c.name}'`).join(', ')}]`)
    yamlLines.push('')
    yamlLines.push('# Statistics:')
    yamlLines.push(`#   Train: ${splits.train.length} images`)
    
    if (config.includeVal) {
      yamlLines.push(`#   Val: ${splits.val.length} images`)
    }
    
    if (config.includeTest) {
      yamlLines.push(`#   Test: ${splits.test.length} images`)
    }
    
    let totalImages = splits.train.length
    if (config.includeVal) totalImages += splits.val.length
    if (config.includeTest) totalImages += splits.test.length
    
    yamlLines.push(`#   Total: ${totalImages} images`)
    
    const yaml = yamlLines.join('\n')
    
    const yamlPath = `${outputPath}/data.yaml`
    const result = await window.electronAPI.writeFile(yamlPath, yaml)
    if (!result.success) {
      throw new Error(`写入 data.yaml 失败: ${result.error}`)
    }
  }
}

