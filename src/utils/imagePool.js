// 图片池管理工具
// 统一管理所有项目的图片文件，支持去重和引用计数

let imagePoolDbPath = null

/**
 * 获取图片池工作空间路径（优先使用用户配置）
 */
async function getImagePoolWorkspacePath() {
  // 优先使用用户配置的路径
  const customPath = localStorage.getItem('imagePoolPath')
  if (customPath) {
    console.log('使用自定义图片池路径:', customPath)
    return customPath
  }
  
  // 使用新的默认路径
  const defaultPath = 'D:\\YoloMarkFlow\\YoloMarkFlow_ImagePool'
  console.log('使用默认图片池路径:', defaultPath)
  return defaultPath
}

/**
 * 初始化图片池
 */
export async function initImagePool() {
  try {
    // 获取工作空间路径（支持自定义）
    const workspacePath = await getImagePoolWorkspacePath()
    const imagePoolPath = `${workspacePath}\\image_pool`

    // 确保目录存在
    await window.electronAPI.ensureDirectory(imagePoolPath)

    // 初始化图片池数据库（传递工作空间路径）
    const initResult = await window.electronAPI.initImagePool(workspacePath)
    if (!initResult.success) {
      throw new Error('图片池数据库初始化失败: ' + initResult.error)
    }

    imagePoolDbPath = initResult.dbPath
    console.log('图片池初始化成功:', imagePoolDbPath)
    console.log('图片池目录:', imagePoolPath)
    
    return { success: true, dbPath: imagePoolDbPath }
  } catch (error) {
    console.error('图片池初始化失败:', error)
    throw error
  }
}

/**
 * 导入图片到图片池
 * @param {string} projectName - 项目名称
 * @param {string} filePath - 源文件路径
 * @returns {Promise<{imageId: number, filename: string, isNewFile: boolean}>}
 */
export async function importImage(projectName, filePath) {
  if (!imagePoolDbPath) {
    await initImagePool()
  }

  try {
    // 1. 计算文件hash
    const hashResult = await window.electronAPI.calculateFileHash(filePath)
    if (!hashResult.success) {
      throw new Error('计算文件hash失败: ' + hashResult.error)
    }
    const fileHash = hashResult.hash

    // 2. 检查hash是否已存在
    const existingImage = await getImageByHash(fileHash)
    if (existingImage) {
      // 图片已存在，返回现有的imageId
      console.log('图片已存在于图片池:', existingImage.filename)
      return {
        imageId: existingImage.id,
        filename: existingImage.filename,
        isNewFile: false
      }
    }

    // 3. 图片不存在，需要导入
    // 获取下一个自增ID（用于生成唯一文件名）
    let countResult = await window.electronAPI.querySQL(
      imagePoolDbPath,
      'SELECT MAX(id) as maxId FROM images'
    )
    
    // 如果查询失败（可能是数据库连接被关闭了），重新初始化
    if (!countResult.success) {
      console.log('图片池数据库连接失效，正在重新初始化...')
      await initImagePool()
      
      // 重新查询
      countResult = await window.electronAPI.querySQL(
        imagePoolDbPath,
        'SELECT MAX(id) as maxId FROM images'
      )
      
      if (!countResult.success || !countResult.data) {
        throw new Error('查询图片池失败: ' + (countResult.error || '未知错误'))
      }
    }
    
    const nextId = (countResult.data[0]?.maxId || 0) + 1

    // 4. 生成唯一文件名：projectName_id.ext
    const ext = filePath.substring(filePath.lastIndexOf('.'))
    const filename = `${projectName}_${nextId}${ext}`

    // 5. 获取目标路径（使用自定义工作空间路径）
    const workspacePath = await getImagePoolWorkspacePath()
    const destPathResult = await window.electronAPI.getImagePoolPath(filename, workspacePath)
    if (!destPathResult.success) {
      throw new Error('获取图片池路径失败')
    }
    const destPath = destPathResult.path

    // 6. 复制文件到图片池
    const copyResult = await window.electronAPI.copyToImagePool(filePath, destPath)
    if (!copyResult.success) {
      throw new Error('复制文件失败: ' + copyResult.error)
    }

    // 7. 插入到数据库
    let insertResult = await window.electronAPI.runSQL(
      imagePoolDbPath,
      'INSERT INTO images (hash, filename, created_at) VALUES (?, ?, ?)',
      [fileHash, filename, new Date().toISOString()]
    )

    // 如果插入失败（可能是数据库连接被关闭了），重新初始化并重试
    if (!insertResult.success) {
      console.log('图片池数据库连接失效，正在重新初始化...')
      await initImagePool()
      
      // 重新插入
      insertResult = await window.electronAPI.runSQL(
        imagePoolDbPath,
        'INSERT INTO images (hash, filename, created_at) VALUES (?, ?, ?)',
        [fileHash, filename, new Date().toISOString()]
      )
      
      if (!insertResult.success) {
        throw new Error('插入数据库失败: ' + insertResult.error)
      }
    }

    const imageId = insertResult.result.lastInsertRowid

    console.log('图片导入成功:', { imageId, filename })

    return {
      imageId,
      filename,
      isNewFile: true
    }
  } catch (error) {
    console.error('导入图片失败:', error)
    throw error
  }
}

