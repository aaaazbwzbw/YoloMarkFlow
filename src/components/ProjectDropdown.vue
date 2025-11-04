<template>
  <div class="project-dropdown-wrapper">
    <el-dropdown trigger="click" @command="handleCommand" :teleported="false">
      <div class="project-info">
        <el-icon class="project-icon"><Folder /></el-icon>
        <span class="project-name">{{ project ? project.name : '未打开项目' }}</span>
        <el-icon class="arrow-icon"><ArrowDown /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu class="project-dropdown-menu">
          <el-dropdown-item command="new">
            <el-icon><DocumentAdd /></el-icon>
            <span>新建项目</span>
          </el-dropdown-item>
          <el-dropdown-item command="open">
            <el-icon><FolderOpened /></el-icon>
            <span>打开项目</span>
          </el-dropdown-item>
          <el-dropdown-item command="import" divided>
            <el-icon><Upload /></el-icon>
            <span>导入数据集</span>
          </el-dropdown-item>
          
          <!-- 最近项目 - 默认显示前5个 -->
          <template v-if="recentProjects.length > 0">
            <div class="recent-projects-section">
              <div class="recent-section-title">最近项目</div>
              <el-dropdown-item 
                v-for="(proj, index) in displayedRecentProjects" 
                :key="index"
                :command="{ type: 'openRecent', project: proj }"
                class="recent-project-item"
                @click.native.stop>
                <div class="recent-project-content">
                  <span class="recent-project-name">{{ proj.name }}</span>
                  <span class="recent-project-path">{{ proj.path }}</span>
                </div>
              </el-dropdown-item>
              
              <!-- 显示更多/收起按钮 -->
              <el-dropdown-item 
                v-if="recentProjects.length > 5"
                command="toggleMore"
                class="toggle-more-item"
                @click.native.stop>
                <span>{{ showAllRecent ? '收起' : `显示更多 (${recentProjects.length - 5})` }}</span>
                <el-icon><ArrowDown v-if="!showAllRecent" /><ArrowUp v-else /></el-icon>
              </el-dropdown-item>
            </div>
          </template>
          
          <el-dropdown-item divided command="close" v-if="project">
            <el-icon><Close /></el-icon>
            <span>关闭项目</span>
          </el-dropdown-item>
          <el-dropdown-item command="delete" v-if="project">
            <el-icon><Delete /></el-icon>
            <span>删除项目</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    
    <!-- 复用 ProjectDialog 组件 -->
    <ProjectDialog 
      ref="projectDialogRef"
      @project-created="handleProjectCreated" 
      @project-opened="handleProjectOpened">
      <span></span>
    </ProjectDialog>
    
  </div>
</template>

<style scoped>
</style>

<script>
import { ref, computed } from 'vue'
import { Folder, ArrowDown, ArrowUp, DocumentAdd, FolderOpened, Clock, Close, Upload, Delete } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import ProjectDialog from './ProjectDialog.vue'
import toast from '../utils/toast'
import { getRecentProjects, clearCurrentProject, removeFromRecentProjects } from '../utils/projectManager'
import { showLoading } from '../utils/loading'

