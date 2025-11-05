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
 * 导入图片到图片池（仅复制文件，不写入数据库）
 * @param {string} projectName - 项目名称
 * @param {string} filePath - 源文件路径
 * @returns {Promise<{hash: string, filename: string, destPath: string, isNewFile: boolean, existingImageId?: number}>}
 */
export async function prepareImageImport(projectName, filePath) {
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
        hash: fileHash,
        filename: existingImage.filename,
        destPath: null,
        isNewFile: false,
        existingImageId: existingImage.id
      }
    }

    // 3. 图片不存在，需要导入
    // 生成临时文件名（使用hash的前8位 + 时间戳，避免冲突）
    const ext = filePath.substring(filePath.lastIndexOf('.'))
    const timestamp = Date.now()
    const tempFilename = `${projectName}_${fileHash.substring(0, 8)}_${timestamp}${ext}`

    // 4. 获取目标路径（使用自定义工作空间路径）
    const workspacePath = await getImagePoolWorkspacePath()
    const destPathResult = await window.electronAPI.getImagePoolPath(tempFilename, workspacePath)
    if (!destPathResult.success) {
      throw new Error('获取图片池路径失败')
    }
    const destPath = destPathResult.path

    // 5. 复制文件到图片池
    const copyResult = await window.electronAPI.copyToImagePool(filePath, destPath)
    if (!copyResult.success) {
      throw new Error('复制文件失败: ' + copyResult.error)
    }

    return {
      hash: fileHash,
      filename: tempFilename, // 临时文件名，后续批量写入时会更新
      destPath,
      isNewFile: true
    }
  } catch (error) {
    console.error('准备图片导入失败:', error)
    throw error
  }
}

/**
 * 批量写入图片到数据库
 * @param {Array<{hash: string, filename: string, destPath: string, projectName: string}>} imageData - 图片数据数组
 * @returns {Promise<Array<{imageId: number, filename: string, hash: string}>>}
 */
