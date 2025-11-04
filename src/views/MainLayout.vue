<template>
  <div class="main-layout">
    <!-- 左侧菜单栏 -->
    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
      <!-- 项目Logo和标题 -->
      <div class="sidebar-header">
        <div class="logo-container">
          <div class="logo">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <h1 class="app-title">YoloMarkFlow</h1>
        </div>
      </div>
      
      <!-- 折叠按钮固定在边框上 -->
      <button class="collapse-btn" @click="toggleCollapse" :title="isCollapsed ? '展开菜单' : '折叠菜单'">
        <el-icon>
          <DArrowRight v-if="isCollapsed" />
          <DArrowLeft v-else />
        </el-icon>
      </button>

      <!-- 主菜单 -->
      <nav class="main-menu">
        <div class="menu-item" 
             :class="{ active: currentRoute === '/workbench' || currentRoute === '/classification', disabled: !hasProject }"
             @click="hasProject ? navigateToWorkbench() : showProjectRequiredMessage()"
             :title="isCollapsed ? '标注工作台' : ''">
          <el-icon><Edit /></el-icon>
          <div class="menu-text">
            <span class="menu-title">标注工作台</span>
          </div>
        </div>

        <div class="menu-item" 
             :class="{ active: currentRoute === '/training' }"
             @click="navigateTo('/training')"
             :title="isCollapsed ? '模型训练' : ''">
          <el-icon><Monitor /></el-icon>
          <div class="menu-text">
            <span class="menu-title">模型训练</span>
          </div>
        </div>

        <div class="menu-item" 
             :class="{ active: currentRoute === '/datasets' }"
             @click="navigateTo('/datasets')"
             :title="isCollapsed ? '数据集管理' : ''">
          <el-icon><Files /></el-icon>
          <div class="menu-text">
            <span class="menu-title">数据集管理</span>
          </div>
        </div>

        <div class="menu-item menu-item-disabled" 
             :class="{ active: currentRoute === '/modelhub' }"
             @click="navigateTo('/modelhub')"
             :title="isCollapsed ? '模型仓库' : ''">
          <el-icon><Box /></el-icon>
          <div class="menu-text">
            <span class="menu-title">模型仓库</span>
          </div>
        </div>

        <div class="menu-divider"></div>

        <div class="menu-item" 
             :class="{ active: currentRoute === '/settings' }"
             @click="navigateTo('/settings')"
             :title="isCollapsed ? '设置' : ''">
          <el-icon><Setting /></el-icon>
          <div class="menu-text">
            <span class="menu-title">设置</span>
          </div>
        </div>

        <div class="menu-item" 
             :class="{ active: currentRoute === '/help' }"
             @click="navigateTo('/help')"
             :title="isCollapsed ? '帮助' : ''">
          <el-icon><QuestionFilled /></el-icon>
          <div class="menu-text">
            <span class="menu-title">帮助</span>
          </div>
        </div>
      </nav>

      <!-- 用户信息卡片 -->
      <div class="user-card">
        <div class="user-avatar">
          <el-icon size="32"><User /></el-icon>
        </div>
        <div class="user-info">
          <div class="user-name">未登录</div>
          <div class="user-level">免费版</div>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script>
import { getCurrentProject } from '../utils/projectManager'

export default {
  name: 'MainLayout',
  data() {
    return {
      currentRoute: '/workbench',
      hasProject: false,
      isCollapsed: false
    }
  },
  watch: {
    $route: {
      handler(newRoute) {
        this.currentRoute = newRoute.path
      },
      immediate: true
    }
  },
  mounted() {
    // 检查是否有当前项目
    this.checkProject()
    
    // 监听项目变化
    window.addEventListener('project-changed', this.checkProject)
    
    // 加载折叠状态
    const collapsed = localStorage.getItem('sidebar-collapsed')
    if (collapsed !== null) {
      this.isCollapsed = collapsed === 'true'
    }
  },
  beforeUnmount() {
    window.removeEventListener('project-changed', this.checkProject)
  },
  methods: {
    checkProject() {
      this.hasProject = !!getCurrentProject()
    },
    navigateTo(path) {
      this.$router.push(path)
    },
    navigateToWorkbench() {
      // 根据项目类型跳转到对应工作台
      const project = getCurrentProject()
      if (project && project.type === 'classification') {
        this.$router.push('/classification')
      } else {
        this.$router.push('/workbench')
      }
    },
    showProjectRequiredMessage() {
      this.$message.warning('请先打开或创建一个项目')
    },
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
      localStorage.setItem('sidebar-collapsed', this.isCollapsed)
    }
  }
}
</script>

<style scoped>
.main-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  width: 100%;
  height: 100%;
  background: #ffffff;
  transition: grid-template-columns 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  position: relative;
}

.main-layout:has(.sidebar.collapsed) {
  grid-template-columns: 70px 1fr;
}