/**
 * 根据ID获取图片路径
 * @param {number} imageId - 图片ID
 * @returns {Promise<string>} 图片完整路径
 */
export async function getImagePath(imageId) {
  if (!imagePoolDbPath) {
    console.log('imagePoolDbPath 未初始化，正在初始化图片池...')
    await initImagePool()
  }

  try {
    // 从数据库查询文件名
    const result = await window.electronAPI.querySQL(
      imagePoolDbPath,
      'SELECT filename FROM images WHERE id = ?',
      [imageId]
    )

    // 如果查询失败（可能是数据库连接被关闭了），重新初始化
    if (!result.success) {
      console.log('图片池数据库连接失效，正在重新初始化...')
      await initImagePool()
      
      // 重新查询
      const retryResult = await window.electronAPI.querySQL(
        imagePoolDbPath,
        'SELECT filename FROM images WHERE id = ?',
        [imageId]
      )
      
      if (!retryResult.success || !retryResult.data || retryResult.data.length === 0) {
        throw new Error('图片不存在: ID=' + imageId)
      }
      
      const filename = retryResult.data[0].filename
      const workspacePath = await getImagePoolWorkspacePath()
      const pathResult = await window.electronAPI.getImagePoolPath(filename, workspacePath)
      if (!pathResult.success) {
        throw new Error('获取图片路径失败')
      }
      return pathResult.path
    }

    if (!result.data || result.data.length === 0) {
      throw new Error('图片不存在: ID=' + imageId)
    }

    const filename = result.data[0].filename

    // 获取工作空间路径（支持自定义）
    const workspacePath = await getImagePoolWorkspacePath()

    // 获取完整路径
    const pathResult = await window.electronAPI.getImagePoolPath(filename, workspacePath)
    if (!pathResult.success) {
      throw new Error('获取图片路径失败')
    }

    return pathResult.path
  } catch (error) {
    console.error('获取图片路径失败:', error)
    throw error
  }
}

/**
 * 根据hash查询图片是否已存在
 * @param {string} hash - 文件hash
 * @returns {Promise<{id: number, filename: string} | null>}
 */
export async function getImageByHash(hash) {
  if (!imagePoolDbPath) {
    await initImagePool()
  }

  try {
    const result = await window.electronAPI.querySQL(
      imagePoolDbPath,
      'SELECT id, filename FROM images WHERE hash = ?',
      [hash]
    )
    
    // 如果查询失败（可能是数据库连接被关闭了），重新初始化
    if (!result.success) {
      console.log('图片池数据库连接失效，正在重新初始化...')
      await initImagePool()
      
      // 重新查询
      const retryResult = await window.electronAPI.querySQL(
        imagePoolDbPath,
        'SELECT id, filename FROM images WHERE hash = ?',
        [hash]
      )
      
      if (!retryResult.success || !retryResult.data || retryResult.data.length === 0) {
        return null
      }
      
      return {
        id: retryResult.data[0].id,
        filename: retryResult.data[0].filename
      }
    }

    // 正常情况下的返回
    if (result.data && result.data.length > 0) {
      return {
        id: result.data[0].id,
        filename: result.data[0].filename
      }
    }

    return null
  } catch (error) {
    console.error('查询图片hash失败:', error)
    throw error
  }
}

/**
 * 批量导入图片
 * @param {string} projectName - 项目名称
 * @param {string[]} filePaths - 文件路径数组
 * @returns {Promise<Array<{imageId: number, filename: string, originalPath: string}>>}
 */
export async function importImages(projectName, filePaths) {
  const results = []
  const errors = []

  for (const filePath of filePaths) {
    try {
      const result = await importImage(projectName, filePath)
      results.push({
        imageId: result.imageId,
        filename: result.filename,
        isNewFile: result.isNewFile,
        originalPath: filePath
      })
    } catch (error) {
      errors.push({
        filePath,
        error: error.message
      })
    }
  }

  return {
    success: true,
    results,
    errors
  }
}

/**
 * 查找孤立图片（仅被指定项目引用的图片）
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Array<number>>} 孤立图片的ID列表
 */
