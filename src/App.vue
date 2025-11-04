<template>
  <div id="app">
    <!-- 自定义标题栏 (启动页面不显示) -->
    <div v-if="!isStartupRoute" class="title-bar">
      <div class="title-bar-content">
        <div class="title-bar-title">
          <svg class="app-logo" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <span class="app-title-text">YoloMarkFlow</span>
          
          <!-- 项目名称和管理（始终显示） -->
          <ProjectDropdown 
            :project="currentProject"
            @project-changed="handleProjectChanged"
            @close-project-requested="handleCloseProjectRequested" />
        </div>
        <div class="title-bar-spacer"></div>
        <div v-if="isWorkbenchRoute" class="title-bar-actions">
          <!-- 只在目标检测工作台显示工具栏按钮，分类工作台不需要 -->
          <button 
            v-if="currentRoute === '/workbench'"
            class="title-bar-action-btn" 
            @click="toggleWorkbenchToolbar"
            title="工具栏">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <span>工具栏</span>
          </button>
          <button 
            class="title-bar-action-btn" 
            @click="openShortcutsModal"
            title="快捷键设置">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M6 8h.01M10 8h.01M14 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h.01M10 16h.01M14 16h.01M18 16h.01"/>
            </svg>
            <span>快捷键</span>
          </button>
        </div>
        <div class="title-bar-controls">
          <button class="title-bar-button minimize" @click="minimizeWindow">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2" y="5.5" width="8" height="1" fill="currentColor"/>
            </svg>
          </button>
          <button class="title-bar-button maximize" @click="maximizeWindow">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none"/>
            </svg>
          </button>
          <button class="title-bar-button close" @click="closeWindow">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    <div class="app-content">
      <router-view />
    </div>
  </div>
</template>

<script>
import ProjectDropdown from './components/ProjectDropdown.vue'
import { getCurrentProject } from './utils/projectManager'
import { initImagePool } from './utils/imagePool'
import { initTheme } from './utils/theme'