export async function batchInsertImages(imageData) {
  if (!imagePoolDbPath) {
    await initImagePool()
  }

  if (!imageData || imageData.length === 0) {
    console.log('[batchInsertImages] 没有图片数据需要插入')
    return []
  }

  // 确保数据库连接是打开的
  try {
    const testResult = await window.electronAPI.querySQL(
      imagePoolDbPath,
      'SELECT 1 as test'
    )
    if (!testResult.success) {
      console.log('[batchInsertImages] 数据库连接失效，重新初始化...')
      await initImagePool()
    }
  } catch (error) {
    console.log('[batchInsertImages] 数据库连接检查失败，重新初始化...', error)
    await initImagePool()
  }

  console.log(`[batchInsertImages] 开始批量插入 ${imageData.length} 张图片到数据库`)

  try {
    // 获取当前最大ID
    let countResult = await window.electronAPI.querySQL(
      imagePoolDbPath,
      'SELECT MAX(id) as maxId FROM images'
    )
    
    if (!countResult.success || !countResult.data) {
      // 如果查询失败，可能是数据库连接被关闭了，重新初始化
      console.log('[batchInsertImages] 查询最大ID失败，重新初始化数据库...')
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
    
    let nextId = (countResult.data[0]?.maxId || 0) + 1
    console.log(`[batchInsertImages] 当前最大ID: ${nextId - 1}, 下一个ID: ${nextId}`)

    // 批量生成文件名和准备插入数据
    const insertData = []
    const now = new Date().toISOString()
    
    for (let i = 0; i < imageData.length; i++) {
      const data = imageData[i]
      const ext = data.filename.substring(data.filename.lastIndexOf('.'))
      const finalFilename = `${data.projectName}_${nextId + i}${ext}`
      
      // 如果文件名已改变，需要重命名文件
      if (finalFilename !== data.filename && data.destPath) {
    const workspacePath = await getImagePoolWorkspacePath()
        const newPathResult = await window.electronAPI.getImagePoolPath(finalFilename, workspacePath)
        if (newPathResult.success) {
          // 重命名文件
          const moveResult = await window.electronAPI.moveFile(data.destPath, newPathResult.path)
          if (moveResult && moveResult.success) {
            data.destPath = newPathResult.path
          } else {
            console.warn(`重命名文件失败: ${data.filename} -> ${finalFilename}`)
          }
        }
      }
      
      insertData.push({
        hash: data.hash,
        filename: finalFilename,
        created_at: now
      })
    }

    console.log(`[batchInsertImages] 准备插入 ${insertData.length} 条记录到数据库`)

    // 批量插入数据库（使用事务）
    const beginResult = await window.electronAPI.execSQL(imagePoolDbPath, 'BEGIN TRANSACTION')
    if (!beginResult.success) {
      throw new Error('开启事务失败: ' + beginResult.error)
    }
    
    try {
      const results = []
      for (let i = 0; i < insertData.length; i++) {
        const data = insertData[i]
        
        // 在插入前再次检查 hash 是否已存在（处理并发情况）
        const checkResult = await window.electronAPI.querySQL(
      imagePoolDbPath,
          'SELECT id, filename FROM images WHERE hash = ?',
          [data.hash]
        )
        
        if (checkResult.success && checkResult.data && checkResult.data.length > 0) {
          // hash 已存在，使用已存在的记录
          const existing = checkResult.data[0]
          console.log(`[batchInsertImages] 图片 hash ${data.hash} 已存在，跳过插入，使用已有记录 id=${existing.id}`)
          results.push({
            imageId: existing.id,
            filename: existing.filename,
            hash: data.hash,
            isExisting: true
          })
          continue
        }
        
        // hash 不存在，执行插入
        const insertResult = await window.electronAPI.runSQL(
        imagePoolDbPath,
        'INSERT INTO images (hash, filename, created_at) VALUES (?, ?, ?)',
          [data.hash, data.filename, data.created_at]
      )
      
      if (!insertResult.success) {
          // 如果是唯一约束冲突，再次查询已存在的记录
          if (insertResult.error && insertResult.error.includes('UNIQUE constraint')) {
            console.log(`[batchInsertImages] 插入时发生唯一约束冲突，查询已存在的记录: hash=${data.hash}`)
            const retryCheckResult = await window.electronAPI.querySQL(
              imagePoolDbPath,
              'SELECT id, filename FROM images WHERE hash = ?',
              [data.hash]
            )
            
            if (retryCheckResult.success && retryCheckResult.data && retryCheckResult.data.length > 0) {
              const existing = retryCheckResult.data[0]
              console.log(`[batchInsertImages] 找到已存在的记录 id=${existing.id}，使用已有记录`)
              results.push({
                imageId: existing.id,
                filename: existing.filename,
                hash: data.hash,
                isExisting: true
              })
              continue
            }
          }
          
          throw new Error(`插入数据库失败 (${i+1}/${insertData.length}): ${insertResult.error}`)
        }
        
        results.push({
          imageId: insertResult.result.lastInsertRowid,
          filename: data.filename,
          hash: data.hash,
          isExisting: false
        })
        
        if ((i + 1) % 10 === 0) {
          console.log(`[batchInsertImages] 已插入 ${i + 1}/${insertData.length} 张图片`)
        }
      }
      
      const commitResult = await window.electronAPI.execSQL(imagePoolDbPath, 'COMMIT')
      if (!commitResult.success) {
        throw new Error('提交事务失败: ' + commitResult.error)
      }
      
      console.log(`[batchInsertImages] 批量插入完成: ${results.length} 张图片到数据库`)
      return results
  } catch (error) {
      console.error('[batchInsertImages] 插入失败，回滚事务:', error)
      const rollbackResult = await window.electronAPI.execSQL(imagePoolDbPath, 'ROLLBACK')
      if (!rollbackResult.success) {
        console.error('[batchInsertImages] 回滚失败:', rollbackResult.error)
      }
    throw error
    }
  } catch (error) {
    console.error('批量插入图片失败:', error)
    throw error
  }
}

/**
 * 导入图片到图片池（兼容旧接口，内部使用新的批量逻辑）
 * @param {string} projectName - 项目名称
 * @param {string} filePath - 源文件路径
 * @returns {Promise<{imageId: number, filename: string, isNewFile: boolean}>}
 */
export async function importImage(projectName, filePath) {
  const prepared = await prepareImageImport(projectName, filePath)
  
  if (!prepared.isNewFile) {
    return {
      imageId: prepared.existingImageId,
      filename: prepared.filename,
      isNewFile: false
    }
  }
  
  const [result] = await batchInsertImages([{
    hash: prepared.hash,
    filename: prepared.filename,
    destPath: prepared.destPath,
    projectName
  }])
  
  return {
    imageId: result.imageId,
    filename: result.filename,
    isNewFile: true
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
    
    // 扫描所有项目（使用项目注册表，确保准确）
    const projectsResult = await window.electronAPI.project.getAllRegistered()
    if (projectsResult.success && projectsResult.paths && projectsResult.paths.length > 0) {
      for (const otherProjectPath of projectsResult.paths) {
        if (otherProjectPath === projectPath) {
          continue // 跳过目标项目本身
        }
        
        try {
          const otherDbPath = `${otherProjectPath}/annotations.db`
          
          // 检查数据库文件是否存在
          const dbExistsResult = await window.electronAPI.fileExists(otherDbPath)
          if (!dbExistsResult || !dbExistsResult.exists) {
            console.warn(`[findOrphanedImages] 项目数据库不存在: ${otherDbPath}，跳过`)
            continue
          }
          
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
          console.warn(`[findOrphanedImages] 扫描项目失败 ${otherProjectPath}:`, error)
        }
      }
    }
    
    // 扫描所有数据集，包括所有版本
    const datasetsResult = await window.electronAPI.findAllDatasets()
    console.log(`[findOrphanedImages] findAllDatasets 结果:`, {
      success: datasetsResult.success,
      datasetsCount: datasetsResult.datasets?.length || 0,
      datasets: datasetsResult.datasets,
      error: datasetsResult.error
    })
    
    if (datasetsResult.success && datasetsResult.datasets && datasetsResult.datasets.length > 0) {
      console.log(`[findOrphanedImages] 开始扫描 ${datasetsResult.datasets.length} 个数据集`)
      for (const datasetPath of datasetsResult.datasets) {
        try {
          // 检查当前版本的数据库（使用路径规范化，确保使用正确的分隔符）
          const datasetDbPath = datasetPath.replace(/\\/g, '/') + '/annotations.db'
          
          console.log(`[findOrphanedImages] 检查数据集: ${datasetPath}, 数据库路径: ${datasetDbPath}`)
          
          // 检查数据库文件是否存在
          const dbExistsResult = await window.electronAPI.fileExists(datasetDbPath)
          console.log(`[findOrphanedImages] 数据集数据库存在性检查: ${datasetDbPath}, 存在: ${dbExistsResult?.exists}`)
          
          if (!dbExistsResult || !dbExistsResult.exists) {
            console.warn(`[findOrphanedImages] 数据集数据库不存在: ${datasetDbPath}，跳过`)
            continue
          }
          
          await window.electronAPI.openDatabase(datasetDbPath)
          
          const datasetImagesResult = await window.electronAPI.querySQL(
            datasetDbPath,
            'SELECT DISTINCT image_id FROM dataset_images'
          )
          
          console.log(`[findOrphanedImages] 查询数据集 ${datasetPath} 结果:`, {
            success: datasetImagesResult.success,
            imageCount: datasetImagesResult.data?.length || 0,
            error: datasetImagesResult.error
          })
          
          if (datasetImagesResult.success && datasetImagesResult.data) {
            const datasetImageCount = datasetImagesResult.data.length
            datasetImagesResult.data.forEach(row => {
              referencedImageIds.add(row.image_id)
            })
            console.log(`[findOrphanedImages] 数据集 ${datasetPath} 引用了 ${datasetImageCount} 张图片`)
          } else {
            console.warn(`[findOrphanedImages] 查询数据集 ${datasetPath} 的图片失败:`, datasetImagesResult.error)
          }
          
          // 检查所有版本的备份数据库（annotations_v1.db, annotations_v2.db, ...）
          try {
            const listResult = await window.electronAPI.listDirectory(datasetPath)
            if (listResult.success && listResult.entries) {
              const versionDbFiles = listResult.entries
                .filter(entry => !entry.isDirectory && /^annotations_v\d+\.db$/.test(entry.name))
                .map(entry => entry.name)
              
              for (const versionDbFile of versionDbFiles) {
                // 使用路径规范化，确保使用正确的分隔符
                const versionDbPath = datasetPath.replace(/\\/g, '/') + '/' + versionDbFile
                
                // 检查版本数据库文件是否存在
                const versionDbExistsResult = await window.electronAPI.fileExists(versionDbPath)
                if (!versionDbExistsResult || !versionDbExistsResult.exists) {
                  continue
                }
                
                try {
                  await window.electronAPI.openDatabase(versionDbPath)
                  
                  const versionImagesResult = await window.electronAPI.querySQL(
                    versionDbPath,
                    'SELECT DISTINCT image_id FROM dataset_images'
                  )
                  
                  if (versionImagesResult.success && versionImagesResult.data) {
                    const versionImageCount = versionImagesResult.data.length
                    versionImagesResult.data.forEach(row => {
                      referencedImageIds.add(row.image_id)
                    })
                    console.log(`[findOrphanedImages] 数据集版本 ${versionDbFile} 引用了 ${versionImageCount} 张图片`)
                  }
                } catch (err) {
                  console.warn(`[findOrphanedImages] 扫描数据集版本数据库失败 ${versionDbPath}:`, err)
                }
              }
          }
        } catch (error) {
            console.warn(`[findOrphanedImages] 列出数据集文件失败 ${datasetPath}:`, error)
          }
        } catch (error) {
          console.error(`[findOrphanedImages] 扫描数据集失败 ${datasetPath}:`, error)
          // 继续扫描其他数据集，不中断流程
        }
      }
      console.log(`[findOrphanedImages] 数据集扫描完成，共发现 ${referencedImageIds.size} 张被引用的图片`)
    } else {
      console.warn(`[findOrphanedImages] 获取数据集列表失败:`, datasetsResult.error || '无数据集')
    }
    
    console.log(`[findOrphanedImages] 其他项目和数据集共引用 ${referencedImageIds.size} 张图片`)
    console.log(`[findOrphanedImages] 目标项目有 ${targetImageIds.length} 张图片`)
    
    // 3. 找出孤立图片（仅在目标项目中，且未被其他项目或数据集引用）
    const orphanedImageIds = targetImageIds.filter(id => {
      const isReferenced = referencedImageIds.has(id)
      if (!isReferenced) {
        console.log(`[findOrphanedImages] 图片 ${id} 未被其他项目或数据集引用，将被删除`)
      } else {
        console.log(`[findOrphanedImages] 图片 ${id} 被其他项目或数据集引用，保留`)
      }
      return !isReferenced
    })
    
    console.log(`[findOrphanedImages] 目标项目有 ${targetImageIds.length} 张图片，其中 ${orphanedImageIds.length} 张是孤立的，${targetImageIds.length - orphanedImageIds.length} 张被其他项目或数据集引用`)
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
/**
 * 并发控制工具：限制并发数量
 * @param {Number} limit - 最大并发数
 * @returns {Function} - 返回一个函数，用于包装需要并发控制的异步函数
 */
function createConcurrencyLimiter(limit = 5) {
  let running = 0
  const queue = []

  const execute = async (fn) => {
    if (running >= limit) {
      // 如果达到并发限制，等待
      await new Promise(resolve => queue.push(resolve))
    }

    running++
    try {
      return await fn()
    } finally {
      running--
      // 执行队列中的下一个任务
      if (queue.length > 0) {
        const next = queue.shift()
        next()
      }
    }
  }

  return execute
}

/**
 * 批量删除图片（并行处理）
 * @param {Array} imageTasks - 图片删除任务数组 [{ imageId, ... }]
 * @param {Function} deleteTaskFn - 单个图片删除任务函数 (task) => Promise<result>
 * @param {Number} concurrency - 并发数，默认 5
 * @param {Function} onProgress - 进度回调 (completed, total, message) => void
 * @returns {Promise<Object>} - { results, errors }
 */
async function deleteBatch(imageTasks, deleteTaskFn, concurrency = 5, onProgress) {
  const limiter = createConcurrencyLimiter(concurrency)
  const results = []
  const errors = []
  let completed = 0

  // 创建所有任务
  const tasks = imageTasks.map((task, index) => 
    limiter(async () => {
      try {
        const result = await deleteTaskFn(task)
        results.push({ success: true, index, result })
        completed++
        onProgress?.(completed, imageTasks.length, `正在删除图片 ${completed}/${imageTasks.length}...`)
        return { success: true, index, result }
      } catch (error) {
        const errorInfo = {
          imageId: task.imageId,
          filename: task.filename,
          error: error.message
        }
        errors.push(errorInfo)
        results.push({ success: false, index, error: errorInfo })
        completed++
        onProgress?.(completed, imageTasks.length, `正在删除图片 ${completed}/${imageTasks.length}...`)
        return { success: false, index, error: errorInfo }
      }
    })
  )

  // 等待所有任务完成
  await Promise.all(tasks)

  return { results, errors }
}

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
  const skippedFiles = []
  const errors = []

  try {
    const total = imageIds.length
    
    if (total === 0) {
      onProgress?.(0, 0, '没有需要删除的图片')
      return {
        success: true,
        deletedCount: 0,
        skippedCount: 0,
        errors: []
      }
    }

    // 阶段1：批量查询图片信息（并行）
    console.log(`[deleteOrphanedImages] 开始批量查询 ${total} 张图片的信息...`)
    const concurrency = 10
    const imageTasks = imageIds.map(imageId => ({ imageId }))
    
    const queryTaskFn = async (task) => {
      const { imageId } = task
      
      // 查询图片信息
        const result = await window.electronAPI.querySQL(
          imagePoolDbPath,
        'SELECT id, filename, hash, created_at FROM images WHERE id = ?',
          [imageId]
        )
        
      if (!result.success) {
        throw new Error(`数据库查询失败: ${result.error}`)
      }
      
      if (!result.data || result.data.length === 0) {
        // 图片不存在于数据库，尝试查找可能的文件
        const possibleFilename = `data_${imageId}.jpg`
        const workspacePath = await getImagePoolWorkspacePath()
        const possiblePath = `${workspacePath}/image_pool/${possibleFilename}`
        
        const fileExistsResult = await window.electronAPI.fileExists(possiblePath)
        if (fileExistsResult && fileExistsResult.exists) {
          // 文件存在但数据库中没有记录，返回特殊标记
          return {
            imageId,
            filename: possibleFilename,
            imagePath: possiblePath,
            existsInDb: false,
            existsInFileSystem: true
          }
        }
        
        // 既不存在于数据库也不存在于文件系统
        return {
          imageId,
          existsInDb: false,
          existsInFileSystem: false
        }
        }
        
        const filename = result.data[0].filename
        const workspacePath = await getImagePoolWorkspacePath()
        const pathResult = await window.electronAPI.getImagePoolPath(filename, workspacePath)
        
        if (!pathResult.success) {
          throw new Error('获取图片路径失败')
        }
        
      return {
        imageId,
        filename,
        imagePath: pathResult.path,
        existsInDb: true,
        existsInFileSystem: true
      }
    }
    
    const queryResult = await deleteBatch(
      imageTasks,
      queryTaskFn,
      concurrency,
      (completed, total) => onProgress?.(Math.round((completed / total) * 30), 100, `查询图片信息 ${completed}/${total}...`)
    )
    
    // 阶段2：批量删除文件（并行）
    console.log(`[deleteOrphanedImages] 开始批量删除文件...`)
    const deleteTasks = queryResult.results
      .filter(r => r.success && r.result && (r.result.existsInFileSystem || r.result.existsInDb))
      .map(r => r.result)
    
    if (deleteTasks.length > 0) {
      const deleteTaskFn = async (task) => {
        const { imageId, filename, imagePath, existsInDb, existsInFileSystem } = task
        
        // 删除物理文件
        if (existsInFileSystem && imagePath) {
        const deleteFileResult = await window.electronAPI.deleteFile(imagePath)
        if (!deleteFileResult.success) {
            throw new Error(`删除文件失败: ${deleteFileResult.error || '未知错误'}`)
          }
        }
        
        // 从数据库删除记录
        if (existsInDb) {
        const deleteDbResult = await window.electronAPI.runSQL(
          imagePoolDbPath,
          'DELETE FROM images WHERE id = ?',
          [imageId]
        )
        
          if (!deleteDbResult.success) {
            throw new Error('删除数据库记录失败')
          }
        }
        
        return {
          imageId,
          filename: filename || `data_${imageId}.jpg`,
          deleted: true
        }
      }
      
      const deleteResult = await deleteBatch(
        deleteTasks,
        deleteTaskFn,
        concurrency,
        (completed, total) => onProgress?.(Math.round(30 + (completed / total) * 70), 100, `删除图片 ${completed}/${total}...`)
      )
      
      // 统计结果
      for (const result of deleteResult.results) {
        if (result.success) {
          deletedFiles.push(result.result.filename)
        } else {
          errors.push(result.error)
        }
      }
    }
    
    // 统计跳过的文件（既不存在于数据库也不存在于文件系统）
    for (const result of queryResult.results) {
      if (result.success && result.result) {
        const { existsInDb, existsInFileSystem } = result.result
        if (!existsInDb && !existsInFileSystem) {
          skippedFiles.push(result.result.imageId)
        }
      }
    }
    
    // 添加查询阶段的错误
    errors.push(...queryResult.errors)
    
    onProgress?.(100, 100, '删除完成')
    
    // 统计信息
    const skippedCount = skippedFiles.length
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
      console.log(`[deleteOrphanedImages] 删除完成: ${statusMsg.join('，')}`)
    } else {
      console.log('[deleteOrphanedImages] 删除完成: 没有需要删除的图片')
    }
    
    return {
      success: true,
      deletedCount: deletedFiles.length,
      skippedCount,
      errors
    }
  } catch (error) {
    console.error('[deleteOrphanedImages] 删除孤立图片失败:', error)
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
    
    // 检查当前版本的数据库（使用路径规范化）
    const datasetDbPath = datasetPath.replace(/\\/g, '/') + '/annotations.db'
    try {
      const dbExistsResult = await window.electronAPI.fileExists(datasetDbPath)
      if (dbExistsResult && dbExistsResult.exists) {
        await window.electronAPI.openDatabase(datasetDbPath)
        
        const datasetImagesResult = await window.electronAPI.querySQL(
          datasetDbPath,
          'SELECT DISTINCT image_id FROM dataset_images'
        )
        
        if (datasetImagesResult.success && datasetImagesResult.data) {
          datasetImagesResult.data.forEach(row => {
            targetImageIds.add(row.image_id)
          })
          console.log(`[findOrphanedImagesInDataset] 目标数据集当前版本引用了 ${datasetImagesResult.data.length} 张图片`)
        }
      } else {
        console.warn(`[findOrphanedImagesInDataset] 目标数据集数据库不存在: ${datasetDbPath}`)
      }
    } catch (error) {
      console.warn(`[findOrphanedImagesInDataset] 扫描数据集当前版本失败 ${datasetDbPath}:`, error)
    }
    
    // 检查所有版本的备份数据库（annotations_v1.db, annotations_v2.db, ...）
    try {
      const listResult = await window.electronAPI.listDirectory(datasetPath)
      if (listResult.success && listResult.entries) {
        const versionDbFiles = listResult.entries
          .filter(entry => !entry.isDirectory && /^annotations_v\d+\.db$/.test(entry.name))
          .map(entry => entry.name)
        
        for (const versionDbFile of versionDbFiles) {
          // 使用路径规范化
          const versionDbPath = datasetPath.replace(/\\/g, '/') + '/' + versionDbFile
          
          // 检查版本数据库文件是否存在
          const versionDbExistsResult = await window.electronAPI.fileExists(versionDbPath)
          if (!versionDbExistsResult || !versionDbExistsResult.exists) {
            continue
          }
          
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
              console.log(`[findOrphanedImagesInDataset] 目标数据集版本 ${versionDbFile} 引用了 ${versionImagesResult.data.length} 张图片`)
            }
          } catch (err) {
            console.warn(`[findOrphanedImagesInDataset] 扫描数据集版本数据库失败 ${versionDbPath}:`, err)
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
    
    // 扫描所有项目（使用项目注册表，确保准确）
    const projectsResult = await window.electronAPI.project.getAllRegistered()
    if (projectsResult.success && projectsResult.paths && projectsResult.paths.length > 0) {
      console.log(`[findOrphanedImagesInDataset] 开始扫描 ${projectsResult.paths.length} 个已注册的项目`)
      for (const projectPath of projectsResult.paths) {
        try {
          const projectDbPath = `${projectPath}/annotations.db`
          
          // 检查数据库文件是否存在
          const dbExistsResult = await window.electronAPI.fileExists(projectDbPath)
          if (!dbExistsResult || !dbExistsResult.exists) {
            console.warn(`[findOrphanedImagesInDataset] 项目数据库不存在: ${projectDbPath}，跳过`)
            continue
          }
          
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
      console.warn(`[findOrphanedImagesInDataset] 获取项目注册表失败:`, projectsResult.error || '无已注册的项目')
    }
    
    // 扫描所有数据集（排除当前数据集），包括所有版本
    const datasetsResult = await window.electronAPI.findAllDatasets()
    if (datasetsResult.success && datasetsResult.datasets) {
      for (const otherDatasetPath of datasetsResult.datasets) {
        // 排除当前正在删除的数据集（规范化路径后比较）
        const normalizedOtherPath = otherDatasetPath.replace(/\\/g, '/')
        const normalizedCurrentPath = datasetPath.replace(/\\/g, '/')
        if (normalizedOtherPath === normalizedCurrentPath) {
          console.log(`[findOrphanedImagesInDataset] 跳过当前数据集: ${datasetPath}`)
          continue
        }
        
        try {
          // 检查当前版本的数据库（使用路径规范化）
          const otherDatasetDbPath = otherDatasetPath.replace(/\\/g, '/') + '/annotations.db'
          
          // 检查数据库文件是否存在
          const dbExistsResult = await window.electronAPI.fileExists(otherDatasetDbPath)
          if (!dbExistsResult || !dbExistsResult.exists) {
            console.warn(`[findOrphanedImagesInDataset] 其他数据集数据库不存在: ${otherDatasetDbPath}，跳过`)
            continue
          }
          
          await window.electronAPI.openDatabase(otherDatasetDbPath)
          
          const otherDatasetImagesResult = await window.electronAPI.querySQL(
            otherDatasetDbPath,
            'SELECT DISTINCT image_id FROM dataset_images'
          )
          
          if (otherDatasetImagesResult.success && otherDatasetImagesResult.data) {
            const otherDatasetImageCount = otherDatasetImagesResult.data.length
            otherDatasetImagesResult.data.forEach(row => {
              referencedImageIds.add(row.image_id)
            })
            console.log(`[findOrphanedImagesInDataset] 其他数据集 ${otherDatasetPath} 引用了 ${otherDatasetImageCount} 张图片`)
          }
          
          // 检查所有版本的备份数据库（annotations_v1.db, annotations_v2.db, ...）
          try {
            const listResult = await window.electronAPI.listDirectory(otherDatasetPath)
            if (listResult.success && listResult.entries) {
              const versionDbFiles = listResult.entries
                .filter(entry => !entry.isDirectory && /^annotations_v\d+\.db$/.test(entry.name))
                .map(entry => entry.name)
              
              for (const versionDbFile of versionDbFiles) {
                // 使用路径规范化
                const versionDbPath = otherDatasetPath.replace(/\\/g, '/') + '/' + versionDbFile
                
                // 检查版本数据库文件是否存在
                const versionDbExistsResult = await window.electronAPI.fileExists(versionDbPath)
                if (!versionDbExistsResult || !versionDbExistsResult.exists) {
                  continue
                }
                
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
                  console.warn(`[findOrphanedImagesInDataset] 扫描数据集版本数据库失败 ${versionDbPath}:`, err)
                }
              }
            }
          } catch (error) {
            console.warn(`[findOrphanedImagesInDataset] 列出数据集文件失败 ${otherDatasetPath}:`, error)
          }
        } catch (error) {
          console.error(`[findOrphanedImagesInDataset] 扫描数据集失败 ${otherDatasetPath}:`, error)
          // 继续扫描其他数据集，不中断流程
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

