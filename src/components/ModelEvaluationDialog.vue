<template>
  <Modal
    v-model="dialogVisible"
    title="模型评估"
    custom-width="1100px"
    :show-footer="false"
    :close-on-overlay="false"
    @close="handleClose">
    <div v-if="data" class="evaluation-content">
      <!-- 模型基本信息 -->
      <div class="model-info">
        <h3>{{ taskName }}</h3>
        <div class="info-row">
          <span class="label">训练时间:</span>
          <span class="value">{{ formatDate(completedAt) }}</span>
        </div>
        <div class="info-row">
          <span class="label">输出目录:</span>
          <span class="value path-link" @click="handleOpenFolder">
            {{ data.outputPath }}
            <el-icon><FolderOpened /></el-icon>
          </span>
        </div>
      </div>

      <!-- 核心指标卡片 -->
      <div class="metrics-cards">
        <el-card class="metric-card">
          <div class="metric-title">mAP@0.5</div>
          <div class="metric-value highlight">{{ formatPercent(data.metrics.map50) }}</div>
        </el-card>
        <el-card class="metric-card">
          <div class="metric-title">mAP@0.5:0.95</div>
          <div class="metric-value">{{ formatPercent(data.metrics.map5095) }}</div>
        </el-card>
        <el-card class="metric-card">
          <div class="metric-title">Precision</div>
          <div class="metric-value">{{ formatPercent(data.metrics.precision) }}</div>
        </el-card>
        <el-card class="metric-card">
          <div class="metric-title">Recall</div>
          <div class="metric-value">{{ formatPercent(data.metrics.recall) }}</div>
        </el-card>
      </div>

      <!-- Loss曲线图表 -->
      <div v-if="hasChartData" class="chart-section">
        <h4>训练曲线</h4>
        <div ref="chartContainer" class="chart-container"></div>
      </div>

      <!-- 可视化图表 -->
      <div v-if="hasGeneratedCharts" class="generated-charts">
        <h4>训练生成的可视化图表</h4>
        <div class="charts-grid">
          <el-button
            v-if="data.chartsAvailable.results"
            @click="openChartImage('results.png')">
            查看训练结果图
          </el-button>
          <el-button
            v-if="data.chartsAvailable.confusion"
            @click="openChartImage('confusion_matrix.png')">
            查看混淆矩阵
          </el-button>
          <el-button
            v-if="data.chartsAvailable.pr"
            @click="openChartImage('PR_curve.png')">
            查看PR曲线
          </el-button>
        </div>
      </div>

      <!-- 详细结果表格 -->
      <div v-if="data.detailedResults && data.detailedResults.length > 0" class="detail-section">
        <el-collapse>
          <el-collapse-item title="详细训练数据" name="details">
            <el-table
              :data="data.detailedResults"
              stripe
              max-height="300"
              style="width: 100%">
              <el-table-column
                v-for="(value, key) in data.detailedResults[0]"
                :key="key"
                :prop="key"
                :label="formatColumnName(key)"
                width="120">
                <template #default="scope">
                  {{ formatCellValue(scope.row[key]) }}
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <div v-else class="no-data">
      <el-empty description="暂无评估数据" />
    </div>
  </Modal>
</template>

<script>
import { FolderOpened } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import Modal from './Modal.vue'

