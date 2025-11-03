// 数据集管理工具
// 负责数据集的创建、更新、导出和版本管理

import { getImagePath } from './imagePool'

/**
 * 获取数据集根目录路径
 * @returns {Promise<string>} 数据集根目录路径
 */
async function getDatasetsPath() {
  // 优先使用用户自定义的图片池路径
  const customPath = localStorage.getItem('imagePoolPath')
  
  let workspacePath
  if (customPath) {
    workspacePath = customPath
  } else {
    // 使用新的默认路径
    workspacePath = 'D:\\YoloMarkFlow\\YoloMarkFlow_ImagePool'
  }
  
  return `${workspacePath}/datasets`
}

/**
 * 列出所有数据集
 * @returns {Promise<Array<Object>>} 数据集列表
 */
export async function listDatasets() {
  try {
    const datasetsPath = await getDatasetsPath()
    
    // 确保数据集目录存在
    await window.electronAPI.ensureDirectory(datasetsPath)
    
    // 列出目录内容
    const listResult = await window.electronAPI.listDirectory(datasetsPath)
    if (!listResult.success) {
      return []
    }
    
    // 过滤出目录
    const datasetDirs = listResult.entries.filter(entry => entry.isDirectory)
    
    // 读取每个数据集的元数据
    const datasets = []
    for (const dir of datasetDirs) {
      try {
        const datasetPath = `${datasetsPath}/${dir.name}`
        const dbPath = `${datasetPath}/annotations.db`
        const metadataPath = `${datasetPath}/metadata.json`
        
        // 尝试读取元数据
        const metadataResult = await window.electronAPI.readJSON(metadataPath)
        
        if (metadataResult.success && metadataResult.data) {
          datasets.push({
            name: dir.name,
            path: datasetPath,      // 添加数据集路径
            dbPath: dbPath,         // 添加数据库路径
            ...metadataResult.data
          })
        } else {
          // 没有元数据，尝试从数据库读取
          const info = await getDatasetInfo(dir.name)
          datasets.push({
            ...info,
            path: datasetPath,      // 确保包含路径
            dbPath: dbPath          // 确保包含数据库路径
          })
        }
      } catch (error) {
        console.error(`读取数据集 ${dir.name} 失败:`, error)
      }
    }
    
    return datasets
  } catch (error) {
    console.error('列出数据集失败:', error)
    return []
  }
}

/**
 * 创建数据集
 * @param {string} name - 数据集名称
 * @param {Array<Object>} projectSelections - 项目选择
 *   格式: [{ projectPath: string, projectName: string, categoryIds: number[] }]
 * @param {Object} options - 选项
 * @param {Function} options.onProgress - 进度回调函数 (current, total, message) => void
 * @returns {Promise<Object>} 创建结果
 */