/* 左侧菜单栏 */
.sidebar {
  background: var(--color-bg-primary, #ffffff);
  color: var(--color-text-primary, #3c3c3c);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border, #d4d4d4);
  overflow: visible;
  position: relative;
  z-index: 100;
  transition: background-color 0.3s ease;
}

body[data-theme="dark"] .sidebar {
  background: #1e1e1e;
  color: #cccccc;
  border-right-color: #3c3c3c;
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid var(--color-border, #d4d4d4);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: padding 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

body[data-theme="dark"] .sidebar-header {
  border-bottom-color: #3c3c3c;
}

.sidebar.collapsed .sidebar-header {
  padding: 24px 15px;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 12px;
  transition: gap 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar.collapsed .logo-container {
  gap: 0;
  justify-content: center;
}

.logo {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #f3f3f3 0%, #e8e8e8 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary, #3c3c3c);
  flex-shrink: 0;
  transition: all 0.3s ease;
}

body[data-theme="dark"] .logo {
  background: linear-gradient(135deg, #252526 0%, #333333 100%);
  color: #ffffff;
}

.logo svg {
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.1));
  transition: all 0.3s ease;
}

body[data-theme="dark"] .logo svg {
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.3));
}

.logo:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px var(--color-shadow, rgba(0, 0, 0, 0.1));
}

body[data-theme="dark"] .logo:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

body[data-theme="dark"] .logo:hover svg {
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5));
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary, #3c3c3c);
  white-space: nowrap;
  overflow: hidden;
  max-width: 200px;
  transition: max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 1;
}

body[data-theme="dark"] .app-title {
  color: #cccccc;
}

.sidebar.collapsed .app-title {
  max-width: 0;
  opacity: 0;
}

.collapse-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  right: -14px;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #d4d4d4);
  color: var(--color-text-primary, #3c3c3c);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease,
              border-color 0.2s ease,
              box-shadow 0.2s ease;
  z-index: 1000;
  box-shadow: 0 2px 8px var(--color-shadow, rgba(0, 0, 0, 0.1));
}

body[data-theme="dark"] .collapse-btn {
  background: #252526;
  border-color: #3c3c3c;
  color: #cccccc;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.collapse-btn:hover {
  background: var(--color-bg-tertiary, #e8e8e8);
  border-color: var(--color-primary, #007acc);
  box-shadow: 0 4px 12px var(--color-shadow, rgba(0, 0, 0, 0.15));
}

body[data-theme="dark"] .collapse-btn:hover {
  background: #3c3c3c;
  border-color: #007acc;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
}

.collapse-btn:active {
  transform: translateY(-50%) scale(0.95);
}

/* 项目操作区 */
/* 主菜单 */
.main-menu {
  flex: 1;
  padding: 12px 0;
  overflow: hidden;
  position: relative;
}

.main-menu:hover {
  overflow-y: auto;
  overflow-x: hidden;
}

/* 滚动条样式 */
.main-menu::-webkit-scrollbar {
  width: 4px;
}

.main-menu::-webkit-scrollbar-track {
  background: transparent;
}

.main-menu::-webkit-scrollbar-thumb {
  background: var(--color-border, #d4d4d4);
  border-radius: 2px;
}

body[data-theme="dark"] .main-menu::-webkit-scrollbar-thumb {
  background: #3c3c3c;
}

.main-menu::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary, #007acc);
}

body[data-theme="dark"] .main-menu::-webkit-scrollbar-thumb:hover {
  background: #007acc;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  cursor: pointer;
  transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              padding 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              gap 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  height: 48px;
  box-sizing: border-box;
}

.sidebar.collapsed .menu-item {
  padding: 14px;
  gap: 0;
  justify-content: center;
  height: 48px;
}

.menu-item:hover {
  background: var(--color-bg-secondary, #f3f3f3);
}

body[data-theme="dark"] .menu-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.menu-item.active {
  background: var(--color-bg-tertiary, #e8e8e8);
  border-left: 3px solid var(--color-primary, #007acc);
}

body[data-theme="dark"] .menu-item.active {
  background: rgba(255, 255, 255, 0.1);
  border-left-color: #007acc;
}

.menu-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-item.disabled:hover {
  background: transparent;
}

.menu-item .el-icon {
  font-size: 20px;
  color: var(--color-text-secondary, #616161);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

body[data-theme="dark"] .menu-item .el-icon {
  color: #9d9d9d;
}

.menu-item.active .el-icon {
  color: var(--color-primary, #007acc);
}

body[data-theme="dark"] .menu-item.active .el-icon {
  color: #007acc;
}

.menu-text {
  overflow: hidden;
  display: flex;
  align-items: center;
  height: 20px;
  max-width: 200px;
  transition: max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 1;
}

.sidebar.collapsed .menu-text {
  max-width: 0;
  opacity: 0;
}

.menu-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #3c3c3c);
  white-space: nowrap;
  line-height: 20px;
}

body[data-theme="dark"] .menu-title {
  color: #cccccc;
}

.menu-item.active .menu-title {
  color: var(--color-primary, #007acc);
  font-weight: 600;
}

body[data-theme="dark"] .menu-item.active .menu-title {
  color: #007acc;
}

.menu-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-divider {
  height: 1px;
  background: var(--color-border, #d4d4d4);
  margin: 12px 20px;
}

body[data-theme="dark"] .menu-divider {
  background: #3c3c3c;
}

/* 用户信息卡片 */
.user-card {
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-bg-secondary);
  transition: padding 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              gap 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.sidebar.collapsed .user-card {
  padding: 16px 11px;
  gap: 0;
  justify-content: center;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.user-info {
  overflow: hidden;
  max-width: 150px;
  transition: max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 1;
}

.sidebar.collapsed .user-info {
  max-width: 0;
  opacity: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-level {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Fade过渡动画 - 优化时间和缓动 */
.fade-enter-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.1s;
}

.fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 主内容区 */
.main-content {
  background: #f5f5f5;
  overflow: hidden;
  min-width: 0;
  position: relative;
  z-index: 1;
}
</style>

