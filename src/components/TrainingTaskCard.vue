<template>
  <div 
    class="training-task-card" 
    :class="{ 
      active: isActive,
      [task.status]: true 
    }"
    @click="$emit('select', task)">
    <div class="task-header">
      <div class="task-title-group">
        <div class="task-status-icon" :class="task.status">
          <el-icon v-if="task.status === 'running'" class="rotating">
            <Loading />
          </el-icon>
          <el-icon v-else-if="task.status === 'pending'">
            <Timer />
          </el-icon>
          <el-icon v-else-if="task.status === 'paused'">
            <VideoPause />
          </el-icon>
          <el-icon v-else-if="task.status === 'completed'">
            <CircleCheck />
          </el-icon>
          <el-icon v-else-if="task.status === 'failed' || task.status === 'cancelled'">
            <CircleClose />
          </el-icon>
        </div>
        <h4 class="task-name" :title="task.name">{{ task.name }}</h4>
      </div>
      <el-dropdown v-if="showActions" trigger="click" @command="handleCommand">
        <el-button text size="small" @click.stop>
          <el-icon><MoreFilled /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="pause" v-if="task.status === 'running'">
              <el-icon><VideoPause /></el-icon>
              暂停训练
            </el-dropdown-item>
            <el-dropdown-item command="resume" v-if="task.status === 'paused'">
              <el-icon><VideoPlay /></el-icon>
              继续训练
            </el-dropdown-item>
            <el-dropdown-item command="stop" v-if="task.status === 'running' || task.status === 'paused'">
              <el-icon><Close /></el-icon>
              停止训练
            </el-dropdown-item>
            <el-dropdown-item command="retrain" v-if="task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'" divided>
              <el-icon><RefreshRight /></el-icon>
              重新训练
            </el-dropdown-item>
            <el-dropdown-item command="export" v-if="task.status === 'completed'">
              <el-icon><Download /></el-icon>
              导出模型
            </el-dropdown-item>
            <el-dropdown-item command="delete" divided>
              <el-icon><Delete /></el-icon>
              删除任务
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div class="task-meta">
      <div class="meta-item">
        <el-icon><FolderOpened /></el-icon>
        <span>{{ task.dataset?.name || '未知数据集' }}</span>
      </div>
      <div class="meta-item">
        <el-icon><Collection /></el-icon>
        <span>{{ task.config?.yoloVersion || 'YOLOv8' }}{{ task.config?.modelSize || 's' }}</span>
      </div>
      <div class="meta-item" v-if="task.status === 'completed'">
        <el-icon><Timer /></el-icon>
        <span>{{ formatDate(task.completedAt) }}</span>
      </div>
    </div>

    <!-- 运行中状态 -->
    <div v-if="task.status === 'running' || task.status === 'paused'" class="task-progress">
      <div class="progress-info">
        <span class="progress-label">Epoch {{ task.progress?.currentEpoch || 0 }}/{{ task.progress?.totalEpochs || 100 }}</span>
        <span class="progress-eta">{{ task.progress?.eta || '--:--' }} • {{ formatSpeed(task.progress?.speed) }}</span>
      </div>
      <el-progress 
        :percentage="getProgressPercent()" 
        :status="task.status === 'paused' ? 'warning' : undefined"
        :stroke-width="4" />
      
      <div class="task-metrics-grid">
        <div class="metric-cell">
          <span class="metric-label">Train Loss</span>
          <span class="metric-value">{{ formatNumber(task.metrics?.trainLoss) }}</span>
        </div>
        <div class="metric-cell">
          <span class="metric-label">Val Loss</span>
          <span class="metric-value">{{ formatNumber(task.metrics?.valLoss) }}</span>
        </div>
        <div class="metric-cell">
          <span class="metric-label">mAP@0.5</span>
          <span class="metric-value highlight">{{ formatPercent(task.metrics?.map50) }}</span>
        </div>
        <div class="metric-cell">
          <span class="metric-label">Precision</span>
          <span class="metric-value">{{ formatPercent(task.metrics?.precision) }}</span>
        </div>
        <div class="metric-cell">
          <span class="metric-label">Recall</span>
          <span class="metric-value">{{ formatPercent(task.metrics?.recall) }}</span>
        </div>
      </div>
    </div>

    <!-- 已完成状态 -->
    <div v-else-if="task.status === 'completed'" class="task-result">
      <div class="task-metrics-grid completed">
        <div class="metric-cell">
          <span class="metric-label">mAP@0.5</span>
          <span class="metric-value success">{{ formatPercent(task.metrics?.map50) }}</span>
        </div>
        <div class="metric-cell">
          <span class="metric-label">mAP@0.5:0.95</span>
          <span class="metric-value">{{ formatPercent(task.metrics?.map5095) }}</span>
        </div>
        <div class="metric-cell">
          <span class="metric-label">Precision</span>
          <span class="metric-value">{{ formatPercent(task.metrics?.precision) }}</span>
        </div>
        <div class="metric-cell">
          <span class="metric-label">Recall</span>
          <span class="metric-value">{{ formatPercent(task.metrics?.recall) }}</span>
        </div>
        <div class="metric-cell">
          <span class="metric-label">Train Loss</span>
          <span class="metric-value">{{ formatNumber(task.metrics?.trainLoss) }}</span>
        </div>
        <div class="metric-cell">
          <span class="metric-label">Val Loss</span>
          <span class="metric-value">{{ formatNumber(task.metrics?.valLoss) }}</span>
        </div>
      </div>
    </div>

    <!-- 失败/取消状态 -->
    <div v-else-if="task.status === 'failed' || task.status === 'cancelled'" class="task-error">
      <div class="error-message">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ task.status === 'failed' ? '训练失败' : '已取消' }}</span>
      </div>
      <div class="task-time">
        <span>{{ formatDate(task.updatedAt || task.createdAt) }}</span>
      </div>
    </div>

    <!-- 等待中状态 -->
    <div v-else class="task-pending">
      <div class="pending-info">
        <el-icon><Clock /></el-icon>
        <span>等待训练</span>
      </div>
    </div>
  </div>
