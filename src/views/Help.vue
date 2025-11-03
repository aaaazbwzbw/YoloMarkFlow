<template>
  <div class="page-container">
    <div class="page-header">
      <h2>帮助</h2>
      <p class="page-description">查看文档、教程和关于信息</p>
    </div>
    <div class="page-content">
      <div class="help-section">
        <h3>快速开始</h3>
        <div class="help-card">
          <el-icon size="32"><Document /></el-icon>
          <h4>用户手册</h4>
          <p>查看完整的使用文档</p>
          <el-button type="primary" text @click="showManual">查看文档</el-button>
        </div>
        <div class="help-card">
          <el-icon size="32"><VideoPlay /></el-icon>
          <h4>视频教程</h4>
          <p>观看操作演示视频</p>
          <el-button type="primary" text>观看视频</el-button>
        </div>
      </div>

      <div class="help-section">
        <h3>关于</h3>
        <div class="about-info">
          <div class="about-logo">
            <div class="logo">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            <h3>YoloMarkFlow</h3>
          </div>
          <p>版本: v{{ appVersion }}</p>
          <p>一站式视觉AI训练平台</p>
        </div>
      </div>
    </div>

    <!-- 用户手册 Modal -->
    <Modal
      v-model="manualVisible"
      title="用户手册"
      size="large"
      custom-width="90%"
      :show-footer="false">
      <div class="manual-content" v-html="manualHtml" @click="handleManualClick"></div>
    </Modal>
  </div>
</template>

<script>
import { marked } from 'marked'
import Modal from '../components/Modal.vue'

export default {
  name: 'Help',
  components: {
    Modal
  },
  data() {
    return {
      appVersion: '1.0.1',
      manualVisible: false,
      manualHtml: ''
    }
  },
  async mounted() {
    await this.loadAppVersion()
  },
  methods: {
    async loadAppVersion() {
      try {
        const result = await window.electronAPI.getAppVersion()
        if (result.success) {
          this.appVersion = result.version
        }
      } catch (error) {
        console.error('获取版本信息失败:', error)
      }
    },
    async showManual() {
      try {
        // 读取用户手册文件
        const result = await window.electronAPI.readUserManual()
        if (result.success) {
          // 配置 marked 选项
          marked.setOptions({
            breaks: true,
            gfm: true
          })
          // 渲染 markdown 为 HTML
          this.manualHtml = marked.parse(result.content)
          this.manualVisible = true
        } else {
          this.$message.error('读取用户手册失败')
        }
      } catch (error) {
        console.error('显示用户手册失败:', error)
        this.$message.error('显示用户手册失败')
      }
    },
    handleManualClick(event) {
      // 处理用户手册中的链接点击
      const target = event.target
      if (target.tagName === 'A') {
        event.preventDefault()
        const href = target.getAttribute('href')
        
        if (!href) return
        
        // 如果是锚点链接（页面内跳转）
        if (href.startsWith('#')) {
          const targetId = href.substring(1)
          const targetElement = document.getElementById(targetId)
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' })
          }
        } else {
          // 如果是外部链接，使用系统默认浏览器打开
          window.electronAPI.openExternal(href)
        }
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

.help-section {
  margin-bottom: 40px;
  text-align: center;
}

.help-section h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 20px 0;
}

.help-card {
  display: inline-block;
  width: 240px;
  padding: 24px;
  margin-right: 16px;
  margin-bottom: 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  text-align: center;
  vertical-align: top;
  transition: background-color 0.15s;
}

.help-card:hover {
  background: var(--color-bg-tertiary);
}

.help-card .el-icon {
  color: var(--color-info);
  margin-bottom: 12px;
}

.help-card h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.help-card p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 16px 0;
}

.about-info {
  padding: 32px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  text-align: center;
  max-width: 500px;
  margin: 0 auto;
}

.about-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.about-logo .logo {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333333;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

body[data-theme="dark"] .about-logo .logo {
  color: #ffffff;
}

.about-logo .logo svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.1));
  transition: all 0.3s ease;
}

body[data-theme="dark"] .about-logo .logo svg {
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.3));
}

.about-logo .logo:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px var(--color-shadow, rgba(0, 0, 0, 0.1));
}

body[data-theme="dark"] .about-logo .logo:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

body[data-theme="dark"] .about-logo .logo:hover svg {
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5));
}

.about-logo h3 {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.about-info p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 8px 0;
}

/* 用户手册样式 */
.manual-content {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
  color: var(--color-text-primary);
  line-height: 1.8;
}

.manual-content :deep(h1) {
  font-size: 28px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 24px 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--color-border);
}

.manual-content :deep(h2) {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 20px 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border);
}

.manual-content :deep(h3) {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 16px 0 10px 0;
}

.manual-content :deep(h4) {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 14px 0 8px 0;
}

.manual-content :deep(p) {
  margin: 8px 0;
  color: var(--color-text-secondary);
}

.manual-content :deep(ul),
.manual-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
  color: var(--color-text-secondary);
}

.manual-content :deep(li) {
  margin: 4px 0;
}

.manual-content :deep(code) {
  background: var(--color-bg-tertiary);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  color: var(--color-info);
}

.manual-content :deep(pre) {
  background: var(--color-bg-tertiary);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 12px 0;
}

.manual-content :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--color-text-primary);
}

.manual-content :deep(blockquote) {
  border-left: 4px solid var(--color-info);
  padding-left: 16px;
  margin: 12px 0;
  color: var(--color-text-secondary);
  font-style: italic;
}

.manual-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

.manual-content :deep(table th),
.manual-content :deep(table td) {
  border: 1px solid var(--color-border);
  padding: 8px 12px;
  text-align: left;
}

.manual-content :deep(table th) {
  background: var(--color-bg-tertiary);
  font-weight: 600;
  color: var(--color-text-primary);
}

.manual-content :deep(table td) {
  color: var(--color-text-secondary);
}

.manual-content :deep(a) {
  color: var(--color-info);
  text-decoration: none;
}

.manual-content :deep(a:hover) {
  text-decoration: underline;
}

.manual-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 12px 0;
}

.manual-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 20px 0;
}
</style>

