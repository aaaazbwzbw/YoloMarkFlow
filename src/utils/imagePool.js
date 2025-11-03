// 图片池管理工具
// 统一管理所有项目的图片文件，支持去重和引用计数

let imagePoolDbPath = null

/**
 * 获取图片池工作空间路径（优先使用用户配置）
 */
export async function getImagePoolWorkspacePath() {
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
    
    // 扫描所有数据集，包括所有版本
    const datasetsResult = await window.electronAPI.findAllDatasets()
    if (datasetsResult.success && datasetsResult.datasets) {
      for (const datasetPath of datasetsResult.datasets) {
        try {
          // 检查当前版本的数据库
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
          
          // 检查所有版本的备份数据库（annotations_v1.db, annotations_v2.db, ...）
          try {
            const listResult = await window.electronAPI.listDirectory(datasetPath)
            if (listResult.success && listResult.entries) {
              const versionDbFiles = listResult.entries
                .filter(entry => !entry.isDirectory && /^annotations_v\d+\.db$/.test(entry.name))
                .map(entry => entry.name)
              
              for (const versionDbFile of versionDbFiles) {
                const versionDbPath = `${datasetPath}/${versionDbFile}`
                try {
                  await window.electronAPI.openDatabase(versionDbPath)
                  
                  const versionImagesResult = await window.electronAPI.querySQL(
                    versionDbPath,
                    'SELECT DISTINCT image_id FROM dataset_images'
                  )
                  
                  if (versionImagesResult.success && versionImagesResult.data) {
                    versionImagesResult.data.forEach(row => {
                      referencedImageIds.add(row.image_id)
                    })
                  }
                } catch (err) {
                  console.warn(`扫描数据集版本数据库失败 ${versionDbPath}:`, err)
                }
              }
            }
          } catch (error) {
            console.warn(`列出数据集文件失败 ${datasetPath}:`, error)
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
 * @param {Function} onProgress - 进度回调函数 (current, total, message)
 * @returns {Promise<{success: boolean, deletedCount: number, errors: Array}>}
 */
export async function deleteOrphanedImages(imageIds, onProgress) {
  // 确保图片池已初始化（如果未初始化或数据库连接已关闭，重新初始化）
  if (!imagePoolDbPath) {
    await initImagePool()
  } else {
    // 检查数据库是否仍然可用，如果不可用则重新初始化
    try {
      const testResult = await window.electronAPI.querySQL(
        imagePoolDbPath,
        'SELECT 1 as test'
      )
      if (!testResult.success) {
        console.log('图片池数据库连接失效，重新初始化...')
        await initImagePool()
      }
    } catch (error) {
      console.log('图片池数据库连接检查失败，重新初始化...', error)
      await initImagePool()
    }
  }

  const deletedFiles = []
  const errors = []

  try {
    const total = imageIds.length
    
    for (let i = 0; i < imageIds.length; i++) {
      const imageId = imageIds[i]
      
      try {
        // 进度回调
        onProgress?.(i + 1, total, `正在删除图片 ${i + 1}/${total}...`)
        
        // 1. 获取图片文件名
        const result = await window.electronAPI.querySQL(
          imagePoolDbPath,
          'SELECT id, filename, hash, created_at FROM images WHERE id = ?',
          [imageId]
        )
        
        if (!result.success) {
          console.error(`查询图片 ${imageId} 失败:`, result.error)
          errors.push({
            imageId,
            error: `数据库查询失败: ${result.error}`
          })
          continue
        }
        
        if (!result.data || result.data.length === 0) {
          console.warn(`图片 ${imageId} 不存在于图片池数据库`)
          
          // 尝试通过文件名查找：如果文件名格式是 data_491.jpg，尝试查找
          // 注意：这可能不可靠，因为文件名格式可能不同
          const possibleFilename = `data_${imageId}.jpg`
          console.log(`尝试查找可能的文件名: ${possibleFilename}`)
          
          const filenameResult = await window.electronAPI.querySQL(
            imagePoolDbPath,
            'SELECT id, filename FROM images WHERE filename = ?',
            [possibleFilename]
          )
          
          if (filenameResult.success && filenameResult.data && filenameResult.data.length > 0) {
            console.log(`找到文件名匹配的记录: ID=${filenameResult.data[0].id}, filename=${filenameResult.data[0].filename}`)
            // ID 不匹配，可能数据库中的 ID 和实际文件名中的 ID 不一致
            // 这种情况我们仍然跳过，因为无法确定正确的映射关系
          }
          
          // 检查图片文件是否实际存在（即使数据库中没有记录）
          const workspacePath = await getImagePoolWorkspacePath()
          const possiblePath = `${workspacePath}/image_pool/${possibleFilename}`
          console.log(`检查文件是否存在: ${possiblePath}`)
          
          const fileExistsResult = await window.electronAPI.fileExists(possiblePath)
          if (fileExistsResult && fileExistsResult.exists) {
            console.warn(`文件 ${possibleFilename} 存在但数据库中没有记录，可能存在数据不一致。尝试删除文件...`)
            // 尝试直接删除文件
            try {
              const deleteFileResult = await window.electronAPI.deleteFile(possiblePath)
              if (deleteFileResult && deleteFileResult.success) {
                console.log(`成功删除孤立文件: ${possibleFilename}`)
                deletedFiles.push(possibleFilename)
                continue
              }
            } catch (error) {
              console.error(`删除文件失败: ${error.message}`)
            }
          }
          
          // 跳过这个图片，因为数据库中没有记录
          continue
        }
        
        const filename = result.data[0].filename
        console.log(`图片 ${imageId} 对应的文件名: ${filename}`)
        
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
          errors.push({
            imageId,
            filename,
            error: deleteFileResult.error || '删除文件失败'
          })
          continue
        }
        
        // 4. 从数据库删除记录
        const deleteDbResult = await window.electronAPI.runSQL(
          imagePoolDbPath,
          'DELETE FROM images WHERE id = ?',
          [imageId]
        )
        
        if (deleteDbResult.success) {
          deletedFiles.push(filename)
          console.log(`已删除图片: ${filename}`)
        } else {
          errors.push({
            imageId,
            filename,
            error: '删除数据库记录失败'
          })
        }
      } catch (error) {
        console.error(`删除图片 ${imageId} 失败:`, error)
        errors.push({
          imageId,
          error: error.message
        })
      }
    }
    
    onProgress?.(total, total, '删除完成')
    
    // 计算跳过的数量（图片不存在于图片池）
    const skippedCount = total - deletedFiles.length - errors.length
    const statusMsg = []
    if (deletedFiles.length > 0) {
      statusMsg.push(`成功 ${deletedFiles.length} 张`)
    }
    if (skippedCount > 0) {
      statusMsg.push(`跳过 ${skippedCount} 张（不存在于图片池）`)
    }
    if (errors.length > 0) {
      statusMsg.push(`失败 ${errors.length} 张`)
    }
    
    if (statusMsg.length > 0) {
      console.log(`删除完成: ${statusMsg.join('，')}`)
    } else {
      console.log('删除完成: 没有需要删除的图片')
    }
    
    return {
      success: true,
      deletedCount: deletedFiles.length,
      skippedCount, // 添加跳过的数量
      errors
    }
  } catch (error) {
    console.error('删除孤立图片失败:', error)
    // 不抛出异常，而是返回错误结果，这样删除项目操作可以继续
    return {
      success: false,
      deletedCount: 0,
      skippedCount: 0,
      errors: [{ error: error.message }]
    }
  }
}

/**
 * 查找数据集中的孤立图片（仅被指定数据集引用的图片）
 * @param {string} datasetPath - 数据集路径
 * @returns {Promise<Array<number>>} 孤立图片的ID列表
 */
export async function findOrphanedImagesInDataset(datasetPath) {
  if (!imagePoolDbPath) {
    await initImagePool()
  }

  try {
    // 1. 获取目标数据集的所有 image_id（包括所有版本）
    const targetImageIds = new Set()
    
    // 检查当前版本的数据库
    const datasetDbPath = `${datasetPath}/annotations.db`
    try {
      await window.electronAPI.openDatabase(datasetDbPath)
      
      const datasetImagesResult = await window.electronAPI.querySQL(
        datasetDbPath,
        'SELECT DISTINCT image_id FROM dataset_images'
      )
      
      if (datasetImagesResult.success && datasetImagesResult.data) {
        datasetImagesResult.data.forEach(row => {
          targetImageIds.add(row.image_id)
        })
      }
    } catch (error) {
      console.warn(`扫描数据集当前版本失败 ${datasetDbPath}:`, error)
    }
    
    // 检查所有版本的备份数据库（annotations_v1.db, annotations_v2.db, ...）
    try {
      const listResult = await window.electronAPI.listDirectory(datasetPath)
      if (listResult.success && listResult.entries) {
        const versionDbFiles = listResult.entries
          .filter(entry => !entry.isDirectory && /^annotations_v\d+\.db$/.test(entry.name))
          .map(entry => entry.name)
        
        for (const versionDbFile of versionDbFiles) {
          const versionDbPath = `${datasetPath}/${versionDbFile}`
          try {
            await window.electronAPI.openDatabase(versionDbPath)
            
            const versionImagesResult = await window.electronAPI.querySQL(
              versionDbPath,
              'SELECT DISTINCT image_id FROM dataset_images'
            )
            
            if (versionImagesResult.success && versionImagesResult.data) {
              versionImagesResult.data.forEach(row => {
                targetImageIds.add(row.image_id)
              })
            }
          } catch (err) {
            console.warn(`扫描数据集版本数据库失败 ${versionDbPath}:`, err)
          }
        }
      }
    } catch (error) {
      console.warn(`列出数据集文件失败 ${datasetPath}:`, error)
    }
    
    if (targetImageIds.size === 0) {
      console.log('目标数据集没有图片')
      return []
    }
    
    const targetImageIdsArray = Array.from(targetImageIds)
    console.log(`目标数据集（所有版本）有 ${targetImageIdsArray.length} 张图片`)
    
    // 2. 获取所有其他项目和数据集引用的 image_id
    const referencedImageIds = new Set()
    
    // 扫描所有项目
    const projectsResult = await window.electronAPI.findAllProjects()
    if (projectsResult.success && projectsResult.projects) {
      console.log(`[findOrphanedImagesInDataset] 开始扫描 ${projectsResult.projects.length} 个项目`)
      for (const projectPath of projectsResult.projects) {
        try {
          const projectDbPath = `${projectPath}/annotations.db`
          await window.electronAPI.openDatabase(projectDbPath)
          
          const projectImagesResult = await window.electronAPI.querySQL(
            projectDbPath,
            'SELECT DISTINCT image_id FROM project_images'
          )
          
          if (projectImagesResult.success && projectImagesResult.data) {
            const projectImageCount = projectImagesResult.data.length
            projectImagesResult.data.forEach(row => {
              referencedImageIds.add(row.image_id)
            })
            console.log(`[findOrphanedImagesInDataset] 项目 ${projectPath} 引用了 ${projectImageCount} 张图片`)
          } else {
            console.warn(`[findOrphanedImagesInDataset] 查询项目 ${projectPath} 的图片失败:`, projectImagesResult.error)
          }
        } catch (error) {
          console.error(`[findOrphanedImagesInDataset] 扫描项目失败 ${projectPath}:`, error)
          // 继续扫描其他项目，不中断流程
        }
      }
      console.log(`[findOrphanedImagesInDataset] 项目扫描完成，共发现 ${referencedImageIds.size} 张被引用的图片`)
    } else {
      console.warn(`[findOrphanedImagesInDataset] 获取项目列表失败:`, projectsResult.error)
    }
    
    // 扫描所有数据集（排除当前数据集），包括所有版本
    const datasetsResult = await window.electronAPI.findAllDatasets()
    if (datasetsResult.success && datasetsResult.datasets) {
      for (const otherDatasetPath of datasetsResult.datasets) {
        if (otherDatasetPath === datasetPath) {
          continue // 跳过当前数据集本身
        }
        
        try {
          // 检查当前版本的数据库
          const otherDatasetDbPath = `${otherDatasetPath}/annotations.db`
          await window.electronAPI.openDatabase(otherDatasetDbPath)
          
          const otherDatasetImagesResult = await window.electronAPI.querySQL(
            otherDatasetDbPath,
            'SELECT DISTINCT image_id FROM dataset_images'
          )
          
          if (otherDatasetImagesResult.success && otherDatasetImagesResult.data) {
            otherDatasetImagesResult.data.forEach(row => {
              referencedImageIds.add(row.image_id)
            })
          }
          
          // 检查所有版本的备份数据库（annotations_v1.db, annotations_v2.db, ...）
          try {
            const listResult = await window.electronAPI.listDirectory(otherDatasetPath)
            if (listResult.success && listResult.entries) {
              const versionDbFiles = listResult.entries
                .filter(entry => !entry.isDirectory && /^annotations_v\d+\.db$/.test(entry.name))
                .map(entry => entry.name)
              
              for (const versionDbFile of versionDbFiles) {
                const versionDbPath = `${otherDatasetPath}/${versionDbFile}`
                try {
                  await window.electronAPI.openDatabase(versionDbPath)
                  
                  const versionImagesResult = await window.electronAPI.querySQL(
                    versionDbPath,
                    'SELECT DISTINCT image_id FROM dataset_images'
                  )
                  
                  if (versionImagesResult.success && versionImagesResult.data) {
                    versionImagesResult.data.forEach(row => {
                      referencedImageIds.add(row.image_id)
                    })
                  }
                } catch (err) {
                  console.warn(`扫描数据集版本数据库失败 ${versionDbPath}:`, err)
                }
              }
            }
          } catch (error) {
            console.warn(`列出数据集文件失败 ${otherDatasetPath}:`, error)
          }
        } catch (error) {
          console.warn(`扫描数据集失败 ${otherDatasetPath}:`, error)
        }
      }
    }
    
    console.log(`[findOrphanedImagesInDataset] 其他项目和数据集共引用 ${referencedImageIds.size} 张图片`)
    
    // 3. 找出孤立图片（仅在目标数据集中，且未被其他项目或数据集引用）
    const orphanedImageIds = targetImageIdsArray.filter(id => {
      const isReferenced = referencedImageIds.has(id)
      if (!isReferenced) {
        console.log(`[findOrphanedImagesInDataset] 图片 ${id} 未被其他项目或数据集引用，将被删除`)
      }
      return !isReferenced
    })
    
    console.log(`[findOrphanedImagesInDataset] 目标数据集有 ${targetImageIdsArray.length} 张图片，其中 ${orphanedImageIds.length} 张是孤立的，${targetImageIdsArray.length - orphanedImageIds.length} 张被其他项目或数据集引用`)
    return orphanedImageIds
  } catch (error) {
    console.error('查找孤立图片失败:', error)
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
  findOrphanedImagesInDataset,
  deleteOrphanedImages
}