export async function createDataset(name, projectSelections, options = {}) {
  const { onProgress } = options
  const openedDatabases = [] // 记录所有打开的数据库
  
  try {
    // 1. 创建数据集目录
    const datasetsPath = await getDatasetsPath()
    const datasetPath = `${datasetsPath}/${name}`
    await window.electronAPI.ensureDirectory(datasetPath)
    
    // 2. 创建数据集数据库
    const dbPath = `${datasetPath}/annotations.db`
    await window.electronAPI.openDatabase(dbPath)
    openedDatabases.push(dbPath)
    
    // 3. 创建数据集表结构
    await window.electronAPI.execSQL(dbPath, `
      CREATE TABLE IF NOT EXISTS dataset_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id INTEGER NOT NULL,
        source_project TEXT NOT NULL,
        original_name TEXT NOT NULL
      )
    `)
    
    await window.electronAPI.execSQL(dbPath, `
      CREATE TABLE IF NOT EXISTS annotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        position TEXT
      )
    `)
    
    await window.electronAPI.execSQL(dbPath, `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        source_project TEXT NOT NULL
      )
    `)
    
    // 4. 遍历项目选择，复制数据
    const stats = {
      totalImages: 0,
      totalAnnotations: 0,
      categoryCounts: {}
    }
    
    // 获取项目名称映射
    const projectNames = {}
    onProgress?.(0, projectSelections.length, '正在读取项目信息...')
    for (let i = 0; i < projectSelections.length; i++) {
      const selection = projectSelections[i]
      const configResult = await window.electronAPI.readProjectConfig(selection.projectPath)
      if (configResult.success) {
        projectNames[selection.projectPath] = configResult.config.name
      }
      onProgress?.(i + 1, projectSelections.length, `正在读取项目信息 ${i + 1}/${projectSelections.length}...`)
    }
    
    // 计算总任务数（项目数 + 类别数 + 标注数）
    let totalTasks = 0
    for (const selection of projectSelections) {
      totalTasks += selection.categoryIds.length
    }
    
    let completedTasks = 0
    
    for (const selection of projectSelections) {
      const { projectPath, categoryIds } = selection
      const projectName = projectNames[projectPath] || '未知项目'
      
      // 打开项目数据库
      const projectDbPath = `${projectPath}/annotations.db`
      await window.electronAPI.openDatabase(projectDbPath)
      openedDatabases.push(projectDbPath)
      
      // 复制选中的类别
      for (const categoryId of categoryIds) {
        completedTasks++
        onProgress?.(completedTasks, totalTasks, `正在处理类别 ${completedTasks}/${totalTasks}：${projectName}...`)
        
        // 查询类别信息
        const catResult = await window.electronAPI.querySQL(
          projectDbPath,
          'SELECT * FROM categories WHERE id = ?',
          [categoryId]
        )
        
        if (catResult.data && catResult.data.length > 0) {
          const category = catResult.data[0]
          
          // 检查类别是否已存在（可能来自不同项目但名称相同）
          const existingResult = await window.electronAPI.querySQL(
            dbPath,
            'SELECT id FROM categories WHERE name = ? AND source_project = ?',
            [category.name, projectName]
          )
          
          let datasetCategoryId
          if (existingResult.data && existingResult.data.length > 0) {
            datasetCategoryId = existingResult.data[0].id
          } else {
            // 插入类别到数据集
            const insertResult = await window.electronAPI.runSQL(
              dbPath,
              'INSERT INTO categories (name, color, source_project) VALUES (?, ?, ?)',
              [category.name, category.color, projectName]
            )
            datasetCategoryId = insertResult.result.lastInsertRowid
          }
          
          // 查询该类别的所有标注
          const annotationsResult = await window.electronAPI.querySQL(
            projectDbPath,
            'SELECT * FROM annotations WHERE class_id = ?',
            [categoryId]
          )
          
          if (annotationsResult.data && annotationsResult.data.length > 0) {
            // 收集所有涉及的image_id（去重）
            const imageIds = [...new Set(annotationsResult.data.map(ann => ann.image_id))]
            
            onProgress?.(completedTasks, totalTasks, `正在处理图片和标注：${category.name} (${imageIds.length} 张图片, ${annotationsResult.data.length} 个标注)...`)
            
            // 对每个image_id，插入dataset_images（如果还未插入）
            for (const imageId of imageIds) {
              // 检查image是否已在数据集中
              const existingImageResult = await window.electronAPI.querySQL(
                dbPath,
                'SELECT id FROM dataset_images WHERE image_id = ?',
                [imageId]
              )
              
              if (!existingImageResult.data || existingImageResult.data.length === 0) {
                // 从项目数据库获取原始文件名
                const projectImageResult = await window.electronAPI.querySQL(
                  projectDbPath,
                  'SELECT original_name FROM project_images WHERE image_id = ?',
                  [imageId]
                )
                
                const originalName = projectImageResult.data?.[0]?.original_name || 'unknown.jpg'
                
                // 插入到数据集
                await window.electronAPI.runSQL(
                  dbPath,
                  'INSERT INTO dataset_images (image_id, source_project, original_name) VALUES (?, ?, ?)',
                  [imageId, projectName, originalName]
                )
                
                stats.totalImages++
              }
            }
            
            // 插入标注
            for (const annotation of annotationsResult.data) {
              await window.electronAPI.runSQL(
                dbPath,
                'INSERT INTO annotations (image_id, category_id, position) VALUES (?, ?, ?)',
                [annotation.image_id, datasetCategoryId, annotation.position]
              )
              
              stats.totalAnnotations++
              
              // 更新类别计数
              if (!stats.categoryCounts[category.name]) {
                stats.categoryCounts[category.name] = 0
              }
              stats.categoryCounts[category.name]++
            }
          }
        }
      }
    }
    
    // 5. 保存元数据
    onProgress?.(totalTasks, totalTasks, '正在保存元数据...')
    
    const metadata = {
      name,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sources: projectSelections.map(sel => ({
        projectPath: sel.projectPath,
        projectName: projectNames[sel.projectPath] || '未知项目',
        categoryIds: sel.categoryIds
      })),
      stats
    }
    
    const metadataPath = `${datasetPath}/metadata.json`
    const writeResult = await window.electronAPI.writeJSON(metadataPath, metadata)
    
    if (!writeResult.success) {
      console.warn('保存元数据失败:', writeResult.error)
    }
    
    console.log('数据集创建成功:', name, stats)
    
    return {
      success: true,
      datasetPath,
      stats
    }
  } catch (error) {
    console.error('创建数据集失败:', error)
    throw error
  } finally {
    // 关闭所有打开的数据库连接
    for (const dbPath of openedDatabases) {
      try {
        await window.electronAPI.closeDatabase(dbPath)
      } catch (closeError) {
        console.warn(`关闭数据库连接失败 (${dbPath}):`, closeError)
      }
    }
  }
}

