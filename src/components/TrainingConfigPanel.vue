<template>
  <div class="training-config-panel">
    <div class="panel-header">
      <h3>训练配置</h3>
      <el-button type="primary" size="small" @click="handleStartTraining" :loading="isStarting">
        <el-icon><VideoPlay /></el-icon>
        开始训练
      </el-button>
    </div>

    <el-form :model="config" label-width="100px" class="config-form">
      <!-- 任务名称 -->
      <el-form-item label="任务名称" required>
        <el-input 
          v-model="config.name" 
          placeholder="例如：人脸检测模型_v1"
          clearable />
      </el-form-item>

      <!-- 数据集选择 -->
      <el-form-item label="数据集" required>
        <el-select 
          v-model="config.datasetName" 
          placeholder="选择数据集"
          style="width: 100%"
          @change="handleDatasetChange">
          <el-option
            v-for="dataset in datasets"
            :key="dataset.name"
            :label="dataset.name"
            :value="dataset.name">
            <div class="dataset-option">
              <span class="dataset-name">{{ dataset.name }}</span>
              <span class="dataset-stats">
                {{ dataset.stats?.totalImages || 0 }} 图片
              </span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 数据集信息预览 -->
      <div v-if="selectedDataset" class="dataset-preview">
        <div class="preview-item">
          <span class="preview-label">图片数量</span>
          <span class="preview-value">{{ selectedDataset.stats?.totalImages || 0 }}</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">标注数量</span>
          <span class="preview-value">{{ selectedDataset.stats?.totalAnnotations || 0 }}</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">类别数量</span>
          <span class="preview-value">{{ getCategoryCount(selectedDataset) }}</span>
        </div>
      </div>

      <!-- YOLO版本 -->
      <el-form-item label="YOLO版本">
        <el-select 
          v-model="config.yoloVersion" 
          style="width: 100%" 
          @change="handleVersionChange">
          <el-option 
            v-for="version in availableModels.versions"
            :key="version"
            :label="`YOLO${version}`" 
            :value="version" />
        </el-select>
        <div v-if="availableModels.versions.length === 0" class="form-tip" style="color: var(--el-color-warning);">
          ⚠ 未检测到可用模型，请添加预训练模型到 models/ 目录或 D:\YoloMarkFlow\model
        </div>
      </el-form-item>

      <!-- 模型规模 -->
      <el-form-item label="模型规模">
        <el-radio-group v-model="config.modelSize">
          <el-radio-button 
            v-for="size in availableSizesForCurrentVersion"
            :key="size"
            :label="size">
            {{ getSizeLabel(size) }}
          </el-radio-button>
        </el-radio-group>
        <div v-if="availableSizesForCurrentVersion.length === 0" class="form-tip" style="color: var(--el-color-warning);">
          ⚠ 当前版本没有可用的模型尺寸
        </div>
      </el-form-item>

      <!-- 预训练权重 -->
      <el-form-item label="预训练权重">
        <el-switch 
          v-model="config.usePretrained"
          active-text="使用预训练"
          inactive-text="从头训练" />
      </el-form-item>

      <!-- 输出目录 -->
      <el-form-item label="输出目录" required>
        <div class="path-selector">
          <el-input 
            v-model="config.outputPath" 
            placeholder="训练结果输出目录"
            clearable />
          <el-button 
            type="primary" 
            size="small" 
            @click="selectOutputPath"
            style="margin-left: 8px;">
            选择目录
          </el-button>
        </div>
        <div class="form-item-tip">
          训练生成的权重文件和日志将保存在此目录
        </div>
      </el-form-item>

      <!-- Epoch -->
      <el-form-item label="Epoch">
        <div class="slider-input-group">
          <el-slider 
            v-model="config.epochs" 
            :min="10"
            :max="500"
            :step="10"
            :show-tooltip="false"
            style="flex: 1" />
          <el-input-number 
            v-model="config.epochs" 
            :min="10"
            :max="500"
            :step="10"
            controls-position="right"
            style="width: 120px" />
        </div>
      </el-form-item>

      <!-- Batch Size -->
      <el-form-item label="Batch Size">
        <div class="slider-input-group">
          <el-slider 
            v-model="config.batchSize" 
            :min="1"
            :max="64"
            :step="1"
            :show-tooltip="false"
            style="flex: 1" />
          <el-input-number 
            v-model="config.batchSize" 
            :min="1"
            :max="64"
            :step="1"
            controls-position="right"
            style="width: 120px" />
        </div>
        <div class="form-tip">根据显存自动调整，建议从16开始</div>
      </el-form-item>

      <!-- Image Size -->
      <el-form-item label="图片尺寸">
        <el-radio-group v-model="config.imageSize">
          <el-radio-button :label="640">640</el-radio-button>
          <el-radio-button :label="800">800</el-radio-button>
          <el-radio-button :label="1024">1024</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!-- 数据增强 -->
      <el-form-item label="数据增强">
        <div class="augmentation-options">
          <el-checkbox v-model="config.augmentation.mosaic">Mosaic</el-checkbox>
          <el-checkbox v-model="config.augmentation.mixup">MixUp</el-checkbox>
          <el-checkbox v-model="config.augmentation.hsv">HSV增强</el-checkbox>
          <el-checkbox v-model="config.augmentation.flip">翻转</el-checkbox>
        </div>
      </el-form-item>

      <!-- 高级参数 -->
      <el-collapse v-model="activeCollapse" class="advanced-collapse">
        <el-collapse-item name="advanced" title="高级参数">
          <el-form-item label="学习率">
            <el-input-number 
              v-model="config.advanced.learningRate" 
              :min="0.0001"
              :max="0.1"
              :step="0.0001"
              :precision="4"
              controls-position="right"
              style="width: 100%" />
          </el-form-item>

          <el-form-item label="优化器">
            <el-select v-model="config.advanced.optimizer" style="width: 100%">
              <el-option label="SGD" value="SGD" />
              <el-option label="Adam" value="Adam" />
              <el-option label="AdamW" value="AdamW" />
            </el-select>
          </el-form-item>

          <el-form-item label="Train/Val比例">
            <div class="split-ratio">
              <el-slider 
                v-model="config.advanced.trainRatio" 
                :min="50"
                :max="95"
                :step="5"
                :format-tooltip="(val) => val + '%'"
                style="flex: 1" />
              <span class="ratio-text">{{ config.advanced.trainRatio }}% / {{ 100 - config.advanced.trainRatio }}%</span>
            </div>
          </el-form-item>

          <el-form-item label="早停">
            <el-switch 
              v-model="config.advanced.earlyStop"
              active-text="启用"
              inactive-text="禁用" />
            <el-input-number 
              v-if="config.advanced.earlyStop"
              v-model="config.advanced.patience" 
              :min="5"
              :max="100"
              :step="5"
              controls-position="right"
              style="width: 120px; margin-left: 12px" />
            <span v-if="config.advanced.earlyStop" class="form-tip" style="margin-left: 8px">
              Epoch无提升后停止
            </span>
          </el-form-item>
        </el-collapse-item>
      </el-collapse>
    </el-form>
  </div>
