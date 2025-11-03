<template>
  <div class="page-container">
    <div class="page-header">
      <h2>设置</h2>
      <p class="page-description">应用的全局设置</p>
    </div>
    <div class="page-content">
      <div class="settings-section">
        <h3>通用设置</h3>
        <el-form label-width="120px">
          <el-form-item label="主题">
            <el-select v-model="theme" @change="handleThemeChange" placeholder="选择主题">
              <el-option label="浅色" value="light" />
              <el-option label="深色" value="dark" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <div class="settings-section">
        <h3>路径设置</h3>
        <el-form label-width="120px">
          <el-form-item label="图片池路径">
            <div class="path-selector">
              <el-input 
                v-model="imagePoolPath" 
                readonly 
                placeholder="默认路径：用户文档/annotation_workspace" />
              <el-button 
                type="primary" 
                size="small" 
                @click="selectImagePoolPath"
                style="margin-left: 8px;">
                选择目录
              </el-button>
              <el-button 
                size="small" 
                @click="resetImagePoolPath"
                style="margin-left: 8px;">
                恢复默认
              </el-button>
            </div>
            <div class="form-item-tip">
              图片池用于统一存储所有项目的图片文件，支持自动去重。
              <span v-if="imagePoolPathChanged" class="warning-text">
                ⚠️ 更改路径需要重启应用生效
              </span>
            </div>
          </el-form-item>
          <el-form-item label="当前占用">
            <div class="storage-info">
              <span>图片数量：{{ poolStats.imageCount || 0 }} 张</span>
              <span style="margin-left: 16px;">磁盘占用：{{ poolStats.diskUsage || '计算中...' }}</span>
              <el-button 
                size="small" 
                type="info" 
                plain
                :loading="refreshing"
                :disabled="refreshing"
                @click="refreshPoolStats"
                style="margin-left: 16px;">
                {{ refreshing ? '刷新中...' : '刷新' }}
              </el-button>
            </div>
          </el-form-item>
          
          <el-form-item label="默认导出路径">
            <div class="path-selector">
              <el-input 
                v-model="exportPath" 
                readonly 
                placeholder="D:\YoloMarkFlow\YoloMarkFlow_DatabaseOut" />
              <el-button 
                type="primary" 
                size="small" 
                @click="selectExportPath"
                style="margin-left: 8px;">
                选择目录
              </el-button>
              <el-button 
                size="small" 
                @click="resetExportPath"
                style="margin-left: 8px;">
                恢复默认
              </el-button>
            </div>
            <div class="form-item-tip">
              导出数据集时将默认使用此路径，您仍可在导出时修改。
            </div>
          </el-form-item>

          <el-form-item label="模型下载目录">
            <div class="path-selector">
              <el-input 
                v-model="modelDownloadPath" 
                readonly 
                placeholder="D:\YoloMarkFlow\model" />
              <el-button 
                type="primary" 
                size="small" 
                @click="selectModelDownloadPath"
                style="margin-left: 8px;">
                选择目录
              </el-button>
              <el-button 
                size="small" 
                @click="resetModelDownloadPath"
                style="margin-left: 8px;">
                恢复默认
              </el-button>
            </div>
            <div class="form-item-tip">
              预训练模型权重文件将下载到此目录，可节省重复下载时间。
            </div>
          </el-form-item>
        </el-form>
      </div>

      <div class="settings-section">
        <h3>插件管理</h3>
        
        <!-- 导入插件 -->
        <div style="margin-bottom: 20px;">
          <el-button 
            type="primary" 
            :loading="importingPlugin"
            @click="showImportPluginDialog">
            <el-icon><Upload /></el-icon>
            <span style="margin-left: 4px;">导入插件</span>
          </el-button>
          <div class="form-item-tip" style="margin-top: 8px;">
            支持导入 ZIP 或 RAR 格式的插件包，将自动解压到插件目录
          </div>
        </div>

        <!-- 插件信息 -->
        <div class="plugin-info-card">
          <div class="plugin-header">
            <h4>已安装插件</h4>
            <el-button 
              size="small" 
              type="primary" 
              plain
              :loading="loadingPlugins"
              @click="loadPlugins">
              {{ loadingPlugins ? '加载中...' : '刷新' }}
            </el-button>
          </div>
          
          <div v-if="plugins.length > 0" class="plugins-list">
            <div v-for="plugin in plugins" :key="plugin.name" class="plugin-item">
              <div class="plugin-main-info">
                <div class="plugin-icon">
                  <el-icon size="24" color="#409eff"><Box /></el-icon>
                </div>
                <div class="plugin-details">
                  <div class="plugin-name">{{ plugin.displayName || plugin.name }}</div>
                  <div class="plugin-meta">
                    <el-tag size="small" type="info">v{{ plugin.version }}</el-tag>
                    <el-tag size="small" type="success" v-if="plugin.metadata?.type === 'official'">官方</el-tag>
                    <span class="plugin-path-label">{{ plugin.path }}</span>
                  </div>
                  <div class="plugin-description" v-if="plugin.metadata?.description">
                    {{ plugin.metadata.description }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="no-plugins">
            <el-empty description="未检测到插件" :image-size="60">
              <template #image>
                <el-icon size="60" color="#909399"><Box /></el-icon>
              </template>
            </el-empty>
          </div>
          
          <div class="plugin-stats" v-if="plugins.length > 0">
            <div class="stat-item">
              <span class="stat-label">活动进程:</span>
              <span class="stat-value">{{ activeProcessCount }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessageBox } from 'element-plus'
import { Box, Upload } from '@element-plus/icons-vue'
import { getTheme, setTheme } from '../utils/theme'
import toast from '../utils/toast'

export default {
  name: 'Settings',
  components: {
    Box,
    Upload
  },
  data() {
    return {
      theme: 'light',
      autoSave: true,
      imagePoolPath: '',
      originalImagePoolPath: '',
      imagePoolPathChanged: false,
      exportPath: '',
      modelDownloadPath: '',
      poolStats: {
        imageCount: 0,
        diskUsage: '计算中...'
      },
      refreshing: false,
      // 插件相关
      plugins: [],
      loadingPlugins: false,
      activeProcessCount: 0,
      importingPlugin: false
    }
  },
  async mounted() {
    // 同步加载设置（快速操作，不会阻塞）
    await this.loadSettings()
    
    // 使用 nextTick + setTimeout 确保页面完全渲染后再执行耗时操作
    this.$nextTick(() => {
      setTimeout(() => {
        // 异步加载统计信息（不阻塞页面渲染）
        this.refreshPoolStats().catch(err => {
          console.error('Failed to refresh pool stats:', err)
        })
        
        // 加载插件信息
        this.loadPlugins().catch(err => {
          console.error('Failed to load plugins:', err)
        })
      }, 0)
    })
    
    // 监听主题变化（从其他地方切换主题时同步）
    this.themeObserver = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light'
      if (this.theme !== currentTheme) {
        this.theme = currentTheme
      }
    })
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
    
  },
  beforeUnmount() {
    // 清理观察器
    if (this.themeObserver) {
      this.themeObserver.disconnect()
    }
  },
  methods: {
    async loadSettings() {
      // 加载主题设置（优先从DOM读取，确保与实际显示一致）
      const domTheme = document.documentElement.getAttribute('data-theme') || 'light'
      const savedTheme = getTheme()
      this.theme = domTheme
      
      // 确保主题同步
      if (domTheme !== savedTheme) {
        localStorage.setItem('theme', domTheme)
      }
      
      // 加载导出路径配置
      const savedExportPath = localStorage.getItem('defaultExportPath')
      this.exportPath = savedExportPath || 'D:\\YoloMarkFlow\\YoloMarkFlow_DatabaseOut'
      
      // 加载模型下载路径配置
      const savedModelPath = localStorage.getItem('modelDownloadPath')
      this.modelDownloadPath = savedModelPath || 'D:\\YoloMarkFlow\\model'
      
      // 加载图片池路径配置
      const savedPath = localStorage.getItem('imagePoolPath')
      if (savedPath) {
        this.imagePoolPath = savedPath
        this.originalImagePoolPath = savedPath
      } else {
        // 使用新的默认路径
        const defaultImagePoolPath = 'D:\\YoloMarkFlow\\YoloMarkFlow_ImagePool'
        this.imagePoolPath = defaultImagePoolPath
        this.originalImagePoolPath = defaultImagePoolPath
      }
    },
    
    handleThemeChange(newTheme) {
      // 设置主题（会自动保存到localStorage并应用到DOM）
      setTheme(newTheme)
      
      // 确保数据与DOM同步
      this.theme = newTheme
      
      toast.success(`已切换为${newTheme === 'dark' ? '深色' : '浅色'}主题`)
    },
    
    async selectExportPath() {
      let newPath = null
      try {
        const result = await window.electronAPI.selectDirectory({
          title: '选择默认导出目录'
        })
        if (!result.success || !result.directory) {
          return
        }
        
        newPath = result.directory
        
        // 检查新路径是否与当前路径相同
        if (newPath === this.exportPath) {
          toast.info('选择的路径与当前路径相同')
          return
        }
        
        // 检查旧路径是否有数据
        const oldPath = this.exportPath
        if (oldPath && oldPath !== newPath) {
          const dirExists = await window.electronAPI.directoryExists(oldPath)
          if (dirExists.exists) {
            // 检查目录是否有内容
            const listResult = await window.electronAPI.listDirectory(oldPath)
            const hasData = listResult.success && listResult.entries && listResult.entries.length > 0
            
            if (hasData) {
              // 有数据，必须迁移
              await ElMessageBox.confirm(
                `检测到旧导出路径下有数据。\n\n旧路径：${oldPath}\n新路径：${newPath}\n\n是否迁移所有导出的数据集到新路径？`,
                '确认迁移数据',
                {
                  confirmButtonText: '确定迁移',
                  cancelButtonText: '仅更改路径',
                  distinguishCancelAndClose: true,
                  type: 'warning'
                }
              )
              
              // 执行迁移
              const migrateMsg = toast.loading('正在迁移导出数据...')
              try {
                const copyResult = await window.electronAPI.copyDirectory(oldPath, newPath)
                migrateMsg()
                
                if (copyResult.success) {
                  toast.success('数据迁移完成！')
                } else {
                  throw new Error(copyResult.error || '迁移失败')
                }
              } catch (error) {
                migrateMsg()
                throw error
              }
            }
          }
        }
        
        this.exportPath = newPath
        localStorage.setItem('defaultExportPath', newPath)
        toast.success('默认导出路径已更新')
        
      } catch (error) {
        if (error !== 'cancel' && error !== 'close') {
          console.error('选择导出路径失败:', error)
          toast.error('更改路径失败: ' + error.message)
        } else if (error === 'cancel') {
          // 用户选择"仅更改路径"
          const newPath = result.directory
          this.exportPath = newPath
          localStorage.setItem('defaultExportPath', newPath)
          toast.success('默认导出路径已更新（未迁移旧数据）')
        }
      }
    },
    
    resetExportPath() {
      this.exportPath = 'D:\\YoloMarkFlow\\YoloMarkFlow_DatabaseOut'
      localStorage.removeItem('defaultExportPath')
      toast.success('已恢复默认导出路径')
    },

    async selectModelDownloadPath() {
      let newPath = null
      try {
        const result = await window.electronAPI.selectDirectory({
          title: '选择模型下载目录'
        })
        if (!result.success || !result.directory) {
          return
        }
        
        newPath = result.directory
        
        // 检查新路径是否与当前路径相同
        if (newPath === this.modelDownloadPath) {
          toast.info('选择的路径与当前路径相同')
          return
        }
        
        // 检查旧路径是否有模型文件
        const oldPath = this.modelDownloadPath
        if (oldPath && oldPath !== newPath) {
          const dirExists = await window.electronAPI.directoryExists(oldPath)
          if (dirExists.exists) {
            // 检查是否有.pt模型文件
            const listResult = await window.electronAPI.listDirectory(oldPath)
            const hasModels = listResult.success && listResult.entries && 
              listResult.entries.some(entry => entry.name.endsWith('.pt'))
            
            if (hasModels) {
              // 有模型文件，必须迁移
              await ElMessageBox.confirm(
                `检测到旧路径下有已下载的模型文件。\n\n旧路径：${oldPath}\n新路径：${newPath}\n\n是否迁移所有模型文件到新路径？`,
                '确认迁移数据',
                {
                  confirmButtonText: '确定迁移',
                  cancelButtonText: '仅更改路径',
                  distinguishCancelAndClose: true,
                  type: 'warning'
                }
              )
              
              // 执行迁移
              const migrateMsg = toast.loading('正在迁移模型文件...')
              try {
                const copyResult = await window.electronAPI.copyDirectory(oldPath, newPath)
                migrateMsg()
                
                if (copyResult.success) {
                  toast.success('模型文件迁移完成！')
                } else {
                  throw new Error(copyResult.error || '迁移失败')
                }
              } catch (error) {
                migrateMsg()
                throw error
              }
            }
          }
        }
        
        this.modelDownloadPath = newPath
        localStorage.setItem('modelDownloadPath', newPath)
        toast.success('模型下载路径已更新')
        
      } catch (error) {
        if (error !== 'cancel' && error !== 'close') {
          console.error('选择模型下载路径失败:', error)
          toast.error('更改路径失败: ' + error.message)
        } else if (error === 'cancel') {
          // 用户选择"仅更改路径"
          this.modelDownloadPath = newPath
          localStorage.setItem('modelDownloadPath', newPath)
          toast.success('模型下载路径已更新（未迁移旧文件）')
        }
      }
    },

    resetModelDownloadPath() {
      this.modelDownloadPath = 'D:\\YoloMarkFlow\\model'
      localStorage.removeItem('modelDownloadPath')
      toast.success('已恢复默认模型下载路径')
    },
    
    async selectImagePoolPath() {
      try {
        let newPath = await window.electronAPI.selectProjectDirectory()
        
        if (!newPath) {
          return
        }
        
        // 检查目录是否为空，如果不为空，自动加上子目录
        const isEmptyResult = await window.electronAPI.directoryIsEmpty(newPath)
        if (isEmptyResult.success && !isEmptyResult.isEmpty) {
          // 目录不为空，自动加上 YoloMarkFlow_ImagePool 子目录
          newPath = `${newPath}\\YoloMarkFlow_ImagePool`
          toast.info('检测到目录非空，已自动添加子目录：YoloMarkFlow_ImagePool')
        }
        
        // 检查新路径是否与当前路径相同
        if (newPath === this.imagePoolPath) {
          toast.info('选择的路径与当前路径相同')
          return
        }
        
        // 检查当前路径是否有数据需要迁移
        const currentWorkspacePath = await this.getCurrentWorkspacePath()
        const currentImagePoolPath = `${currentWorkspacePath}\\image_pool`
        const currentDbPath = `${currentWorkspacePath}\\image_pool.db`
        
        // 检查是否存在旧数据
        const poolDirExists = await window.electronAPI.directoryExists(currentImagePoolPath)
        const dbFileExists = await window.electronAPI.fileExists(currentDbPath)
        
        const hasExistingData = poolDirExists.exists || dbFileExists.exists
        
        if (hasExistingData) {
          // 有现有数据，必须迁移
          await ElMessageBox.confirm(
            `检测到当前路径下有图片池数据。\n\n更改路径将自动迁移所有数据到新路径：\n${newPath}\n\n是否继续？`,
            '确认迁移数据',
            {
              confirmButtonText: '确定迁移',
              cancelButtonText: '取消',
              type: 'warning'
            }
          )
          
          // 执行数据迁移
          await this.migrateImagePool(currentWorkspacePath, newPath)
          
          // 迁移成功后保存新路径
          this.imagePoolPath = newPath
          localStorage.setItem('imagePoolPath', newPath)
          this.imagePoolPathChanged = this.imagePoolPath !== this.originalImagePoolPath
          
          toast.success('数据迁移完成！路径已更新，请重启应用以生效')
        } else {
          // 没有现有数据，直接更改路径
          await ElMessageBox.confirm(
            `将图片池路径更改为：\n${newPath}\n\n更改后需要重启应用才能生效。是否继续？`,
            '确认更改路径',
            {
              confirmButtonText: '确定',
              cancelButtonText: '取消',
              type: 'info'
            }
          )
          
          this.imagePoolPath = newPath
          localStorage.setItem('imagePoolPath', newPath)
          this.imagePoolPathChanged = this.imagePoolPath !== this.originalImagePoolPath
          
          toast.success('路径已更新，请重启应用以生效')
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('更改路径失败:', error)
          toast.error('更改路径失败: ' + error.message)
        }
      }
    },
    
    async getCurrentWorkspacePath() {
      const savedPath = localStorage.getItem('imagePoolPath')
      if (savedPath) {
        return savedPath
      }
      
      // 使用新的默认路径
      return 'D:\\YoloMarkFlow\\YoloMarkFlow_ImagePool'
    },
    
    async migrateImagePool(oldWorkspacePath, newWorkspacePath) {
      const loadingMsg = toast.loading('正在准备迁移...')
      
      try {
        const oldImagePoolPath = `${oldWorkspacePath}\\image_pool`
        const oldDbPath = `${oldWorkspacePath}\\image_pool.db`
        const newImagePoolPath = `${newWorkspacePath}\\image_pool`
        const newDbPath = `${newWorkspacePath}\\image_pool.db`
        
        // 检查新路径下是否已存在数据
        const newPoolExists = await window.electronAPI.directoryExists(newImagePoolPath)
        if (newPoolExists.exists) {
          throw new Error('目标路径下已存在 image_pool 目录，迁移已取消')
        }
        
        // 计算需要迁移的数据大小
        let totalSize = 0
        const poolDirSize = await window.electronAPI.getDirectorySize(oldImagePoolPath)
        if (poolDirSize.success) {
          totalSize += poolDirSize.size
        }
        
        const dbFileInfo = await window.electronAPI.getFileInfo(oldDbPath)
        if (dbFileInfo.success) {
          totalSize += dbFileInfo.info.size
        }
        
        // 格式化大小显示
        let sizeText = ''
        if (totalSize < 1024 * 1024) {
          sizeText = `${(totalSize / 1024).toFixed(2)} KB`
        } else if (totalSize < 1024 * 1024 * 1024) {
          sizeText = `${(totalSize / 1024 / 1024).toFixed(2)} MB`
        } else {
          sizeText = `${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`
        }
        
        loadingMsg()
        toast.info(`开始迁移数据（约 ${sizeText}），请稍候...`)
        
        const migrationMsg = toast.loading('正在迁移图片池目录...')
        
        // 迁移图片池目录
        const poolDirExists = await window.electronAPI.directoryExists(oldImagePoolPath)
        if (poolDirExists.exists) {
          const copyDirResult = await window.electronAPI.copyDirectory(oldImagePoolPath, newImagePoolPath)
          if (!copyDirResult.success) {
            throw new Error('迁移图片池目录失败: ' + copyDirResult.error)
          }
        }
        
        migrationMsg()
        const dbMsg = toast.loading('正在迁移数据库文件...')
        
        // 迁移数据库文件
        const dbExists = await window.electronAPI.fileExists(oldDbPath)
        if (dbExists.exists) {
          const copyDbResult = await window.electronAPI.copyFile(oldDbPath, newDbPath)
          if (!copyDbResult.success) {
            throw new Error('迁移数据库文件失败: ' + copyDbResult.error)
          }
        }
        
        dbMsg()

        // 检查并迁移 datasets 目录
        const oldDatasetsPath = `${oldWorkspacePath}\\datasets`
        const newDatasetsPath = `${newWorkspacePath}\\datasets`
        const datasetsDirExists = await window.electronAPI.directoryExists(oldDatasetsPath)
        if (datasetsDirExists.exists) {
          const datasetsMsg = toast.loading('正在迁移数据集目录...')

          const copyDatasetsResult = await window.electronAPI.copyDirectory(oldDatasetsPath, newDatasetsPath)
          if (!copyDatasetsResult.success) {
            console.warn('迁移数据集目录失败:', copyDatasetsResult.error)
          }

          datasetsMsg()
        }
        
        // 关闭所有数据库连接，准备删除文件
        const closeMsg = toast.loading('正在关闭数据库连接...')

        // 先尝试关闭所有已打开的数据库连接
        try {
          const closeAllResult = await window.electronAPI.closeAllDatabases()
          if (closeAllResult.success) {
            console.log('已关闭所有数据库连接:', closeAllResult.closedDatabases)
          }
        } catch (error) {
          console.warn('批量关闭数据库连接失败:', error)
        }

        // 等待一小段时间，确保文件句柄完全释放
        await new Promise(resolve => setTimeout(resolve, 500))

        closeMsg()
        
        // 迁移成功后，删除原路径的文件
        const deleteMsg = toast.loading('正在清理原路径文件...')

        // 删除旧的 image_pool 目录
        if (poolDirExists.exists) {
          const deletePoolResult = await window.electronAPI.deleteDirectory(oldImagePoolPath)
          if (!deletePoolResult.success) {
            console.warn('删除图片池目录失败:', deletePoolResult.error)
          }
        }

        // 删除旧的 image_pool.db
        if (dbExists.exists) {
          const deleteDbResult = await window.electronAPI.deleteDirectory(oldDbPath)
          if (!deleteDbResult.success) {
            console.warn('删除数据库文件失败:', deleteDbResult.error)
          }
        }

        // 删除旧的 datasets 目录
        if (datasetsDirExists.exists) {
          const deleteDatasetsResult = await window.electronAPI.deleteDirectory(oldDatasetsPath)
          if (!deleteDatasetsResult.success) {
            console.warn('删除数据集目录失败:', deleteDatasetsResult.error)
          }
        }

        deleteMsg()
        toast.success('数据迁移完成，已清理原路径文件！')
        
      } catch (error) {
        loadingMsg()
        console.error('数据迁移失败:', error)
        throw error
      }
    },
    
    async resetImagePoolPath() {
      try {
        await ElMessageBox.confirm(
          '确定要恢复为默认路径吗？需要重启应用才能生效。',
          '确认恢复',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        localStorage.removeItem('imagePoolPath')
        
        // 使用新的默认路径
        const defaultImagePoolPath = 'D:\\YoloMarkFlow\\YoloMarkFlow_ImagePool'
        this.imagePoolPath = defaultImagePoolPath
        this.imagePoolPathChanged = this.imagePoolPath !== this.originalImagePoolPath
        toast.success('已恢复默认路径，请重启应用以生效')
      } catch (error) {
        if (error !== 'cancel') {
          console.error('恢复默认路径失败:', error)
        }
      }
    },
    
    async refreshPoolStats() {
      if (this.refreshing) return
      
      this.refreshing = true
      try {
        this.poolStats.diskUsage = '计算中...'
        
        // 获取图片池路径（优先使用用户配置）
        let workspacePath
        const customPath = localStorage.getItem('imagePoolPath')
        if (customPath) {
          workspacePath = customPath
        } else {
          // 使用新的默认路径
          workspacePath = 'D:\\YoloMarkFlow\\YoloMarkFlow_ImagePool'
        }
        
        const dbPath = `${workspacePath}\\image_pool.db`
        
        // 检查数据库文件是否存在
        const existsResult = await window.electronAPI.fileExists(dbPath)
        if (!existsResult.success || !existsResult.exists) {
          this.poolStats.imageCount = 0
          this.poolStats.diskUsage = '0 KB'
          return
        }
        
        // 确保数据库连接（如果已打开会直接复用）
        await window.electronAPI.openDatabase(dbPath)
        
        // 查询图片数量
        const countResult = await window.electronAPI.querySQL(
          dbPath,
          'SELECT COUNT(*) as count FROM images'
        )
        
        this.poolStats.imageCount = countResult.data?.[0]?.count || 0
        
        // 计算磁盘占用（这里简化处理，实际需要遍历文件）
        // 暂时显示预估值
        const avgSize = 500 // KB，假设平均每张图片 500KB
        const totalKB = this.poolStats.imageCount * avgSize
        
        if (totalKB < 1024) {
          this.poolStats.diskUsage = `${totalKB.toFixed(2)} KB`
        } else if (totalKB < 1024 * 1024) {
          this.poolStats.diskUsage = `${(totalKB / 1024).toFixed(2)} MB`
        } else {
          this.poolStats.diskUsage = `${(totalKB / 1024 / 1024).toFixed(2)} GB`
        }
        
        toast.success('统计信息已更新')
      } catch (error) {
        console.error('获取统计信息失败:', error)
        this.poolStats.diskUsage = '获取失败'
        toast.warning('获取统计信息失败，请检查图片池路径是否正确')
      } finally {
        this.refreshing = false
      }
    },


    // ========== 插件相关方法 ==========

    async loadPlugins() {
      this.loadingPlugins = true
      try {
        // 获取所有插件
        const pluginsResult = await window.electronAPI.plugin.getAll()
        if (pluginsResult.success) {
          this.plugins = pluginsResult.plugins || []
        } else {
          console.error('Failed to load plugins:', pluginsResult.error)
          this.plugins = []
        }

        // 获取活动进程数
        const processCountResult = await window.electronAPI.plugin.getActiveProcessCount()
        if (processCountResult.success) {
          this.activeProcessCount = processCountResult.count || 0
        }
      } catch (error) {
        console.error('Failed to load plugins:', error)
        toast.error('加载插件信息失败')
      } finally {
        this.loadingPlugins = false
      }
    },

    async showImportPluginDialog() {
      try {
        const result = await window.electronAPI.selectFile({
          title: '选择插件包',
          filters: [
            { name: '插件包', extensions: ['zip', 'rar'] },
            { name: '所有文件', extensions: ['*'] }
          ],
          properties: ['openFile']
        })

        if (!result.success || !result.filePaths || result.filePaths.length === 0) {
          return
        }

        const pluginPackagePath = result.filePaths[0]
        await this.importPlugin(pluginPackagePath)
      } catch (error) {
        if (error !== 'cancel') {
          console.error('选择插件包失败:', error)
          toast.error('选择插件包失败')
        }
      }
    },

    async importPlugin(pluginPackagePath) {
      this.importingPlugin = true
      const loadingMsg = toast.loading('正在导入插件...')

      try {
        const result = await window.electronAPI.plugin.importPlugin(pluginPackagePath)
        loadingMsg()

        if (result.success) {
          toast.success(`插件导入成功！插件名称: ${result.pluginName || '未知'}`)
          // 重新加载插件列表
          await this.loadPlugins()
        } else {
          toast.error(`插件导入失败: ${result.error || '未知错误'}`)
        }
      } catch (error) {
        loadingMsg()
        console.error('导入插件失败:', error)
        toast.error(`导入插件失败: ${error.message || '未知错误'}`)
      } finally {
        this.importingPlugin = false
      }
    }
  }
}
</script>