/**
 * 获取数据集信息
 * @param {string} datasetName - 数据集名称
 * @returns {Promise<Object>} 数据集信息
 */
export async function getDatasetInfo(datasetName) {
  const datasetsPath = await getDatasetsPath()
  const datasetPath = `${datasetsPath}/${datasetName}`
  const dbPath = `${datasetPath}/annotations.db`
  
  try {
    // 打开数据库
    await window.electronAPI.openDatabase(dbPath)
    
    // 查询统计信息
    const imagesResult = await window.electronAPI.querySQL(
      dbPath,
      'SELECT COUNT(*) as total FROM dataset_images'
    )
    const totalImages = imagesResult.data?.[0]?.total || 0
    
    const annotationsResult = await window.electronAPI.querySQL(
      dbPath,
      'SELECT COUNT(*) as total FROM annotations'
    )
    const totalAnnotations = annotationsResult.data?.[0]?.total || 0
    
    const categoriesResult = await window.electronAPI.querySQL(
      dbPath,
      'SELECT * FROM categories'
    )
    const categories = categoriesResult.data || []
    
    return {
      name: datasetName,
      datasetPath,
      totalImages,
      totalAnnotations,
      categories
    }
  } catch (error) {
    console.error('获取数据集信息失败:', error)
    throw error
  } finally {
    // 关闭数据库连接
    try {
      await window.electronAPI.closeDatabase(dbPath)
    } catch (closeError) {
      console.warn('关闭数据库连接失败:', closeError)
    }
  }
}

/**
 * 更新数据集（创建新版本）
 * @param {string} datasetName - 数据集名称
 * @returns {Promise<Object>} 更新结果
 */
