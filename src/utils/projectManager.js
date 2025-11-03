// 项目管理工具
import { ref } from 'vue'

// 项目配置文件名
export const PROJECT_CONFIG_FILE = '.yolomarkflow.json'

// 当前项目信息
export const currentProject = ref(null)

/**
 * 创建项目配置
 */
export function createProjectConfig(projectInfo) {
  return {
    name: projectInfo.name,
    path: projectInfo.path,
    description: projectInfo.description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    settings: {
      imageFormats: ['.jpg', '.jpeg', '.png', '.bmp'],
      labelFormat: 'yolo', // yolo, coco, voc
      classes: []
    },
    statistics: {
      totalImages: 0,
      annotatedImages: 0,
      totalAnnotations: 0
    },
    workspaceState: {
      currentImageIndex: -1,
      scrollPosition: 0,
      lastSaved: null
    }
  }
}

// 缓存已修复的配置，避免重复修复
const fixedConfigCache = new WeakMap()

/**
 * 修复损坏的项目配置（当配置被嵌套保存时）
 */
export function fixCorruptedConfig(config) {
  // 如果配置不是对象，直接返回
  if (!config || typeof config !== 'object') {
    return config
  }
  
  // 检查缓存，避免重复修复
  if (fixedConfigCache.has(config)) {
    console.log('fixCorruptedConfig: 使用缓存的修复结果')
    return fixedConfigCache.get(config)
  }
  
  console.log('fixCorruptedConfig 输入:', JSON.stringify(config, null, 2))
  
  let result = config
  
  // 如果配置包含 success 和 config 字段，说明之前错误地保存了整个返回对象
  if (config.success && config.config && typeof config.config === 'object') {
    console.warn('检测到损坏的项目配置，正在修复...')
    result = fixCorruptedConfig(config.config) // 递归修复，可能嵌套多层
  }
  // 如果配置同时有多个 settings 字段（嵌套），合并它们
  else if (config.settings && config.config && config.config.settings) {
    console.warn('检测到嵌套的 settings，正在合并...')
    const innerConfig = fixCorruptedConfig(config.config)
    // 使用最外层的 settings，因为它是最新的
    result = {
      ...innerConfig,
      settings: config.settings,
      updatedAt: config.updatedAt || innerConfig.updatedAt
    }
    console.log('fixCorruptedConfig: 合并后的配置:', JSON.stringify(result, null, 2))
  }
  // 检查是否是正常的项目配置
  else if (config.name && config.path && config.version) {
    console.log('fixCorruptedConfig: 检测到正常的项目配置，无需修复')
    result = config
  }
  // 如果配置看起来不完整，尝试修复
  else if (config.config && typeof config.config === 'object') {
    console.warn('检测到可能的嵌套配置，尝试修复...')
    result = fixCorruptedConfig(config.config)
  }
  else {
    console.log('fixCorruptedConfig: 返回原始配置')
    result = config
  }
  
  // 缓存修复结果
  fixedConfigCache.set(config, result)
  
  return result
}

/**
 * 检查配置是否需要修复
 */
export function needsFix(config) {
  if (!config || typeof config !== 'object') {
    return false
  }
  
  // 如果配置包含 success 和 config 字段，说明需要修复
  if (config.success && config.config && typeof config.config === 'object') {
    return true
  }
  
  // 如果配置同时有多个 settings 字段（嵌套），需要修复
  if (config.settings && config.config && config.config.settings) {
    return true
  }
  
  // 如果配置看起来不完整但有嵌套的config，需要修复
  if (config.config && typeof config.config === 'object') {
    return true
  }
  
  return false
}

/**
 * 验证项目配置
 */
export function validateProjectConfig(config) {
  if (!config || typeof config !== 'object') {
    console.error('validateProjectConfig: config不是对象', config)
    return false
  }
  
  // 检查必需字段
  const requiredFields = ['name', 'path', 'version']
  for (const field of requiredFields) {
    if (!config[field]) {
      console.error(`validateProjectConfig: 缺少必需字段 ${field}`, config)
      return false
    }
  }
  
  console.log('validateProjectConfig: 验证通过', config)
  return true
}

/**
 * 更新项目配置
 */
export function updateProjectConfig(config, updates) {
  return {
    ...config,
    ...updates,
    updatedAt: new Date().toISOString()
  }
}

/**
 * 设置当前项目
 */
export function setCurrentProject(project) {
  currentProject.value = project
  // 保存到localStorage
  if (project) {
    localStorage.setItem('currentProject', JSON.stringify(project))
  } else {
    localStorage.removeItem('currentProject')
  }
}

/**
 * 获取当前项目
 */
export function getCurrentProject() {
  if (currentProject.value) {
    return currentProject.value
  }
  
  // 从localStorage恢复
  const saved = localStorage.getItem('currentProject')
  if (saved) {
    try {
      currentProject.value = JSON.parse(saved)
      return currentProject.value
    } catch (e) {
      console.error('恢复项目信息失败', e)
    }
  }
  
  return null
}

/**
 * 获取最近打开的项目列表
 */
export function getRecentProjects() {
  const saved = localStorage.getItem('recentProjects')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch (e) {
      console.error('读取最近项目失败', e)
    }
  }
  return []
}

/**
 * 添加到最近项目
 */
export function addToRecentProjects(project) {
  let recent = getRecentProjects()
  
  // 移除重复项
  recent = recent.filter(p => p.path !== project.path)
  
  // 添加到开头
  recent.unshift({
    name: project.name,
    path: project.path,
    lastOpened: new Date().toISOString()
  })
  
  // 最多保存10个
  recent = recent.slice(0, 10)
  
  localStorage.setItem('recentProjects', JSON.stringify(recent))
}

/**
 * 清除当前项目
 */
export function clearCurrentProject() {
  setCurrentProject(null)
}

/**
 * 从最近项目列表中移除项目
 */
export function removeFromRecentProjects(projectPath) {
  let recent = getRecentProjects()
  recent = recent.filter(p => p.path !== projectPath)
  localStorage.setItem('recentProjects', JSON.stringify(recent))
}

/**
 * 列出所有项目
 * @returns {Promise<Array<Object>>} 项目列表
 */
export async function listProjects() {
  try {
    // 从最近项目列表获取所有项目路径
    const recentProjects = getRecentProjects()
    
    if (!recentProjects || recentProjects.length === 0) {
      return []
    }
    
    // 验证每个项目是否仍然存在，并读取其配置
    const projects = []
    for (const recent of recentProjects) {
      try {
        // 检查项目目录是否存在
        const configPath = `${recent.path}/${PROJECT_CONFIG_FILE}`
        const exists = await window.electronAPI.fileExists(configPath)
        
        if (exists.exists) {
          // 读取项目配置
          const configResult = await window.electronAPI.readProjectConfig(recent.path)
          
          if (configResult.success) {
            let config = configResult.config
            
            // 修复可能损坏的配置
            if (needsFix(config)) {
              config = fixCorruptedConfig(config)
            }
            
            // 验证配置
            if (validateProjectConfig(config)) {
              projects.push({
                name: config.name,
                path: config.path,
                description: config.description || '',
                createdAt: config.createdAt,
                updatedAt: config.updatedAt,
                lastOpened: recent.lastOpened
              })
            }
          }
        }
      } catch (error) {
        console.error(`读取项目失败 (${recent.path}):`, error)
      }
    }
    
    return projects
  } catch (error) {
    console.error('列出项目失败:', error)
    return []
  }
}

