<template>
  <div class="training-page">
    <!-- 硬件监控栏 -->
    <HardwareMonitor />

    <!-- 主内容区 -->
    <div class="training-content">
      <!-- 左侧主区域 -->
      <div class="main-section">
        <!-- 训练队列区 -->
        <div class="training-queue">
          <div class="queue-header">
            <h3>训练队列</h3>
            <el-button type="primary" size="small" @click="showNewTrainingDialog">
              <el-icon><Plus /></el-icon>
              新建训练
            </el-button>
          </div>
          
          <div class="queue-content">
            <div v-if="runningTasks.length === 0" class="empty-queue">
              <el-empty description="暂无训练任务">
                <el-button type="primary" @click="showNewTrainingDialog">
                  开始第一个训练任务
                </el-button>
              </el-empty>
            </div>
            
            <div v-else class="task-cards-container">
              <TrainingTaskCard
                v-for="task in runningTasks"
                :key="task.id"
                :task="task"
                :isActive="selectedTaskId === task.id"
                @select="selectTask"
                @action="handleTaskAction" />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧辅助栏 -->
      <div class="side-panel" :class="{ collapsed: sidePanelCollapsed }">
        <div class="panel-toggle" @click="toggleSidePanel">
          <el-icon>
            <component :is="sidePanelCollapsed ? 'DArrowLeft' : 'DArrowRight'" />
          </el-icon>
        </div>

        <div v-if="!sidePanelCollapsed" class="panel-content">
          <!-- 历史记录标签页 -->
          <el-tabs v-model="activeTab" class="side-tabs">
            <el-tab-pane label="训练历史" name="history">
              <div class="history-section">
                <div class="section-header">
                  <span class="section-title">已完成</span>
                  <el-button text size="small" @click="refreshHistory">
                    <el-icon><Refresh /></el-icon>
                  </el-button>
                </div>

                <div class="history-list">
                  <div v-if="completedTasks.length === 0" class="empty-history">
                    <el-empty description="暂无历史记录" :image-size="80" />
                  </div>
                  
                  <template v-else>
                    <TrainingTaskCard
                      v-for="task in completedTasks"
                      :key="task.id"
                      :task="task"
                      :showActions="true"
                      @select="viewTaskDetail"
                      @action="handleTaskAction" />
                  </template>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="模型管理" name="models">
              <div class="models-section">
                <div class="section-header">
                  <span class="section-title">已训练模型</span>
                </div>

                <div class="models-list">
                  <div v-if="completedTasks.length === 0" class="empty-models">
                    <el-empty description="暂无可用模型" :image-size="80" />
                  </div>
                  
                  <template v-else>
                    <div 
                      v-for="task in completedTasks"
                      :key="task.id"
                      class="model-item">
                      <div class="model-info">
                        <div class="model-name">{{ task.name }}</div>
                        <div class="model-meta">
                          <span>{{ task.config.yoloVersion }}{{ task.config.modelSize }}</span>
                          <span class="separator">•</span>
                          <span>mAP: {{ formatPercent(task.metrics?.map50) }}</span>
                        </div>
                      </div>
                      <el-dropdown trigger="click" @command="(cmd) => handleModelAction(cmd, task)">
                        <el-button text size="small">
                          <el-icon><MoreFilled /></el-icon>
                        </el-button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="export">
                              <el-icon><Download /></el-icon>
                              导出模型
                            </el-dropdown-item>
                            <el-dropdown-item command="evaluate">
                              <el-icon><DataAnalysis /></el-icon>
                              模型评估
                            </el-dropdown-item>
                            <el-dropdown-item command="open-folder">
                              <el-icon><FolderOpened /></el-icon>
                              打开目录
                            </el-dropdown-item>
                            <el-dropdown-item command="delete" divided style="color: var(--el-color-danger);">
                              <el-icon><Delete /></el-icon>
                              删除模型
                            </el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>
                  </template>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
    </div>
    </div>

    <!-- 新建训练对话框 -->
    <Modal
      v-model="newTrainingDialogVisible"
      title="新建训练任务"
      size="large"
      custom-width="800px"
      :show-footer="false">
      <TrainingConfigPanel
        :datasets="datasets"
        @start-training="handleStartTraining" />
    </Modal>

    <!-- 模型评估弹窗 -->
    <ModelEvaluationDialog
      v-model:visible="evaluationDialogVisible"
      :data="evaluationData"
      :task-name="currentEvaluationTask?.name"
      :completed-at="currentEvaluationTask?.completedAt"
      @open-folder="handleOpenEvaluationFolder"
      @open-chart="handleOpenChart" />

  </div>