export default {
  name: 'App',
  components: {
    ProjectDropdown
  },
  data() {
    return {
      currentProject: null
    }
  },
  computed: {
    isWorkbenchRoute() {
      // 目标检测工作台或分类工作台都显示工具栏按钮
      return this.$route.path === '/workbench' || this.$route.path === '/classification'
    },
    currentRoute() {
      return this.$route.path
    },
    isStartupRoute() {
      return this.$route.path === '/startup'
    }
  },
  async mounted() {
    // 初始化主题
    initTheme()
    
    // 初始化图片池
    try {
      await initImagePool()
      console.log('图片池初始化完成')
    } catch (error) {
      console.error('图片池初始化失败:', error)
    }

    // 加载当前项目
    this.currentProject = getCurrentProject()
    
    // 监听启动页面完成事件（在StartupLoading完成后才恢复项目）
    window.addEventListener('startup-completed', this.restoreLastOpenedProject)
    
    // 监听项目变化事件
    window.addEventListener('project-changed', this.handleGlobalProjectChanged)
    window.addEventListener('project-switch-requested', this.handleProjectSwitchRequested)
    
    // 全局禁止文本选择（捕获阶段）
    window.addEventListener('selectstart', this.preventDefaultBehavior, true)
    
    // 全局禁止拖拽（捕获阶段）
    window.addEventListener('dragstart', this.handleDragEvent, true)
    window.addEventListener('drag', this.preventDefaultBehavior, true)
    window.addEventListener('dragenter', this.preventDefaultBehavior, true)
    window.addEventListener('dragover', this.preventDefaultBehavior, true)
    window.addEventListener('dragleave', this.preventDefaultBehavior, true)
    window.addEventListener('drop', this.preventDefaultBehavior, true)
    window.addEventListener('dragend', this.preventDefaultBehavior, true)
  },
  beforeUnmount() {
    window.removeEventListener('startup-completed', this.restoreLastOpenedProject)
    window.removeEventListener('project-changed', this.handleGlobalProjectChanged)
    window.removeEventListener('project-switch-requested', this.handleProjectSwitchRequested)
    
    // 移除全局事件监听器
    window.removeEventListener('selectstart', this.preventDefaultBehavior, true)
    window.removeEventListener('dragstart', this.handleDragEvent, true)
    window.removeEventListener('drag', this.preventDefaultBehavior, true)
    window.removeEventListener('dragenter', this.preventDefaultBehavior, true)
    window.removeEventListener('dragover', this.preventDefaultBehavior, true)
    window.removeEventListener('dragleave', this.preventDefaultBehavior, true)
    window.removeEventListener('drop', this.preventDefaultBehavior, true)
    window.removeEventListener('dragend', this.preventDefaultBehavior, true)
  },
  methods: {
    // 恢复上次打开的项目
    async restoreLastOpenedProject() {
      try {
        // 获取上次打开的项目路径
        const lastProjectPath = localStorage.getItem('lastOpenedProject')
        
        if (!lastProjectPath) {
          console.log('没有上次打开的项目记录')
          return
        }
        
        // 验证项目是否仍然存在
        const configResult = await window.electronAPI.readProjectConfig(lastProjectPath)
        if (!configResult.success) {
          console.log('上次打开的项目不存在或已损坏，清除记录')
          localStorage.removeItem('lastOpenedProject')
          return
        }
        
        let project = configResult.config
        
        // 修复可能损坏的配置
        const { fixCorruptedConfig, needsFix } = await import('./utils/projectManager')
        if (needsFix(project)) {
          project = fixCorruptedConfig(project)
        }
        
        // 确保项目类型存在（兼容旧项目，默认为 'detection'）
        if (!project.type) {
          console.warn('项目配置缺少 type 字段，默认为 detection:', project)
          project.type = 'detection'
        }
        
        // 根据项目类型决定跳转到哪个工作台
        const workbenchPath = project.type === 'classification' ? '/classification' : '/workbench'
        
        // 如果当前路由已经是正确的工作台，不需要跳转
        // 但如果当前路由是错误的工作台（比如分类项目但当前在目标检测工作台），需要强制跳转
        const currentPath = this.$route.path
        const isCorrectWorkbench = (currentPath === '/workbench' && project.type !== 'classification') || 
                                  (currentPath === '/classification' && project.type === 'classification')
        
        if (!isCorrectWorkbench) {
          console.log('自动恢复项目:', project.name, '类型:', project.type, '跳转到:', workbenchPath)
          this.$router.push({
            path: workbenchPath,
            query: { projectPath: lastProjectPath }
          })
        } else {
          console.log('当前已在正确的工作台，无需跳转')
        }
      } catch (error) {
        console.error('恢复上次打开的项目失败:', error)
      }
    },
    
    minimizeWindow() {
      if (window.electronAPI) {
        window.electronAPI.minimizeWindow()
      }
    },
    maximizeWindow() {
      if (window.electronAPI) {
        window.electronAPI.maximizeWindow()
      }
    },
    closeWindow() {
      if (window.electronAPI) {
        window.electronAPI.closeWindow()
      }
    },
    toggleWorkbenchToolbar() {
      // 发送自定义事件给工作台组件（Workbench 或 ClassificationWorkbench）
      window.dispatchEvent(new Event('toggle-workbench-toolbar'))
    },
    openShortcutsModal() {
      // 发送自定义事件给工作台组件（Workbench 或 ClassificationWorkbench）
      window.dispatchEvent(new Event('open-shortcuts-modal'))
    },
    handleProjectChanged(project) {
      this.currentProject = project
      
      // 触发全局项目变化事件
      window.dispatchEvent(new CustomEvent('project-changed', { detail: project }))
      
      // 如果关闭了项目，跳转到欢迎页
      if (!project && this.$route.path !== '/welcome') {
        this.$router.push('/welcome')
      }
    },
    handleGlobalProjectChanged(event) {
      // 从其他组件触发的项目变化
      const project = event.detail || getCurrentProject()
      this.currentProject = project
    },
    handleProjectSwitchRequested(event) {
      // 项目切换请求事件
      const project = event.detail?.newProject || getCurrentProject()
      this.currentProject = project
      console.log('App: 收到项目切换请求', project)
    },
    handleCloseProjectRequested() {
      // 触发全局关闭项目事件，由 Workbench 组件处理
      window.dispatchEvent(new Event('close-project-requested'))
    },
    
    // 检查是否在输入框中
    isInInputField(element) {
      if (!element || !element.tagName) return false
      
      const tagName = element.tagName.toLowerCase()
      const inputTypes = ['input', 'textarea', 'select']
      
      if (inputTypes.includes(tagName)) {
        return true
      }
      
      // 检查是否有contenteditable属性
      if (element.contentEditable === 'true') {
        return true
      }
      
      return false
    },
    
    // 处理拖拽事件（在捕获阶段检查是否允许拖拽）
    handleDragEvent(event) {
      // 检查是否是类别项的拖拽（需要允许）
      let element = event.target
      while (element) {
        // 允许带有 class-item 类的元素拖拽（用于类别排序）
        if (element.classList?.contains('class-item')) {
          return  // 允许拖拽
        }
        element = element.parentElement
      }
      
      // 其他情况阻止拖拽
      event.preventDefault()
      event.stopPropagation()
      return false
    },
    
    // 阻止浏览器默认行为（选择等）
    preventDefaultBehavior(event) {
      // 检查是否在输入框中（需要保留选择功能）
      if (this.isInInputField(event.target)) {
        return
      }
      
      // 其他情况阻止默认行为
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

#app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 全局禁止文本选择 */
* {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

/* 输入框保留选择功能 */
input,
textarea,
[contenteditable="true"] {
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

/* 全局禁止拖拽 */
* {
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-drag: none;
}

/* 允许特定元素拖拽（类别项） */
.class-item[draggable="true"] {
  -webkit-user-drag: element;
  -khtml-user-drag: element;
  -moz-user-drag: element;
  -o-user-drag: element;
  user-drag: element;
  cursor: move;
}

/* 自定义标题栏样式 */
.title-bar {
  height: 32px;
  background: var(--color-bg-secondary, #f3f3f3);
  color: var(--color-text-primary, #3c3c3c);
  display: flex;
  align-items: center;
  -webkit-app-region: drag;
  user-select: none;
  border-bottom: 1px solid var(--color-border, #d4d4d4);
  position: relative;
  z-index: 9999;
}

/* 深色主题 */
body[data-theme="dark"] .title-bar {
  background: #252526;
  color: #cccccc;
  border-bottom-color: #3c3c3c;
}

.title-bar-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 0 0 16px;
}

.title-bar-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #3c3c3c);
  display: flex;
  align-items: center;
  gap: 8px;
}

body[data-theme="dark"] .title-bar-title {
  color: #cccccc;
}

.app-logo {
  flex-shrink: 0;
  color: var(--color-text-primary, #3c3c3c);
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.1));
  transition: all 0.3s ease;
}

body[data-theme="dark"] .app-logo {
  color: #ffffff;
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.3));
}

.app-logo:hover {
  transform: scale(1.05);
}

body[data-theme="dark"] .app-logo:hover {
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5));
}

.app-title-text {
  white-space: nowrap;
}

.title-bar-spacer {
  flex: 1;
}

.title-bar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 12px;
}

