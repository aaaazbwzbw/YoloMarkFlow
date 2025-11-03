// SQLite数据库管理工具
import { getCurrentProject } from './projectManager'

/**
 * 数据库管理类
 */
export class DatabaseManager {
  constructor() {
    this.dbPath = null
    this.projectPath = null
  }

  /**
   * 初始化数据库连接
   */
  async init() {
    const currentProject = getCurrentProject()
    if (!currentProject || !currentProject.path) {
      throw new Error('没有打开的项目')
    }

    this.projectPath = currentProject.path
    this.dbPath = `${this.projectPath}/annotations.db`

    // 通过Electron API打开SQLite数据库
    const result = await window.electronAPI.openDatabase(this.dbPath)
    if (!result.success) {
      throw new Error(result.error)
    }

    await this.createTables()
    
    // 添加小延迟确保表创建完成
    await new Promise(resolve => setTimeout(resolve, 100))
    
    console.log('数据库初始化成功')
  }

  /**
   * 创建数据表
   */
  async createTables() {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    // 创建类别表
    await window.electronAPI.execSQL(this.dbPath, `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        sort INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建标注表（使用image_id）
    await window.electronAPI.execSQL(this.dbPath, `
      CREATE TABLE IF NOT EXISTS annotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id INTEGER NOT NULL,
        class_id INTEGER,
        position TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES categories (id)
      )
    `)

    // 创建project_images表
    await window.electronAPI.execSQL(this.dbPath, `
      CREATE TABLE IF NOT EXISTS project_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        imported_at TEXT
      )
    `)

    // 创建索引
    await window.electronAPI.execSQL(this.dbPath, `
      CREATE INDEX IF NOT EXISTS idx_annotations_image_id ON annotations (image_id)
    `)
    await window.electronAPI.execSQL(this.dbPath, `
      CREATE INDEX IF NOT EXISTS idx_annotations_class_id ON annotations (class_id)
    `)
    await window.electronAPI.execSQL(this.dbPath, `
      CREATE INDEX IF NOT EXISTS idx_project_images_image_id ON project_images (image_id)
    `)

    console.log('数据表创建成功')
    
    // 执行迁移
    await this.migrateToImagePool()
    
    // 验证表是否创建成功
    try {
      const testResult = await window.electronAPI.querySQL(
        this.dbPath,
        "SELECT name FROM sqlite_master WHERE type='table'"
      )
      console.log('表验证结果:', testResult.data)
    } catch (error) {
      console.error('表验证失败:', error)
    }
  }

  /**
   * 迁移到图片池架构
   */
  async migrateToImagePool() {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    try {
      // 检查是否已经迁移（检查annotations表是否有image_name列）
      const columnsResult = await window.electronAPI.querySQL(
        this.dbPath,
        "PRAGMA table_info(annotations)"
      )
      
      const hasImageName = columnsResult.data?.some(col => col.name === 'image_name')
      const hasImageId = columnsResult.data?.some(col => col.name === 'image_id')

      if (hasImageName && !hasImageId) {
        console.log('检测到旧数据库结构，开始迁移...')
        
        // 方案：由于SQLite限制，我们创建新表并复制数据
        // 1. 创建临时的新annotations表
        await window.electronAPI.execSQL(this.dbPath, `
          CREATE TABLE annotations_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id INTEGER NOT NULL,
            class_id INTEGER,
            position TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (class_id) REFERENCES categories (id)
          )
        `)

        // 注意：旧数据无法自动迁移到图片池，因为没有image_id映射
        // 新导入的图片将使用新架构
        console.log('数据库迁移完成（旧数据保留在原表）')

        // 2. 删除旧表
        await window.electronAPI.execSQL(this.dbPath, 'DROP TABLE IF EXISTS annotations')
        
        // 3. 重命名新表
        await window.electronAPI.execSQL(this.dbPath, 'ALTER TABLE annotations_new RENAME TO annotations')
        
        // 4. 重建索引
        await window.electronAPI.execSQL(this.dbPath, `
          CREATE INDEX IF NOT EXISTS idx_annotations_image_id ON annotations (image_id)
        `)
        await window.electronAPI.execSQL(this.dbPath, `
          CREATE INDEX IF NOT EXISTS idx_annotations_class_id ON annotations (class_id)
        `)
        
        console.log('数据库结构迁移完成')
      } else if (hasImageId) {
        console.log('数据库已使用新结构，无需迁移')
      }
    } catch (error) {
      console.error('数据库迁移失败:', error)
      // 迁移失败不应该阻止初始化
    }
  }

  /**
   * 添加类别
   */
  async addCategory(name, color) {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    const result = await window.electronAPI.runSQL(
      this.dbPath,
      'INSERT INTO categories (name, color) VALUES (?, ?)',
      [name, color]
    )
    
    console.log('类别添加成功:', result.result.lastInsertRowid)
    return result.result.lastInsertRowid
  }

  /**
   * 获取所有类别
   */
  async getCategories() {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    const result = await window.electronAPI.querySQL(
      this.dbPath,
      'SELECT * FROM categories ORDER BY sort ASC, id ASC'
    )
    return result.data || []
  }

  /**
   * 更新类别
   */
  async updateCategory(id, name, color) {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    await window.electronAPI.runSQL(
      this.dbPath,
      'UPDATE categories SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, color, id]
    )
    console.log('类别更新成功')
  }

  /**
   * 删除类别
   */
  async deleteCategory(id) {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    // 先删除该类别下的所有标注
    await window.electronAPI.runSQL(this.dbPath, 'DELETE FROM annotations WHERE class_id = ?', [id])
    
    // 再删除类别
    await window.electronAPI.runSQL(this.dbPath, 'DELETE FROM categories WHERE id = ?', [id])
    
    console.log('类别删除成功')
  }

  /**
   * 删除指定图片的所有标注
   */
  async deleteImageAnnotations(imageId) {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    await window.electronAPI.runSQL(this.dbPath, 'DELETE FROM annotations WHERE image_id = ?', [imageId])
    
    console.log(`图片 ${imageId} 的标注已删除`)
  }

  /**
   * 获取所有标注数据
   */
  async getAllAnnotations() {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    const result = await window.electronAPI.querySQL(
      this.dbPath,
      'SELECT a.*, c.name as class_name, c.color as class_color FROM annotations a LEFT JOIN categories c ON a.class_id = c.id'
    )
    
    // 解析position JSON数据
    const annotations = (result.data || []).map(annotation => {
      if (annotation.position) {
        try {
          const positionData = JSON.parse(annotation.position)
          return {
            ...annotation,
            position: {
              centerX: positionData.center_x,
              centerY: positionData.center_y,
              width: positionData.width,
              height: positionData.height
            }
          }
        } catch (error) {
          console.error('解析position JSON失败:', error)
          return annotation
        }
      }
      return annotation
    })
    
    return annotations
  }

  /**
   * 获取每个类别的样本数量
   */
  async getCategoryCounts() {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    const result = await window.electronAPI.querySQL(
      this.dbPath,
      `SELECT 
        c.id,
        c.name,
        c.color,
        COUNT(a.id) as count
      FROM categories c
      LEFT JOIN annotations a ON c.id = a.class_id
      GROUP BY c.id, c.name, c.color
      ORDER BY c.sort ASC, c.id ASC`
    )
    return result.data || []
  }


  /**
   * 添加图片引用到项目（带去重检查）
   * @param {number} imageId - 图片池中的图片ID
   * @param {string} originalName - 原始文件名
   * @returns {Promise<{id: number, isNew: boolean}>} project_images表的主键ID和是否是新记录
   */
  async addProjectImage(imageId, originalName) {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    // 先检查该imageId是否已经在项目中
    const checkResult = await window.electronAPI.querySQL(
      this.dbPath,
      'SELECT id FROM project_images WHERE image_id = ?',
      [imageId]
    )

    if (checkResult.data && checkResult.data.length > 0) {
      // 图片已存在，返回现有ID
      console.log('图片已存在于项目中，跳过添加:', imageId)
      return {
        id: checkResult.data[0].id,
        isNew: false
      }
    }

    // 图片不存在，添加新记录
    const result = await window.electronAPI.runSQL(
      this.dbPath,
      'INSERT INTO project_images (image_id, original_name, imported_at) VALUES (?, ?, ?)',
      [imageId, originalName, new Date().toISOString()]
    )

    console.log('图片引用添加成功:', result.result.lastInsertRowid)
    return {
      id: result.result.lastInsertRowid,
      isNew: true
    }
  }

  /**
   * 获取项目的所有图片
   * @returns {Promise<Array<{id: number, image_id: number, original_name: string}>>}
   */
  async getProjectImages() {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    const result = await window.electronAPI.querySQL(
      this.dbPath,
      'SELECT id, image_id, original_name, imported_at FROM project_images ORDER BY id ASC'
    )

    return result.data || []
  }

  /**
   * 根据image_id获取图片的标注数据
   * @param {number} imageId - 图片池中的图片ID
   * @returns {Promise<Array>} 标注数据数组
   */
  async getImageAnnotations(imageId) {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    const result = await window.electronAPI.querySQL(
      this.dbPath,
      'SELECT * FROM annotations WHERE image_id = ?',
      [imageId]
    )

    // 解析position JSON数据
    const annotations = (result.data || []).map(annotation => {
      if (annotation.position) {
        try {
          const positionData = JSON.parse(annotation.position)
          return {
            ...annotation,
            position: {
              centerX: positionData.center_x,
              centerY: positionData.center_y,
              width: positionData.width,
              height: positionData.height
            }
          }
        } catch (error) {
          console.error('解析position JSON失败:', error)
          return annotation
        }
      }
      return annotation
    })

    return annotations
  }

  /**
   * 保存图片的标注数据（使用image_id）
   * @param {number} imageId - 图片池中的图片ID
   * @param {Array} annotations - 标注数据数组
   */
  async saveImageAnnotations(imageId, annotations) {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    // 开始事务
    await window.electronAPI.execSQL(this.dbPath, 'BEGIN TRANSACTION')

    try {
      // 先删除该图片的所有标注
      await window.electronAPI.runSQL(
        this.dbPath,
        'DELETE FROM annotations WHERE image_id = ?',
        [imageId]
      )

      // 插入新的标注数据
      for (const annotation of annotations) {
        if (annotation.position) {
          // 有标注框的情况，将position对象序列化为JSON
          const positionJson = JSON.stringify({
            center_x: annotation.position.centerX,
            center_y: annotation.position.centerY,
            width: annotation.position.width,
            height: annotation.position.height
          })
          await window.electronAPI.runSQL(
            this.dbPath,
            'INSERT INTO annotations (image_id, class_id, position) VALUES (?, ?, ?)',
            [imageId, annotation.classId, positionJson]
          )
        } else {
          // 负样本的情况（position为null）
          await window.electronAPI.runSQL(
            this.dbPath,
            'INSERT INTO annotations (image_id, class_id, position) VALUES (?, ?, ?)',
            [imageId, annotation.classId, null]
          )
        }
      }

      // 提交事务
      await window.electronAPI.execSQL(this.dbPath, 'COMMIT')
    } catch (error) {
      // 回滚事务
      await window.electronAPI.execSQL(this.dbPath, 'ROLLBACK')
      throw error
    }
  }

  /**
   * 批量获取多张图片的标注状态（基于image_id）
   * @param {Array<number>} imageIds - 图片ID数组
   * @returns {Object} - { imageId: { hasAnnotations: boolean, isNegative: boolean, count: number } }
   */
  async getImagesStatusByIds(imageIds) {
    if (!this.dbPath) {
      throw new Error('数据库未初始化')
    }

    if (!imageIds || imageIds.length === 0) {
      return {}
    }

    // 构建 IN 查询的占位符
    const placeholders = imageIds.map(() => '?').join(',')

    const result = await window.electronAPI.querySQL(
      this.dbPath,
      `SELECT 
        image_id,
        COUNT(*) as count,
        SUM(CASE WHEN position IS NULL AND class_id IS NULL THEN 1 ELSE 0 END) as pure_negative_count,
        SUM(CASE WHEN position IS NULL AND class_id IS NOT NULL THEN 1 ELSE 0 END) as class_negative_count,
        SUM(CASE WHEN position IS NOT NULL THEN 1 ELSE 0 END) as annotated_count
      FROM annotations 
      WHERE image_id IN (${placeholders})
      GROUP BY image_id`,
      imageIds
    )

    // 转换为对象格式，方便查询
    const statusMap = {}

    // 初始化所有图片状态为未标注
    imageIds.forEach(id => {
      statusMap[id] = {
        hasAnnotations: false,
        isNegative: false,
        count: 0
      }
    })

    // 更新有标注数据的图片状态
    if (result.data) {
      result.data.forEach(row => {
        const totalCount = parseInt(row.count) || 0
        const pureNegativeCount = parseInt(row.pure_negative_count) || 0
        const classNegativeCount = parseInt(row.class_negative_count) || 0
        const annotatedCount = parseInt(row.annotated_count) || 0

        // 如果有 class_id 和 position 都为 null 的记录，或者只有 position 为 null 的记录，则为负样本
        const isNegative = totalCount > 0 && annotatedCount === 0 && (pureNegativeCount > 0 || classNegativeCount > 0)

        statusMap[row.image_id] = {
          hasAnnotations: totalCount > 0,
          isNegative: isNegative,
          count: totalCount
        }
      })
    }

    return statusMap
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.dbPath) {
      await window.electronAPI.closeDatabase(this.dbPath)
      this.dbPath = null
      console.log('数据库连接已关闭')
    }
  }
}

// 创建全局数据库管理器实例
export const dbManager = new DatabaseManager()

export default dbManager