export default {
  name: 'ModelEvaluationDialog',
  components: {
    FolderOpened,
    Modal
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    data: {
      type: Object,
      default: null
    },
    taskName: {
      type: String,
      default: ''
    },
    completedAt: {
      type: String,
      default: ''
    }
  },
  emits: ['update:visible', 'open-folder', 'open-chart'],
  data() {
    return {
      chart: null,
      themeObserver: null
    }
  },
  computed: {
    dialogVisible: {
      get() {
        return this.visible
      },
      set(val) {
        this.$emit('update:visible', val)
      }
    },
    hasChartData() {
      return this.data?.charts?.lossHistory?.length > 0 || 
             this.data?.charts?.valLossHistory?.length > 0
    },
    hasGeneratedCharts() {
      return this.data?.chartsAvailable &&
        (this.data.chartsAvailable.results || 
         this.data.chartsAvailable.confusion || 
         this.data.chartsAvailable.pr)
    }
  },
  watch: {
    visible(val) {
      if (val && this.hasChartData) {
        this.$nextTick(() => {
          this.initChart()
        })
      }
    }
  },
  mounted() {
    // 监听主题切换
    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          // 主题变化时重新渲染图表
          if (this.visible && this.hasChartData && this.chart) {
            this.$nextTick(() => {
              this.initChart()
            })
          }
        }
      })
    })

    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
  },
  beforeUnmount() {
    // 清理图表
    if (this.chart) {
      this.chart.dispose()
    }
    
    // 清理主题监听器
    if (this.themeObserver) {
      this.themeObserver.disconnect()
    }
    
    // 清理resize监听
    window.removeEventListener('resize', this.handleResize)
  },
  methods: {
    initChart() {
      if (!this.$refs.chartContainer) return
      
      if (this.chart) {
        this.chart.dispose()
      }

      // 检测当前主题
      const isDark = document.body.getAttribute('data-theme') === 'dark'
      
      // 根据主题选择颜色
      const textColor = isDark ? '#cccccc' : '#333333'
      const lineColor = isDark ? '#3c3c3c' : '#e0e0e0'
      const trainColor = isDark ? '#5470c6' : '#007ACC'
      const valColor = isDark ? '#ee6666' : '#E53935'

      this.chart = echarts.init(this.$refs.chartContainer)

      const epochs = this.data.charts.lossHistory?.map((_, i) => i + 1) || []

      const option = {
        backgroundColor: 'transparent',
        title: {
          text: '训练与验证Loss',
          left: 'center',
          top: 10,
          textStyle: {
            fontSize: 14,
            fontWeight: 500,
            color: textColor
          }
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: isDark ? 'rgba(50, 50, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: lineColor,
          borderWidth: 1,
          textStyle: {
            color: textColor,
            fontSize: 12
          },
          axisPointer: {
            type: 'cross',
            lineStyle: {
              color: lineColor,
              type: 'dashed'
            }
          }
        },
        legend: {
          data: ['训练Loss', '验证Loss'],
          top: 35,
          textStyle: {
            color: textColor,
            fontSize: 12
          }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '5%',
          top: '25%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: epochs,
          name: 'Epoch',
          nameTextStyle: {
            color: textColor,
            fontSize: 12
          },
          axisLine: {
            lineStyle: {
              color: lineColor
            }
          },
          axisLabel: {
            color: textColor,
            fontSize: 11
          },
          splitLine: {
            show: false
          }
        },
        yAxis: {
          type: 'value',
          name: 'Loss',
          nameTextStyle: {
            color: textColor,
            fontSize: 12
          },
          axisLine: {
            show: false
          },
          axisLabel: {
            color: textColor,
            fontSize: 11
          },
          splitLine: {
            lineStyle: {
              color: lineColor,
              type: 'dashed'
            }
          }
        },
        series: [
          {
            name: '训练Loss',
            type: 'line',
            smooth: true,
            data: this.data.charts.lossHistory || [],
            symbolSize: 4,
            itemStyle: {
              color: trainColor
            },
            lineStyle: {
              width: 2,
              color: trainColor
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: isDark ? 'rgba(84, 112, 198, 0.2)' : 'rgba(0, 122, 204, 0.15)' },
                  { offset: 1, color: isDark ? 'rgba(84, 112, 198, 0)' : 'rgba(0, 122, 204, 0)' }
                ]
              }
            }
          },
          {
            name: '验证Loss',
            type: 'line',
            smooth: true,
            data: this.data.charts.valLossHistory || [],
            symbolSize: 4,
            itemStyle: {
              color: valColor
            },
            lineStyle: {
              width: 2,
              color: valColor
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: isDark ? 'rgba(238, 102, 102, 0.2)' : 'rgba(229, 57, 53, 0.15)' },
                  { offset: 1, color: isDark ? 'rgba(238, 102, 102, 0)' : 'rgba(229, 57, 53, 0)' }
                ]
              }
            }
          }
        ]
      }

      this.chart.setOption(option)

      // 响应式
      window.addEventListener('resize', this.handleResize)
    },
    handleResize() {
      if (this.chart) {
        this.chart.resize()
      }
    },
    formatPercent(num) {
      if (num === null || num === undefined) return '--'
      return (num * 100).toFixed(1) + '%'
    },
    formatDate(dateStr) {
      if (!dateStr) return '--'
      const date = new Date(dateStr)
      return date.toLocaleString('zh-CN')
    },
    formatColumnName(name) {
      // 简单的列名格式化
      return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    },
    formatCellValue(value) {
      if (typeof value === 'number') {
        return value.toFixed(4)
      }
      return value
    },
    handleOpenFolder() {
      this.$emit('open-folder')
    },
    openChartImage(filename) {
      this.$emit('open-chart', filename)
    },
    handleClose() {
      if (this.chart) {
        this.chart.dispose()
        this.chart = null
      }
      window.removeEventListener('resize', this.handleResize)
    }
  }
}
</script>