export async function updateDataset(datasetName) {
  const openedDatabases = []
  
  try {
    const datasetsPath = await getDatasetsPath()
    const datasetPath = `${datasetsPath}/${datasetName}`
    
    // 1. 读取现有的元数据
    const metadataPath = `${datasetPath}/metadata.json`
    const metadataResult = await window.electronAPI.readJSON(metadataPath)
    
    if (!metadataResult.success || !metadataResult.data) {
      throw new Error('无法读取数据集元数据')
    }
    
    const oldMetadata = metadataResult.data
    const currentVersion = oldMetadata.version || 1
    const newVersion = currentVersion + 1
    
    // 2. 备份当前版本的数据库
    const oldDbPath = `${datasetPath}/annotations.db`
    const backupDbPath = `${datasetPath}/annotations_v${currentVersion}.db`
    
    // 关闭所有数据库连接
    await window.electronAPI.closeAllDatabases()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 复制数据库文件作为备份
    const copyResult = await window.electronAPI.copyFile(oldDbPath, backupDbPath)
    if (!copyResult.success) {
      throw new Error(`备份数据库失败: ${copyResult.error}`)
    }
    
    // 删除原数据库文件
    const deleteResult = await window.electronAPI.deleteFile(oldDbPath)
    if (!deleteResult.success) {
      console.warn('删除旧数据库失败，但可以继续:', deleteResult.error)
    }
    
    // 3. 重新创建数据集数据库
    const dbPath = oldDbPath // 使用相同的路径
    await window.electronAPI.openDatabase(dbPath)
    openedDatabases.push(dbPath)
    
    // 创建表结构
    await window.electronAPI.execSQL(dbPath, `
      CREATE TABLE IF NOT EXISTS dataset_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id INTEGER NOT NULL,
        source_project TEXT NOT NULL,
        original_name TEXT NOT NULL
      )
    `)
    
    await window.electronAPI.execSQL(dbPath, `
      CREATE TABLE IF NOT EXISTS annotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        position TEXT
      )
    `)
    
    await window.electronAPI.execSQL(dbPath, `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        source_project TEXT NOT NULL
      )
    `)
    
    // 4. 使用原来的 sources 重新收集数据
    const stats = {
      totalImages: 0,
      totalAnnotations: 0,
      categoryCounts: {}
    }
    
    // 获取项目名称映射
    const projectNames = {}
    for (const source of oldMetadata.sources) {
      const configResult = await window.electronAPI.readProjectConfig(source.projectPath)
      if (configResult.success) {
        projectNames[source.projectPath] = configResult.config.name
      } else {
        projectNames[source.projectPath] = source.projectName
      }
    }
    
    for (const source of oldMetadata.sources) {
      const { projectPath, categoryIds } = source
      const projectName = projectNames[projectPath] || '未知项目'
      
      // 打开项目数据库
      const projectDbPath = `${projectPath}/annotations.db`
      await window.electronAPI.openDatabase(projectDbPath)
      openedDatabases.push(projectDbPath)
      
      // 复制选中的类别
      for (const categoryId of categoryIds) {
        // 查询类别信息
        const catResult = await window.electronAPI.querySQL(
          projectDbPath,
          'SELECT * FROM categories WHERE id = ?',
          [categoryId]
        )
        
        if (catResult.data && catResult.data.length > 0) {
          const category = catResult.data[0]
          
          // 检查类别是否已存在
          const existingResult = await window.electronAPI.querySQL(
            dbPath,
            'SELECT id FROM categories WHERE name = ? AND source_project = ?',
            [category.name, projectName]
          )
          
          let datasetCategoryId
          if (existingResult.data && existingResult.data.length > 0) {
            datasetCategoryId = existingResult.data[0].id
          } else {
            // 插入类别到数据集
            const insertResult = await window.electronAPI.runSQL(
              dbPath,
              'INSERT INTO categories (name, color, source_project) VALUES (?, ?, ?)',
              [category.name, category.color, projectName]
            )
            datasetCategoryId = insertResult.result.lastInsertRowid
          }
          
          // 查询该类别的所有标注
          const annotationsResult = await window.electronAPI.querySQL(
            projectDbPath,
            'SELECT * FROM annotations WHERE class_id = ?',
            [categoryId]
          )
          
          if (annotationsResult.data && annotationsResult.data.length > 0) {
            // 收集所有涉及的image_id（去重）
            const imageIds = [...new Set(annotationsResult.data.map(ann => ann.image_id))]
            
            // 对每个image_id，插入dataset_images（如果还未插入）
            for (const imageId of imageIds) {
              // 检查image是否已在数据集中
              const existingImageResult = await window.electronAPI.querySQL(
                dbPath,
                'SELECT id FROM dataset_images WHERE image_id = ?',
                [imageId]
              )
              
              if (!existingImageResult.data || existingImageResult.data.length === 0) {
                // 从项目数据库获取原始文件名
                const projectImageResult = await window.electronAPI.querySQL(
                  projectDbPath,
                  'SELECT original_name FROM project_images WHERE image_id = ?',
                  [imageId]
                )
                
                const originalName = projectImageResult.data?.[0]?.original_name || 'unknown.jpg'
                
                // 插入到数据集
                await window.electronAPI.runSQL(
                  dbPath,
                  'INSERT INTO dataset_images (image_id, source_project, original_name) VALUES (?, ?, ?)',
                  [imageId, projectName, originalName]
                )
                
                stats.totalImages++
              }
            }
            
            // 插入标注
            for (const annotation of annotationsResult.data) {
              await window.electronAPI.runSQL(
                dbPath,
                'INSERT INTO annotations (image_id, category_id, position) VALUES (?, ?, ?)',
                [annotation.image_id, datasetCategoryId, annotation.position]
              )
              
              stats.totalAnnotations++
              
              // 更新类别计数
              if (!stats.categoryCounts[category.name]) {
                stats.categoryCounts[category.name] = 0
              }
              stats.categoryCounts[category.name]++
            }
          }
        }
      }
    }
    
    // 5. 更新元数据
    const newMetadata = {
      ...oldMetadata,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      stats,
      updateHistory: [
        ...(oldMetadata.updateHistory || []),
        {
          version: newVersion,
          updatedAt: new Date().toISOString(),
          previousVersion: currentVersion,
          backupFile: `annotations_v${currentVersion}.db`
        }
      ]
    }
    
    const writeResult = await window.electronAPI.writeJSON(metadataPath, newMetadata)
    
    if (!writeResult.success) {
      console.warn('保存元数据失败:', writeResult.error)
    }
    
    console.log('数据集更新成功:', datasetName, 'v' + currentVersion, '->', 'v' + newVersion, stats)
    
    return {
      success: true,
      datasetPath,
      version: newVersion,
      stats
    }
  } catch (error) {
    console.error('更新数据集失败:', error)
    throw error
  } finally {
    // 关闭所有打开的数据库连接
    for (const dbPath of openedDatabases) {
      try {
        await window.electronAPI.closeDatabase(dbPath)
      } catch (closeError) {
        console.warn(`关闭数据库连接失败 (${dbPath}):`, closeError)
      }
    }
  }
}

