<template>
  <div class="welcome-page">
    <div class="welcome-content">
      <!-- Logo -->
      <div class="welcome-logo">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- 外框 - 代表标注框 -->
          <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <!-- Y字形 - 代表YOLO -->
          <path d="M7 7 L12 13 L17 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 13 L12 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <!-- 流程线条 - 科技感 -->
          <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
          <circle cx="17" cy="7" r="1.2" fill="currentColor"/>
          <circle cx="12" cy="17" r="1.2" fill="currentColor"/>
        </svg>
      </div>

      <!-- 标题 -->
      <h1 class="welcome-title">YoloMarkFlow</h1>
      <p class="welcome-subtitle">一站式视觉AI训练平台</p>

      <!-- 操作按钮 -->
      <div class="welcome-actions">
        <ProjectDialog @project-created="handleProjectCreated" @project-opened="handleProjectOpened">
          <el-button type="primary" size="large" class="action-btn">
            <el-icon><FolderAdd /></el-icon>
            <span>新建/打开项目</span>
          </el-button>
        </ProjectDialog>
      </div>

      <!-- 最近项目 -->
      <div v-if="recentProjects.length > 0" class="recent-projects-welcome">
        <div class="recent-header">
          <span class="recent-title">最近打开</span>
          <span class="recent-count">{{ recentProjects.length }}</span>
        </div>
        <div class="recent-list-welcome">
          <div 
            v-for="(project, index) in recentProjects.slice(0, 5)" 
            :key="index"
            class="recent-item"
            @click="openRecentProject(project)"
            @contextmenu.prevent="showContextMenu($event, project)">
            <svg class="recent-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 7C3 5.89543 3.89543 5 5 5H9.58579C9.851 5 10.1054 5.10536 10.2929 5.29289L12 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span class="recent-item-name">{{ project.name }}</span>
            <span class="recent-item-path">{{ project.path }}</span>
          </div>
        </div>
      </div>

      <!-- 右键菜单 -->
      <div 
        v-show="contextMenuVisible"
        class="context-menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        @click.stop>
        <div class="context-menu-item" @click="deleteProject">
          <el-icon><Delete /></el-icon>
          <span>删除项目</span>
        </div>
      </div>

      <!-- 快速入门提示 -->
      <div class="quick-guide" v-if="recentProjects.length === 0">
        <div class="guide-title">快速开始</div>
        <div class="guide-steps">
          <div class="guide-step">
            <div class="step-number">1</div>
            <div class="step-text">新建或打开项目</div>
          </div>
          <div class="step-arrow">→</div>
          <div class="guide-step">
            <div class="step-number">2</div>
            <div class="step-text">进入标注工作台</div>
          </div>
          <div class="step-arrow">→</div>
          <div class="guide-step">
            <div class="step-number">3</div>
            <div class="step-text">开始标注训练</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { FolderAdd, Folder, Delete } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import ProjectDialog from '../components/ProjectDialog.vue'
import toast from '../utils/toast'
import { getRecentProjects, setCurrentProject, addToRecentProjects, validateProjectConfig, fixCorruptedConfig, removeFromRecentProjects } from '../utils/projectManager'