export default {
  name: 'ProjectDropdown',
  components: {
    Folder,
    ArrowDown,
    ArrowUp,
    DocumentAdd,
    FolderOpened,
    Clock,
    Close,
    Upload,
    Delete,
    ProjectDialog
  },
  props: {
    project: {
      type: Object,
      default: null
    }
  },
  emits: ['project-changed', 'close-project-requested'],
  setup(props, { emit }) {
    const projectDialogRef = ref(null)
    const showAllRecent = ref(false)
    
    
    const recentProjects = computed(() => {
      const recent = getRecentProjects()
      // 排除当前项目（如果有）
      if (props.project) {
        return recent.filter(p => p.path !== props.project.path)
      }
      return recent
    })
    
    const displayedRecentProjects = computed(() => {
      if (showAllRecent.value) {
        return recentProjects.value
      }
      return recentProjects.value.slice(0, 5)
    })
    
    const handleCommand = async (command) => {
      if (typeof command === 'string') {
        switch (command) {
          case 'new':
            // 触发 ProjectDialog 的新建项目
            if (projectDialogRef.value) {
              projectDialogRef.value.handleCommand('new')
            }
            break
          case 'open':
            // 触发 ProjectDialog 的打开项目
            if (projectDialogRef.value) {
              projectDialogRef.value.handleCommand('open')
            }
            break
          case 'import':
            // 触发 ProjectDialog 的导入数据集
            if (projectDialogRef.value) {
              projectDialogRef.value.handleCommand('import')
            }
            break
          case 'toggleMore':
            // 切换显示更多，不关闭菜单
            showAllRecent.value = !showAllRecent.value
            return // 不要关闭菜单
          case 'close':
            await handleCloseProject()
            break
          case 'delete':
            await handleDeleteProject()
            break
        }
      } else if (command.type === 'openRecent') {
        // 打开最近项目
        if (projectDialogRef.value) {
          await projectDialogRef.value.openProjectByPath(command.project.path)
        }
      }
    }
    
    const handleCloseProject = async () => {
      // 直接触发保存逻辑，不需要确认
      emit('close-project-requested')
    }

    const handleDeleteProject = async () => {
      if (!props.project) return

      const projectPath = props.project.path
      const projectName = props.project.name

      try {
        // 步骤1: 初始确认对话框（带复选框）
        let deleteOrphanedImages = true // 默认勾选
        
        await ElMessageBox({
          title: '删除项目',
          message: `
            <div style="line-height: 1.8;">
              <p style="margin-bottom: 16px;">确认删除项目 <strong>"${projectName}"</strong> 吗？</p>
              <p style="margin-bottom: 8px;">此操作将：</p>
              <ul style="margin: 0 0 16px 0; padding-left: 20px;">
                <li>删除项目配置和标注数据</li>
                <li>从最近项目列表中移除</li>
              </ul>
              <div style="margin-top: 16px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                  <input type="checkbox" id="deleteOrphanedCheckbox" checked style="margin-right: 8px;">
                  <span>同时删除未被引用的图片</span>
                </label>
              </div>
            </div>
          `,
          dangerouslyUseHTMLString: true,
          confirmButtonText: '继续',
          cancelButtonText: '取消',
          type: 'warning',
          beforeClose: (action, instance, done) => {
            if (action === 'confirm') {
              const checkbox = document.getElementById('deleteOrphanedCheckbox')
              deleteOrphanedImages = checkbox ? checkbox.checked : false
            }
            done()
          }
        })

        // 步骤2: 扫描孤立图片（如果需要）
        let orphanedImageIds = []
        if (deleteOrphanedImages) {
          const loadingInstance = toast.loading('正在扫描图片引用...')

          try {
            const { findOrphanedImages } = await import('../utils/imagePool')
            orphanedImageIds = await findOrphanedImages(projectPath)
            loadingInstance()
          } catch (error) {
            loadingInstance()
            console.error('扫描孤立图片失败:', error)
            toast.warning('扫描图片失败，将只删除项目')
            orphanedImageIds = []
          }
        }

        // 步骤3: 最终确认对话框
        let confirmMessage = `<div style="line-height: 1.8;">
          <p style="margin-bottom: 16px;">即将删除：</p>
          <ul style="margin: 0 0 16px 0; padding-left: 20px;">
            <li>项目：<strong>${projectName}</strong></li>`
        
        if (deleteOrphanedImages && orphanedImageIds.length > 0) {
          confirmMessage += `<li>图片：<strong>${orphanedImageIds.length}</strong> 张未被其他项目或数据集使用的图片</li>`
        } else if (deleteOrphanedImages && orphanedImageIds.length === 0) {
          confirmMessage += `<li style="color: #909399;">该项目引用的所有图片仍被其他项目或数据集使用，不会删除任何图片文件</li>`
        }
        
        confirmMessage += `</ul>
          <p style="color: #F56C6C; font-weight: bold; margin-top: 16px;">⚠️ 此操作不可恢复！</p>
        </div>`

        await ElMessageBox({
          title: '确认删除',
          message: confirmMessage,
          dangerouslyUseHTMLString: true,
          confirmButtonText: '确认删除',
          cancelButtonText: '取消',
          type: 'warning',
          confirmButtonClass: 'el-button--danger'
        })

        // 步骤4: 执行删除
        // 1. 先关闭项目（触发保存和清理）
        emit('close-project-requested')

        // 2. 删除孤立图片（如果有），显示进度（必须在关闭数据库之前）
        // 注意：删除孤立图片需要使用图片池数据库，所以要先删除图片，再关闭数据库
        let closeLoading = null
        let deleteStats = {
          deletedCount: 0,
          skippedCount: 0,
          errorCount: 0
        }
        
        if (deleteOrphanedImages && orphanedImageIds.length > 0) {
          // 显示删除进度遮罩层
          closeLoading = showLoading(`正在删除图片 0/${orphanedImageIds.length}...`)
          
          try {
            const { deleteOrphanedImages: deleteImages } = await import('../utils/imagePool')
            
            const deleteResult = await deleteImages(orphanedImageIds, (current, total, message) => {
              // 更新进度消息
              const progressMessage = message || `正在删除图片 ${current}/${total}...`
              closeLoading(progressMessage)
            })
            
            deleteStats = {
              deletedCount: deleteResult.deletedCount || 0,
              skippedCount: deleteResult.skippedCount || 0,
              errorCount: (deleteResult.errors && deleteResult.errors.length) || 0
            }
            
            // 关闭遮罩层
            closeLoading()
            closeLoading = null
            
            // 显示删除结果（如果有错误）
            if (deleteStats.errorCount > 0) {
              toast.warning(`部分图片删除失败（${deleteStats.errorCount} 张），但将继续删除项目`)
            }
          } catch (error) {
            console.error('删除孤立图片失败:', error)
            if (closeLoading) {
              closeLoading()
              closeLoading = null
            }
            toast.warning('部分图片删除失败，但将继续删除项目')
          }
        } else {
          // 如果没有需要删除的图片，显示删除项目遮罩层
          closeLoading = showLoading('正在删除项目...')
        }

        // 3. 关闭所有数据库连接（在删除图片之后）
        if (closeLoading) {
          closeLoading('正在关闭数据库连接...')
        }
        try {
          await window.electronAPI.closeAllDatabases()
        } catch (error) {
          console.warn('关闭数据库连接失败:', error)
        }

        // 4. 等待确保所有文件句柄释放（Windows需要更长时间）
        if (closeLoading) {
          closeLoading('正在释放文件句柄...')
        }
        await new Promise(resolve => setTimeout(resolve, 800))

        // 5. 注销项目路径
        if (closeLoading) {
          closeLoading('正在注销项目...')
        }
        try {
          await window.electronAPI.project.unregister(projectPath)
        } catch (error) {
          console.warn('注销项目路径失败:', error)
        }

        // 6. 删除项目目录
        if (closeLoading) {
          closeLoading('正在删除项目目录...')
        }
        const deleteResult = await window.electronAPI.deleteProject(projectPath)
        
        if (!deleteResult.success) {
          throw new Error(deleteResult.error)
        }

        // 7. 从最近项目列表中移除
        removeFromRecentProjects(projectPath)

        // 8. 清除当前项目
        clearCurrentProject()
        
        // 9. 通知 App.vue 更新项目状态（触发 project-changed 事件）
        emit('project-changed', null)
        
        // 同时触发全局项目变化事件，确保所有组件都能收到通知
        window.dispatchEvent(new CustomEvent('project-changed', { detail: null }))

        // 10. 关闭遮罩层
        if (closeLoading) {
          closeLoading()
          closeLoading = null
        }

        // 11. 显示删除结果对话框
        let resultMessage = `<div style="line-height: 1.8;">
          <p style="margin-bottom: 12px;">项目 "${projectName}" 已删除</p>`
        
        if (deleteOrphanedImages && deleteStats.deletedCount > 0) {
          resultMessage += `<div style="margin-top: 16px;">
            <p><strong>统计信息：</strong></p>
            <ul style="margin: 8px 0 0 20px; padding: 0;">`
          
          if (deleteStats.deletedCount > 0) {
            resultMessage += `<li>已删除图片：${deleteStats.deletedCount} 张</li>`
          }
          if (deleteStats.skippedCount > 0) {
            resultMessage += `<li>跳过图片：${deleteStats.skippedCount} 张（不存在于图片池）</li>`
          }
          if (deleteStats.errorCount > 0) {
            resultMessage += `<li style="color: #F56C6C;">删除失败：${deleteStats.errorCount} 张</li>`
          }
          
          resultMessage += `</ul></div>`
        }
        
        resultMessage += `</div>`

        await ElMessageBox({
          title: '删除成功',
          message: resultMessage,
          dangerouslyUseHTMLString: true,
          confirmButtonText: '确定',
          type: 'success'
        })

        // 12. 跳转到欢迎页
        setTimeout(() => {
          window.location.hash = '#/welcome'
        }, 100)

      } catch (error) {
        // 关闭遮罩层（如果还在显示）
        if (closeLoading) {
          closeLoading()
          closeLoading = null
        }
        
        if (error === 'cancel') {
          // 用户取消删除
          return
        }
        console.error('删除项目失败:', error)
        toast.error('删除项目失败: ' + error.message)
      }
    }
    
    const handleProjectCreated = (project) => {
      emit('project-changed', project)
    }
    
    const handleProjectOpened = (project) => {
      emit('project-changed', project)
    }
    
    return {
      projectDialogRef,
      showAllRecent,
      recentProjects,
      displayedRecentProjects,
      handleCommand,
      handleProjectCreated,
      handleProjectOpened
    }
  }
}
</script>