.title-bar-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--color-border, #d4d4d4);
  border-radius: 4px;
  color: var(--color-text-primary, #3c3c3c);
  font-size: 12px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: all 0.2s;
  height: 24px;
}

body[data-theme="dark"] .title-bar-action-btn {
  border-color: #3c3c3c;
  color: #cccccc;
}

.title-bar-action-btn:hover {
  background: var(--color-bg-tertiary, #e8e8e8);
  border-color: var(--color-primary, #007acc);
}

body[data-theme="dark"] .title-bar-action-btn:hover {
  background: #3c3c3c;
  border-color: #007acc;
}

.title-bar-action-btn svg {
  flex-shrink: 0;
}

.title-bar-action-btn span {
  color: inherit;
}

.title-bar-controls {
  display: flex;
  gap: 0;
}

.title-bar-button {
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-primary, #3c3c3c);
  cursor: pointer;
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  padding: 0;
  margin: 0;
  outline: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body[data-theme="dark"] .title-bar-button {
  color: #cccccc;
}

.title-bar-button svg {
  display: block;
  shape-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

.title-bar-button:hover {
  background: var(--color-bg-tertiary, #e8e8e8);
}

body[data-theme="dark"] .title-bar-button:hover {
  background: #3c3c3c;
}

.title-bar-button.close:hover {
  background: #e81123;
  color: #ffffff;
}

.app-content {
  flex: 1;
  overflow: hidden;
}
</style>