/**
 * 切换数据集版本
 * @param {string} datasetName - 数据集名称
 * @param {number} targetVersion - 目标版本号
 * @returns {Promise<Object>} 切换结果
 */
export async function switchDatasetVersion(datasetName, targetVersion) {
  try {
    const datasetsPath = await getDatasetsPath()
    const datasetPath = `${datasetsPath}/${datasetName}`
    
    // 1. 读取元数据，验证目标版本是否存在
    const metadataPath = `${datasetPath}/metadata.json`
    const metadataResult = await window.electronAPI.readJSON(metadataPath)
    
    if (!metadataResult.success || !metadataResult.data) {
      throw new Error('无法读取数据集元数据')
    }
    
    const metadata = metadataResult.data
    const currentVersion = metadata.version || 1
    
    // 如果目标版本就是当前版本，无需切换
    if (targetVersion === currentVersion) {
      return {
        success: true,
        message: '已经是当前版本'
      }
    }
    
    // 检查目标版本的备份文件是否存在
    const targetDbPath = `${datasetPath}/annotations_v${targetVersion}.db`
    const targetExists = await window.electronAPI.fileExists(targetDbPath)
    
    if (!targetExists.exists) {
      throw new Error(`版本 v${targetVersion} 的备份文件不存在`)
    }
    
    // 2. 关闭所有数据库连接
    await window.electronAPI.closeAllDatabases()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 3. 备份当前版本
    const currentDbPath = `${datasetPath}/annotations.db`
    const currentBackupPath = `${datasetPath}/annotations_v${currentVersion}.db`
    
    // 如果当前版本的备份不存在，先创建
    const currentBackupExists = await window.electronAPI.fileExists(currentBackupPath)
    if (!currentBackupExists.exists) {
      const copyResult = await window.electronAPI.copyFile(currentDbPath, currentBackupPath)
      if (!copyResult.success) {
        throw new Error(`备份当前版本失败: ${copyResult.error}`)
      }
    }
    
    // 4. 删除当前的 annotations.db
    const deleteResult = await window.electronAPI.deleteFile(currentDbPath)
    if (!deleteResult.success) {
      console.warn('删除当前数据库失败，但可以继续:', deleteResult.error)
    }
    
    // 5. 将目标版本的备份复制为当前数据库
    const restoreResult = await window.electronAPI.copyFile(targetDbPath, currentDbPath)
    if (!restoreResult.success) {
      throw new Error(`恢复版本失败: ${restoreResult.error}`)
    }
    
    // 6. 更新元数据中的版本号
    const updatedMetadata = {
      ...metadata,
      version: targetVersion,
      updatedAt: new Date().toISOString()
    }
    
    const writeResult = await window.electronAPI.writeJSON(metadataPath, updatedMetadata)
    if (!writeResult.success) {
      console.warn('更新元数据失败:', writeResult.error)
    }
    
    console.log('数据集版本切换成功:', datasetName, 'v' + currentVersion, '->', 'v' + targetVersion)
    
    return {
      success: true,
      version: targetVersion
    }
  } catch (error) {
    console.error('切换数据集版本失败:', error)
    throw error
  }
}

