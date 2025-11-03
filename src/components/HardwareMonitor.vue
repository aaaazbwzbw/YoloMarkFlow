<template>
  <div class="hardware-monitor">
    <div class="monitor-content">
      <!-- GPU 信息 -->
      <div class="hw-item">
        <div class="hw-header">
          <el-icon class="hw-icon gpu"><VideoPlay /></el-icon>
          <span class="hw-title">GPU</span>
        </div>
        <div class="hw-body">
          <div class="hw-main-metric">
            <div class="progress-wrapper">
              <el-progress 
                :percentage="hardwareInfo.gpu.usage" 
                :color="getProgressColor(hardwareInfo.gpu.usage)"
                :show-text="false"
                :stroke-width="4" />
            </div>
            <span class="metric-value">{{ hardwareInfo.gpu.usage }}%</span>
          </div>
          <div class="hw-sub-metrics">
            <span class="sub-metric">
              <span class="sub-label">显存</span>
              <span class="sub-value">{{ hardwareInfo.gpu.memoryUsed }}/{{ hardwareInfo.gpu.memoryTotal }}GB</span>
            </span>
            <span class="sub-metric">
              <span class="sub-label">温度</span>
              <span class="sub-value" :class="getTempClass(hardwareInfo.gpu.temp)">{{ hardwareInfo.gpu.temp }}°C</span>
            </span>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- CPU 信息 -->
      <div class="hw-item">
        <div class="hw-header">
          <el-icon class="hw-icon cpu"><Cpu /></el-icon>
          <span class="hw-title">CPU</span>
        </div>
        <div class="hw-body">
          <div class="hw-main-metric">
            <div class="progress-wrapper">
              <el-progress 
                :percentage="hardwareInfo.cpu.usage" 
                :color="getProgressColor(hardwareInfo.cpu.usage)"
                :show-text="false"
                :stroke-width="4" />
            </div>
            <span class="metric-value">{{ hardwareInfo.cpu.usage }}%</span>
          </div>
          <div class="hw-sub-metrics">
            <span class="sub-metric">
              <span class="sub-label">核心</span>
              <span class="sub-value">{{ hardwareInfo.cpu.cores }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- 内存信息 -->
      <div class="hw-item">
        <div class="hw-header">
          <el-icon class="hw-icon memory"><Memo /></el-icon>
          <span class="hw-title">内存</span>
        </div>
        <div class="hw-body">
          <div class="hw-main-metric">
            <div class="progress-wrapper">
              <el-progress 
                :percentage="hardwareInfo.memory.percent" 
                :color="getProgressColor(hardwareInfo.memory.percent)"
                :show-text="false"
                :stroke-width="4" />
            </div>
            <span class="metric-value">{{ hardwareInfo.memory.percent }}%</span>
          </div>
          <div class="hw-sub-metrics">
            <span class="sub-metric">
              <span class="sub-value">{{ hardwareInfo.memory.used }}/{{ hardwareInfo.memory.total }}GB</span>
            </span>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- 磁盘信息 -->
      <div class="hw-item">
        <div class="hw-header">
          <el-icon class="hw-icon disk"><Files /></el-icon>
          <span class="hw-title">磁盘</span>
        </div>
        <div class="hw-body">
          <div class="hw-main-metric single">
            <span class="metric-value large">{{ hardwareInfo.disk.free }}GB</span>
          </div>
          <div class="hw-sub-metrics">
            <span class="sub-metric">
              <span class="sub-label">可用空间</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { VideoPlay, Cpu, Memo, Files } from '@element-plus/icons-vue'

export default {
  name: 'HardwareMonitor',
  components: {
    VideoPlay,
    Cpu,
    Memo,
    Files
  },
  data() {
    return {
      hardwareInfo: {
        gpu: {
          name: '检测中...',
          usage: 0,
          memoryUsed: 0,
          memoryTotal: 0,
          memoryPercent: 0,
          temp: 0
        },
        cpu: {
          name: '检测中...',
          usage: 0,
          cores: 0
        },
        memory: {
          used: 0,
          total: 0,
          percent: 0
        },
        disk: {
          free: 0
        }
      },
      refreshTimer: null
    }
  },
  mounted() {
    this.loadHardwareInfo()
    this.startMonitoring()
  },
  beforeUnmount() {
    this.stopMonitoring()
  },
  methods: {
    async loadHardwareInfo() {
      try {
        // 调用 Electron API 获取硬件信息
        if (window.electronAPI?.system?.getHardwareInfo) {
          const info = await window.electronAPI.system.getHardwareInfo()
          this.hardwareInfo = info
        } else {
          // Mock 数据用于开发测试
          this.hardwareInfo = {
            gpu: {
              name: 'NVIDIA GeForce RTX 3060',
              usage: Math.floor(Math.random() * 60),
              memoryUsed: (Math.random() * 8).toFixed(1),
              memoryTotal: 12,
              memoryPercent: Math.floor(Math.random() * 70),
              temp: Math.floor(Math.random() * 30 + 50)
            },
            cpu: {
              name: 'Intel Core i7-10700K',
              usage: Math.floor(Math.random() * 50),
              cores: 8
            },
            memory: {
              used: (Math.random() * 16).toFixed(1),
              total: 32,
              percent: Math.floor(Math.random() * 60)
            },
            disk: {
              free: 256
            }
          }
        }
      } catch (error) {
        console.error('Failed to load hardware info:', error)
      }
    },
    startMonitoring() {
      // 每2秒刷新一次
      this.refreshTimer = setInterval(() => {
        this.loadHardwareInfo()
      }, 2000)
    },
    stopMonitoring() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer)
        this.refreshTimer = null
      }
    },
    getProgressColor(percent) {
      if (percent < 50) return '#67c23a'
      if (percent < 80) return '#e6a23c'
      return '#f56c6c'
    },
    getTempClass(temp) {
      if (temp < 60) return 'temp-normal'
      if (temp < 80) return 'temp-warm'
      return 'temp-hot'
    }
  }
}
</script>

<style scoped>
.hardware-monitor {
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  height: 70px;
}

.monitor-content {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 20px;
  gap: 0;
}

/* 硬件项 */
.hw-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  height: 100%;
}

.hw-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 50px;
}

.hw-icon {
  font-size: 20px;
}

.hw-icon.gpu {
  color: #76b900;
}

.hw-icon.cpu {
  color: #0078d4;
}

.hw-icon.memory {
  color: #e6a23c;
}

.hw-icon.disk {
  color: #909399;
}

.hw-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hw-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* 主指标 */
.hw-main-metric {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hw-main-metric.single {
  gap: 0;
}

.progress-wrapper {
  flex: 1;
  min-width: 100px;
  max-width: 200px;
}

.progress-wrapper :deep(.el-progress) {
  width: 100%;
}

.metric-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  min-width: 45px;
  text-align: right;
}

.metric-value.large {
  font-size: 22px;
}

/* 子指标 */
.hw-sub-metrics {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.sub-metric {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.sub-label {
  color: var(--color-text-tertiary);
}

.sub-value {
  color: var(--color-text-secondary);
  font-weight: 500;
}

/* 温度颜色 */
.temp-normal {
  color: #67c23a !important;
}

.temp-warm {
  color: #e6a23c !important;
}

.temp-hot {
  color: #f56c6c !important;
}

/* 分隔线 */
.divider {
  width: 1px;
  height: 50px;
  background: var(--color-border);
  flex-shrink: 0;
}

/* 响应式 */
@media (max-width: 1400px) {
  .hw-item {
    padding: 0 12px;
  }
  
  .progress-wrapper {
    max-width: 150px;
  }
}
</style>