</template>

<script>
import { Plus, Refresh, MoreFilled, Download, DataAnalysis, FolderOpened, DArrowLeft, DArrowRight, Delete } from '@element-plus/icons-vue'
import HardwareMonitor from '../components/HardwareMonitor.vue'
import TrainingTaskCard from '../components/TrainingTaskCard.vue'
import TrainingConfigPanel from '../components/TrainingConfigPanel.vue'
import Modal from '../components/Modal.vue'
import ModelEvaluationDialog from '../components/ModelEvaluationDialog.vue'
import trainingManager from '../utils/trainingManager'
import datasetManager from '../utils/datasetManager'
import { showLoading } from '../utils/loading'

export default {
  name: 'Training',
  components: {
    Plus,
    Refresh,
    MoreFilled,
    Download,
    DataAnalysis,
    FolderOpened,
    DArrowLeft,
    DArrowRight,
    Delete,
    HardwareMonitor,
    TrainingTaskCard,
    TrainingConfigPanel,
    Modal,
    ModelEvaluationDialog
  },
  data() {
    return {
      tasks: [],
      datasets: [],
      selectedTaskId: null,
      sidePanelCollapsed: false,
      activeTab: 'history',
      newTrainingDialogVisible: false,
      evaluationDialogVisible: false,
      evaluationData: null,
      evaluationLoading: false,
      currentEvaluationTask: null
    }
  },
  computed: {
    runningTasks() {
      // 过滤出活动中的任务
      const activeTasks = this.tasks.filter(t => 
        t.status === 'pending' || t.status === 'running' || t.status === 'paused'
      )
      
      // 排序规则：
      // 1. 正在训练的任务（running）排在最前面
      // 2. 然后是等待中的任务（pending），按创建时间先后顺序
      // 3. 暂停的任务（paused）排在最后
      return activeTasks.sort((a, b) => {
        // 状态优先级：running(1) < pending(2) < paused(3)
        const statusPriority = {
          'running': 1,
          'pending': 2,
          'paused': 3
        }
        
        const priorityDiff = statusPriority[a.status] - statusPriority[b.status]
        if (priorityDiff !== 0) return priorityDiff
        
        // 相同状态下，按创建时间排序（早创建的在前）
        return new Date(a.createdAt) - new Date(b.createdAt)
      })
    },
    completedTasks() {
      return this.tasks.filter(t => 
        t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
      )
    },
    selectedTask() {
      if (!this.selectedTaskId) return null
      return this.tasks.find(t => t.id === this.selectedTaskId)
    }
  },
  async mounted() {
    await this.init()
    this.setupEventListeners()
  },
  beforeUnmount() {
    this.removeEventListeners()
  },
  methods: {
    async init() {
      try {
        // 初始化训练管理器
        await trainingManager.init()
        this.tasks = trainingManager.getAllTasks()
        
        // 加载数据集列表
        this.datasets = await datasetManager.listDatasets()
        
        // 自动选择第一个运行中的任务
        if (this.runningTasks.length > 0) {
          this.selectedTaskId = this.runningTasks[0].id
        }
      } catch (error) {
        console.error('Failed to initialize training page:', error)
        this.$message.error('初始化失败')
      }
    },
    setupEventListeners() {
      trainingManager.on('statusChange', this.handleStatusChange)
      trainingManager.on('progressUpdate', this.handleProgressUpdate)
      trainingManager.on('metricsUpdate', this.handleMetricsUpdate)
      trainingManager.on('complete', this.handleTrainingComplete)
      trainingManager.on('autoStart', this.handleAutoStart)
    },
    removeEventListeners() {
      trainingManager.off('statusChange', this.handleStatusChange)
      trainingManager.off('progressUpdate', this.handleProgressUpdate)
      trainingManager.off('metricsUpdate', this.handleMetricsUpdate)
      trainingManager.off('complete', this.handleTrainingComplete)
      trainingManager.off('autoStart', this.handleAutoStart)
    },
    handleStatusChange(data) {
      this.tasks = trainingManager.getAllTasks()
    },
    handleProgressUpdate(data) {
      this.tasks = trainingManager.getAllTasks()
    },
    handleMetricsUpdate(data) {
      this.tasks = trainingManager.getAllTasks()
    },
    handleTrainingComplete(data) {
      this.tasks = trainingManager.getAllTasks()
      this.$message.success('训练完成！')
    },
    handleAutoStart(data) {
      this.tasks = trainingManager.getAllTasks()
      const task = this.tasks.find(t => t.id === data.taskId)
      if (task) {
        this.$message.info(`自动启动训练：${task.name}`)
      }
    },
    showNewTrainingDialog() {
      this.newTrainingDialogVisible = true
    },
    async handleStartTraining(config) {
      let closeLoading = null
      try {
        // 创建训练任务
        const task = await trainingManager.createTask(config)
        this.tasks = trainingManager.getAllTasks()
        
        // 更新任务列表以显示新创建的任务卡片
        this.selectedTaskId = task.id
        
        // 如果没有任务在运行，立即启动；否则加入队列等待
        if (!trainingManager.hasRunningTask()) {
          // 显示加载卡片
          closeLoading = showLoading('正在准备训练数据，请稍候...')
          
          await trainingManager.startTask(task.id)
          
          // 关闭加载卡片
          closeLoading()
          closeLoading = null
          
          this.$message.success('训练任务已启动')
        } else {
          this.$message.success('训练任务已加入队列，等待前面的任务完成')
        }
        
        this.newTrainingDialogVisible = false
        
      } catch (error) {
        console.error('Failed to start training:', error)
        if (closeLoading) {
          closeLoading()
        }
        this.$message.error(error.message || '创建训练任务失败')
      }
    },
    selectTask(task) {
      this.selectedTaskId = task.id
    },
    async handleTaskAction({ action, task }) {
      switch (action) {
        case 'pause':
          await this.handlePause(task.id)
          break
        case 'resume':
          await this.handleResume(task.id)
          break
        case 'stop':
          await this.handleStop(task.id)
          break
        case 'retrain':
          await this.handleRetrain(task)
          break
        case 'export':
          await this.exportModel(task)
          break
        case 'delete':
          await this.deleteTask(task)
          break
      }
    },
    async handlePause(taskId) {
      try {
        await trainingManager.pauseTask(taskId)
        this.tasks = trainingManager.getAllTasks()
        this.$message.success('已暂停训练')
      } catch (error) {
        console.error('Failed to pause:', error)
        this.$message.error('暂停失败')
      }
    },
    async handleResume(taskId) {
      try {
        await trainingManager.resumeTask(taskId)
        this.tasks = trainingManager.getAllTasks()
        this.$message.success('已继续训练')
      } catch (error) {
        console.error('Failed to resume:', error)
        this.$message.error('继续失败')
      }
    },
    async handleStop(taskId) {
      try {
        await this.$confirm('确定要停止训练吗？', '提示', {
          type: 'warning'
        })
        
        await trainingManager.stopTask(taskId)
        this.tasks = trainingManager.getAllTasks()
        if (this.selectedTaskId === taskId) {
          this.selectedTaskId = null
        }
        this.$message.success('已停止训练')
      } catch (error) {
        if (error !== 'cancel') {
          console.error('Failed to stop:', error)
          this.$message.error('停止失败')
        }
      }
    },
    async handleRetrain(task) {
      let closeLoading = null
      try {
        // 保存原任务配置
        const originalConfig = {
          name: task.name,  // 保持原名称
          dataset: task.dataset,
          outputPath: task.config.outputPath,  // 添加outputPath
          yoloVersion: task.config.yoloVersion,
          modelSize: task.config.modelSize,
          epochs: task.config.epochs,
          batchSize: task.config.batchSize,
          imageSize: task.config.imageSize,
          usePretrained: task.config.usePretrained,
          augmentation: task.config.augmentation,
          advanced: task.config.advanced
        }
        
        // 删除原任务
        await trainingManager.deleteTask(task.id)
        this.tasks = trainingManager.getAllTasks()
        
        // 创建新的同名任务
        const newTask = await trainingManager.createTask(originalConfig)
        this.selectedTaskId = newTask.id
        
        // 立即启动训练
        closeLoading = showLoading('正在准备训练数据，请稍候...')
        
        await trainingManager.startTask(newTask.id)
        
        closeLoading()
        closeLoading = null
        
        this.$message.success('重新训练任务已启动')
      } catch (error) {
        console.error('Failed to retrain:', error)
        if (closeLoading) {
          closeLoading()
        }
        this.$message.error(error.message || '重新训练失败')
      }
    },
    async handleModelAction(action, task) {
      try {
        switch (action) {
          case 'export':
            await this.exportModel(task)
            break
          case 'evaluate':
            await this.evaluateModel(task)
            break
          case 'open-folder':
            await this.openModelFolder(task)
            break
          case 'delete':
            await this.deleteModel(task)
            break
        }
      } catch (error) {
        console.error('Model action failed:', error)
        this.$message.error(error.message || '操作失败')
      }
    },

    async evaluateModel(task) {
      try {
        this.evaluationLoading = true
        this.currentEvaluationTask = task
        
        // 只传递可序列化的必要字段，使用深拷贝确保数据干净
        const evaluationData = JSON.parse(JSON.stringify({
          name: task.name,
          outputPath: task.outputPath,
          metrics: task.metrics || {},
          charts: task.charts || {}
        }))
        
        const result = await window.electronAPI.model.evaluate(evaluationData)
        
        if (!result.success) {
          throw new Error(result.error || '评估失败')
        }
        
        // 显示评估弹窗
        this.evaluationData = result.data
        this.evaluationDialogVisible = true
        
      } catch (error) {
        console.error('Model evaluation failed:', error)
        this.$message.error(error.message || '模型评估失败')
      } finally {
        this.evaluationLoading = false
      }
    },

    handleOpenEvaluationFolder() {
      if (this.currentEvaluationTask) {
        this.openModelFolder(this.currentEvaluationTask)
      }
    },

    async handleOpenChart(filename) {
      try {
        if (!this.evaluationData?.outputPath) return
        
        const chartPath = `${this.evaluationData.outputPath}/${filename}`
        const result = await window.electronAPI.model.openFolder(this.evaluationData.outputPath)
        
        if (!result.success) {
          this.$message.error('打开图表失败')
        }
      } catch (error) {
        console.error('Failed to open chart:', error)
        this.$message.error('打开图表失败')
      }
    },

    async exportModel(task) {
      if (!task.outputPath) {
        this.$message.warning('模型输出路径不存在')
        return
      }

      const result = await window.electronAPI.model.export(task.outputPath, task.name)
      
      if (result.success) {
        if (result.message) {
          this.$message.info(result.message)
        } else {
          this.$message.success('模型导出成功')
        }
      } else {
        if (result.error !== 'canceled') {
          throw new Error(result.error || '导出失败')
        }
      }
    },

    async openModelFolder(task) {
      if (!task.outputPath) {
        this.$message.warning('模型输出路径不存在')
        return
      }

      const result = await window.electronAPI.model.openFolder(task.outputPath)
      
      if (!result.success) {
        throw new Error(result.error || '打开目录失败')
      }
    },

    async deleteModel(task) {
      try {
        // 确认对话框
        await this.$confirm(
          `确定要删除模型"${task.name}"吗？\n\n此操作将：\n• 删除训练记录\n• 删除模型文件和目录\n\n此操作不可恢复！`,
          '删除模型',
          {
            confirmButtonText: '确定删除',
            cancelButtonText: '取消',
            type: 'warning',
            dangerouslyUseHTMLString: false
          }
        )
        
        // 1. 删除训练任务记录
        await trainingManager.deleteTask(task.id)
        
        // 2. 如果有输出目录，删除整个目录
        if (task.outputPath) {
          try {
            const deleteResult = await window.electronAPI.deleteDirectory(task.outputPath)
            if (deleteResult.success) {
              console.log('模型目录已删除:', task.outputPath)
            } else {
              console.warn('删除模型目录失败:', deleteResult.error)
              this.$message.warning('训练记录已删除，但模型目录删除失败: ' + deleteResult.error)
            }
          } catch (error) {
            console.error('删除模型目录时出错:', error)
            this.$message.warning('训练记录已删除，但模型目录删除失败')
          }
        }
        
        // 3. 刷新任务列表
        this.tasks = trainingManager.getAllTasks()
        
        // 4. 如果删除的是当前选中的任务，清空选中
        if (this.selectedTaskId === task.id) {
          this.selectedTaskId = null
        }
        
        this.$message.success('模型已删除')
      } catch (error) {
        if (error !== 'cancel') {
          console.error('Failed to delete model:', error)
          this.$message.error('删除失败: ' + (error.message || error))
        }
      }
    },

    async deleteTask(task) {
      try {
        await this.$confirm(`确定要删除训练任务"${task.name}"吗？`, '提示', {
          type: 'warning'
        })
        
        await trainingManager.deleteTask(task.id)
        this.tasks = trainingManager.getAllTasks()
        
        if (this.selectedTaskId === task.id) {
          this.selectedTaskId = null
        }
        
        this.$message.success('已删除任务')
      } catch (error) {
        if (error !== 'cancel') {
          console.error('Failed to delete task:', error)
          this.$message.error('删除失败')
        }
      }
    },
    async refreshHistory() {
      await trainingManager.loadTaskHistory()
      this.tasks = trainingManager.getAllTasks()
      this.$message.success('已刷新')
    },
    toggleSidePanel() {
      this.sidePanelCollapsed = !this.sidePanelCollapsed
    },
    getStatusType(status) {
      const typeMap = {
        pending: 'info',
        running: 'success',
        paused: 'warning',
        completed: 'primary',
        failed: 'danger',
        cancelled: 'info'
      }
      return typeMap[status] || 'info'
    },
    getStatusText(status) {
      const textMap = {
        pending: '等待中',
        running: '运行中',
        paused: '已暂停',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消'
      }
      return textMap[status] || status
    },
    formatPercent(num) {
      if (num === null || num === undefined) return '--'
      return (num * 100).toFixed(1) + '%'
    },
    formatDateTime(dateStr) {
      if (!dateStr) return '--'
      return new Date(dateStr).toLocaleString('zh-CN')
    }
  }
}
</script>