<style scoped>
.project-dropdown-wrapper {
  display: inline-block;
  margin-left: 16px;
}

.project-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: transparent;
  border: 1px solid var(--color-border, #d4d4d4);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-app-region: no-drag;
}

body[data-theme="dark"] .project-info {
  border-color: #3c3c3c;
}

.project-info:hover {
  background: var(--color-bg-tertiary, #e8e8e8);
  border-color: var(--color-primary, #007acc);
}

body[data-theme="dark"] .project-info:hover {
  background: #3c3c3c;
  border-color: #007acc;
}

.project-icon {
  font-size: 14px;
  color: var(--color-text-secondary, #616161);
}

body[data-theme="dark"] .project-icon {
  color: #9d9d9d;
}

.project-name {
  font-size: 12px;
  color: var(--color-text-primary, #3c3c3c);
  font-weight: 500;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

body[data-theme="dark"] .project-name {
  color: #cccccc;
}

.arrow-icon {
  font-size: 12px;
  color: var(--color-text-tertiary, #8e8e8e);
}

body[data-theme="dark"] .arrow-icon {
  color: #6d6d6d;
}

/* 下拉菜单样式 - 覆盖 Element Plus 默认样式 */
:deep(.el-dropdown__popper) {
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e4e7ed);
  box-shadow: 0 2px 12px var(--color-shadow, rgba(0, 0, 0, 0.15));
}

body[data-theme="dark"] :deep(.el-dropdown__popper) {
  background: #252526;
  border-color: #3c3c3c;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}

/* 下拉箭头 */
:deep(.el-popper__arrow) {
  display: block !important;
}

:deep(.el-popper__arrow::before) {
  background: var(--color-bg-primary, #ffffff) !important;
  border: 1px solid var(--color-border, #e4e7ed) !important;
  border-right: none !important;
  border-bottom: none !important;
}

body[data-theme="dark"] :deep(.el-popper__arrow::before) {
  background: #252526 !important;
  border-color: #3c3c3c !important;
}

:deep(.el-dropdown-menu) {
  background: var(--color-bg-primary, #ffffff);
}

body[data-theme="dark"] :deep(.el-dropdown-menu) {
  background: #252526;
}

:deep(.el-dropdown-menu__item) {
  color: var(--color-text-primary, #606266);
}

body[data-theme="dark"] :deep(.el-dropdown-menu__item) {
  color: #cccccc;
}

:deep(.el-dropdown-menu__item:hover) {
  background: var(--color-bg-secondary, #f5f7fa);
  color: var(--color-primary, #409eff);
}

body[data-theme="dark"] :deep(.el-dropdown-menu__item:hover) {
  background: #3c3c3c;
  color: #007acc;
}

:deep(.el-dropdown-menu__item--divided) {
  border-top-color: var(--color-border, #e4e7ed);
}

body[data-theme="dark"] :deep(.el-dropdown-menu__item--divided) {
  border-top-color: #3c3c3c;
}

:deep(.el-dropdown-menu__item .el-icon) {
  color: var(--color-text-secondary, #909399);
}

body[data-theme="dark"] :deep(.el-dropdown-menu__item .el-icon) {
  color: #9d9d9d;
}

:deep(.el-dropdown-menu__item:hover .el-icon) {
  color: var(--color-primary, #409eff);
}

body[data-theme="dark"] :deep(.el-dropdown-menu__item:hover .el-icon) {
  color: #007acc;
}

.project-dropdown-menu {
  margin-top: 4px;
}

.recent-projects-section {
  border-top: 1px solid var(--color-border, #e4e7ed);
  padding-top: 4px;
  margin-top: 4px;
}

body[data-theme="dark"] .recent-projects-section {
  border-top-color: #3c3c3c;
}

.recent-section-title {
  padding: 8px 16px 4px;
  font-size: 12px;
  color: var(--color-text-secondary, #909399);
  font-weight: 600;
}

body[data-theme="dark"] .recent-section-title {
  color: #9d9d9d;
}

.recent-project-item {
  padding: 8px 16px !important;
}

.toggle-more-item {
  padding: 6px 16px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  color: var(--color-primary, #409eff) !important;
  font-size: 12px;
}

body[data-theme="dark"] .toggle-more-item {
  color: #007acc !important;
}

.toggle-more-item:hover {
  background: var(--color-bg-tertiary, #ecf5ff) !important;
}

body[data-theme="dark"] .toggle-more-item:hover {
  background: #3c3c3c !important;
}

.recent-project-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recent-project-name {
  font-size: 13px;
  color: var(--color-text-primary, #303133);
}

body[data-theme="dark"] .recent-project-name {
  color: #cccccc;
}

.recent-project-path {
  font-size: 11px;
  color: var(--color-text-secondary, #909399);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

body[data-theme="dark"] .recent-project-path {
  color: #9d9d9d;
}
</style>