/**
 * 删除数据集
 * @param {string} datasetName - 数据集名称
 * @returns {Promise<Object>} 删除结果
 */
/**
 * 删除数据集的某个版本
 * @param {string} datasetName - 数据集名称
 * @param {number} versionToDelete - 要删除的版本号
 * @returns {Promise<{success: boolean, version?: number}>}
 */
export async function deleteDatasetVersion(datasetName, versionToDelete) {
  try {
    const datasetsPath = await getDatasetsPath()
    const datasetPath = `${datasetsPath}/${datasetName}`
    
    // 1. 读取元数据
    const metadataPath = `${datasetPath}/metadata.json`
    const metadataResult = await window.electronAPI.readJSON(metadataPath)
    
    if (!metadataResult.success || !metadataResult.data) {
      throw new Error('无法读取数据集元数据')
    }
    
    const metadata = metadataResult.data
    const currentVersion = metadata.version || 1
    const updateHistory = metadata.updateHistory || []
    
    // 2. 获取所有版本号
    const allVersions = new Set([currentVersion])
    updateHistory.forEach(h => {
      if (h.version) allVersions.add(h.version)
      if (h.previousVersion) allVersions.add(h.previousVersion)
    })
    
    // 检查是否是最后一个版本
    if (allVersions.size <= 1) {
      throw new Error('这是最后一个版本，无法删除。请删除整个数据集。')
    }
    
    // 检查版本是否存在
    if (!allVersions.has(versionToDelete)) {
      throw new Error(`版本 v${versionToDelete} 不存在`)
    }
    
    // 3. 关闭所有数据库连接
    await window.electronAPI.closeAllDatabases()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 4. 如果删除的是当前版本，需要先切换到另一个版本
    let newCurrentVersion = currentVersion
    if (versionToDelete === currentVersion) {
      // 找到最新的历史版本
      const otherVersions = Array.from(allVersions).filter(v => v !== versionToDelete).sort((a, b) => b - a)
      if (otherVersions.length === 0) {
        throw new Error('没有其他版本可切换')
      }
      
      newCurrentVersion = otherVersions[0]
      
      // 切换到新版本
      const targetDbPath = `${datasetPath}/annotations_v${newCurrentVersion}.db`
      const currentDbPath = `${datasetPath}/annotations.db`
      
      // 删除当前数据库
      await window.electronAPI.deleteFile(currentDbPath)
      
      // 复制目标版本到当前
      const copyResult = await window.electronAPI.copyFile(targetDbPath, currentDbPath)
      if (!copyResult.success) {
        throw new Error(`切换到版本 v${newCurrentVersion} 失败: ${copyResult.error}`)
      }
    }
    
    // 5. 删除版本备份文件
    const versionDbPath = `${datasetPath}/annotations_v${versionToDelete}.db`
    const versionExists = await window.electronAPI.fileExists(versionDbPath)
    
    if (versionExists.exists) {
      const deleteResult = await window.electronAPI.deleteFile(versionDbPath)
      if (!deleteResult.success) {
        throw new Error(`删除版本文件失败: ${deleteResult.error}`)
      }
    }
    
    // 6. 更新元数据，移除相关的 updateHistory 记录
    const newUpdateHistory = updateHistory.filter(h => 
      h.version !== versionToDelete && h.previousVersion !== versionToDelete
    )
    
    metadata.version = newCurrentVersion
    metadata.updateHistory = newUpdateHistory
    metadata.updatedAt = new Date().toISOString()
    
    // 保存元数据
    const saveResult = await window.electronAPI.writeJSON(metadataPath, metadata)
    if (!saveResult.success) {
      throw new Error('更新元数据失败: ' + saveResult.error)
    }
    
    return {
      success: true,
      version: newCurrentVersion
    }
  } catch (error) {
    console.error('删除数据集版本失败:', error)
    throw error
  }
}