<style scoped>
.training-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  position: relative;
  padding-bottom: 40px; /* 为底部状态栏留出空间 */
}

.training-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.main-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 800px;
  overflow: hidden;
}

.training-queue {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.queue-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.queue-content {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  padding: 16px 20px;
}

.empty-queue {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-cards-container {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-content: flex-start;
}

.side-panel {
  width: 420px;
  border-left: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  position: relative;
  transition: width 0.3s;
  display: flex;
  flex-direction: column;
}

.side-panel.collapsed {
  width: 40px;
}

.panel-toggle {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 60px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-left: none;
  border-radius: 0 4px 4px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
}

.panel-toggle:hover {
  background: var(--color-bg-tertiary);
}

.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允许缩小 */
}

.side-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允许缩小 */
}

.side-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
}

.side-tabs :deep(.el-tabs__item) {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.side-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-info);
}

.side-tabs :deep(.el-tabs__item:hover) {
  color: var(--color-text-primary);
}

.side-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允许缩小 */
}

.side-tabs :deep(.el-tab-pane) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允许缩小以启用滚动 */
}

.history-section,
.models-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允许flex子项缩小 */
}

.section-header {
  flex-shrink: 0; /* 固定头部，不参与缩放 */
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-primary);
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: 0.3px;
}

.history-list,
.models-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden; /* 防止横向滚动 */
  padding: 12px;
  background: var(--color-bg-secondary);
  min-height: 0; /* 关键：允许flex子项缩小以启用滚动 */
  /* 自定义滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

/* 列表项间距 */
.history-list > * + *,
.models-list > * + * {
  margin-top: 12px;
}