</template>

<script>
import { VideoPlay } from '@element-plus/icons-vue'

export default {
  name: 'TrainingConfigPanel',
  components: {
    VideoPlay
  },
  props: {
    datasets: {
      type: Array,
      default: () => []
    }
  },
  emits: ['start-training'],
  data() {
    return {
      isStarting: false,
      activeCollapse: [],
      availableModels: {
        models: [],
        versions: [],
        sizesByVersion: {}
      },
      config: {
        name: '',
        datasetName: '',
        yoloVersion: 'v8',
        modelSize: 's',
        usePretrained: true,
        outputPath: 'D:\\YoloMarkFlow\\YoloMarkFlow_trainOut',
        epochs: 100,
        batchSize: 16,
        imageSize: 640,
        augmentation: {
          mosaic: true,
          mixup: true,
          hsv: true,
          flip: true
        },
        advanced: {
          learningRate: 0.01,
          optimizer: 'SGD',
          trainRatio: 80,
          earlyStop: true,
          patience: 50
        }
      }
    }
  },
  async mounted() {
    await this.loadAvailableModels()
  },
  computed: {
    selectedDataset() {
      if (!this.config.datasetName) return null
      return this.datasets.find(d => d.name === this.config.datasetName)
    },
    availableSizesForCurrentVersion() {
      return this.availableModels.sizesByVersion[this.config.yoloVersion] || []
    }
  },
  methods: {
    async loadAvailableModels() {
      try {
        const result = await window.electronAPI.training.scanModels()
        this.availableModels = result
        
        console.log('[TrainingConfigPanel] Available models:', result)
        
        // 如果当前选择的版本不存在，使用第一个可用版本
        if (result.versions.length > 0 && !result.versions.includes(this.config.yoloVersion)) {
          this.config.yoloVersion = result.versions[0]
        }
        
        // 如果当前选择的尺寸不存在，使用第一个可用尺寸
        const availableSizes = result.sizesByVersion[this.config.yoloVersion] || []
        if (availableSizes.length > 0 && !availableSizes.includes(this.config.modelSize)) {
          this.config.modelSize = availableSizes[0]
        }
      } catch (error) {
        console.error('[TrainingConfigPanel] Failed to load available models:', error)
        this.$message.error('加载可用模型列表失败')
      }
    },
    handleVersionChange() {
      // 切换版本时，自动选择第一个可用尺寸
      const sizes = this.availableSizesForCurrentVersion
      if (sizes.length > 0 && !sizes.includes(this.config.modelSize)) {
        this.config.modelSize = sizes[0]
      }
    },
    getSizeLabel(size) {
      const labels = {
        n: 'Nano',
        s: 'Small',
        m: 'Medium',
        l: 'Large',
        x: 'XLarge'
      }
      return labels[size] || size.toUpperCase()
    },
    handleDatasetChange() {
      if (!this.config.name && this.selectedDataset) {
        this.config.name = `${this.selectedDataset.name}_训练_${new Date().getTime()}`
      }
    },
    getCategoryCount(dataset) {
      if (!dataset) return 0
      // 优先从 stats.categories 获取（如果有元数据）
      if (dataset.stats?.categories?.length !== undefined) {
        return dataset.stats.categories.length
      }
      // 如果没有元数据，从 categories 数组获取（getDatasetInfo 返回的结构）
      if (dataset.categories?.length !== undefined) {
        return dataset.categories.length
      }
      return 0
    },
    async selectOutputPath() {
      try {
        const result = await window.electronAPI.selectDirectory({
          title: '选择训练输出目录'
        })
        if (result.success && result.path) {
          this.config.outputPath = result.path
        }
      } catch (error) {
        console.error('Failed to select output path:', error)
        this.$message.error('选择目录失败')
      }
    },
    async handleStartTraining() {
      // 验证
      if (!this.config.name) {
        this.$message.warning('请输入任务名称')
        return
      }
      if (!this.config.datasetName) {
        this.$message.warning('请选择数据集')
        return
      }
      if (!this.config.outputPath) {
        this.$message.warning('请选择输出目录')
        return
      }

      this.isStarting = true
      try {
        // 只传递可序列化的数据，使用 JSON 序列化确保完全可序列化
        const trainingConfig = JSON.parse(JSON.stringify({
          ...this.config,
          dataset: this.selectedDataset ? {
            name: this.selectedDataset.name,
            path: this.selectedDataset.path,
            dbPath: this.selectedDataset.dbPath, // 添加 dbPath
            stats: this.selectedDataset.stats
          } : null
        }))
        this.$emit('start-training', trainingConfig)
      } finally {
        this.isStarting = false
      }
    },
    resetConfig() {
      this.config = {
        name: '',
        datasetName: '',
        yoloVersion: 'v8',
        modelSize: 's',
        usePretrained: true,
        outputPath: 'D:\\YoloMarkFlow\\YoloMarkFlow_trainOut',
        epochs: 100,
        batchSize: 16,
        imageSize: 640,
        augmentation: {
          mosaic: true,
          mixup: true,
          hsv: true,
          flip: true
        },
        advanced: {
          learningRate: 0.01,
          optimizer: 'SGD',
          trainRatio: 80,
          earlyStop: true,
          patience: 50
        }
      }
    }
  }
}
</script>

<style scoped>
.training-config-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.config-form {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.dataset-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dataset-name {
  font-size: 13px;
}

.dataset-stats {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.dataset-preview {
  margin: -12px 0 16px 100px;
  padding: 12px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  display: flex;
  gap: 20px;
}

.preview-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.preview-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.slider-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
}

.form-tip {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

.augmentation-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.advanced-collapse {
  margin-top: 12px;
  border: none;
  background: transparent;
}

.advanced-collapse :deep(.el-collapse-item__header) {
  background: var(--color-bg-secondary);
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.advanced-collapse :deep(.el-collapse-item__wrap) {
  background: transparent;
  border: none;
}

.advanced-collapse :deep(.el-collapse-item__content) {
  padding: 16px 0 0 0;
}

.split-ratio {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
}

.ratio-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  min-width: 80px;
  text-align: right;
}

/* 路径选择器 */
.path-selector {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.path-selector .el-input {
  flex: 1;
}

.form-item-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

/* 滚动条 */
.config-form::-webkit-scrollbar {
  width: 6px;
}

.config-form::-webkit-scrollbar-track {
  background: transparent;
}

.config-form::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.config-form::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-tertiary);
}
</style>

