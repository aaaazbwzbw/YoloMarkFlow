<template>
  <div class="training-monitor">
    <div class="monitor-header">
      <h3>{{ task.name }}</h3>
      <div class="control-buttons">
        <el-button 
          v-if="task.status === 'running'"
          size="small" 
          @click="$emit('pause', task.id)">
          <el-icon><VideoPause /></el-icon>
          暂停
        </el-button>
        <el-button 
          v-if="task.status === 'paused'"
          size="small" 
          type="success"
          @click="$emit('resume', task.id)">
          <el-icon><VideoPlay /></el-icon>
          继续
        </el-button>
        <el-button 
          v-if="task.status === 'running' || task.status === 'paused'"
          size="small" 
          type="danger"
          @click="$emit('stop', task.id)">
          <el-icon><Close /></el-icon>
          停止
        </el-button>
        <el-button 
          v-if="task.status === 'running'"
          size="small"
          @click="$emit('save-checkpoint', task.id)">
          <el-icon><Document /></el-icon>
          保存检查点
        </el-button>
      </div>
    </div>

    <div class="monitor-content">
      <!-- 左侧：图表和指标 -->
      <div class="charts-section">
        <!-- 进度信息 -->
        <div class="progress-section">
          <div class="progress-card">
            <div class="card-title">训练进度</div>
            <div class="progress-details">
              <div class="progress-item">
                <span class="label">当前 Epoch</span>
                <span class="value">{{ task.progress?.currentEpoch || 0 }} / {{ task.progress?.totalEpochs || 0 }}</span>
              </div>
              <el-progress 
                :percentage="getProgressPercent()" 
                :stroke-width="8"
                :status="task.status === 'paused' ? 'warning' : undefined" />
              <div class="progress-meta">
                <div class="meta-item">
                  <el-icon><Timer /></el-icon>
                  <span>剩余时间: {{ task.progress?.eta || '--:--' }}</span>
                </div>
                <div class="meta-item">
                  <el-icon><Odometer /></el-icon>
                  <span>速度: {{ task.progress?.speed || '0' }} img/s</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 实时指标 -->
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">Train Loss</div>
              <div class="metric-value loss">{{ formatNumber(task.metrics?.trainLoss) }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Val Loss</div>
              <div class="metric-value loss">{{ formatNumber(task.metrics?.valLoss) }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">mAP@0.5</div>
              <div class="metric-value success">{{ formatPercent(task.metrics?.map50) }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">mAP@0.5:0.95</div>
              <div class="metric-value">{{ formatPercent(task.metrics?.map5095) }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Precision</div>
              <div class="metric-value">{{ formatPercent(task.metrics?.precision) }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Recall</div>
              <div class="metric-value">{{ formatPercent(task.metrics?.recall) }}</div>
            </div>
          </div>
        </div>

        <!-- 图表 -->
        <div class="chart-container">
          <div class="chart-card">
            <div class="card-title">Loss 曲线</div>
            <div ref="lossChart" class="chart"></div>
          </div>
          <div class="chart-card">
            <div class="card-title">精度指标</div>
            <div ref="metricsChart" class="chart"></div>
          </div>
        </div>
      </div>

      <!-- 右侧：日志 -->
      <div class="logs-section">
        <div class="logs-header">
          <div class="card-title">训练日志</div>
          <div class="logs-actions">
            <el-input 
              v-model="logSearch"
              placeholder="搜索日志"
              size="small"
              clearable
              style="width: 200px">
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button 
              text 
              size="small"
              @click="clearLogs">
              清空
            </el-button>
          </div>
        </div>
        <div class="logs-content" ref="logsContent">
          <div 
            v-for="(log, index) in filteredLogs"
            :key="index"
            class="log-line"
            :class="log.level">
            <span class="log-time">[{{ log.time }}]</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
          <div v-if="filteredLogs.length === 0" class="logs-empty">
            暂无日志
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import { 
  VideoPause, VideoPlay, Close, Document,
  Timer, Odometer, Search
} from '@element-plus/icons-vue'

export default {
  name: 'TrainingMonitor',
  components: {
    VideoPause, VideoPlay, Close, Document,
    Timer, Odometer, Search
  },
  props: {
    task: {
      type: Object,
      required: true
    }
  },
  emits: ['pause', 'resume', 'stop', 'save-checkpoint'],
  data() {
    return {
      logSearch: '',
      logs: [],
      lossChart: null,
      metricsChart: null
    }
  },
  computed: {
    filteredLogs() {
      if (!this.logSearch) return this.logs
      return this.logs.filter(log => 
        log.message.toLowerCase().includes(this.logSearch.toLowerCase())
      )
    }
  },
  watch: {
    'task.charts': {
      handler() {
        this.updateCharts()
      },
      deep: true
    }
  },
  mounted() {
    this.initCharts()
    this.loadLogs()
  },
  beforeUnmount() {
    if (this.lossChart) this.lossChart.dispose()
    if (this.metricsChart) this.metricsChart.dispose()
  },
  methods: {
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
    initCharts() {
      // Loss 图表
      this.lossChart = echarts.init(this.$refs.lossChart, 'dark')
      this.lossChart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis'
        },
        legend: {
          data: ['Train Loss', 'Val Loss'],
          textStyle: { color: '#cccccc' }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          name: 'Epoch',
          data: []
        },
        yAxis: {
          type: 'value',
          name: 'Loss'
        },
        series: [
          {
            name: 'Train Loss',
            type: 'line',
            smooth: true,
            data: [],
            itemStyle: { color: '#67c23a' }
          },
          {
            name: 'Val Loss',
            type: 'line',
            smooth: true,
            data: [],
            itemStyle: { color: '#e6a23c' }
          }
        ]
      })

      // 精度指标图表
      this.metricsChart = echarts.init(this.$refs.metricsChart, 'dark')
      this.metricsChart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis'
        },
        legend: {
          data: ['mAP@0.5', 'Precision', 'Recall'],
          textStyle: { color: '#cccccc' }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          name: 'Epoch',
          data: []
        },
        yAxis: {
          type: 'value',
          name: 'Score',
          min: 0,
          max: 1
        },
        series: [
          {
            name: 'mAP@0.5',
            type: 'line',
            smooth: true,
            data: [],
            itemStyle: { color: '#409eff' }
          },
          {
            name: 'Precision',
            type: 'line',
            smooth: true,
            data: [],
            itemStyle: { color: '#67c23a' }
          },
          {
            name: 'Recall',
            type: 'line',
            smooth: true,
            data: [],
            itemStyle: { color: '#e6a23c' }
          }
        ]
      })

      // 响应窗口大小变化
      window.addEventListener('resize', this.handleResize)
    },
    handleResize() {
      this.lossChart?.resize()
      this.metricsChart?.resize()
    },
    updateCharts() {
      if (!this.task.charts) return

      const lossHistory = this.task.charts.lossHistory || []
      const metricsHistory = this.task.charts.metricsHistory || []

      // 更新 Loss 图表
      if (lossHistory.length > 0) {
        const epochs = lossHistory.map(item => item[0])
        const trainLoss = lossHistory.map(item => item[1])
        const valLoss = lossHistory.map(item => item[2])

        this.lossChart.setOption({
          xAxis: { data: epochs },
          series: [
            { data: trainLoss },
            { data: valLoss }
          ]
        })
      }

      // 更新精度图表
      if (metricsHistory.length > 0) {
        const epochs = metricsHistory.map(item => item[0])
        const map50 = metricsHistory.map(item => item[1])
        const precision = metricsHistory.map(item => item[2])
        const recall = metricsHistory.map(item => item[3])

        this.metricsChart.setOption({
          xAxis: { data: epochs },
          series: [
            { data: map50 },
            { data: precision },
            { data: recall }
          ]
        })
      }
    },
    loadLogs() {
      // Mock 日志数据
      this.logs = [
        { time: '10:30:01', level: 'info', message: '开始训练...' },
        { time: '10:30:02', level: 'info', message: '加载数据集: 100 images' },
        { time: '10:30:05', level: 'info', message: 'Epoch 1/100 - Loss: 0.5234' },
        { time: '10:30:10', level: 'info', message: 'Epoch 2/100 - Loss: 0.4521' },
        { time: '10:30:15', level: 'success', message: 'Validation - mAP@0.5: 0.6523' }
      ]
      this.scrollLogsToBottom()
    },
    addLog(level, message) {
      const time = new Date().toLocaleTimeString('zh-CN')
      this.logs.push({ time, level, message })
      this.$nextTick(() => {
        this.scrollLogsToBottom()
      })
    },
    clearLogs() {
      this.logs = []
    },
    scrollLogsToBottom() {
      if (this.$refs.logsContent) {
        this.$refs.logsContent.scrollTop = this.$refs.logsContent.scrollHeight
      }
    }
  }
}
</script>