.history-list::-webkit-scrollbar,
.models-list::-webkit-scrollbar {
  width: 6px;
}

.history-list::-webkit-scrollbar-track,
.models-list::-webkit-scrollbar-track {
  background: transparent;
}

.history-list::-webkit-scrollbar-thumb,
.models-list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.history-list::-webkit-scrollbar-thumb:hover,
.models-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-tertiary);
}

.empty-history,
.empty-models {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-history :deep(.el-empty__description),
.empty-models :deep(.el-empty__description) {
  color: #909090;
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.model-item:hover {
  border-color: var(--color-info);
  background: var(--color-bg-secondary);
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.15);
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-size: 13px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-meta {
  font-size: 11px;
  color: #b0b0b0;
  font-weight: 500;
}

.separator {
  margin: 0 6px;
  color: #606060;
}

/* 滚动条 */
.queue-content::-webkit-scrollbar,
.history-list::-webkit-scrollbar,
.models-list::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.queue-content::-webkit-scrollbar-track,
.history-list::-webkit-scrollbar-track,
.models-list::-webkit-scrollbar-track {
  background: transparent;
}

.queue-content::-webkit-scrollbar-thumb,
.history-list::-webkit-scrollbar-thumb,
.models-list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.queue-content::-webkit-scrollbar-thumb:hover,
.history-list::-webkit-scrollbar-thumb:hover,
.models-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-tertiary);
}

/* Element Plus 组件深色优化 */
:deep(.el-dropdown-menu__item) {
  color: #e0e0e0;
}

:deep(.el-dropdown-menu__item:hover) {
  background: var(--color-bg-tertiary);
  color: #ffffff;
}

:deep(.el-dropdown-menu__item .el-icon) {
  color: #b0b0b0;
}

:deep(.el-tag) {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
  color: #e0e0e0;
}
</style>