export async function deleteDataset(datasetName, options = {}) {
  const { deleteOrphanedImages = true, onProgress } = options
  
  try {
    const datasetsPath = await getDatasetsPath()
    const datasetPath = `${datasetsPath}/${datasetName}`
    const dbPath = `${datasetPath}/annotations.db`
    
    // 0. 检查数据集是否有多个版本
    let hasMultipleVersions = false
    try {
      const metadataPath = `${datasetPath}/metadata.json`
      const metadataResult = await window.electronAPI.readJSON(metadataPath)
      if (metadataResult.success && metadataResult.data) {
        const metadata = metadataResult.data
        const currentVersion = metadata.version || 1
        const updateHistory = metadata.updateHistory || []
        // 检查是否有备份版本文件
        const allVersions = new Set([currentVersion])
        updateHistory.forEach(h => {
          if (h.version) allVersions.add(h.version)
          if (h.previousVersion) allVersions.add(h.previousVersion)
        })
        hasMultipleVersions = allVersions.size > 1
        console.log(`数据集 "${datasetName}" 版本数: ${allVersions.size}, 是否多版本: ${hasMultipleVersions}`)
      }
    } catch (error) {
      console.warn('读取数据集元数据失败，假设只有一个版本:', error)
    }
    
    // 1. 扫描孤立图片（如果需要删除未被引用的图片）
    // 如果数据集有多个版本，直接删除数据集，不需要扫描引用（因为其他版本可能还在引用这些图片）
    let orphanedImageIds = []
    if (deleteOrphanedImages && !hasMultipleVersions) {
      // 只有单个版本时，才扫描引用
      try {
        console.log(`[deleteDataset] 开始扫描数据集 "${datasetName}" 的孤立图片...`)
        const { findOrphanedImagesInDataset } = await import('./imagePool')
        orphanedImageIds = await findOrphanedImagesInDataset(datasetPath)
        console.log(`[deleteDataset] 数据集 "${datasetName}" (单版本) 扫描完成，发现 ${orphanedImageIds.length} 张孤立图片`)
        
        // 如果发现有孤立图片，再次验证一下，确保没有被项目引用
        if (orphanedImageIds.length > 0) {
          console.log(`[deleteDataset] 警告：准备删除 ${orphanedImageIds.length} 张图片，请确认这些图片确实没有被项目引用`)
          // 可以在这里添加额外的验证逻辑
        }
      } catch (error) {
        console.error('[deleteDataset] 扫描孤立图片失败:', error)
        // 如果扫描失败，为了安全起见，不删除任何图片
        orphanedImageIds = []
      }
    } else if (hasMultipleVersions) {
      console.log(`[deleteDataset] 数据集 "${datasetName}" 有多个版本，删除数据集时不扫描引用`)
    }
    
    // 2. 删除孤立图片（如果有），显示进度
    // 在删除数据集之前，先删除孤立图片（因为删除数据集后需要关闭数据库）
    // 在删除之前，再次验证每个图片是否真的没有被引用（双重保险）
    let deletedImageCount = 0
    if (deleteOrphanedImages && orphanedImageIds.length > 0) {
      try {
        console.log(`[deleteDataset] 准备删除 ${orphanedImageIds.length} 张图片，先进行二次验证...`)
        
        // 二次验证：对每个图片使用 checkImageReferences 再次确认（此时数据集还在，可以检查引用）
        const verifiedOrphanedImageIds = []
        for (const imageId of orphanedImageIds) {
          try {
            const checkResult = await window.electronAPI.imagePool.checkImageReferences(imageId)
            if (checkResult.success) {
              if (checkResult.referenceCount === 0) {
                verifiedOrphanedImageIds.push(imageId)
                console.log(`[deleteDataset] 图片 ${imageId} 二次验证通过，确实未被引用`)
              } else {
                console.warn(`[deleteDataset] 图片 ${imageId} 二次验证失败：仍有 ${checkResult.referenceCount} 个引用（项目=${checkResult.projectReferenceCount}, 数据集=${checkResult.datasetReferenceCount}），跳过删除`)
              }
            } else {
              console.error(`[deleteDataset] 图片 ${imageId} 二次验证失败：${checkResult.error}，为安全起见跳过删除`)
            }
          } catch (error) {
            console.error(`[deleteDataset] 图片 ${imageId} 二次验证异常:`, error, '为安全起见跳过删除')
          }
        }
        
        console.log(`[deleteDataset] 二次验证完成：${orphanedImageIds.length} 张图片中，${verifiedOrphanedImageIds.length} 张通过验证，${orphanedImageIds.length - verifiedOrphanedImageIds.length} 张被跳过`)
        
        if (verifiedOrphanedImageIds.length > 0) {
          const { deleteOrphanedImages: deleteImages } = await import('./imagePool')
          
          const deleteResult = await deleteImages(verifiedOrphanedImageIds, (current, total, message) => {
            onProgress?.(current, total, message || `正在删除图片 ${current}/${total}...`)
          })
          
          deletedImageCount = deleteResult.deletedCount || 0
          
          if (deleteResult.errors && deleteResult.errors.length > 0) {
            console.warn(`[deleteDataset] ${deleteResult.errors.length} 张图片删除失败`)
          }
        } else {
          console.log(`[deleteDataset] 所有图片都有引用，跳过删除`)
        }
      } catch (error) {
        console.error('[deleteDataset] 删除孤立图片失败:', error)
        // 不抛出错误，继续删除数据集
      }
    }
    
    // 3. 关闭所有数据库连接（在删除图片之后）
    try {
      await window.electronAPI.closeAllDatabases()
    } catch (closeError) {
      console.warn('关闭数据库连接失败:', closeError)
    }
    
    // 4. 等待 500ms 确保文件句柄释放
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 5. 尝试删除数据集目录（带简单重试）
    let deleteResult = await window.electronAPI.deleteDirectory(datasetPath)
    
    // 如果失败且是文件锁定错误，重试一次
    if (!deleteResult.success && 
        deleteResult.error && 
        (deleteResult.error.includes('EBUSY') || deleteResult.error.includes('EPERM'))) {
      console.warn('文件被锁定，1秒后重试...')
      
      // 再次关闭所有数据库
      try {
        await window.electronAPI.closeAllDatabases()
      } catch (e) {
        // 忽略错误
      }
      
      // 等待1秒后重试
      await new Promise(resolve => setTimeout(resolve, 1000))
      deleteResult = await window.electronAPI.deleteDirectory(datasetPath)
    }
    
    if (!deleteResult.success) {
      throw new Error(deleteResult.error || '删除失败')
    }
    
    return {
      success: true,
      deletedImageCount
    }
  } catch (error) {
    console.error('删除数据集失败:', error)
    throw error
  }
}

export default {
  listDatasets,
  createDataset,
  getDatasetInfo,
  updateDataset,
  switchDatasetVersion,
  deleteDataset,
  deleteDatasetVersion
}