export async function findOrphanedImages(projectPath) {
  if (!imagePoolDbPath) {
    await initImagePool()
  }

  try {
    // 1. 获取目标项目的所有 image_id
    const projectDbPath = `${projectPath}/annotations.db`
    await window.electronAPI.openDatabase(projectDbPath)
    
    const projectImagesResult = await window.electronAPI.querySQL(
      projectDbPath,
      'SELECT DISTINCT image_id FROM project_images'
    )
    
    if (!projectImagesResult.success || !projectImagesResult.data) {
      console.log('目标项目没有图片')
      return []
    }
    
    const targetImageIds = projectImagesResult.data.map(row => row.image_id)
    console.log(`目标项目有 ${targetImageIds.length} 张图片`)
    
    if (targetImageIds.length === 0) {
      return []
    }
    
    // 2. 获取所有其他项目和数据集引用的 image_id
    const referencedImageIds = new Set()
    
    // 扫描所有项目
    const projectsResult = await window.electronAPI.findAllProjects()
    if (projectsResult.success && projectsResult.projects) {
      for (const otherProjectPath of projectsResult.projects) {
        if (otherProjectPath === projectPath) {
          continue // 跳过目标项目本身
        }
        
        try {
          const otherDbPath = `${otherProjectPath}/annotations.db`
          await window.electronAPI.openDatabase(otherDbPath)
          
          const otherImagesResult = await window.electronAPI.querySQL(
            otherDbPath,
            'SELECT DISTINCT image_id FROM project_images'
          )
          
          if (otherImagesResult.success && otherImagesResult.data) {
            otherImagesResult.data.forEach(row => {
              referencedImageIds.add(row.image_id)
            })
          }
        } catch (error) {
          console.warn(`扫描项目失败 ${otherProjectPath}:`, error)
        }
      }
    }
    
    // 扫描所有数据集
    const datasetsResult = await window.electronAPI.findAllDatasets()
    if (datasetsResult.success && datasetsResult.datasets) {
      for (const datasetPath of datasetsResult.datasets) {
        try {
          const datasetDbPath = `${datasetPath}/annotations.db`
          await window.electronAPI.openDatabase(datasetDbPath)
          
          const datasetImagesResult = await window.electronAPI.querySQL(
            datasetDbPath,
            'SELECT DISTINCT image_id FROM dataset_images'
          )
          
          if (datasetImagesResult.success && datasetImagesResult.data) {
            datasetImagesResult.data.forEach(row => {
              referencedImageIds.add(row.image_id)
            })
          }
        } catch (error) {
          console.warn(`扫描数据集失败 ${datasetPath}:`, error)
        }
      }
    }
    
    console.log(`其他项目和数据集共引用 ${referencedImageIds.size} 张图片`)
    
    // 3. 找出孤立图片
    const orphanedImageIds = targetImageIds.filter(id => !referencedImageIds.has(id))
    
    console.log(`找到 ${orphanedImageIds.length} 张孤立图片`)
    return orphanedImageIds
  } catch (error) {
    console.error('查找孤立图片失败:', error)
    throw error
  }
}

/**
 * 删除孤立图片
 * @param {Array<number>} imageIds - 要删除的图片ID列表
 * @returns {Promise<{success: boolean, deletedCount: number, errors: Array}>}
 */
export async function deleteOrphanedImages(imageIds) {
  if (!imagePoolDbPath) {
    await initImagePool()
  }

  const deletedFiles = []
  const errors = []

  try {
    for (const imageId of imageIds) {
      try {
        // 1. 获取图片文件名
        const result = await window.electronAPI.querySQL(
          imagePoolDbPath,
          'SELECT filename FROM images WHERE id = ?',
          [imageId]
        )
        
        if (!result.success || !result.data || result.data.length === 0) {
          console.warn(`图片 ${imageId} 不存在于图片池`)
          continue
        }
        
        const filename = result.data[0].filename
        
        // 2. 获取图片完整路径
        const workspacePath = await getImagePoolWorkspacePath()
        const pathResult = await window.electronAPI.getImagePoolPath(filename, workspacePath)
        
        if (!pathResult.success) {
          throw new Error('获取图片路径失败')
        }
        
        const imagePath = pathResult.path
        
        // 3. 删除物理文件
        const deleteFileResult = await window.electronAPI.deleteFile(imagePath)
        if (!deleteFileResult.success) {
          console.warn(`删除图片文件失败 ${filename}:`, deleteFileResult.error)
        }
        
        // 4. 从数据库删除记录
        const deleteDbResult = await window.electronAPI.runSQL(
          imagePoolDbPath,
          'DELETE FROM images WHERE id = ?',
          [imageId]
        )
        
        if (deleteDbResult.success) {
          deletedFiles.push(filename)
        }
      } catch (error) {
        console.error(`删除图片 ${imageId} 失败:`, error)
        errors.push({
          imageId,
          error: error.message
        })
      }
    }
    
    console.log(`成功删除 ${deletedFiles.length} 张图片，失败 ${errors.length} 张`)
    
    return {
      success: true,
      deletedCount: deletedFiles.length,
      errors
    }
  } catch (error) {
    console.error('删除孤立图片失败:', error)
    throw error
  }
}

export default {
  initImagePool,
  importImage,
  importImages,
  getImagePath,
  getImageByHash,
  findOrphanedImages,
  deleteOrphanedImages
}

