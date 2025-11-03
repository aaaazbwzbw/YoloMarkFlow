const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs').promises
const fsSync = require('fs')
const sqlite3 = require('sqlite3').verbose()
const crypto = require('crypto')
const packageJson = require('../package.json')
const pluginManager = require('./pluginManager')
const trainingController = require('./trainingController')
const inferenceService = require('./inferenceService')

let mainWindow
let dbInstances = new Map() // 存储数据库实例

// ==================== 日志系统 ====================
let logStream = null
let logFilePath = null

// 保存原始 console 方法（必须在重写之前）
const originalConsoleLog = console.log.bind(console)
const originalConsoleError = console.error.bind(console)
const originalConsoleWarn = console.warn.bind(console)

/**
 * 日志写入函数
 */
function writeLog(level, ...args) {
  const timestamp = new Date().toISOString()
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2)
      } catch {
        return String(arg)
      }
    }
    return String(arg)
  }).join(' ')
  
  const logLine = `[${timestamp}] [${level}] ${message}\n`
  
  // 写入日志文件
  if (logStream) {
    try {
      logStream.write(logLine)
    } catch (error) {
      // 如果写入失败，使用原始 console.error（避免递归）
      originalConsoleError('[Logger] Failed to write log:', error)
    }
  }
  
  // 同时输出到控制台（开发环境）
  // 注意：这里使用原始方法，避免递归
  if (!app.isPackaged || process.env.DEBUG) {
    if (level === 'ERROR') {
      originalConsoleError(...args)
    } else if (level === 'WARN') {
      originalConsoleWarn(...args)
    } else {
      originalConsoleLog(...args)
    }
  }
}

/**
 * 初始化日志系统
 */
function initializeLogger() {
  try {
    // 获取日志文件路径：安装在应用目录下
    if (app.isPackaged) {
      // 打包后：使用应用安装目录
      logFilePath = path.join(path.dirname(app.getPath('exe')), 'YoloMarkFlow.log')
    } else {
      // 开发环境：使用项目根目录
      logFilePath = path.join(__dirname, '..', 'YoloMarkFlow.log')
    }
    
    // 打开日志文件流（追加模式）
    logStream = fsSync.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf8' })
    
    // 写入日志头
    const logHeader = `\n${'='.repeat(80)}\n`
      + `YoloMarkFlow Log - ${new Date().toISOString()}\n`
      + `App Version: ${packageJson.version}\n`
      + `Node Version: ${process.version}\n`
      + `Platform: ${process.platform} ${os.release()}\n`
      + `App Path: ${app.getAppPath()}\n`
      + `Resources Path: ${process.resourcesPath || 'N/A'}\n`
      + `${'='.repeat(80)}\n\n`
    
    logStream.write(logHeader)
    originalConsoleLog('[Logger] Log file initialized:', logFilePath)
  } catch (error) {
    originalConsoleError('[Logger] Failed to initialize logger:', error)
  }
}

// 重写 console 方法，同时写入日志文件
// 注意：writeLog 内部已经处理了控制台输出，这里只负责写入日志文件
console.log = (...args) => {
  writeLog('INFO', ...args)
}

console.error = (...args) => {
  writeLog('ERROR', ...args)
}

console.warn = (...args) => {
  writeLog('WARN', ...args)
}

/**
 * 清理日志系统
 */
function cleanupLogger() {
  if (logStream) {
    try {
      const footer = `\n${'='.repeat(80)}\nApplication closed at ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`
      logStream.write(footer)
      logStream.end()
    } catch (error) {
      console.error('[Logger] Failed to close log stream:', error)
    }
    logStream = null
  }
}

/**
 * 获取日志文件路径（用于 IPC）
 */
function getLogFilePath() {
  return logFilePath
}
// ==================== 日志系统结束 ====================

// 检测开发服务器是否运行
async function checkDevServer(url, timeout = 5000) {
  return new Promise((resolve) => {
    const http = require('http')
    const urlObj = new URL(url)
    
    // 解析端口号（如果 URL 中没有端口，使用协议默认端口）
    let port = urlObj.port
    if (!port || port === '') {
      port = urlObj.protocol === 'https:' ? 443 : 80
    } else {
      port = parseInt(port, 10)
    }
    
    // 使用 GET 而不是 HEAD，因为某些开发服务器可能不支持 HEAD
    const req = http.request({
      hostname: urlObj.hostname,
      port: port,
      path: '/',
      method: 'GET',
      timeout: timeout
    }, (res) => {
      // 只要收到响应就认为服务器在运行
      resolve(res.statusCode >= 200 && res.statusCode < 500)
    })
    
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    
    req.end()
  })
}

