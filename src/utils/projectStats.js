// 项目统计工具
// 用于计算项目的标注统计信息

/**
 * 获取项目的统计信息
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Object>} 统计信息
 */
export async function getProjectStats(projectPath) {
  try {
    // 读取项目配置获取项目名称
    const configResult = await window.electronAPI.readProjectConfig(projectPath)
    if (!configResult.success) {
      throw new Error('无法读取项目配置')
    }
    
    const projectName = configResult.config.name || '未命名项目'
    
    // 打开项目数据库
    const dbPath = `${projectPath}/annotations.db`
    await window.electronAPI.openDatabase(dbPath)
    
    // 查询图片总数
    const imagesResult = await window.electronAPI.querySQL(
      dbPath,
      'SELECT COUNT(*) as total FROM project_images'
    )
    const totalImages = imagesResult.data?.[0]?.total || 0
    
    // 查询标注框总数
    const annotationsResult = await window.electronAPI.querySQL(
      dbPath,
      'SELECT COUNT(*) as total FROM annotations WHERE position IS NOT NULL'
    )
    const totalAnnotations = annotationsResult.data?.[0]?.total || 0
    
    // 查询已标注图片数（有标注框的图片）
    const annotatedImagesResult = await window.electronAPI.querySQL(
      dbPath,
      `SELECT COUNT(DISTINCT image_id) as count 
       FROM annotations 
       WHERE position IS NOT NULL`
    )
    const annotatedImages = annotatedImagesResult.data?.[0]?.count || 0
    
    // 查询负样本图片数（只有position为null的标注）
    const negativeImagesResult = await window.electronAPI.querySQL(
      dbPath,
      `SELECT COUNT(DISTINCT a.image_id) as count
       FROM annotations a
       WHERE a.position IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM annotations a2 
         WHERE a2.image_id = a.image_id 
         AND a2.position IS NOT NULL
       )`
    )
    const negativeImages = negativeImagesResult.data?.[0]?.count || 0
    
    // 查询每个类别的标注框数量
    const categoriesResult = await window.electronAPI.querySQL(
      dbPath,
      `SELECT 
        c.id, 
        c.name, 
        c.color,
        COUNT(a.id) as count
       FROM categories c
       LEFT JOIN annotations a ON c.id = a.class_id AND a.position IS NOT NULL
       GROUP BY c.id, c.name, c.color
       ORDER BY c.sort ASC, c.id ASC`
    )
    const categories = categoriesResult.data || []
    
    return {
      projectName,
      projectPath,
      totalImages,
      annotatedImages,
      negativeImages,
      unannotatedImages: totalImages - annotatedImages - negativeImages,
      totalAnnotations,
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        count: cat.count || 0
      }))
    }
  } catch (error) {
    console.error('获取项目统计失败:', error)
    throw error
  }
}

/**
 * 获取多个项目的统计信息
 * @param {Array<string>} projectPaths - 项目路径数组
 * @returns {Promise<Array<Object>>} 统计信息数组
 */
export async function getProjectsStats(projectPaths) {
  const results = []
  
  for (const projectPath of projectPaths) {
    try {
      const stats = await getProjectStats(projectPath)
      results.push(stats)
    } catch (error) {
      console.error(`获取项目统计失败 (${projectPath}):`, error)
      results.push({
        projectPath,
        projectName: '加载失败',
        error: error.message
      })
    }
  }
  
  return results
}

export default {
  getProjectStats,
  getProjectsStats
}