<style scoped>
.page-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.page-header {
  padding: 24px 32px;
  border-bottom: 1px solid var(--color-border);
}

.page-header h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.page-description {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.settings-section {
  margin-bottom: 32px;
  padding: 24px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.settings-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 20px 0;
}

.path-selector {
  display: flex;
  align-items: center;
  width: 100%;
}

.path-selector .el-input {
  flex: 1;
}

.form-item-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.warning-text {
  color: var(--color-warning);
  font-weight: 500;
  margin-left: 8px;
}

.storage-info {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: var(--color-text-primary);
}

/* 修复浅色主题下按钮文本颜色 - 黑色按钮白色文本 */
.storage-info .el-button--info.is-plain {
  color: #ffffff;
  background-color: #3c3c3c;
  border-color: #3c3c3c;
}

.storage-info .el-button--info.is-plain:hover {
  color: #ffffff;
  background-color: #505050;
  border-color: #505050;
}

.storage-info .el-button--info.is-plain:focus {
  color: #ffffff;
  background-color: #3c3c3c;
  border-color: #3c3c3c;
}

.storage-info .el-button--info.is-plain:active {
  color: #ffffff;
  background-color: #2a2a2a;
  border-color: #2a2a2a;
}

.storage-info .el-button--info.is-plain.is-disabled {
  color: rgba(255, 255, 255, 0.5);
  background-color: #8e8e8e;
  border-color: #8e8e8e;
}

/* 深色主题下的按钮样式 */
body[data-theme="dark"] .storage-info .el-button--info.is-plain {
  color: #a6a9ad;
  background-color: rgba(144, 147, 153, 0.15);
  border-color: rgba(144, 147, 153, 0.6);
}

body[data-theme="dark"] .storage-info .el-button--info.is-plain:hover {
  color: #b1b3b8;
  background-color: rgba(144, 147, 153, 0.25);
  border-color: #a6a9ad;
}

/* 插件信息样式 */
.plugin-info-card {
  padding: 16px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.plugin-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

/* 修复浅色主题下按钮文本颜色 - 黑色按钮白色文本 */
.plugin-header .el-button--primary.is-plain {
  color: #ffffff;
  background-color: #3c3c3c;
  border-color: #3c3c3c;
}

.plugin-header .el-button--primary.is-plain:hover {
  color: #ffffff;
  background-color: #505050;
  border-color: #505050;
}

.plugin-header .el-button--primary.is-plain:focus {
  color: #ffffff;
  background-color: #3c3c3c;
  border-color: #3c3c3c;
}

.plugin-header .el-button--primary.is-plain:active {
  color: #ffffff;
  background-color: #2a2a2a;
  border-color: #2a2a2a;
}

.plugin-header .el-button--primary.is-plain.is-disabled {
  color: rgba(255, 255, 255, 0.5);
  background-color: #8e8e8e;
  border-color: #8e8e8e;
}

/* 深色主题下的按钮样式 */
body[data-theme="dark"] .plugin-header .el-button--primary.is-plain {
  color: #66b1ff;
  background-color: rgba(64, 158, 255, 0.15);
  border-color: rgba(64, 158, 255, 0.6);
}

body[data-theme="dark"] .plugin-header .el-button--primary.is-plain:hover {
  color: #85c1ff;
  background-color: rgba(64, 158, 255, 0.25);
  border-color: #66b1ff;
}

.plugins-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plugin-item {
  padding: 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  transition: all 0.2s;
}

.plugin-item:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.plugin-main-info {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.plugin-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 8px;
}

.plugin-details {
  flex: 1;
}

.plugin-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 6px;
}

.plugin-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.plugin-path-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
}

.plugin-description {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.no-plugins {
  padding: 20px;
  text-align: center;
}

.plugin-stats {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  gap: 24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.stat-label {
  color: var(--color-text-secondary);
}

.stat-value {
  color: var(--color-text-primary);
  font-weight: 600;
}
</style>