<style scoped>
/* 移除Modal默认max-width限制，使用customWidth */
:deep(.modal-container) {
  max-width: none !important;
}

/* 评估内容容器 - 不设置padding，由Modal的content提供 */
.evaluation-content {
  /* Modal的content已有padding，这里不需要额外padding */
}

/* 模型基本信息 */
.model-info {
  margin-bottom: 20px;
  padding: 14px 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.model-info h3 {
  margin: 0 0 10px 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 18px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-row .label {
  color: var(--color-text-secondary);
  margin-right: 8px;
  min-width: 80px;
  flex-shrink: 0;
}

.info-row .value {
  color: var(--color-text-primary);
  flex: 1;
  word-break: break-all;
}

.path-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-info);
  cursor: pointer;
  transition: opacity 0.15s;
}

.path-link:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.path-link:active {
  opacity: 0.6;
}

/* 核心指标卡片 */
.metrics-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.metric-card {
  padding: 16px 12px;
  text-align: center;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  transition: border-color 0.15s, background-color 0.15s;
}

.metric-card:hover {
  border-color: var(--color-info);
  background: var(--color-bg-tertiary);
}

.metric-title {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
  font-weight: 400;
}

.metric-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.5px;
}

.metric-value.highlight {
  color: var(--color-success);
}

/* 图表区域 */
.chart-section {
  margin-bottom: 20px;
}

.chart-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.chart-container {
  width: 100%;
  height: 320px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

/* 生成的可视化图表 */
.generated-charts {
  margin-bottom: 20px;
}

.generated-charts h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.charts-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 详细数据表格 */
.detail-section {
  margin-top: 20px;
}

/* 深度集成Element Plus样式到主题 */
.detail-section :deep(.el-collapse) {
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.detail-section :deep(.el-collapse-item__header) {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border);
  font-size: 13px;
  height: 40px;
  line-height: 40px;
}

.detail-section :deep(.el-collapse-item__wrap) {
  background: var(--color-bg-primary);
  border-color: var(--color-border);
}

.detail-section :deep(.el-collapse-item__content) {
  padding: 12px 0;
  color: var(--color-text-primary);
}

.detail-section :deep(.el-table) {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.detail-section :deep(.el-table th.el-table__cell) {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
  font-weight: 500;
}

.detail-section :deep(.el-table td.el-table__cell) {
  border-color: var(--color-border);
  color: var(--color-text-primary);
}

.detail-section :deep(.el-table tr) {
  background: var(--color-bg-primary);
}

.detail-section :deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: var(--color-bg-secondary);
}

.detail-section :deep(.el-table--enable-row-hover .el-table__body tr:hover > td) {
  background: var(--color-bg-tertiary) !important;
}

/* 无数据状态 */
.no-data {
  padding: 60px 0;
  text-align: center;
}

.no-data :deep(.el-empty) {
  --el-empty-padding: 20px 0;
}

.no-data :deep(.el-empty__description p) {
  color: var(--color-text-secondary);
}

/* 按钮样式适配 */
.charts-grid :deep(.el-button) {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
  color: var(--color-text-primary);
  font-size: 13px;
  height: 28px;
  padding: 0 12px;
}

.charts-grid :deep(.el-button:hover) {
  background: var(--color-bg-tertiary);
  border-color: var(--color-info);
  color: var(--color-info);
}

.charts-grid :deep(.el-button:active) {
  background: var(--color-border);
}
</style>