<style scoped>
.training-monitor {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.monitor-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.control-buttons {
  display: flex;
  gap: 8px;
}

.monitor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.charts-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px;
  gap: 16px;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.progress-card,
.chart-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 16px;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

.progress-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-item .label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.progress-item .value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.progress-meta {
  display: flex;
  gap: 24px;
  margin-top: 4px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.metric-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 12px;
  text-align: center;
}

.metric-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 8px;
}

.metric-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.metric-value.loss {
  color: #e6a23c;
}

.metric-value.success {
  color: #67c23a;
}

.chart-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.chart {
  height: 250px;
}

.logs-section {
  width: 400px;
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.logs-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.logs-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
}

.log-line {
  padding: 4px 8px;
  margin-bottom: 2px;
  border-radius: 2px;
  line-height: 1.5;
}

.log-line.info {
  color: var(--color-text-secondary);
}

.log-line.success {
  color: #67c23a;
  background: rgba(103, 194, 58, 0.1);
}

.log-line.warning {
  color: #e6a23c;
  background: rgba(230, 162, 60, 0.1);
}

.log-line.error {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
}

.log-time {
  color: var(--color-text-tertiary);
  margin-right: 8px;
}

.logs-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

/* 滚动条 */
.charts-section::-webkit-scrollbar,
.logs-content::-webkit-scrollbar {
  width: 6px;
}

.charts-section::-webkit-scrollbar-track,
.logs-content::-webkit-scrollbar-track {
  background: transparent;
}

.charts-section::-webkit-scrollbar-thumb,
.logs-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.charts-section::-webkit-scrollbar-thumb:hover,
.logs-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-tertiary);
}
</style>