</template>

<script>
import { 
  MoreFilled, RefreshRight, Download, Delete,
  FolderOpened, Collection, Timer, WarningFilled, Clock,
  VideoPause, VideoPlay, Close, Loading, CircleCheck, CircleClose
} from '@element-plus/icons-vue'

export default {
  name: 'TrainingTaskCard',
  components: {
    MoreFilled, RefreshRight, Download, Delete,
    FolderOpened, Collection, Timer, WarningFilled, Clock,
    VideoPause, VideoPlay, Close, Loading, CircleCheck, CircleClose
  },
  props: {
    task: {
      type: Object,
      required: true
    },
    isActive: {
      type: Boolean,
      default: false
    },
    showActions: {
      type: Boolean,
      default: true
    }
  },
  emits: ['select', 'action'],
  methods: {
    handleCommand(command) {
      this.$emit('action', { action: command, task: this.task })
    },
    getProgressPercent() {
      if (!this.task.progress) return 0
      const current = this.task.progress.currentEpoch || 0
      const total = this.task.progress.totalEpochs || 100
      return Math.floor((current / total) * 100)
    },
    formatNumber(num) {
      if (num === null || num === undefined) return '--'
      return num.toFixed(4)
    },
    formatPercent(num) {
      if (num === null || num === undefined) return '--'
      return (num * 100).toFixed(1) + '%'
    },
    formatSpeed(speed) {
      if (speed === null || speed === undefined) return '0 img/s'
      
      // 如果已经是格式化后的字符串（包含 "img/s"），直接返回
      if (typeof speed === 'string') {
        if (speed.includes('img/s')) return speed
        // 尝试将字符串转换为数字
        const numSpeed = parseFloat(speed)
        if (isNaN(numSpeed) || numSpeed === 0) return '0 img/s'
        return `${numSpeed.toFixed(1)} img/s`
      }
      
      // 数字类型
      if (speed === 0) return '0 img/s'
      return `${speed.toFixed(1)} img/s`
    },
    formatDate(dateStr) {
      if (!dateStr) return '--'
      const date = new Date(dateStr)
      const now = new Date()
      const diff = now - date
      
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
      if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
      if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前'
      
      return date.toLocaleDateString('zh-CN')
    }
  }
}
</script>

<style scoped>
.training-task-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 380px;
  max-width: 480px;
}

.training-task-card:hover {
  border-color: var(--color-info);
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.1);
}

.training-task-card.active {
  border-color: var(--color-info);
  background: var(--color-bg-secondary);
}

.task-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.task-title-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.task-status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  font-size: 16px;
}

.task-status-icon.running {
  color: #67c23a;
}

.task-status-icon.pending {
  color: #e6a23c;
}

.task-status-icon.paused {
  color: #e6a23c;
}

.task-status-icon.completed {
  color: #67c23a;
}

.task-status-icon.failed,
.task-status-icon.cancelled {
  color: #f56c6c;
}

/* 旋转动画 - 用于 running 状态的 Loading 图标 */
.task-status-icon .rotating {
  animation: rotating 1.5s linear infinite;
}

@keyframes rotating {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.task-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.meta-item .el-icon {
  font-size: 12px;
}

.task-progress {
  margin-top: 8px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.progress-label,
.progress-eta {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.task-metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 10px;
}

.task-metrics-grid.completed {
  grid-template-columns: repeat(3, 1fr);
}

.metric-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px;
  background: var(--color-bg-secondary);
  border-radius: 3px;
}

.metric-cell .metric-label {
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.metric-cell .metric-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.metric-cell .metric-value.highlight {
  color: #67c23a;
  font-size: 15px;
  font-weight: 700;
}

.metric-cell .metric-value.success {
  color: #67c23a;
  font-weight: 700;
}

.task-result {
  margin-top: 8px;
}

.task-error {
  margin-top: 8px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: rgba(245, 108, 108, 0.1);
  border-radius: 3px;
  margin-bottom: 8px;
}

.error-message .el-icon {
  color: #f56c6c;
}

.error-message span {
  font-size: 12px;
  color: #f56c6c;
}

.task-pending {
  margin-top: 8px;
  padding: 16px;
  text-align: center;
}

.pending-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>

