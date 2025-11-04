// Electron Preload Script
// 用于在渲染进程和主进程之间建立安全的通信桥梁

const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),
  selectDirectory: (options) => ipcRenderer.invoke('dialog:selectDirectory', options),
  
  // 项目管理
  selectProjectDirectory: () => ipcRenderer.invoke('project:selectDirectory'),
  createProjectDirectory: (path) => ipcRenderer.invoke('project:createDirectory', path),
  writeProjectConfig: (path, config) => ipcRenderer.invoke('project:writeConfig', path, config),
  readProjectConfig: (path) => ipcRenderer.invoke('project:readConfig', path),
  checkProjectExists: (path) => ipcRenderer.invoke('project:checkExists', path),
  deleteProject: (path) => ipcRenderer.invoke('project:delete', path),
  findAllProjects: () => ipcRenderer.invoke('project:findAll'),
  findAllDatasets: () => ipcRenderer.invoke('dataset:findAll'),
  getDefaultProjectPath: (projectName) => ipcRenderer.invoke('project:getDefaultPath', projectName),
  saveProjectWorkspaceState: (projectPath, state) => ipcRenderer.invoke('save-project-workspace-state', projectPath, state),
  loadProjectWorkspaceState: (projectPath) => ipcRenderer.invoke('load-project-workspace-state', projectPath),
  
  // 项目操作
  project: {
    removeImage: (params) => ipcRenderer.invoke('project:removeImage', params),
    register: (projectPath) => ipcRenderer.invoke('project:register', projectPath),
    unregister: (projectPath) => ipcRenderer.invoke('project:unregister', projectPath),
    getAllRegistered: () => ipcRenderer.invoke('project:getAllRegistered')
  },
  
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  readUserManual: () => ipcRenderer.invoke('app:readUserManual'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  
  // 图片管理
  selectImageFiles: () => ipcRenderer.invoke('images:selectFiles'),
  selectImageDirectory: () => ipcRenderer.invoke('images:selectDirectory'),
  copyImagesToProject: (sourceFiles, projectPath) => ipcRenderer.invoke('images:copyToProject', sourceFiles, projectPath),
  scanImageDirectory: (dirPath, extensions) => ipcRenderer.invoke('images:scanDirectory', dirPath, extensions),
  listProjectImages: (projectPath) => ipcRenderer.invoke('images:listProjectImages', projectPath),
  
  // 数据库管理
  openDatabase: (dbPath) => ipcRenderer.invoke('database:open', dbPath),
  closeDatabase: (dbPath) => ipcRenderer.invoke('database:close', dbPath),
  closeAllDatabases: () => ipcRenderer.invoke('database:closeAll'),
  execSQL: (dbPath, sql) => ipcRenderer.invoke('database:exec', dbPath, sql),
  querySQL: (dbPath, sql, params) => ipcRenderer.invoke('database:all', dbPath, sql, params),
  allSQL: (dbPath, sql, params) => ipcRenderer.invoke('database:all', dbPath, sql, params),
  runSQL: (dbPath, sql, params) => ipcRenderer.invoke('database:run', dbPath, sql, params),
  
  // 工作空间管理
  getWorkspacePath: () => ipcRenderer.invoke('workspace:getPath'),
  ensureDirectory: (dirPath) => ipcRenderer.invoke('workspace:ensureDirectory', dirPath),
  
  // 目录操作
  copyDirectory: (sourcePath, destPath) => ipcRenderer.invoke('directory:copy', sourcePath, destPath),
  getDirectorySize: (dirPath) => ipcRenderer.invoke('directory:getSize', dirPath),
  directoryExists: (dirPath) => ipcRenderer.invoke('directory:exists', dirPath),
  directoryIsEmpty: (dirPath) => ipcRenderer.invoke('directory:isEmpty', dirPath),
  listDirectory: (dirPath) => ipcRenderer.invoke('directory:list', dirPath),
  deleteDirectory: (dirPath) => ipcRenderer.invoke('directory:delete', dirPath),
  
  // 文件操作
  calculateFileHash: (filePath) => ipcRenderer.invoke('file:calculateHash', filePath),
  copyToImagePool: (sourceFile, destFile) => ipcRenderer.invoke('file:copyToImagePool', sourceFile, destFile),
  getImagePoolPath: (filename, customWorkspacePath) => ipcRenderer.invoke('file:getImagePoolPath', filename, customWorkspacePath),
  fileExists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
  getFileInfo: (filePath) => ipcRenderer.invoke('file:getInfo', filePath),
  copyFile: (sourcePath, destPath) => ipcRenderer.invoke('file:copy', sourcePath, destPath),
  moveFile: (sourcePath, destPath) => ipcRenderer.invoke('file:move', sourcePath, destPath),
  deleteFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),
  readJSON: (filePath) => ipcRenderer.invoke('file:readJSON', filePath),
  readText: (filePath) => ipcRenderer.invoke('file:readText', filePath),
  writeJSON: (filePath, data) => ipcRenderer.invoke('file:writeJSON', filePath, data),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:writeFile', filePath, content),
  listFiles: (dirPath) => ipcRenderer.invoke('file:listFiles', dirPath),
  selectFile: (options) => ipcRenderer.invoke('dialog:selectFile', options),
  selectFiles: (options) => ipcRenderer.invoke('dialog:selectFiles', options),
  
  // 图片池
  initImagePool: (customWorkspacePath) => ipcRenderer.invoke('imagePool:init', customWorkspacePath),
  imagePool: {
    checkImageReferences: (imageId) => ipcRenderer.invoke('imagePool:checkImageReferences', imageId),
    deleteImage: (imageId, workspacePath) => ipcRenderer.invoke('imagePool:deleteImage', imageId, workspacePath)
  },
  
  // 训练管理
  training: {
    start: (config) => ipcRenderer.invoke('training:start', config),
    pause: (taskId) => ipcRenderer.invoke('training:pause', taskId),
    resume: (taskId, config) => ipcRenderer.invoke('training:resume', taskId, config),
    stop: (taskId) => ipcRenderer.invoke('training:stop', taskId),
    getStatus: (taskId) => ipcRenderer.invoke('training:getStatus', taskId),
    listTasks: () => ipcRenderer.invoke('training:listTasks'),
    saveTasks: (tasks) => ipcRenderer.invoke('training:saveTasks', tasks),
    getTask: (taskId) => ipcRenderer.invoke('training:getTask', taskId),
    deleteTask: (taskId) => ipcRenderer.invoke('training:deleteTask', taskId),
    scanModels: () => ipcRenderer.invoke('training:scanModels'),
    // 事件监听
    onStatus: (callback) => ipcRenderer.on('training:status', (event, data) => callback(data)),
    onProgress: (callback) => ipcRenderer.on('training:progress', (event, data) => callback(data)),
    onComplete: (callback) => ipcRenderer.on('training:complete', (event, data) => callback(data)),
    onError: (callback) => ipcRenderer.on('training:error', (event, data) => callback(data))
  },
  
  // 模型管理
  model: {
    openFolder: (folderPath) => ipcRenderer.invoke('model:openFolder', folderPath),
    export: (sourcePath, modelName) => ipcRenderer.invoke('model:export', sourcePath, modelName),
    getInfo: (modelPath) => ipcRenderer.invoke('model:getInfo', modelPath),
    evaluate: (task) => ipcRenderer.invoke('model:evaluate', task),
    inference: (params) => ipcRenderer.invoke('model:inference', params),
    unloadModel: (modelPath) => ipcRenderer.invoke('model:unloadModel', modelPath),
    clearModels: () => ipcRenderer.invoke('model:clearModels')
  },
  
  // 系统信息
  system: {
    getHardwareInfo: () => ipcRenderer.invoke('system:getHardwareInfo'),
    getPlatform: () => process.platform,
    getVersion: () => process.versions.electron
  },
  
  // Python环境管理
  pythonEnv: {
    detectGPU: () => ipcRenderer.invoke('python:detectGPU')
  },
  
  // 插件管理
  plugin: {
    getAll: () => ipcRenderer.invoke('plugin:getAll'),
    get: (pluginName) => ipcRenderer.invoke('plugin:get', pluginName),
    getActiveProcessCount: () => ipcRenderer.invoke('plugin:getActiveProcessCount'),
    importPlugin: (pluginPackagePath) => ipcRenderer.invoke('plugin:importPlugin', pluginPackagePath)
  },
  
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  
  // 保留原始的系统信息方法以保持兼容性
  getPlatform: () => process.platform,
  getVersion: () => process.versions.electron,
  
  // 自定义事件监听
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args))
  },
  
  // 移除事件监听
  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback)
  }
})