export default {
  name: 'Welcome',
  components: {
    FolderAdd,
    Folder,
    Delete,
    ProjectDialog
  },
  data() {
    return {
      recentProjects: [],
      contextMenuVisible: false,
      contextMenuX: 0,
      contextMenuY: 0,
      contextMenuProject: null
    }
  },
  mounted() {
    this.loadRecentProjects()
    // 点击其他地方关闭右键菜单
    document.addEventListener('click', this.hideContextMenu)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.hideContextMenu)
  },
  methods: {
    loadRecentProjects() {
      this.recentProjects = getRecentProjects()
    },
    async openRecentProject(project) {
      try {
        // 检查项目是否存在
        const exists = await window.electronAPI.checkProjectExists(project.path)
        if (!exists) {
          toast.error('该项目不存在或已被删除')
          return
        }

        // 读取项目配置
        const readResult = await window.electronAPI.readProjectConfig(project.path)
        if (!readResult.success) {
          throw new Error(readResult.error)
        }

        let config = readResult.config

        console.log('Welcome页面 - 读取到的原始项目配置:', config)

        // 修复可能损坏的配置
        config = fixCorruptedConfig(config)
        
        console.log('Welcome页面 - 修复后的项目配置:', config)

        // 验证配置
        if (!validateProjectConfig(config)) {
          console.error('Welcome页面 - 项目配置验证失败:', config)
          toast.error('项目配置文件格式不正确')
          return
        }

        // 保存修复后的配置（如果配置被修复过）
        if (readResult.config !== config) {
          console.log('保存修复后的配置到文件...')
          await window.electronAPI.writeProjectConfig(project.path, config)
        }

        // 设置为当前项目
        setCurrentProject(config)
        addToRecentProjects(config)

        toast.success('项目打开成功！')
        
        // 触发全局项目变化事件，传递项目数据
        window.dispatchEvent(new CustomEvent('project-changed', { detail: config }))
        
        // 跳转到工作台
        this.$router.push('/workbench')
      } catch (error) {
        console.error('打开项目失败', error)
        toast.error('打开项目失败: ' + error.message)
      }
    },
    handleProjectCreated(project) {
      console.log('项目已创建', project)
    },
    handleProjectOpened(project) {
      console.log('项目已打开', project)
    },
    showContextMenu(event, project) {
      this.contextMenuVisible = true
      this.contextMenuX = event.clientX
      this.contextMenuY = event.clientY
      this.contextMenuProject = project
    },
    hideContextMenu() {
      this.contextMenuVisible = false
      this.contextMenuProject = null
    },
    async deleteProject() {
      if (!this.contextMenuProject) return

      const project = this.contextMenuProject
      const projectPath = project.path
      const projectName = project.name
      
      this.hideContextMenu()

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
          confirmMessage += `<li>图片：<strong>${orphanedImageIds.length}</strong> 张未被其他项目使用的图片</li>`
        } else if (deleteOrphanedImages && orphanedImageIds.length === 0) {
          confirmMessage += `<li style="color: #909399;">该项目引用的所有图片仍被其他项目使用，不会删除任何图片文件</li>`
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
        // 1. 关闭所有数据库连接
        try {
          await window.electronAPI.closeAllDatabases()
        } catch (error) {
          console.warn('关闭数据库连接失败:', error)
        }

        // 2. 等待确保所有文件句柄释放（Windows需要更长时间）
        await new Promise(resolve => setTimeout(resolve, 800))

        // 3. 删除项目目录
        const deleteResult = await window.electronAPI.deleteProject(projectPath)
        
        if (!deleteResult.success) {
          throw new Error(deleteResult.error)
        }

        // 2. 删除孤立图片（如果有）
        if (deleteOrphanedImages && orphanedImageIds.length > 0) {
          try {
            const { deleteOrphanedImages: deleteImages } = await import('../utils/imagePool')
            await deleteImages(orphanedImageIds)
          } catch (error) {
            console.error('删除孤立图片失败:', error)
            toast.warning('项目已删除，但部分图片删除失败')
          }
        }

        // 3. 从最近项目列表中移除
        removeFromRecentProjects(projectPath)

        // 4. 刷新列表
        this.loadRecentProjects()

        const successMsg = orphanedImageIds.length > 0 
          ? `项目 "${projectName}" 及 ${orphanedImageIds.length} 张图片已删除`
          : `项目 "${projectName}" 已删除`
        
        toast.success(successMsg)

      } catch (error) {
        if (error === 'cancel') {
          // 用户取消删除
          return
        }
        console.error('删除项目失败:', error)
        toast.error('删除项目失败: ' + error.message)
      }
    }
  }
}
</script>

<style scoped>
.welcome-page {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  overflow: hidden;
  position: relative;
}

body[data-theme="dark"] .welcome-page {
  background: linear-gradient(135deg, #1e1e1e 0%, #252526 100%);
}

/* 背景装饰 */
.welcome-page::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
  background-size: 30px 30px;
  animation: backgroundMove 60s linear infinite;
}

body[data-theme="dark"] .welcome-page::before {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
}

@keyframes backgroundMove {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(30px, 30px);
  }
}

.welcome-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: fadeInUp 0.8s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Logo样式 */
.welcome-logo {
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, #f3f3f3 0%, #e8e8e8 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary, #3c3c3c);
  box-shadow: 0 8px 32px var(--color-shadow, rgba(0, 0, 0, 0.1));
  margin-bottom: 32px;
  animation: pulse 2s ease-in-out infinite;
}

body[data-theme="dark"] .welcome-logo {
  background: linear-gradient(135deg, #252526 0%, #333333 100%);
  color: #ffffff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.welcome-logo svg {
  filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.2));
}