// 带重试的开发服务器检测
async function checkDevServerWithRetry(url, maxRetries = 2, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    const isRunning = await checkDevServer(url)
    if (isRunning) {
      return true
    }
    if (i < maxRetries - 1) {
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  return false
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 732, // 700 + 32 (标题栏高度)
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // 智能检测开发服务器（带重试）
  const DEV_SERVER_URL = 'http://localhost:5173'
  const isDevServerRunning = await checkDevServerWithRetry(DEV_SERVER_URL, 2, 1000)
  
  if (isDevServerRunning) {
    // 开发模式：开发服务器在运行，加载 loading.html
    console.log('✓ 检测到开发服务器，加载 loading.html')
    mainWindow.loadFile(path.join(__dirname, '../loading.html'))
    mainWindow.webContents.openDevTools() // 开启开发者工具
  } else {
    // 生产模式：加载打包后的文件，指定启动路由
    console.log('✗ 未检测到开发服务器，加载 dist/index.html')
    const indexPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(indexPath, { hash: 'startup' })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 添加窗口控制按钮的事件监听
  ipcMain.handle('window-minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.handle('window-close', () => {
    mainWindow.close()
  })

  // 项目管理相关的IPC处理器
  // 选择项目目录
  ipcMain.handle('project:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择项目目录'
    })
    
    if (result.canceled) {
      return null
    }
    
    return result.filePaths[0]
  })

  // 创建项目目录
  ipcMain.handle('project:createDirectory', async (event, projectPath) => {
    try {
      await fs.mkdir(projectPath, { recursive: true })
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 写入项目配置
  ipcMain.handle('project:writeConfig', async (event, projectPath, config) => {
    try {
      const configPath = path.join(projectPath, '.yolomarkflow.json')
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 读取项目配置
  ipcMain.handle('project:readConfig', async (event, projectPath) => {
    try {
      const configPath = path.join(projectPath, '.yolomarkflow.json')
      const data = await fs.readFile(configPath, 'utf-8')
      return { success: true, config: JSON.parse(data) }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 检查项目是否存在
  ipcMain.handle('project:checkExists', async (event, projectPath) => {
    try {
      const configPath = path.join(projectPath, '.yolomarkflow.json')
      return fsSync.existsSync(configPath)
    } catch (error) {
      return false
    }
  })

  // 删除项目
  ipcMain.handle('project:delete', async (event, projectPath) => {
    try {
      // 尝试删除，如果失败则重试
      let lastError = null
      const maxRetries = 3
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          // 递归删除整个项目目录
          await fs.rm(projectPath, { recursive: true, force: true })
          return { success: true }
        } catch (error) {
          lastError = error
          
          // 如果是文件被占用的错误，等待后重试
          if (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'ENOTEMPTY') {
            console.log(`删除失败，${i + 1}/${maxRetries} 次重试...`)
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))) // 递增等待时间
            continue
          }
          
          // 其他错误直接返回
          throw error
        }
      }
      
      // 所有重试都失败
      throw lastError
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 查找所有项目
  ipcMain.handle('project:findAll', async (event) => {
    try {
      const workspaceResult = await getWorkspacePath()
      if (!workspaceResult.success) {
        return { success: false, error: workspaceResult.error }
      }
      
      const workspacePath = workspaceResult.path
      const projectsPath = path.join(workspacePath, 'projects')
      
      // 确保项目目录存在
      try {
        await fs.access(projectsPath)
      } catch {
        return { success: true, projects: [] }
      }
      
      // 递归查找所有包含 .yolomarkflow.json 的目录
      const projects = []
      
      async function scanDirectory(dirPath) {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true })
          
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name)
            
            if (entry.isDirectory()) {
              // 检查是否包含项目配置文件
              const configPath = path.join(fullPath, '.yolomarkflow.json')
              try {
                await fs.access(configPath)
                projects.push(fullPath)
              } catch {
                // 不是项目目录，继续递归扫描
                await scanDirectory(fullPath)
              }
            }
          }
        } catch (error) {
          console.warn(`扫描目录失败 ${dirPath}:`, error)
        }
      }
      
      await scanDirectory(projectsPath)
      
      return { success: true, projects }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 查找所有数据集
  ipcMain.handle('dataset:findAll', async (event) => {
    try {
      const workspaceResult = await getWorkspacePath()
      if (!workspaceResult.success) {
        return { success: false, error: workspaceResult.error }
      }
      
      const workspacePath = workspaceResult.path
      const datasetsPath = path.join(workspacePath, 'datasets')
      
      // 确保数据集目录存在
      try {
        await fs.access(datasetsPath)
      } catch {
        return { success: true, datasets: [] }
      }
      
      // 列出所有数据集目录
      const datasets = []
      const entries = await fs.readdir(datasetsPath, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const datasetPath = path.join(datasetsPath, entry.name)
          // 检查是否包含 annotations.db
          const dbPath = path.join(datasetPath, 'annotations.db')
          try {
            await fs.access(dbPath)
            datasets.push(datasetPath)
          } catch {
            // 不是有效的数据集目录
          }
        }
      }
      
      return { success: true, datasets }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 从项目中移除图片引用
  ipcMain.handle('project:removeImage', async (event, { projectPath, imageId }) => {
    try {
      const dbPath = path.join(projectPath, 'annotations.db')
      const sqlite3 = require('sqlite3').verbose()
      const db = new sqlite3.Database(dbPath)
      
      return new Promise((resolve, reject) => {
        db.run('DELETE FROM project_images WHERE image_id = ?', [imageId], function(err) {
          if (err) {
            db.close()
            reject(err)
          } else {
            db.close()
            resolve({ success: true })
          }
        })
      })
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 检查图片被多少项目引用
  ipcMain.handle('imagePool:checkImageReferences', async (event, imageId) => {
    try {
      const workspaceResult = await getWorkspacePath()
      if (!workspaceResult.success) {
        return { success: false, error: workspaceResult.error }
      }
      
      const workspacePath = workspaceResult.path
      const projectsPath = path.join(workspacePath, 'projects')
      
      let referenceCount = 0
      
      // 确保项目目录存在
      try {
        await fs.access(projectsPath)
      } catch {
        return { success: true, referenceCount: 0 }
      }
      
      // 列出所有项目
      const entries = await fs.readdir(projectsPath, { withFileTypes: true })
      const sqlite3 = require('sqlite3').verbose()
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(projectsPath, entry.name)
          const dbPath = path.join(projectPath, 'annotations.db')
          
          try {
            await fs.access(dbPath)
            
            // 检查此项目数据库中是否有该图片
            const count = await new Promise((resolve, reject) => {
              const db = new sqlite3.Database(dbPath)
              db.get('SELECT COUNT(*) as count FROM project_images WHERE image_id = ?', [imageId], (err, row) => {
                db.close()
                if (err) reject(err)
                else resolve(row.count)
              })
            })
            
            referenceCount += count
          } catch {
            // 跳过无效的项目
          }
        }
      }
      
      return { success: true, referenceCount }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 从图片池中删除图片
  ipcMain.handle('imagePool:deleteImage', async (event, imageId) => {
    try {
      // 注意：主进程中无法使用 localStorage，直接使用默认路径
      // TODO: 未来可以从配置文件读取自定义路径
      const imagePoolPath = 'D:\\YoloMarkFlow\\YoloMarkFlow_ImagePool'
      
      const dbPath = path.join(imagePoolPath, 'imagePool.db')
      const sqlite3 = require('sqlite3').verbose()
      const db = new sqlite3.Database(dbPath)
      
      // 先获取图片路径
      const imagePath = await new Promise((resolve, reject) => {
        db.get('SELECT path FROM images WHERE id = ?', [imageId], (err, row) => {
          if (err) reject(err)
          else resolve(row ? row.path : null)
        })
      })
      
      if (!imagePath) {
        db.close()
        return { success: false, error: '图片不存在' }
      }
      
      // 删除物理文件
      try {
        await fs.unlink(imagePath)
      } catch (error) {
        console.error('删除物理文件失败:', error)
      }
      
      // 删除数据库记录
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM images WHERE id = ?', [imageId], function(err) {
          db.close()
          if (err) reject(err)
          else resolve()
        })
      })
      
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 获取应用版本信息
  ipcMain.handle('app:getVersion', () => {
    return {
      success: true,
      version: packageJson.version,
      name: packageJson.name,
      description: packageJson.description
    }
  })

  // 获取日志文件路径
  ipcMain.handle('app:getLogPath', () => {
    const logPath = getLogFilePath()
    return {
      success: true,
      path: logPath,
      exists: logPath ? fsSync.existsSync(logPath) : false
    }
  })

  // 打开日志文件
  ipcMain.handle('app:openLogFile', async () => {
    try {
      const logPath = getLogFilePath()
      if (!logPath || !fsSync.existsSync(logPath)) {
        return {
          success: false,
          error: '日志文件不存在'
        }
      }
      
      // 使用系统默认程序打开日志文件
      await shell.openPath(logPath)
      return {
        success: true,
        path: logPath
      }
    } catch (error) {
      console.error('打开日志文件失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  // 读取用户手册
  ipcMain.handle('app:readUserManual', async () => {
    try {
      const manualPath = path.join(__dirname, '../用户手册.md')
      const content = await fs.readFile(manualPath, 'utf-8')
      return {
        success: true,
        content
      }
    } catch (error) {
      console.error('读取用户手册失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  // 使用系统默认浏览器打开链接
  ipcMain.handle('app:openExternal', async (event, url) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('打开外部链接失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  // 保存项目工作状态
  ipcMain.handle('save-project-workspace-state', async (event, projectPath, state) => {
    try {
      const configPath = path.join(projectPath, '.yolomarkflow.json')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configContent)
      
      config.workspaceState = state
      config.updatedAt = new Date().toISOString()
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))
      return { success: true }
    } catch (error) {
      console.error('保存工作状态失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 加载项目工作状态
  ipcMain.handle('load-project-workspace-state', async (event, projectPath) => {
    try {
      const configPath = path.join(projectPath, '.yolomarkflow.json')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configContent)
      
      return config.workspaceState || null
    } catch (error) {
      console.error('加载工作状态失败:', error)
      return null
    }
  })

  // 图片导入相关的IPC处理器
  // 选择图片文件
  ipcMain.handle('images:selectFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      title: '选择图片文件',
      filters: [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'webp'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (result.canceled) {
      return { success: true, files: [] }
    }
    
    return { success: true, files: result.filePaths }
  })

  // 选择图片目录
  ipcMain.handle('images:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择图片目录'
    })
    
    if (result.canceled) {
      return { success: true, directory: null }
    }
    
    return { success: true, directory: result.filePaths[0] }
  })

  // 通用目录选择器
  ipcMain.handle('dialog:selectDirectory', async (event, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: options.title || '选择目录',
      defaultPath: options.defaultPath
    })
    
    if (result.canceled) {
      return { success: true, directory: null }
    }
    
    return { success: true, directory: result.filePaths[0] }
  })

  // 复制图片到项目目录
  ipcMain.handle('images:copyToProject', async (event, sourceFiles, projectPath) => {
    try {
      const imagesDir = path.join(projectPath, 'images')
      
      // 确保images目录存在
      await fs.mkdir(imagesDir, { recursive: true })
      
      const copiedFiles = []
      const errors = []
      
      for (const sourceFile of sourceFiles) {
        try {
          const fileName = path.basename(sourceFile)
          const destFile = path.join(imagesDir, fileName)
          
          // 检查目标文件是否已存在
          if (fsSync.existsSync(destFile)) {
            // 如果文件已存在，添加时间戳避免冲突
            const ext = path.extname(fileName)
            const nameWithoutExt = path.basename(fileName, ext)
            const timestamp = Date.now()
            const newFileName = `${nameWithoutExt}_${timestamp}${ext}`
            const newDestFile = path.join(imagesDir, newFileName)
            
            await fs.copyFile(sourceFile, newDestFile)
            copiedFiles.push({
              originalPath: sourceFile,
              projectPath: path.relative(projectPath, newDestFile),
              fileName: newFileName
            })
          } else {
            await fs.copyFile(sourceFile, destFile)
            copiedFiles.push({
              originalPath: sourceFile,
              projectPath: path.relative(projectPath, destFile),
              fileName: fileName
            })
          }
        } catch (error) {
          errors.push({
            file: sourceFile,
            error: error.message
          })
        }
      }
      
      return {
        success: true,
        copiedFiles,
        errors
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  })

  // 扫描目录中的图片
  ipcMain.handle('images:scanDirectory', async (event, dirPath, extensions) => {
    try {
      const files = await fs.readdir(dirPath)
      const imageFiles = []
      
      for (const file of files) {
        const filePath = path.join(dirPath, file)
        const stat = await fs.stat(filePath)
        
        if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase()
          if (extensions.includes(ext)) {
            imageFiles.push(filePath)
          }
        }
      }
      
      return {
        success: true,
        files: imageFiles
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  })

  // 获取项目中的图片列表
  ipcMain.handle('images:listProjectImages', async (event, projectPath) => {
    try {
      const imagesDir = path.join(projectPath, 'images')
      
      // 检查images目录是否存在
      if (!fsSync.existsSync(imagesDir)) {
        return { success: true, images: [] }
      }
      
      const files = await fs.readdir(imagesDir)
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.webp']
      const images = []
      
      for (const file of files) {
        const filePath = path.join(imagesDir, file)
        const stat = await fs.stat(filePath)
        
        if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase()
          if (imageExtensions.includes(ext)) {
            images.push({
              name: file,
              path: filePath,
              relativePath: path.join('images', file),
              size: stat.size,
              modified: stat.mtime
            })
          }
        }
      }
      
      return {
        success: true,
        images
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  })

  // 数据库相关的IPC处理器
  // 打开数据库（带连接复用）
  ipcMain.handle('database:open', async (event, dbPath) => {
    try {
      // 规范化路径（统一使用反斜杠）
      const normalizedPath = path.normalize(dbPath)
      
      // 如果数据库实例已存在且有效，直接返回成功（连接复用）
      if (dbInstances.has(normalizedPath)) {
        const existingDb = dbInstances.get(normalizedPath)
        if (existingDb && existingDb.open) {
          // console.log(`复用已打开的数据库连接: ${normalizedPath}`)
          return { success: true }
        } else {
          // 连接已失效，清理
          dbInstances.delete(normalizedPath)
        }
      }

      // 打开新连接
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(normalizedPath, (err) => {
          if (err) {
            reject(err)
          } else {
            dbInstances.set(normalizedPath, db)
            console.log(`数据库已打开: ${normalizedPath}`)
            resolve({ success: true })
          }
        })
      })
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 关闭数据库
  ipcMain.handle('database:close', async (event, dbPath) => {
    try {
      // 规范化路径
      const normalizedPath = path.normalize(dbPath)
      
      if (dbInstances.has(normalizedPath)) {
        const db = dbInstances.get(normalizedPath)
        if (db) {
          // 等待数据库关闭完成
          await new Promise((resolve, reject) => {
            db.close((err) => {
              if (err) {
                console.error(`关闭数据库出错 (${normalizedPath}):`, err)
                reject(err)
              } else {
                console.log(`数据库已关闭: ${normalizedPath}`)
                resolve()
              }
            })
          })
        }
        dbInstances.delete(normalizedPath)
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 关闭所有数据库连接
  ipcMain.handle('database:closeAll', async (event) => {
    try {
      const closedDatabases = []
      const closePromises = []
      
      for (const [dbPath, db] of dbInstances.entries()) {
        if (db) {
          // 为每个数据库创建关闭 Promise
          const closePromise = new Promise((resolve) => {
            db.close((err) => {
              if (err) {
                console.error(`关闭数据库失败 (${dbPath}):`, err)
              } else {
                console.log(`数据库已关闭: ${dbPath}`)
                closedDatabases.push(dbPath)
              }
              resolve() // 无论成功失败都 resolve，确保不阻塞
            })
          })
          closePromises.push(closePromise)
        }
      }
      
      // 等待所有数据库关闭完成
      await Promise.all(closePromises)
      
      // 清空实例映射
      dbInstances.clear()
      
      console.log(`已关闭 ${closedDatabases.length} 个数据库连接`)
      
      // 触发垃圾回收（如果可用）
      if (global.gc) {
        console.log('触发主进程垃圾回收...')
        global.gc()
      }
      
      return { success: true, closedDatabases }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 执行SQL语句
  ipcMain.handle('database:exec', async (event, dbPath, sql) => {
    try {
      const normalizedPath = path.normalize(dbPath)
      const db = dbInstances.get(normalizedPath)
      if (!db) {
        throw new Error('数据库未打开')
      }
      
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) {
            reject(err)
          } else {
            resolve({ success: true })
          }
        })
      })
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 查询数据
  ipcMain.handle('database:all', async (event, dbPath, sql, params = []) => {
    try {
      const normalizedPath = path.normalize(dbPath)
      const db = dbInstances.get(normalizedPath)
      if (!db) {
        throw new Error('数据库未打开')
      }
      
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err)
          } else {
            resolve({ success: true, data: rows })
          }
        })
      })
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 插入/更新/删除数据
  ipcMain.handle('database:run', async (event, dbPath, sql, params = []) => {
    try {
      const normalizedPath = path.normalize(dbPath)
      const db = dbInstances.get(normalizedPath)
      if (!db) {
        throw new Error('数据库未打开')
      }
      
      return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) {
            reject(err)
          } else {
            resolve({ success: true, result: { lastInsertRowid: this.lastID, changes: this.changes } })
          }
        })
      })
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 工作空间相关的IPC处理器
  // 获取工作空间根路径
  ipcMain.handle('workspace:getPath', async () => {
    try {
      const userDataPath = app.getPath('documents')
      const workspacePath = path.join(userDataPath, 'annotation_workspace')
      return { success: true, path: workspacePath }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 确保工作空间目录存在
  ipcMain.handle('workspace:ensureDirectory', async (event, dirPath) => {
    try {
      // 如果是相对路径，转换为绝对路径
      let fullPath = dirPath
      if (!path.isAbsolute(dirPath)) {
        // 使用系统临时目录作为基础路径
        fullPath = path.join(os.tmpdir(), dirPath)
      }
      
      await fs.mkdir(fullPath, { recursive: true })
      return { success: true, path: fullPath }  // 返回创建的路径
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 文件操作相关的IPC处理器
  // 计算文件MD5 hash
  ipcMain.handle('file:calculateHash', async (event, filePath) => {
    try {
      const fileBuffer = await fs.readFile(filePath)
      const hash = crypto.createHash('md5').update(fileBuffer).digest('hex')
      return { success: true, hash }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 复制文件到图片池
  ipcMain.handle('file:copyToImagePool', async (event, sourceFile, destFile) => {
    try {
      // 确保目标目录存在
      const destDir = path.dirname(destFile)
      await fs.mkdir(destDir, { recursive: true })
      
      // 复制文件
      await fs.copyFile(sourceFile, destFile)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 获取图片池中文件的完整路径（支持自定义工作空间路径）
  ipcMain.handle('file:getImagePoolPath', async (event, filename, customWorkspacePath) => {
    try {
      let workspacePath
      if (customWorkspacePath) {
        workspacePath = customWorkspacePath
      } else {
        const userDataPath = app.getPath('documents')
        workspacePath = path.join(userDataPath, 'annotation_workspace')
      }
      
      const imagePath = path.join(workspacePath, 'image_pool', filename)
      return { success: true, path: imagePath }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 检查文件是否存在
  ipcMain.handle('file:exists', async (event, filePath) => {
    try {
      const exists = fsSync.existsSync(filePath)
      return { success: true, exists }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 获取文件信息
  ipcMain.handle('file:getInfo', async (event, filePath) => {
    try {
      const stats = await fs.stat(filePath)
      return {
        success: true,
        info: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 复制目录（递归）
  ipcMain.handle('directory:copy', async (event, sourcePath, destPath) => {
    try {
      // 确保目标目录的父目录存在
      const destParent = path.dirname(destPath)
      await fs.mkdir(destParent, { recursive: true })

      // 递归复制函数
      async function copyRecursive(src, dest) {
        const stats = await fs.stat(src)
        
        if (stats.isDirectory()) {
          // 创建目标目录
          await fs.mkdir(dest, { recursive: true })
          
          // 读取源目录内容
          const entries = await fs.readdir(src)
          
          // 递归复制每个条目
          for (const entry of entries) {
            const srcPath = path.join(src, entry)
            const destPath = path.join(dest, entry)
            await copyRecursive(srcPath, destPath)
          }
        } else {
          // 复制文件
          await fs.copyFile(src, dest)
        }
      }

      await copyRecursive(sourcePath, destPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 获取目录大小（递归）
  ipcMain.handle('directory:getSize', async (event, dirPath) => {
    try {
      async function getDirSize(dirPath) {
        let totalSize = 0
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name)
          
          if (entry.isDirectory()) {
            totalSize += await getDirSize(fullPath)
          } else {
            const stats = await fs.stat(fullPath)
            totalSize += stats.size
          }
        }
        
        return totalSize
      }

      const size = await getDirSize(dirPath)
      return { success: true, size }
    } catch (error) {
      return { success: false, error: error.message, size: 0 }
    }
  })

  // 检查目录是否存在
  ipcMain.handle('directory:exists', async (event, dirPath) => {
    try {
      const exists = fsSync.existsSync(dirPath)
      return { success: true, exists }
    } catch (error) {
      return { success: false, error: error.message, exists: false }
    }
  })

  // 检查目录是否为空
  ipcMain.handle('directory:isEmpty', async (event, dirPath) => {
    try {
      if (!fsSync.existsSync(dirPath)) {
        return { success: true, isEmpty: true }
      }
      
      const entries = await fs.readdir(dirPath)
      return { success: true, isEmpty: entries.length === 0 }
    } catch (error) {
      return { success: false, error: error.message, isEmpty: true }
    }
  })

  // 列出目录内容
  ipcMain.handle('directory:list', async (event, dirPath) => {
    try {
      if (!fsSync.existsSync(dirPath)) {
        return { success: true, entries: [] }
      }
      
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const result = entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile()
      }))
      
      return { success: true, entries: result }
    } catch (error) {
      return { success: false, error: error.message, entries: [] }
    }
  })

  // 删除目录（递归）
  ipcMain.handle('directory:delete', async (event, dirPath) => {
    try {
      if (fsSync.existsSync(dirPath)) {
        await fs.rm(dirPath, { recursive: true, force: true })
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 读取 JSON 文件
  ipcMain.handle('file:readJSON', async (event, filePath) => {
    try {
      if (!fsSync.existsSync(filePath)) {
        return { success: false, error: '文件不存在', data: null }
      }
      
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message, data: null }
    }
  })

  // 写入 JSON 文件
  ipcMain.handle('file:writeJSON', async (event, filePath, data) => {
    try {
      // 确保目录存在
      const dirPath = path.dirname(filePath)
      if (!fsSync.existsSync(dirPath)) {
        await fs.mkdir(dirPath, { recursive: true })
      }
      
      const content = JSON.stringify(data, null, 2)
      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
  
  // 写入文本文件
  ipcMain.handle('file:writeFile', async (event, filePath, content) => {
    try {
      // 确保目录存在
      const dirPath = path.dirname(filePath)
      if (!fsSync.existsSync(dirPath)) {
        await fs.mkdir(dirPath, { recursive: true })
      }
      
      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 复制文件
  ipcMain.handle('file:copy', async (event, sourcePath, destPath) => {
    try {
      // 确保目标目录存在
      const destDir = path.dirname(destPath)
      await fs.mkdir(destDir, { recursive: true })
      
      await fs.copyFile(sourcePath, destPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 删除文件
  ipcMain.handle('file:delete', async (event, filePath) => {
    try {
      await fs.unlink(filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 读取文本文件
  ipcMain.handle('file:readText', async (event, filePath) => {
    try {
      if (!fsSync.existsSync(filePath)) {
        return { success: false, error: '文件不存在', data: null }
      }
      
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: error.message, data: null }
    }
  })

  // 列出目录下的文件
  ipcMain.handle('file:listFiles', async (event, dirPath) => {
    try {
      if (!fsSync.existsSync(dirPath)) {
        return { success: false, error: '目录不存在', files: [] }
      }
      
      const stat = await fs.stat(dirPath)
      if (!stat.isDirectory()) {
        return { success: false, error: '路径不是目录', files: [] }
      }
      
      const files = await fs.readdir(dirPath)
      const fullPaths = files.map(file => path.join(dirPath, file))
      
      return { success: true, files: fullPaths }
    } catch (error) {
      return { success: false, error: error.message, files: [] }
    }
  })

  // 选择单个文件
  ipcMain.handle('dialog:selectFile', async (event, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: options.properties || ['openFile'],
      title: options.title || '选择文件',
      filters: options.filters || [{ name: '所有文件', extensions: ['*'] }],
      defaultPath: options.defaultPath
    })
    
    if (result.canceled) {
      return { success: false, filePaths: [] }
    }
    
    return { success: true, filePaths: result.filePaths }
  })

  // 选择多个文件
  ipcMain.handle('dialog:selectFiles', async (event, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      title: options.title || '选择文件',
      filters: options.filters || [{ name: '所有文件', extensions: ['*'] }],
      defaultPath: options.defaultPath
    })
    
    if (result.canceled) {
      return { success: true, files: [] }
    }
    
    return { success: true, files: result.filePaths }
  })

  // 图片池数据库初始化（支持自定义工作空间路径）
  ipcMain.handle('imagePool:init', async (event, customWorkspacePath) => {
    try {
      // 优先使用自定义路径，否则使用默认路径
      let workspacePath
      if (customWorkspacePath) {
        workspacePath = customWorkspacePath
      } else {
        const userDataPath = app.getPath('documents')
        workspacePath = path.join(userDataPath, 'annotation_workspace')
      }
      
      const imagePoolPath = path.join(workspacePath, 'image_pool')
      const imagePoolDbPath = path.normalize(path.join(workspacePath, 'image_pool.db'))

      // 确保目录存在
      await fs.mkdir(imagePoolPath, { recursive: true })

      // 如果已经有连接存在，先关闭
      if (dbInstances.has(imagePoolDbPath)) {
        const existingDb = dbInstances.get(imagePoolDbPath)
        if (existingDb) {
          await new Promise((resolve) => {
            existingDb.close((err) => {
              if (err) console.error(`关闭已存在的图片池数据库出错:`, err)
              resolve()
            })
          })
        }
        dbInstances.delete(imagePoolDbPath)
      }

      // 打开或创建数据库
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(imagePoolDbPath, async (err) => {
          if (err) {
            reject(err)
            return
          }

          console.log(`图片池数据库已打开: ${imagePoolDbPath}`)

          // 创建images表
          db.run(`
            CREATE TABLE IF NOT EXISTS images (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              hash TEXT UNIQUE,
              filename TEXT UNIQUE,
              created_at TEXT
            )
          `, (err) => {
            if (err) {
              db.close()
              reject(err)
            } else {
              // 存储数据库实例
              dbInstances.set(imagePoolDbPath, db)
              console.log(`图片池数据库已加入管理: ${imagePoolDbPath}`)
              resolve({ success: true, dbPath: imagePoolDbPath })
            }
          })
        })
      })
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}

// ==================== 训练管理 IPC ====================

// 引入系统模块
const { execSync, spawn, exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

/**
 * 获取工作空间路径
 * 统一的基础目录：D:\YoloMarkFlow
 * 所有功能如果用户未自定义路径，都应该在这个目录下创建子目录
 */
function getWorkspacePath() {
  return 'D:\\YoloMarkFlow'
}

/**
 * 获取GPU信息（NVIDIA显卡）
 */
function getGPUInfo() {
  try {
    // 尝试执行 nvidia-smi 命令
    const output = execSync(
      'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits',
      { encoding: 'utf-8', timeout: 5000 }
    ).trim()
    
    const [name, usage, memoryUsed, memoryTotal, temp] = output.split(',').map(s => s.trim())
    
    return {
      name: name,
      usage: parseInt(usage),
      memoryUsed: parseFloat(memoryUsed / 1024).toFixed(1), // MB转GB
      memoryTotal: parseFloat(memoryTotal / 1024).toFixed(1),
      memoryPercent: Math.round((parseFloat(memoryUsed) / parseFloat(memoryTotal)) * 100),
      temp: parseInt(temp)
    }
  } catch (error) {
    // 如果nvidia-smi不可用（没有NVIDIA显卡或驱动未安装）
    return {
      name: '未检测到NVIDIA GPU',
      usage: 0,
      memoryUsed: 0,
      memoryTotal: 0,
      memoryPercent: 0,
      temp: 0
    }
  }
}

/**
 * 获取CPU信息
 */
function getCPUInfo() {
  const cpus = os.cpus()
  const cpuModel = cpus[0].model
  const cores = cpus.length
  
  // 计算CPU使用率
  let totalIdle = 0
  let totalTick = 0
  
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type]
    }
    totalIdle += cpu.times.idle
  })
  
  const usage = Math.round((1 - totalIdle / totalTick) * 100)
  
  return {
    name: cpuModel,
    usage: usage,
    cores: cores
  }
}

/**
 * 获取内存信息
 */
function getMemoryInfo() {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  
  return {
    used: (usedMem / 1024 / 1024 / 1024).toFixed(1), // 转换为GB
    total: (totalMem / 1024 / 1024 / 1024).toFixed(1),
    percent: Math.round((usedMem / totalMem) * 100)
  }
}

/**
 * 获取磁盘信息
 */
function getDiskInfo() {
  try {
    const workspacePath = getWorkspacePath()
    const drive = path.parse(workspacePath).root
    
    if (process.platform === 'win32') {
      // Windows平台使用wmic命令
      const output = execSync(
        `wmic logicaldisk where "DeviceID='${drive.replace('\\', '')}'" get FreeSpace`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim()
      
      const lines = output.split('\n').filter(line => line.trim())
      if (lines.length > 1) {
        const freeBytes = parseInt(lines[1].trim())
        return {
          free: (freeBytes / 1024 / 1024 / 1024).toFixed(1) // 转换为GB
        }
      }
    } else {
      // Linux/Mac平台使用df命令
      const output = execSync(
        `df -k "${workspacePath}" | tail -1 | awk '{print $4}'`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim()
      
      const freeKB = parseInt(output)
      return {
        free: (freeKB / 1024 / 1024).toFixed(1) // KB转GB
      }
    }
  } catch (error) {
    console.error('Failed to get disk info:', error)
  }
  
  return {
    free: 0
  }
}

// 缓存CPU使用率计算所需的数据
let lastCPUInfo = null
let lastCPUTime = Date.now()

/**
 * 获取更准确的CPU使用率
 */
function getAccurateCPUUsage() {
  const cpus = os.cpus()
  
  let totalIdle = 0
  let totalTick = 0
  
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type]
    }
    totalIdle += cpu.times.idle
  })
  
  const currentTime = Date.now()
  
  if (lastCPUInfo && (currentTime - lastCPUTime) > 100) {
    const idleDiff = totalIdle - lastCPUInfo.idle
    const totalDiff = totalTick - lastCPUInfo.total
    const usage = Math.round((1 - idleDiff / totalDiff) * 100)
    
    lastCPUInfo = { idle: totalIdle, total: totalTick }
    lastCPUTime = currentTime
    
    return Math.max(0, Math.min(100, usage)) // 确保在0-100范围内
  }
  
  lastCPUInfo = { idle: totalIdle, total: totalTick }
  lastCPUTime = currentTime
  
  return 0
}

// 硬件信息获取（真实数据）
ipcMain.handle('system:getHardwareInfo', async () => {
  try {
    const gpu = getGPUInfo()
    const cpus = os.cpus()
    const memory = getMemoryInfo()
    const disk = getDiskInfo()
    
    // 获取更准确的CPU使用率
    const cpuUsage = getAccurateCPUUsage()
    
    return {
      gpu: gpu,
      cpu: {
        name: cpus[0].model,
        usage: cpuUsage,
        cores: cpus.length
      },
      memory: memory,
      disk: disk
    }
  } catch (error) {
    console.error('Failed to get hardware info:', error)
    // 如果获取失败，返回默认值
    return {
      gpu: {
        name: '获取失败',
        usage: 0,
        memoryUsed: 0,
        memoryTotal: 0,
        memoryPercent: 0,
        temp: 0
      },
      cpu: {
        name: '获取失败',
        usage: 0,
        cores: 0
      },
      memory: {
        used: 0,
        total: 0,
        percent: 0
      },
      disk: {
        free: 0
      }
    }
  }
})

// 启动训练任务
ipcMain.handle('training:start', async (event, config) => {
  console.log('Starting training with config:', config)
  
  try {
    const { taskId, dataYaml } = config
    
    // 创建事件处理器，转发训练事件到渲染进程
    const eventHandler = {
      onStatus: (data) => {
        mainWindow?.webContents.send('training:status', data)
      },
      onProgress: (data) => {
        mainWindow?.webContents.send('training:progress', data)
      },
      onComplete: (data) => {
        mainWindow?.webContents.send('training:complete', data)
      },
      onError: (data) => {
        mainWindow?.webContents.send('training:error', data)
      }
    }
    
    // 启动训练
    const result = await trainingController.startTraining(taskId, config, eventHandler)
    return result
    
  } catch (error) {
    console.error('Failed to start training:', error)
    return { success: false, error: error.message }
  }
})

// 暂停训练任务
ipcMain.handle('training:pause', async (event, taskId) => {
  console.log('Pausing training:', taskId)
  
  try {
    const result = await trainingController.pauseTraining(taskId)
    return result
  } catch (error) {
    console.error('Failed to pause training:', error)
    return { success: false, error: error.message }
  }
})

// 恢复训练任务
ipcMain.handle('training:resume', async (event, taskId, config) => {
  console.log('Resuming training:', taskId)
  
  try {
    // 创建事件处理器
    const eventHandler = {
      onStatus: (data) => {
        mainWindow?.webContents.send('training:status', data)
      },
      onProgress: (data) => {
        mainWindow?.webContents.send('training:progress', data)
      },
      onComplete: (data) => {
        mainWindow?.webContents.send('training:complete', data)
      },
      onError: (data) => {
        mainWindow?.webContents.send('training:error', data)
      }
    }
    
    const result = await trainingController.resumeTraining(taskId, config, eventHandler)
    return result
  } catch (error) {
    console.error('Failed to resume training:', error)
    return { success: false, error: error.message }
  }
})

// 停止训练任务
ipcMain.handle('training:stop', async (event, taskId) => {
  console.log('Stopping training:', taskId)
  
  try {
    const result = await trainingController.stopTraining(taskId)
    return result
  } catch (error) {
    console.error('Failed to stop training:', error)
    return { success: false, error: error.message }
  }
})

// 获取训练状态
ipcMain.handle('training:getStatus', async (event, taskId) => {
  console.log('Getting training status:', taskId)
  // TODO: 实现真实的状态获取
  return { status: 'running', progress: 50 }
})

// 列出所有训练任务
ipcMain.handle('training:listTasks', async () => {
  try {
    const workspacePath = getWorkspacePath()
    const historyPath = path.join(workspacePath, 'training_history.json')
    
    if (fsSync.existsSync(historyPath)) {
      const data = fsSync.readFileSync(historyPath, 'utf-8')
      return JSON.parse(data)
    }
    return []
  } catch (error) {
    console.error('Failed to load training history:', error)
    return []
  }
})

// 保存训练任务历史
ipcMain.handle('training:saveTasks', async (event, tasks) => {
  try {
    const workspacePath = getWorkspacePath()
    const historyPath = path.join(workspacePath, 'training_history.json')
    
    // 确保目录存在
    const dirPath = path.dirname(historyPath)
    if (!fsSync.existsSync(dirPath)) {
      fsSync.mkdirSync(dirPath, { recursive: true })
    }
    
    fsSync.writeFileSync(historyPath, JSON.stringify(tasks, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    console.error('Failed to save training history:', error)
    return { success: false, error: error.message }
  }
})

// 获取训练任务详情
ipcMain.handle('training:getTask', async (event, taskId) => {
  console.log('Getting task:', taskId)
  // TODO: 实现真实的任务详情获取
  return null
})

// 删除训练任务
ipcMain.handle('training:deleteTask', async (event, taskId) => {
  console.log('Deleting task:', taskId)
  // TODO: 实现真实的删除逻辑（删除输出文件等）
  return { success: true }
})

// 扫描预训练模型
ipcMain.handle('training:scanModels', async () => {
  try {
    // 扫描两个目录的模型文件
    const modelDirs = []
    
    // 1. 打包后：app.asar.unpacked/models
    if (app.isPackaged) {
      const packagedModelsDir = path.join(process.resourcesPath, 'app.asar.unpacked', 'models')
      if (fsSync.existsSync(packagedModelsDir)) {
        modelDirs.push(packagedModelsDir)
      }
    } else {
      // 开发环境：项目内 models 目录
      const devModelsDir = path.join(__dirname, '..', 'models')
      if (fsSync.existsSync(devModelsDir)) {
        modelDirs.push(devModelsDir)
      }
    }
    
    // 2. 用户自定义：D:\YoloMarkFlow\model
    const userModelsDir = path.join(getWorkspacePath(), 'model')
    if (fsSync.existsSync(userModelsDir)) {
      modelDirs.push(userModelsDir)
    }
    
    console.log('[ModelScanner] Scanning model directories:', modelDirs)
    
    const models = {
      versions: [],
      sizesByVersion: {}
    }
    
    // 扫描每个目录
    for (const modelDir of modelDirs) {
      try {
        const entries = await fs.readdir(modelDir, { withFileTypes: true })
        
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.pt')) {
            const fileName = entry.name.toLowerCase()
            
            // 解析模型文件名格式：yolo{version}{size}.pt
            // 例如：yolov8n.pt, yolo11s.pt, yolov5m.pt
            let version = null
            let size = null
            
            // 匹配 YOLOv5: yolov5{n|s|m|l|x}.pt
            if (fileName.match(/^yolov5([nslmx])\.pt$/)) {
              version = 'v5'
              size = fileName.match(/^yolov5([nslmx])\.pt$/)[1]
            }
            // 匹配 YOLOv8: yolov8{n|s|m|l|x}.pt
            else if (fileName.match(/^yolov8([nslmx])\.pt$/)) {
              version = 'v8'
              size = fileName.match(/^yolov8([nslmx])\.pt$/)[1]
            }
            // 匹配 YOLO11: yolo11{n|s|m|l|x}.pt
            else if (fileName.match(/^yolo11([nslmx])\.pt$/)) {
              version = 'v11'
              size = fileName.match(/^yolo11([nslmx])\.pt$/)[1]
            }
            
            if (version && size) {
              // 添加到版本列表
              if (!models.versions.includes(version)) {
                models.versions.push(version)
                models.sizesByVersion[version] = []
              }
              
              // 添加到尺寸列表
              if (!models.sizesByVersion[version].includes(size)) {
                models.sizesByVersion[version].push(size)
              }
              
              console.log(`[ModelScanner] Found model: ${entry.name} -> ${version}/${size}`)
            } else {
              console.warn(`[ModelScanner] Unknown model format: ${entry.name}`)
            }
          }
        }
      } catch (error) {
        console.error(`[ModelScanner] Failed to scan directory ${modelDir}:`, error)
      }
    }
    
    // 排序版本和尺寸
    models.versions.sort()
    for (const version of models.versions) {
      models.sizesByVersion[version].sort()
    }
    
    console.log('[ModelScanner] Scan complete:', models)
    return models
    
  } catch (error) {
    console.error('[ModelScanner] Failed to scan models:', error)
    return {
      versions: [],
      sizesByVersion: {}
    }
  }
})

// ========== 插件管理 ==========

// 获取所有插件
ipcMain.handle('plugin:getAll', async () => {
  try {
    const plugins = pluginManager.getAllPlugins()
    return { success: true, plugins }
  } catch (error) {
    console.error('[Plugin] Failed to get plugins:', error)
    return { success: false, error: error.message }
  }
})

// 获取单个插件
ipcMain.handle('plugin:get', async (event, pluginName) => {
  try {
    const plugin = pluginManager.getPlugin(pluginName)
    if (plugin) {
      return { success: true, plugin }
    } else {
      return { success: false, error: 'Plugin not found' }
    }
  } catch (error) {
    console.error('[Plugin] Failed to get plugin:', error)
    return { success: false, error: error.message }
  }
})

// 获取活动进程数
ipcMain.handle('plugin:getActiveProcessCount', async () => {
  try {
    const count = pluginManager.getActiveProcessCount()
    return { success: true, count }
  } catch (error) {
    console.error('[Plugin] Failed to get process count:', error)
    return { success: false, error: error.message }
  }
})

// 导入插件（支持 ZIP 和 RAR）
ipcMain.handle('plugin:importPlugin', async (event, pluginPackagePath) => {
  try {
    console.log('[Plugin] Importing plugin from:', pluginPackagePath)
    
    if (!fsSync.existsSync(pluginPackagePath)) {
      return { success: false, error: '插件包文件不存在' }
    }
    
    const ext = path.extname(pluginPackagePath).toLowerCase()
    const pluginsDir = pluginManager.pluginsDir
    
    // 确保插件目录存在
    if (!fsSync.existsSync(pluginsDir)) {
      fsSync.mkdirSync(pluginsDir, { recursive: true })
    }
    
    let pluginName = null
    let extractDir = null
    
    if (ext === '.zip') {
      // 解压 ZIP 文件
      let AdmZip
      try {
        AdmZip = require('adm-zip')
      } catch (error) {
        return { 
          success: false, 
          error: 'ZIP 解压功能需要 adm-zip 模块。请运行: npm install adm-zip --save' 
        }
      }
      
      const zip = new AdmZip(pluginPackagePath)
      
      // 检查 ZIP 是否为空
      const zipEntries = zip.getEntries()
      if (zipEntries.length === 0) {
        return { success: false, error: 'ZIP 文件为空' }
      }
      
      // 先解压到临时目录
      const tempExtractDir = path.join(pluginsDir, `.temp_extract_${Date.now()}`)
      zip.extractAllTo(tempExtractDir, true)
      
      // 检查临时目录中的内容
      const tempEntries = fsSync.readdirSync(tempExtractDir, { withFileTypes: true })
      
      // 如果只有一个子目录，使用该子目录名作为插件名
      if (tempEntries.length === 1 && tempEntries[0].isDirectory()) {
        pluginName = tempEntries[0].name
        extractDir = path.join(pluginsDir, pluginName)
        
        // 如果目录已存在，先删除（确保完全删除）
        if (fsSync.existsSync(extractDir)) {
          fsSync.rmSync(extractDir, { recursive: true, force: true })
          // Windows 上可能需要短暂等待
          if (process.platform === 'win32') {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        // 直接移动子目录到目标位置（尝试使用 copy 而不是 rename 以避免权限问题）
        try {
          fsSync.renameSync(path.join(tempExtractDir, pluginName), extractDir)
          // 删除临时目录（现在应该是空的）
          fsSync.rmdirSync(tempExtractDir)
        } catch (error) {
          // 如果 rename 失败，使用 copy + remove
          console.log('[Plugin] Rename failed, using copy instead:', error.message)
          fsSync.cpSync(path.join(tempExtractDir, pluginName), extractDir, { recursive: true })
          fsSync.rmSync(tempExtractDir, { recursive: true, force: true })
        }
        console.log('[Plugin] Extracted ZIP to:', extractDir)
      } else {
        // 没有统一根目录，使用文件名作为插件名
        pluginName = path.basename(pluginPackagePath, '.zip')
        extractDir = path.join(pluginsDir, pluginName)
        
        // 如果目录已存在，先删除（确保完全删除）
        if (fsSync.existsSync(extractDir)) {
          fsSync.rmSync(extractDir, { recursive: true, force: true })
          // Windows 上可能需要短暂等待
          if (process.platform === 'win32') {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        // 直接移动整个临时目录
        try {
          fsSync.renameSync(tempExtractDir, extractDir)
        } catch (error) {
          // 如果 rename 失败，使用 copy + remove
          console.log('[Plugin] Rename failed, using copy instead:', error.message)
          fsSync.cpSync(tempExtractDir, extractDir, { recursive: true })
          fsSync.rmSync(tempExtractDir, { recursive: true, force: true })
        }
        console.log('[Plugin] Extracted ZIP to:', extractDir)
      }
      
    } else if (ext === '.rar') {
      // 解压 RAR 文件（Windows 上使用 7-Zip 或 WinRAR）
      if (process.platform !== 'win32') {
        return { success: false, error: 'RAR 解压目前仅支持 Windows 系统' }
      }
      
      // 尝试使用 7-Zip
      const sevenZipPaths = [
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe'
      ]
      
      let sevenZipExe = null
      for (const p of sevenZipPaths) {
        if (fsSync.existsSync(p)) {
          sevenZipExe = p
          break
        }
      }
      
      // 如果找不到 7-Zip，尝试使用 WinRAR
      let winrarExe = null
      if (!sevenZipExe) {
        const winrarPaths = [
          'C:\\Program Files\\WinRAR\\WinRAR.exe',
          'C:\\Program Files (x86)\\WinRAR\\WinRAR.exe'
        ]
        for (const p of winrarPaths) {
          if (fsSync.existsSync(p)) {
            winrarExe = p
            break
          }
        }
      }
      
      if (!sevenZipExe && !winrarExe) {
        return { 
          success: false, 
          error: '未找到 7-Zip 或 WinRAR。请安装 7-Zip 或 WinRAR 以支持 RAR 文件解压。' 
        }
      }
      
      // 先解压到临时目录
      const tempExtractDir = path.join(pluginsDir, `.temp_extract_${Date.now()}`)
      fsSync.mkdirSync(tempExtractDir, { recursive: true })
      
      // 解压 RAR
      if (sevenZipExe) {
        // 使用 7-Zip
        const { execSync } = require('child_process')
        execSync(`"${sevenZipExe}" x "${pluginPackagePath}" -o"${tempExtractDir}" -y`, {
          stdio: 'ignore',
          windowsHide: true
        })
        console.log('[Plugin] Extracted RAR using 7-Zip to:', tempExtractDir)
      } else if (winrarExe) {
        // 使用 WinRAR
        const { execSync } = require('child_process')
        // WinRAR 使用 -ibck 参数后台运行（不显示UI）
        execSync(`"${winrarExe}" x -y -ibck "${pluginPackagePath}" "${tempExtractDir}"`, {
          stdio: 'ignore',
          windowsHide: true
        })
        console.log('[Plugin] Extracted RAR using WinRAR to:', tempExtractDir)
      }
      
      // 检查临时目录中的内容
      const tempEntries = fsSync.readdirSync(tempExtractDir, { withFileTypes: true })
      
      // 如果只有一个子目录，使用该子目录名作为插件名
      if (tempEntries.length === 1 && tempEntries[0].isDirectory()) {
        pluginName = tempEntries[0].name
        extractDir = path.join(pluginsDir, pluginName)
        
        // 如果目录已存在，先删除（确保完全删除）
        if (fsSync.existsSync(extractDir)) {
          fsSync.rmSync(extractDir, { recursive: true, force: true })
          // Windows 上可能需要短暂等待
          if (process.platform === 'win32') {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        // 直接移动子目录到目标位置（尝试使用 copy 而不是 rename 以避免权限问题）
        try {
          fsSync.renameSync(path.join(tempExtractDir, pluginName), extractDir)
          // 删除临时目录（现在应该是空的）
          fsSync.rmdirSync(tempExtractDir)
        } catch (error) {
          // 如果 rename 失败，使用 copy + remove
          console.log('[Plugin] Rename failed, using copy instead:', error.message)
          fsSync.cpSync(path.join(tempExtractDir, pluginName), extractDir, { recursive: true })
          fsSync.rmSync(tempExtractDir, { recursive: true, force: true })
        }
        console.log('[Plugin] Extracted RAR to:', extractDir)
      } else {
        // 没有统一根目录，使用文件名作为插件名
        pluginName = path.basename(pluginPackagePath, '.rar')
        extractDir = path.join(pluginsDir, pluginName)
        
        // 如果目录已存在，先删除（确保完全删除）
        if (fsSync.existsSync(extractDir)) {
          fsSync.rmSync(extractDir, { recursive: true, force: true })
          // Windows 上可能需要短暂等待
          if (process.platform === 'win32') {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        // 直接移动整个临时目录
        try {
          fsSync.renameSync(tempExtractDir, extractDir)
        } catch (error) {
          // 如果 rename 失败，使用 copy + remove
          console.log('[Plugin] Rename failed, using copy instead:', error.message)
          fsSync.cpSync(tempExtractDir, extractDir, { recursive: true })
          fsSync.rmSync(tempExtractDir, { recursive: true, force: true })
        }
        console.log('[Plugin] Extracted RAR to:', extractDir)
      }
    } else {
      return { success: false, error: `不支持的文件格式: ${ext}。仅支持 ZIP 和 RAR 格式。` }
    }
    
    // 重新加载插件
    pluginManager.loadPlugins()
    
    // 验证插件是否成功加载
    // 首先尝试使用目录名查找
    let loadedPlugin = pluginManager.getPlugin(pluginName)
    
    // 如果找不到，尝试从 plugin.json 读取实际名称
    if (!loadedPlugin) {
      try {
        const pluginJsonPath = path.join(extractDir, 'plugin.json')
        if (fsSync.existsSync(pluginJsonPath)) {
          const pluginJson = JSON.parse(fsSync.readFileSync(pluginJsonPath, 'utf-8'))
          const actualPluginName = pluginJson.name
          if (actualPluginName) {
            loadedPlugin = pluginManager.getPlugin(actualPluginName)
            if (loadedPlugin) {
              pluginName = actualPluginName
            }
          }
        }
      } catch (error) {
        console.error('[Plugin] Failed to read plugin.json:', error)
      }
    }
    
    if (loadedPlugin) {
      return { 
        success: true, 
        pluginName: pluginName,
        pluginPath: extractDir 
      }
    } else {
      return { 
        success: false, 
        error: '插件解压成功，但加载失败。请检查 plugin.json 文件是否存在且格式正确。' 
      }
    }
  } catch (error) {
    console.error('[Plugin] Failed to import plugin:', error)
    return { success: false, error: error.message || '导入插件失败' }
  }
})

// ========== Python环境管理 ==========

// GPU检测函数（共享）
async function detectGPU() {
  try {
    console.log('[GPU Detection] Starting NVIDIA GPU detection...')
    
    // Windows下查询GPU名称和驱动版本（不查CUDA版本，因为该字段不支持）（异步）
    const { stdout: output } = await execAsync('nvidia-smi --query-gpu=name,driver_version --format=csv,noheader', {
      encoding: 'utf8',
      timeout: 5000
    })
    
    console.log('[GPU Detection] nvidia-smi output:', output)
    
    const lines = output.trim().split('\n')
    if (lines.length > 0) {
      const [name, driver] = lines[0].split(',').map(s => s.trim())
      
      // 尝试获取CUDA版本（单独查询）（异步）
      let cudaVersion = null
      try {
        const { stdout: cudaOutput } = await execAsync('nvcc --version', {
          encoding: 'utf8',
          timeout: 3000
        })
        const cudaMatch = cudaOutput.match(/release (\d+\.\d+)/)
        if (cudaMatch) {
          cudaVersion = cudaMatch[1]
        }
      } catch (cudaError) {
        console.log('[GPU Detection] Could not detect CUDA version (nvcc not found)')
      }
      
      const result = {
        hasNvidiaGPU: true,
        type: 'nvidia',
        name: name,
        driver: driver,
        cudaVersion: cudaVersion || 'Unknown'
      }
      
      console.log('[GPU Detection] NVIDIA GPU detected:', result)
      return result
    }
  } catch (error) {
    console.error('[GPU Detection] Failed to detect NVIDIA GPU:', error.message)
    if (error.stdout) {
      console.error('[GPU Detection] stdout:', error.stdout)
    }
    if (error.stderr) {
      console.error('[GPU Detection] stderr:', error.stderr)
    }
  }
  
  console.log('[GPU Detection] Falling back to CPU mode')
  return {
    hasNvidiaGPU: false,
    type: 'cpu'
  }
}

// 检测GPU类型IPC接口
ipcMain.handle('python:detectGPU', async () => {
  return detectGPU()
})


// ========== 模型管理 IPC ==========

// 打开模型输出目录
ipcMain.handle('model:openFolder', async (event, folderPath) => {
  try {
    if (folderPath && fsSync.existsSync(folderPath)) {
      await shell.openPath(folderPath)
      return { success: true }
    } else {
      return { success: false, error: '目录不存在' }
    }
  } catch (error) {
    console.error('Failed to open folder:', error)
    return { success: false, error: error.message }
  }
})

// 导出模型文件
ipcMain.handle('model:export', async (event, sourcePath, modelName) => {
  try {
    // 检查源目录是否存在
    if (!fsSync.existsSync(sourcePath)) {
      return { success: false, error: '模型目录不存在' }
    }
    
    // 打开保存对话框
    const result = await dialog.showSaveDialog({
      title: '导出模型',
      defaultPath: `${modelName}.zip`,
      filters: [
        { name: '压缩文件', extensions: ['zip'] }
      ]
    })
    
    if (result.canceled) {
      return { success: false, error: 'canceled' }
    }
    
    const outputPath = result.filePath
    
    // TODO: 实现压缩功能
    // 这里暂时返回成功，实际需要使用zip库压缩模型文件
    return {
      success: true,
      message: '导出功能开发中，将在后续版本实现',
      path: outputPath
    }
  } catch (error) {
    console.error('Failed to export model:', error)
    return { success: false, error: error.message }
  }
})

// 获取模型文件信息
ipcMain.handle('model:getInfo', async (event, modelPath) => {
  try {
    if (!fsSync.existsSync(modelPath)) {
      return { success: false, error: '模型路径不存在' }
    }
    
    // 查找weights目录下的best.pt和last.pt
    const weightsDir = path.join(modelPath, 'weights')
    const modelInfo = {
      hasBestModel: false,
      hasLastModel: false,
      bestModelPath: null,
      lastModelPath: null,
      bestModelSize: 0,
      lastModelSize: 0
    }
    
    if (fsSync.existsSync(weightsDir)) {
      const bestPath = path.join(weightsDir, 'best.pt')
      const lastPath = path.join(weightsDir, 'last.pt')
      
      if (fsSync.existsSync(bestPath)) {
        const stats = fsSync.statSync(bestPath)
        modelInfo.hasBestModel = true
        modelInfo.bestModelPath = bestPath
        modelInfo.bestModelSize = stats.size
      }
      
      if (fsSync.existsSync(lastPath)) {
        const stats = fsSync.statSync(lastPath)
        modelInfo.hasLastModel = true
        modelInfo.lastModelPath = lastPath
        modelInfo.lastModelSize = stats.size
      }
    }
    
    return { success: true, data: modelInfo }
  } catch (error) {
    console.error('Failed to get model info:', error)
    return { success: false, error: error.message }
  }
})

// 模型评估
ipcMain.handle('model:evaluate', async (event, task) => {
  try {
    console.log('[Model] Evaluate model:', task.name)
    
    const { outputPath, metrics, charts } = task
    
    // 检查输出目录是否存在
    if (!outputPath || !fsSync.existsSync(outputPath)) {
      return { success: false, error: '模型输出目录不存在' }
    }
    
    // 读取results.csv文件
    const resultsPath = path.join(outputPath, 'results.csv')
    let detailedResults = null
    
    if (fsSync.existsSync(resultsPath)) {
      try {
        const csvContent = fsSync.readFileSync(resultsPath, 'utf-8')
        detailedResults = parseCSV(csvContent)
        console.log(`[Model] Loaded ${detailedResults.length} rows from results.csv`)
      } catch (csvError) {
        console.warn('[Model] Failed to parse results.csv:', csvError.message)
      }
    }
    
    // 检查可视化图表
    const chartsAvailable = {
      results: fsSync.existsSync(path.join(outputPath, 'results.png')),
      confusion: fsSync.existsSync(path.join(outputPath, 'confusion_matrix.png')),
      pr: fsSync.existsSync(path.join(outputPath, 'PR_curve.png'))
    }
    
    console.log('[Model] Charts available:', chartsAvailable)
    
    return {
      success: true,
      data: {
        metrics: metrics || {},
        charts: charts || {},
        detailedResults,
        chartsAvailable,
        outputPath
      }
    }
  } catch (error) {
    console.error('[Model] Failed to evaluate model:', error)
    return { success: false, error: error.message }
  }
})

// 模型推理 - 使用常驻推理服务
ipcMain.handle('model:inference', async (event, { modelPath, imagePath, confThreshold }) => {
  try {
    console.log('[Model Inference] Starting inference:', { modelPath, imagePath })
    
    // 检查模型文件
    const bestModelPath = path.join(modelPath, 'weights', 'best.pt')
    if (!fsSync.existsSync(bestModelPath)) {
      return { success: false, error: '模型文件不存在' }
    }
    
    // 检查图片文件
    if (!fsSync.existsSync(imagePath)) {
      return { success: false, error: '图片文件不存在' }
    }
    
    const threshold = confThreshold || 0.25
    
    // 使用推理服务（常驻进程，模型缓存）
    const result = await inferenceService.inference(bestModelPath, imagePath, threshold)
    
    console.log('[Model Inference] Result:', result.success ? `${result.count} predictions` : result.error)
    
    return result
    
  } catch (error) {
    console.error('[Model Inference] Failed:', error)
    return { 
      success: false, 
      error: error.message || '推理失败' 
    }
  }
})

// 卸载指定模型
ipcMain.handle('model:unloadModel', async (event, modelPath) => {
  try {
    const bestModelPath = path.join(modelPath, 'weights', 'best.pt')
    await inferenceService.unloadModel(bestModelPath)
    return { success: true }
  } catch (error) {
    console.error('[Model] Failed to unload model:', error)
    return { success: false, error: error.message }
  }
})

// 清空所有已加载的模型
ipcMain.handle('model:clearModels', async () => {
  try {
    await inferenceService.clearModels()
    // 停止推理服务以释放内存
    await inferenceService.stop()
    return { success: true }
  } catch (error) {
    console.error('[Model] Failed to clear models:', error)
    return { success: false, error: error.message }
  }
})

/**
 * CSV解析辅助函数
 */
function parseCSV(content) {
  const lines = content.trim().split('\n')
  if (lines.length === 0) return []
  
  const headers = lines[0].split(',').map(h => h.trim())
  
  return lines.slice(1).map(line => {
    const values = line.split(',')
    const obj = {}
    headers.forEach((h, i) => {
      const value = values[i]?.trim()
      // 尝试转换为数字，失败则保留原字符串
      obj[h] = !isNaN(parseFloat(value)) ? parseFloat(value) : value
    })
    return obj
  })
}

/**
 * 加载Python环境配置
 */
function loadPythonEnvConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'python_env_config.json')
    if (fsSync.existsSync(configPath)) {
      return JSON.parse(fsSync.readFileSync(configPath, 'utf-8'))
    }
  } catch (error) {
    console.error('Failed to load Python env config:', error)
  }
  return null
}

/**
 * 初始化YoloMarkFlow基础目录结构
 * 确保所有必要的目录在应用启动时都存在
 */
function initializeWorkspaceDirectories() {
  const basePath = getWorkspacePath() // D:\YoloMarkFlow
  
  const directories = [
    basePath,                                              // 基础目录
    path.join(basePath, 'YoloMarkFlow_ImagePool'),       // 图片池
    path.join(basePath, 'YoloMarkFlow_trainOut'),        // 训练输出
    path.join(basePath, 'YoloMarkFlow_DatabaseOut'),     // 数据集导出
    path.join(basePath, 'model')                         // 预训练模型
  ]
  
  console.log('[Init] Initializing YoloMarkFlow workspace directories...')
  
  directories.forEach(dir => {
    try {
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true })
        console.log(`[Init] Created directory: ${dir}`)
      } else {
        console.log(`[Init] Directory already exists: ${dir}`)
      }
    } catch (error) {
      console.error(`[Init] Failed to create directory ${dir}:`, error.message)
    }
  })
  
  console.log('[Init] Workspace directories initialization complete')
}

app.whenReady().then(() => {
  // 初始化日志系统（最优先，这样后续所有日志都能记录）
  initializeLogger()
  
  // 初始化插件管理器
  pluginManager.initialize()
  
  // 初始化基础目录
  initializeWorkspaceDirectories()
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

let isQuitting = false

/**
 * 优雅关闭 - 清理所有资源
 */
async function gracefulShutdown() {
  if (isQuitting) {
    return
  }
  
  isQuitting = true
  console.log('[Main] Starting graceful shutdown...')
  
  try {
    // 1. 停止训练控制器
    console.log('[Main] Stopping training controller...')
    await trainingController.shutdown()
    
    // 2. 停止推理服务
    console.log('[Main] Stopping inference service...')
    await inferenceService.stop()
    
    // 3. 清理插件管理器中的所有进程
    console.log('[Main] Shutting down plugin manager...')
    await pluginManager.shutdown()
    
    // 4. 关闭所有数据库连接
    console.log('[Main] Closing database connections...')
    for (const [dbPath, db] of dbInstances.entries()) {
      try {
        await new Promise((resolve, reject) => {
          db.close((err) => {
            if (err) reject(err)
            else resolve()
          })
        })
        console.log(`[Main] Closed database: ${dbPath}`)
      } catch (error) {
        console.error(`[Main] Error closing database ${dbPath}:`, error)
      }
    }
    dbInstances.clear()
    
    // 5. 清理日志系统
    console.log('[Main] Cleaning up logger...')
    cleanupLogger()
    
    console.log('[Main] Graceful shutdown complete')
  } catch (error) {
    console.error('[Main] Error during shutdown:', error)
  }
}

app.on('window-all-closed', async () => {
  await gracefulShutdown()
  
  if (process.platform !== 'darwin') {
    app.exit(0)
  }
})

// 应用退出前清理
app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault()
    await gracefulShutdown()
    app.exit(0)
  }
})

app.on('will-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault()
    await gracefulShutdown()
  }
})

// 捕获未处理的退出信号
process.on('SIGINT', async () => {
  console.log('[Main] Received SIGINT')
  await gracefulShutdown()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('[Main] Received SIGTERM')
  await gracefulShutdown()
  process.exit(0)
})