body[data-theme="dark"] .welcome-logo svg {
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.4));
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* 标题 */
.welcome-title {
  font-size: 42px;
  font-weight: 700;
  color: var(--color-text-primary, #1a1a1a);
  margin: 0 0 12px 0;
  letter-spacing: -0.5px;
}

body[data-theme="dark"] .welcome-title {
  color: #cccccc;
}

.welcome-subtitle {
  font-size: 16px;
  color: var(--color-text-secondary, #666666);
  margin: 0 0 48px 0;
  letter-spacing: 1px;
}

body[data-theme="dark"] .welcome-subtitle {
  color: #9d9d9d;
}

/* 操作按钮 */
.welcome-actions {
  margin-bottom: 48px;
}

/* 最近项目 - Cursor风格 */
.recent-projects-welcome {
  margin-bottom: 48px;
  width: 100%;
  max-width: 600px;
}

.recent-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.recent-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary, #666666);
  letter-spacing: 0.5px;
}

body[data-theme="dark"] .recent-title {
  color: #9d9d9d;
}

.recent-count {
  font-size: 12px;
  color: var(--color-text-tertiary, #999999);
  background: var(--color-bg-tertiary, rgba(0, 0, 0, 0.05));
  padding: 2px 8px;
  border-radius: 12px;
}

body[data-theme="dark"] .recent-count {
  color: #6d6d6d;
  background: rgba(255, 255, 255, 0.1);
}

.recent-list-welcome {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: transparent;
  border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.06));
}

body[data-theme="dark"] .recent-item {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-item:hover {
  background: var(--color-bg-secondary, rgba(0, 0, 0, 0.03));
}

body[data-theme="dark"] .recent-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.recent-item:active {
  background: var(--color-bg-tertiary, rgba(0, 0, 0, 0.05));
}

body[data-theme="dark"] .recent-item:active {
  background: rgba(255, 255, 255, 0.08);
}

.recent-item-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary, #666666);
  flex-shrink: 0;
}

body[data-theme="dark"] .recent-item-icon {
  color: #9d9d9d;
}

.recent-item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary, #1a1a1a);
  min-width: 120px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

body[data-theme="dark"] .recent-item-name {
  color: #cccccc;
}

.recent-item-path {
  font-size: 12px;
  color: var(--color-text-tertiary, #888888);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

body[data-theme="dark"] .recent-item-path {
  color: #6d6d6d;
}

.action-btn {
  padding: 16px 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  background: var(--color-primary, #007acc) !important;
  border: none !important;
  color: #ffffff !important;
  box-shadow: 0 4px 16px rgba(0, 122, 204, 0.3);
  transition: all 0.3s ease;
}

body[data-theme="dark"] .action-btn {
  background: #007acc !important;
  box-shadow: 0 4px 16px rgba(0, 122, 204, 0.4);
}

.action-btn:hover,
.action-btn:focus {
  background: #0098ff !important;
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(0, 122, 204, 0.5);
  border: none !important;
}

body[data-theme="dark"] .action-btn:hover,
body[data-theme="dark"] .action-btn:focus {
  background: #0098ff !important;
  box-shadow: 0 6px 24px rgba(0, 122, 204, 0.6);
}

.action-btn:active {
  background: #005a9e !important;
  transform: translateY(0);
}

body[data-theme="dark"] .action-btn:active {
  background: #005a9e !important;
}

/* 快速入门 */
.quick-guide {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 12px;
  padding: 24px 32px;
  backdrop-filter: blur(10px);
}

body[data-theme="dark"] .quick-guide {
  background: rgba(30, 30, 30, 0.6);
  border-color: #3c3c3c;
}

.guide-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #333333);
  margin-bottom: 16px;
  text-align: center;
}

body[data-theme="dark"] .guide-title {
  color: #cccccc;
}

.guide-steps {
  display: flex;
  align-items: center;
  gap: 16px;
}

.guide-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.step-number {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #000000 0%, #333333 100%);
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.step-text {
  font-size: 12px;
  color: var(--color-text-secondary, #666666);
  white-space: nowrap;
}

body[data-theme="dark"] .step-text {
  color: #9d9d9d;
}

.step-arrow {
  color: var(--color-text-tertiary, #cccccc);
  font-size: 20px;
  font-weight: 300;
}

body[data-theme="dark"] .step-arrow {
  color: #6d6d6d;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e4e7ed);
  border-radius: 6px;
  box-shadow: 0 2px 12px var(--color-shadow, rgba(0, 0, 0, 0.15));
  z-index: 9999;
  padding: 4px 0;
  min-width: 140px;
}

body[data-theme="dark"] .context-menu {
  background: #252526;
  border-color: #3c3c3c;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-primary, #606266);
  transition: all 0.15s ease;
}

body[data-theme="dark"] .context-menu-item {
  color: #cccccc;
}

.context-menu-item:hover {
  background: var(--color-bg-secondary, #f5f7fa);
  color: var(--color-danger, #f56c6c);
}

body[data-theme="dark"] .context-menu-item:hover {
  background: #3c3c3c;
  color: #f44747;
}

.context-menu-item .el-icon {
  font-size: 14px;
}

/* 响应式 */
@media (max-width: 768px) {
  .welcome-title {
    font-size: 32px;
  }

  .welcome-logo {
    width: 100px;
    height: 100px;
  }

  .quick-guide {
    display: none;
  }
}
</style>

