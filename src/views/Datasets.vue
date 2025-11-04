<template>
  <div class="datasets-page">
    <!-- 主内容区 -->
    <div class="page-content">
      <!-- 左侧：源项目选择 -->
      <div class="left-panel">
        <div class="panel-header">
          <div class="panel-title-group">
            <h3>选择源项目</h3>
            <span class="selection-info">
              已选择 {{ selectedProjectCount }} 个项目，{{ selectedCategoryCount }} 个类别
            </span>
    </div>
          <el-button type="primary" size="small" @click="showCreateDialog" :disabled="!hasSelection">
            <el-icon><Plus /></el-icon>
            创建数据集
          </el-button>
  </div>
        
        <div class="project-list" v-loading="loadingProjects">
          <el-tree
            v-if="projects.length"
            :data="projectTreeData"
            node-key="id"
            default-expand-all
            :expand-on-click-node="false"
            @node-click="handleNodeClick"
          >
            <template #default="{ node, data }">
              <div class="tree-project-node" v-if="data.type === 'project'">
                <div class="node-left">
                  <el-checkbox 
                    v-model="data.projectRef.selected"
                    @change="handleProjectSelect(data.projectRef)"
                    @click.stop
                  />
                  <span class="project-name" @click.stop="toggleProjectSelection(data.projectRef)">{{ node.label }}</span>
                </div>
                <div class="project-stats">
                  <span class="stat-item">
                    <el-icon><PictureFilled /></el-icon>
                    {{ data.stats?.annotatedImages || 0 }}/{{ data.stats?.totalImages || 0 }}
                  </span>
                  <span class="stat-item negative">
                    负: {{ data.stats?.negativeImages || 0 }}
                  </span>
                  <span class="stat-item">
                    <el-icon><PriceTag /></el-icon>
                    {{ data.stats?.totalAnnotations || 0 }}
                  </span>
                </div>
              </div>
              
              <div 
                class="tree-category-node" 
                v-if="data.type === 'category'"
                @click.stop="toggleCategorySelection(data.categoryRef, data.projectRef)"
              >
                <div class="node-left">
                  <el-checkbox
                    v-model="data.categoryRef.selected"
                    @change="handleCategorySelect(data.projectRef)"
                    @click.stop
                  />
                  <span class="category-color" :style="{ backgroundColor: data.color }"></span>
                  <span class="category-name">{{ node.label }}</span>
                </div>
                <span class="category-count">({{ data.count }} 框)</span>
              </div>
            </template>
          </el-tree>

          <div v-if="!projects.length && !loadingProjects" class="empty-hint">
            暂无可用项目，请先创建项目并完成标注
          </div>
        </div>
      </div>

      <!-- 右侧：已创建数据集列表 -->
      <div class="right-panel">
        <div class="panel-header">
          <h3>已创建数据集</h3>
          <el-button text @click="refreshDatasets">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>

        <div class="dataset-list" v-loading="loadingDatasets">
          <div 
            v-for="dataset in datasets"
            :key="dataset.name"
            class="dataset-card"
          >
            <div class="dataset-header">
              <h4>{{ dataset.name }}</h4>
              <el-dropdown v-if="getAvailableVersions(dataset).length > 0" @command="(version) => switchVersion(dataset, version)" trigger="click">
                <el-tag type="info" size="small" style="cursor: pointer;">
                  v{{ dataset.version || 1 }} <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-tag>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="dataset.version || 1" :disabled="true">
                      v{{ dataset.version || 1 }} (当前)
                    </el-dropdown-item>
                    <el-dropdown-item 
                      v-for="version in getAvailableVersions(dataset)" 
                      :key="version"
                      :command="version"
                    >
                      v{{ version }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tag v-else type="info" size="small">v{{ dataset.version || 1 }}</el-tag>
            </div>
            
            <div class="dataset-info">
              <div class="info-row">
                <span class="label">创建时间：</span>
                <span class="value">{{ formatDate(dataset.createdAt) }}</span>
              </div>
              <div class="info-row">
                <span class="label">更新时间：</span>
                <span class="value">{{ formatDate(dataset.updatedAt) }}</span>
              </div>
              <div class="info-row">
                <span class="label">图片数量：</span>
                <span class="value">{{ dataset.stats?.totalImages || 0 }}</span>
              </div>
              <div class="info-row">
                <span class="label">标注框数：</span>
                <span class="value">{{ dataset.stats?.totalAnnotations || 0 }}</span>
              </div>
            </div>

            <div class="dataset-actions">
              <el-button size="small" type="success" @click="restoreDataset(dataset)">
                <el-icon><Upload /></el-icon>
                回溯
              </el-button>
              <el-button size="small" @click="updateDataset(dataset)">
                <el-icon><RefreshRight /></el-icon>
                更新
              </el-button>
              <el-button size="small" type="primary" @click="exportDataset(dataset)">
                <el-icon><Download /></el-icon>
                导出
              </el-button>
              <el-button size="small" type="danger" @click="deleteDataset(dataset)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </div>

          <div v-if="!datasets.length && !loadingDatasets" class="empty-hint">
            暂无数据集，请先创建数据集
          </div>
        </div>
      </div>
    </div>

    <!-- 创建数据集对话框 -->
    <Modal
      v-model="createDialogVisible"
      title="创建数据集"
      size="medium"
      :footer-buttons="[
        { label: '取消', onClick: () => createDialogVisible = false },
        { label: '确定创建', type: 'primary', onClick: confirmCreateDataset, loading: creating, disabled: creating }
      ]"
    >
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="数据集名称" required>
          <el-input 
            v-model="createForm.name" 
            placeholder="请输入数据集名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="选择摘要">
          <div class="selection-summary">
            <el-tree
              :data="selectionTreeData"
              default-expand-all
              :expand-on-click-node="false"
              node-key="id"
            >
              <template #default="{ node, data }">
                <div class="tree-node">
                  <el-icon v-if="data.type === 'project'" class="node-icon"><Folder /></el-icon>
                  <span v-if="data.type === 'category'" class="category-color-dot" :style="{ backgroundColor: data.color }"></span>
                  <span class="node-label">{{ node.label }}</span>
                  <span v-if="data.type === 'category'" class="category-count">({{ data.count }} 框)</span>
                </div>
              </template>
            </el-tree>
          </div>
        </el-form-item>
      </el-form>
    </Modal>

    <!-- 导出配置对话框 -->
    <Modal
      v-model="exportDialogVisible"
      title="导出数据集"
      size="large"
      :footer-buttons="[
        { label: '取消', onClick: () => exportDialogVisible = false },
        { label: '开始导出', type: 'primary', onClick: confirmExportDataset, loading: exporting, disabled: !exportForm.outputPath }
      ]"
    >
      <div class="export-dialog-body">
          <div class="export-form">
            <!-- 数据集名称 -->
            <div class="form-section dataset-name-section">
              <label class="form-label">数据集名称</label>
              <span class="form-value">{{ exportForm.datasetName }}</span>
            </div>

            <!-- 导出格式 -->
            <div class="form-section">
              <label class="form-label">导出格式</label>
              <el-radio-group v-model="exportForm.format" class="format-group">
                <el-radio-button label="YOLO">YOLO</el-radio-button>
                <el-radio-button label="COCO">COCO JSON</el-radio-button>
              </el-radio-group>
            </div>

            <!-- 数据划分 -->
            <div class="form-section">
              <label class="form-label">数据划分</label>
              <div class="split-config">
                <!-- 数据集选项 -->
                <div class="split-options">
                  <el-checkbox v-model="exportForm.includeVal" @change="handleSplitOptionChange">
                    包含验证集
                  </el-checkbox>
                  <el-checkbox v-model="exportForm.includeTest" @change="handleSplitOptionChange">
                    包含测试集
                  </el-checkbox>
                </div>

                <!-- 比例配置 -->
                <div class="split-single" v-if="exportForm.includeVal || exportForm.includeTest">
                  <div class="split-info">
                    <div class="split-info-item">
                      <span class="split-info-label">训练集</span>
                      <span class="split-info-value">{{ exportForm.trainRatio }}%</span>
                    </div>
                    <div class="split-info-item" v-if="exportForm.includeVal">
                      <span class="split-info-label">验证集</span>
                      <span class="split-info-value">{{ exportForm.valRatio }}%</span>
                    </div>
                    <div class="split-info-item" v-if="exportForm.includeTest">
                      <span class="split-info-label">测试集</span>
                      <span class="split-info-value">{{ exportForm.testRatio }}%</span>
                    </div>
                  </div>
                  
                  <!-- 范围滑块（两个滑动点） -->
                  <div class="slider-group" v-if="exportForm.includeVal && exportForm.includeTest">
                    <label class="slider-label">数据集划分</label>
                    <el-slider 
                      v-model="splitRange" 
                      range
                      :min="5" 
                      :max="70" 
                      :step="5"
                      :show-tooltip="true"
                      @input="adjustRatiosFromRange"
                    />
                    <div class="range-legend">
                      <span class="legend-item train">训练集 (剩余: {{ 100 - exportForm.valRatio - exportForm.testRatio }}%)</span>
                      <span class="legend-item val">验证集 ({{ exportForm.valRatio }}%)</span>
                      <span class="legend-item test">测试集 ({{ exportForm.testRatio }}%)</span>
                    </div>
                  </div>

                  <!-- 单滑块（只有一个数据集需要划分） -->
                  <div class="slider-group" v-else>
                    <label class="slider-label" v-if="exportForm.includeVal">验证集比例</label>
                    <label class="slider-label" v-else-if="exportForm.includeTest">测试集比例</label>
                    <el-slider 
                      v-if="exportForm.includeVal"
                      v-model="exportForm.valRatio" 
                      :min="5" 
                      :max="50" 
                      :step="5"
                      :show-tooltip="true"
                      :format-tooltip="(val) => `验证集: ${val}% | 训练集: ${100-val}%`"
                      @input="adjustRatios"
                    />
                    <el-slider 
                      v-else-if="exportForm.includeTest"
                      v-model="exportForm.testRatio" 
                      :min="5" 
                      :max="50" 
                      :step="5"
                      :show-tooltip="true"
                      :format-tooltip="(val) => `测试集: ${val}% | 训练集: ${100-val}%`"
                      @input="adjustRatios"
                    />
                  </div>

                  <div class="split-hint">
                    {{ getSplitHint() }}
                  </div>
                </div>

                <div class="split-hint" v-else>
                  所有图片将导出到训练集
                </div>
              </div>
            </div>

            <!-- 导出路径 -->
            <div class="form-section">
              <label class="form-label">导出路径</label>
              <div class="path-input-group">
                <el-input 
                  v-model="exportForm.outputPath" 
                  placeholder="点击选择导出目录" 
                  readonly
                  size="large"
                />
                <el-button @click="selectExportPath" size="large">
                  <el-icon><Folder /></el-icon>
                  选择目录
                </el-button>
              </div>
            </div>

            <!-- 导出预览 -->
            <div class="form-section">
              <label class="form-label">导出预览</label>
              <div class="export-preview">
                <div class="preview-grid" :class="{
                  'two-col': !exportForm.includeVal && !exportForm.includeTest,
                  'three-col': (exportForm.includeVal && !exportForm.includeTest) || (!exportForm.includeVal && exportForm.includeTest),
                  'four-col': exportForm.includeVal && exportForm.includeTest
                }">
                  <div class="preview-card train">
                    <div class="preview-icon">
                      <el-icon><Document /></el-icon>
                    </div>
                    <div class="preview-content">
                      <div class="preview-number">{{ getTrainCount() }}</div>
                      <div class="preview-text">训练集图片</div>
                    </div>
                  </div>
                  <div class="preview-card val" v-if="exportForm.includeVal">
                    <div class="preview-icon">
                      <el-icon><Document /></el-icon>
                    </div>
                    <div class="preview-content">
                      <div class="preview-number">{{ getValCount() }}</div>
                      <div class="preview-text">验证集图片</div>
                    </div>
                  </div>
                  <div class="preview-card test" v-if="exportForm.includeTest">
                    <div class="preview-icon">
                      <el-icon><Document /></el-icon>
                    </div>
                    <div class="preview-content">
                      <div class="preview-number">{{ getTestCount() }}</div>
                      <div class="preview-text">测试集图片</div>
                    </div>
                  </div>
                  <div class="preview-card accent">
                    <div class="preview-icon">
                      <el-icon><View /></el-icon>
                    </div>
                    <div class="preview-content">
                      <div class="preview-number">{{ exportForm.dataset?.stats?.totalAnnotations || 0 }}</div>
                      <div class="preview-text">总标注框数</div>
                    </div>
                  </div>
                </div>
                <div class="preview-summary">
                  <div class="summary-item">
                    <span class="summary-label">数据集总数</span>
                    <span class="summary-value">{{ exportForm.dataset?.stats?.totalImages || 0 }} 张</span>
                  </div>
                  <div class="summary-divider"></div>
                  <div class="summary-item">
                    <span class="summary-label">导出格式</span>
                    <span class="summary-value">{{ exportForm.format }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </Modal>

    <!-- 导出进度对话框 -->
    <Modal
      v-model="exportProgressVisible"
      title="导出进度"
      size="small"
      :show-close="false"
      :footer-buttons="exportStatus === 'success' || exportStatus === 'exception' ? [
        { label: '确定', type: 'primary', onClick: closeExportProgress }
      ] : []"
    >
      <div class="export-progress">
        <el-progress 
          :percentage="exportProgress" 
          :status="exportStatus"
        />
        <div class="progress-message">{{ exportMessage }}</div>
      </div>
    </Modal>

    <!-- 删除数据集确认对话框 -->
    <Modal
      v-model="deleteDialogVisible"
      title="删除数据集"
      size="small"
      :footer-buttons="[
        { label: '取消', onClick: () => deleteDialogVisible = false },
        { label: '删除当前版本', type: 'warning', onClick: () => confirmDelete(false) },
        { label: '删除全部版本', type: 'danger', onClick: () => confirmDelete(true) }
      ]"
    >
      <div class="delete-dialog-content">
        <el-icon class="warning-icon" color="#e6a23c"><WarningFilled /></el-icon>
        <div class="delete-message">
          <p><strong>数据集：{{ deletingDataset?.name }}</strong></p>
          <p>当前版本：v{{ deletingDataset?.version || 1 }}</p>
          <p v-if="deletingDataset?.updateHistory && deletingDataset.updateHistory.length > 0">
            共有 {{ deletingDataset.updateHistory.length + 1 }} 个版本
          </p>
          <p class="delete-hint">请选择删除方式：</p>
          <ul class="delete-options">
            <li><strong>删除当前版本：</strong>仅删除 v{{ deletingDataset?.version || 1 }}，其他版本保留</li>
            <li><strong>删除全部版本：</strong>永久删除整个数据集，<span class="danger-text">此操作不可恢复！</span></li>
          </ul>
        </div>
      </div>
    </Modal>
    

  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { 
  Plus, PictureFilled, PriceTag, ArrowRight, ArrowDown,
  Refresh, RefreshRight, Download, Delete, Folder, Close, Document, View, WarningFilled, Upload
} from '@element-plus/icons-vue'
import { listProjects, getCurrentProject } from '../utils/projectManager'
import { getProjectStats } from '../utils/projectStats'
import { listDatasets, createDataset, updateDataset as updateDatasetUtil, switchDatasetVersion, deleteDataset as deleteDatasetUtil, deleteDatasetVersion, restoreDatasetToProject } from '../utils/datasetManager'
import { YoloExporter } from '../utils/exporters/YoloExporter'
import { CocoExporter } from '../utils/exporters/CocoExporter'

// 自定义 UI 组件
import Modal from '../components/Modal.vue'
import { confirm } from '../utils/dialog'
import { success, error, warning, info } from '../utils/toast'
import { showLoading } from '../utils/loading'
import { ElMessageBox } from 'element-plus'

export default {
  name: 'Datasets',
  components: {
    Plus, PictureFilled, PriceTag, ArrowRight, ArrowDown,
    Refresh, View, RefreshRight, Download, Delete, Folder, Close, Document,
    Modal
  },
  setup() {
    const projects = ref([])
    const datasets = ref([])
    const loadingProjects = ref(false)
    const loadingDatasets = ref(false)
    const createDialogVisible = ref(false)
    const creating = ref(false)

    const createForm = ref({
      name: ''
    })

    // 导出相关数据
    const exportDialogVisible = ref(false)
    const exporting = ref(false)
    const exportForm = ref({
      datasetName: '',
      dataset: null,
      datasetPath: '',
      format: 'YOLO',
      trainRatio: 80,
      valRatio: 20,
      testRatio: 0,
      includeVal: true,
      includeTest: false,
      outputPath: ''
    })

    // 范围滑块的值 [验证集比例, 验证集+测试集总比例]
    const splitRange = ref([15, 30])  // 默认 15% 验证集, 15% 测试集, 剩余 70% 训练集


    // 导出进度
    const exportProgressVisible = ref(false)
    const exportProgress = ref(0)
    const exportStatus = ref('')
    const exportMessage = ref('')

    // 删除对话框
    const deleteDialogVisible = ref(false)
    const deletingDataset = ref(null)
    
    


    // 计算选中的项目和类别数量
    const selectedProjectCount = computed(() => {
      return projects.value.filter(p => p.selected).length
    })

    const selectedCategoryCount = computed(() => {
      return projects.value
        .filter(p => p.selected)
        .reduce((sum, p) => {
          return sum + (p.stats?.categories?.filter(c => c.selected).length || 0)
        }, 0)
    })

    const hasSelection = computed(() => {
      return selectedProjectCount.value > 0 && selectedCategoryCount.value > 0
    })

    // 获取选中的项目和类别
    const selectedProjects = computed(() => {
      return projects.value
        .filter(p => p.selected)
        .map(p => ({
          name: p.name,
          path: p.path,
          selectedCategories: (p.stats?.categories || []).filter(c => c.selected)
        }))
        .filter(p => p.selectedCategories.length > 0)
    })

    // 生成项目列表的树形数据结构
    const projectTreeData = computed(() => {
      return projects.value.map((project, index) => ({
        id: `project-${index}`,
        label: project.name,
        type: 'project',
        projectRef: project,
        stats: project.stats,
        children: (project.stats?.categories || []).map((cat, catIndex) => ({
          id: `project-${index}-cat-${cat.id}`,
          label: cat.name,
          type: 'category',
          categoryRef: cat,
          projectRef: project,
          color: cat.color,
          count: cat.count
        }))
      }))
    })

    // 生成选择摘要的树形数据结构
    const selectionTreeData = computed(() => {
      return selectedProjects.value.map((proj, index) => ({
        id: `summary-project-${index}`,
        label: proj.name,
        type: 'project',
        children: proj.selectedCategories.map((cat, catIndex) => ({
          id: `summary-project-${index}-cat-${cat.id}`,
          label: cat.name,
          type: 'category',
          color: cat.color,
          count: cat.count
        }))
      }))
    })

    // 加载项目列表
    const loadProjects = async () => {
      try {
        loadingProjects.value = true
        const projectList = await listProjects()
        
        // 为每个项目加载统计信息
        const projectsWithStats = await Promise.all(
          projectList.map(async (project) => {
            try {
              const stats = await getProjectStats(project.path)
              return {
                ...project,
                stats,
                selected: false,
                expanded: false
              }
            } catch (error) {
              console.error(`加载项目 ${project.name} 统计信息失败:`, error)
              return {
                ...project,
                stats: null,
                selected: false,
                expanded: false
              }
            }
          })
        )

        projects.value = projectsWithStats
      } catch (err) {
        console.error('加载项目列表失败:', err)
        error('加载项目列表失败')
      } finally {
        loadingProjects.value = false
      }
    }

    // 加载数据集列表
    const loadDatasets = async () => {
      try {
        loadingDatasets.value = true
        datasets.value = await listDatasets()
      } catch (err) {
        console.error('加载数据集列表失败:', err)
        error('加载数据集列表失败')
      } finally {
        loadingDatasets.value = false
      }
    }

    // 刷新数据集列表
    const refreshDatasets = () => {
      loadDatasets()
    }

    // 获取可用的历史版本（排除当前版本）
    const getAvailableVersions = (dataset) => {
      if (!dataset.updateHistory || dataset.updateHistory.length === 0) {
        return []
      }

      const currentVersion = dataset.version || 1
      const allVersions = new Set()

      // 从更新历史中收集所有版本
      dataset.updateHistory.forEach(history => {
        // 添加 previousVersion（旧版本）
        if (history.previousVersion && history.previousVersion !== currentVersion) {
          allVersions.add(history.previousVersion)
        }
        // 添加更新后的版本（如果不是当前版本）
        if (history.version && history.version !== currentVersion) {
          allVersions.add(history.version)
        }
      })

      // 转换为数组并排序（从新到旧）
      return Array.from(allVersions).sort((a, b) => b - a)
    }

    // 切换项目展开状态
    const toggleProject = (project) => {
      project.expanded = !project.expanded
    }
    
    // 切换项目选中状态（点击项目名时）
    const toggleProjectSelection = (project) => {
      project.selected = !project.selected
      handleProjectSelect(project)
    }

    // 处理项目选择
    const handleProjectSelect = (project) => {
      if (!project.selected) {
        // 取消选中项目时，取消所有类别选择
        if (project.stats?.categories) {
          project.stats.categories.forEach(cat => {
            cat.selected = false
          })
        }
      }
      // 选中项目时，不自动选中类别，由用户手动选择
    }

    // 处理类别选择
    const handleCategorySelect = (project) => {
      // 检查是否有选中的类别
      const hasSelectedCategory = project.stats?.categories?.some(c => c.selected)
      
      if (hasSelectedCategory) {
        // 如果有任意类别被选中，自动选中项目
        if (!project.selected) {
          project.selected = true
        }
      } else {
        // 如果没有类别被选中，取消项目选择
        project.selected = false
      }
    }
    
    // 切换类别选择状态（点击整个类别节点）
    const toggleCategorySelection = (category, project) => {
      category.selected = !category.selected
      handleCategorySelect(project)
    }
    
    // 处理节点点击（用于折叠/展开）
    const handleNodeClick = (data, node, component) => {
      // 如果点击的是类别节点，不处理（类别节点没有子节点）
      if (data.type === 'category') {
        return
      }
      
      // 切换展开/收起状态
      node.expanded = !node.expanded
    }

    // 显示创建对话框
    const showCreateDialog = () => {
      if (!hasSelection.value) {
        warning('请先选择至少一个项目和类别')
        return
      }
      createForm.value.name = ''
      createDialogVisible.value = true
    }

    // 确认创建数据集
    const confirmCreateDataset = async () => {
      if (!createForm.value.name.trim()) {
        warning('请输入数据集名称')
        return
      }

      try {
        creating.value = true
        
        // 隐藏创建对话框，显示进度遮罩层
        createDialogVisible.value = false
        let closeLoading = showLoading('正在创建数据集...')

        // 构建项目选择数据
        const projectSelections = selectedProjects.value.map(proj => ({
          projectPath: proj.path,
          categoryIds: proj.selectedCategories.map(c => c.id)
        }))

        let createStats = {
          totalImages: 0,
          totalAnnotations: 0,
          categoryCounts: {}
        }

        try {
          const result = await createDataset(createForm.value.name, projectSelections, {
            onProgress: (current, total, message) => {
              // 更新进度消息
              const progressMessage = message || (total > 0 ? `正在创建数据集 ${current}/${total}...` : '正在创建数据集...')
              closeLoading(progressMessage)
            }
          })

          createStats = result.stats || {
            totalImages: 0,
            totalAnnotations: 0,
            categoryCounts: {}
          }
          
          // 关闭遮罩层
          closeLoading()
          closeLoading = null
          
          // 显示创建结果对话框
          const resultMessage = `<div style="line-height: 1.8;">
            <p style="margin-bottom: 12px;">数据集创建成功！</p>
            <div style="margin-top: 16px;">
              <p><strong>统计信息：</strong></p>
              <ul style="margin: 8px 0 0 20px; padding: 0;">
                ${createStats.totalImages > 0 ? `<li>包含图片：${createStats.totalImages} 张</li>` : ''}
                ${createStats.totalAnnotations > 0 ? `<li>共标注：${createStats.totalAnnotations} 个</li>` : ''}
                ${Object.keys(createStats.categoryCounts || {}).length > 0 ? `<li>类别数量：${Object.keys(createStats.categoryCounts || {}).length} 个</li>` : ''}
              </ul>
            </div>
          </div>`
          
          await ElMessageBox({
            title: '创建成功',
            message: resultMessage,
            dangerouslyUseHTMLString: true,
            confirmButtonText: '确定',
            type: 'success'
          })
          
          // 刷新数据集列表
          await loadDatasets()
        } catch (err) {
          // 关闭遮罩层
          if (closeLoading) {
            closeLoading()
            closeLoading = null
          }
          
          console.error('创建数据集失败:', err)
          
          // 显示错误对话框
          await ElMessageBox({
            title: '创建失败',
            message: `创建数据集失败：${err.message || '未知错误'}`,
            confirmButtonText: '确定',
            type: 'error'
          })
        }
      } finally {
        creating.value = false
      }
    }

    // 切换数据集版本
    const switchVersion = async (dataset, targetVersion) => {
      try {
        await confirm({
          message: `确定要切换到版本 v${targetVersion} 吗？\n\n当前版本 v${dataset.version || 1} 将被保存为备份。`,
          title: '切换版本',
          type: 'warning'
        })

        // 显示加载状态
        const closeLoading = showLoading('正在切换版本，请稍候...')

        try {
          // 调用切换函数
          const result = await switchDatasetVersion(dataset.name, targetVersion)

          if (result.success) {
            success(`已切换到版本 v${result.version}`)
            
            // 刷新数据集列表
            await refreshDatasets()
          } else {
            throw new Error('切换失败')
          }
        } finally {
          closeLoading()
        }
      } catch (err) {
        if (err !== 'cancel' && err !== false) {
          console.error('切换版本失败:', err)
          error(`切换版本失败: ${err.message || err}`)
        }
      }
    }

    // 更新数据集
    const updateDataset = async (dataset) => {
      try {
        await confirm({
          message: `确定要更新数据集 "${dataset.name}" 吗？\n\n更新将会：\n1. 备份当前版本 (v${dataset.version || 1})\n2. 从原始项目重新收集最新数据\n3. 创建新版本 (v${(dataset.version || 1) + 1})`,
          title: '更新数据集',
          type: 'warning'
        })

        // 显示加载框
        const closeLoading = showLoading('正在更新数据集，请稍候...')

        try {
          // 调用更新函数
          const result = await updateDatasetUtil(dataset.name)

          if (result.success) {
            success(`数据集更新成功！版本：v${result.version}`)
            
            // 刷新数据集列表
            await refreshDatasets()
          } else {
            throw new Error('更新失败')
          }
        } finally {
          closeLoading()
        }
      } catch (err) {
        if (err !== 'cancel' && err !== false) {
          console.error('更新数据集失败:', err)
          error(`更新数据集失败: ${err.message || err}`)
        }
      }
    }

    // 导出数据集
    // 打开导出对话框
    const exportDataset = async (dataset) => {
      // 获取数据集路径
      const datasetsPath = await getDatasetsPath()
      const datasetPath = `${datasetsPath}/${dataset.name}`
      
      // 获取默认导出路径
      const defaultExportPath = localStorage.getItem('defaultExportPath') || 'D:\\YoloMarkFlow_Out'
      
      exportForm.value = {
        datasetName: dataset.name,
        dataset: dataset,
        datasetPath: datasetPath,
        format: 'YOLO',
        trainRatio: 80,
        valRatio: 20,
        outputPath: defaultExportPath
      }
      
      exportDialogVisible.value = true
    }

    // 调整划分比例（train + val = 100%）
    // 处理数据集选项变化
    const handleSplitOptionChange = () => {
      // 重新计算比例
      if (!exportForm.value.includeVal && !exportForm.value.includeTest) {
        // 只有训练集
        exportForm.value.trainRatio = 100
        exportForm.value.valRatio = 0
        exportForm.value.testRatio = 0
      } else if (exportForm.value.includeVal && !exportForm.value.includeTest) {
        // 训练集 + 验证集
        exportForm.value.valRatio = 20  // 默认 20% 验证集
        exportForm.value.testRatio = 0
        adjustRatios()
      } else if (!exportForm.value.includeVal && exportForm.value.includeTest) {
        // 训练集 + 测试集
        exportForm.value.valRatio = 0
        exportForm.value.testRatio = 20  // 默认 20% 测试集
        adjustRatios()
      } else {
        // 训练集 + 验证集 + 测试集
        splitRange.value = [15, 30] // 默认 15% 验证, 15% 测试, 剩余 70% 训练
        adjustRatiosFromRange()
      }
    }

    // 从范围滑块调整比例（两个滑动点）
    const adjustRatiosFromRange = () => {
      const [valEnd, testEnd] = splitRange.value
      
      // 左侧点：验证集比例
      // 右侧点：验证集+测试集的总比例
      exportForm.value.valRatio = valEnd
      exportForm.value.testRatio = testEnd - valEnd
      exportForm.value.trainRatio = 100 - testEnd  // 训练集获得剩余
    }

    // 调整比例，确保总和为 100%（单滑块）
    const adjustRatios = () => {
      // 训练集获得剩余的所有部分
      exportForm.value.trainRatio = 100 - exportForm.value.valRatio - exportForm.value.testRatio
    }

    // 获取提示文本
    const getSplitHint = () => {
      if (exportForm.value.includeVal && exportForm.value.includeTest) {
        return '拖动滑动点调整验证集和测试集比例，剩余图片全部作为训练集'
      } else if (exportForm.value.includeVal) {
        return '调整验证集比例，剩余图片全部作为训练集'
      } else if (exportForm.value.includeTest) {
        return '调整测试集比例，剩余图片全部作为训练集'
      }
      return ''
    }

    // 计算验证集数量（优先计算）
    const getValCount = () => {
      if (!exportForm.value.includeVal) return 0
      const total = exportForm.value.dataset?.stats?.totalImages || 0
      return Math.floor(total * exportForm.value.valRatio / 100)
    }

    // 计算测试集数量（优先计算）
    const getTestCount = () => {
      if (!exportForm.value.includeTest) return 0
      const total = exportForm.value.dataset?.stats?.totalImages || 0
      return Math.floor(total * exportForm.value.testRatio / 100)
    }

    // 计算训练集数量（剩余全部给训练集，确保所有图片都被分配）
    const getTrainCount = () => {
      const total = exportForm.value.dataset?.stats?.totalImages || 0
      const valCount = getValCount()
      const testCount = getTestCount()
      return total - valCount - testCount
    }

    // 选择导出路径
    const selectExportPath = async () => {
      const result = await window.electronAPI.selectDirectory({
        title: '选择导出目录'
      })
      if (result.success && result.directory) {
        exportForm.value.outputPath = result.directory
      }
    }

    // 确认导出
    const confirmExportDataset = async () => {
      if (!exportForm.value.outputPath) {
        warning('请选择导出路径')
        return
      }

      try {
        exporting.value = true
        exportDialogVisible.value = false
        exportProgressVisible.value = true
        exportProgress.value = 0
        exportStatus.value = ''
        exportMessage.value = '准备导出...'

        // 构建完整导出路径：{选择的目录}/{数据集名}_v{版本}_{格式}/
        const version = exportForm.value.dataset?.version || 1
        const formatLower = exportForm.value.format.toLowerCase()
        const exportFolderName = `${exportForm.value.datasetName}_v${version}_${formatLower}`
        const fullOutputPath = `${exportForm.value.outputPath}/${exportFolderName}`

        exportMessage.value = `创建导出目录: ${exportFolderName}...`

        // 确保导出目录存在
        const dirResult = await window.electronAPI.ensureDirectory(fullOutputPath)
        if (!dirResult.success) {
          throw new Error(`创建导出目录失败: ${dirResult.error}`)
        }

        // 构建导出配置
        const config = {
          trainRatio: exportForm.value.trainRatio / 100,
          valRatio: exportForm.value.valRatio / 100
        }

        // 创建导出器实例
        const exporter = exportForm.value.format === 'YOLO' 
          ? new YoloExporter() 
          : new CocoExporter()

        // 执行导出
        const result = await exporter.export(
          exportForm.value.datasetPath,
          fullOutputPath,
          config,
          (current, total, message) => {
            exportProgress.value = Math.round(current)
            exportMessage.value = message
          }
        )

        if (result.success) {
          exportStatus.value = 'success'
          exportMessage.value = '导出完成！'
          success('数据集导出成功！')
        } else {
          throw new Error('导出失败')
        }
      } catch (err) {
        console.error('导出失败:', err)
        exportStatus.value = 'exception'
        exportMessage.value = `导出失败: ${err.message}`
        error('导出失败: ' + err.message)
      } finally {
        exporting.value = false
      }
    }

    // 关闭导出进度对话框
    const closeExportProgress = () => {
      exportProgressVisible.value = false
      exportProgress.value = 0
      exportStatus.value = ''
      exportMessage.value = ''
    }

    // 获取数据集目录路径
    const getDatasetsPath = async () => {
      const customPath = localStorage.getItem('imagePoolPath')
      let workspacePath
      if (customPath) {
        workspacePath = customPath
      } else {
        // 使用新的默认路径
        workspacePath = 'D:\\YoloMarkFlow\\YoloMarkFlow_ImagePool'
      }
      return `${workspacePath}/datasets`
    }

    // 删除数据集
    const deleteDataset = async (dataset) => {
      // 检查是否有历史版本
      const hasHistory = dataset.updateHistory && dataset.updateHistory.length > 0
      
      if (hasHistory) {
        // 如果有历史版本，显示自定义对话框
        deletingDataset.value = dataset
        deleteDialogVisible.value = true
      } else {
        // 没有历史版本，直接确认删除
        try {
          await confirm({
            message: `确定要删除数据集"${dataset.name}"吗？此操作不可恢复！`,
            title: '确认删除',
            type: 'danger'
          })
          
          // 删除数据集并显示进度
          let closeLoading = showLoading('正在删除数据集...')
          
          try {
            let deleteStats = {
              deletedCount: 0,
              skippedCount: 0,
              errorCount: 0
            }
            
            const result = await deleteDatasetUtil(dataset.name, {
              deleteOrphanedImages: true,
              onProgress: (current, total, message) => {
                // 更新进度消息
                const progressMessage = message || (total > 0 ? `正在删除图片 ${current}/${total}...` : '正在删除...')
                closeLoading(progressMessage)
              }
            })
            
            deleteStats = {
              deletedCount: result.deletedImageCount || 0,
              skippedCount: 0,
              errorCount: 0
            }
            
            // 关闭遮罩层
            closeLoading()
            closeLoading = null
            
            // 显示删除结果对话框
            let resultMessage = `<div style="line-height: 1.8;">
              <p style="margin-bottom: 12px;">数据集 "${dataset.name}" 已删除</p>`
            
            if (deleteStats.deletedCount > 0) {
              resultMessage += `<div style="margin-top: 16px;">
                <p><strong>统计信息：</strong></p>
                <ul style="margin: 8px 0 0 20px; padding: 0;">
                  <li>已删除图片：${deleteStats.deletedCount} 张</li>
                </ul>
              </div>`
            }
            
            resultMessage += `</div>`
            
            await ElMessageBox({
              title: '删除成功',
              message: resultMessage,
              dangerouslyUseHTMLString: true,
              confirmButtonText: '确定',
              type: 'success'
            })
            
            await loadDatasets()
          } catch (error) {
            // 关闭遮罩层
            if (closeLoading) {
              closeLoading()
              closeLoading = null
            }
            
            // 显示错误对话框
            await ElMessageBox({
              title: '删除失败',
              message: `删除数据集失败：${error.message || '未知错误'}`,
              confirmButtonText: '确定',
              type: 'error'
            })
          }
        } catch (err) {
          if (err !== 'close' && err !== 'cancel' && err !== false) {
            console.error('删除数据集失败:', err)
            error('删除数据集失败: ' + (err.message || err))
          }
        }
      }
    }

    // 确认删除（从对话框触发）
    const confirmDelete = async (deleteAll) => {
      try {
        deleteDialogVisible.value = false
        const dataset = deletingDataset.value
        
        if (!dataset) return

        if (deleteAll) {
          // 删除整个数据集（所有版本）
          let closeLoading = showLoading('正在删除数据集...')
          
          try {
            let deleteStats = {
              deletedCount: 0,
              skippedCount: 0,
              errorCount: 0
            }
            
            const result = await deleteDatasetUtil(dataset.name, {
              deleteOrphanedImages: true,
              onProgress: (current, total, message) => {
                // 更新进度消息
                const progressMessage = message || (total > 0 ? `正在删除图片 ${current}/${total}...` : '正在删除...')
                closeLoading(progressMessage)
              }
            })
            
            deleteStats = {
              deletedCount: result.deletedImageCount || 0,
              skippedCount: 0,
              errorCount: 0
            }
            
            // 关闭遮罩层
            closeLoading()
            closeLoading = null
            
            // 显示删除结果对话框
            let resultMessage = `<div style="line-height: 1.8;">
              <p style="margin-bottom: 12px;">数据集 "${dataset.name}" 的所有版本已删除</p>`
            
            if (deleteStats.deletedCount > 0) {
              resultMessage += `<div style="margin-top: 16px;">
                <p><strong>统计信息：</strong></p>
                <ul style="margin: 8px 0 0 20px; padding: 0;">
                  <li>已删除图片：${deleteStats.deletedCount} 张</li>
                </ul>
              </div>`
            }
            
            resultMessage += `</div>`
            
            await ElMessageBox({
              title: '删除成功',
              message: resultMessage,
              dangerouslyUseHTMLString: true,
              confirmButtonText: '确定',
              type: 'success'
            })
            
            await loadDatasets()
          } catch (error) {
            // 关闭遮罩层
            if (closeLoading) {
              closeLoading()
              closeLoading = null
            }
            
            // 显示错误对话框
            await ElMessageBox({
              title: '删除失败',
              message: `删除数据集失败：${error.message || '未知错误'}`,
              confirmButtonText: '确定',
              type: 'error'
            })
          }
        } else {
          // 仅删除当前版本
          const result = await deleteDatasetVersion(dataset.name, dataset.version || 1)
          if (result.success) {
            success(`已删除 v${dataset.version || 1}，当前版本切换到 v${result.version}`)
            await loadDatasets()
          }
        }
      } catch (err) {
        console.error('删除数据集失败:', err)
        error('删除数据集失败: ' + (err.message || err))
      } finally {
        deletingDataset.value = null
      }
    }

    // 回溯数据集到当前项目
    const restoreDataset = async (dataset) => {
      try {
        // 检查是否有当前项目
        const currentProject = getCurrentProject()
        if (!currentProject || !currentProject.path) {
          warning('请先打开一个项目')
          return
        }
        
        // 确认对话框
        await confirm({
          title: '确认回溯',
          message: `确定要将数据集 "${dataset.name}" 回溯到当前项目 "${currentProject.name}" 吗？\n\n这将把数据集的所有图片和标注添加到当前项目中。`,
          confirmText: '确认回溯',
          cancelText: '取消'
        })
        
        // 显示回溯进度遮罩层
        let closeLoading = showLoading('正在回溯数据集...')
        
        try {
          // 执行回溯
          const result = await restoreDatasetToProject(
            dataset.name,
            currentProject.path,
            {
              onProgress: (current, total, message) => {
                // 更新进度消息
                const progressMessage = message || `正在回溯数据集... (${Math.round((current / total) * 100)}%)`
                closeLoading(progressMessage)
              }
            }
          )
          
          // 关闭遮罩层
          closeLoading()
          closeLoading = null
          
          // 显示回溯结果对话框
          const resultMessage = `<div style="line-height: 1.8;">
            <p style="margin-bottom: 12px;">数据集回溯成功！</p>
            <div style="margin-top: 16px;">
              <p><strong>统计信息：</strong></p>
              <ul style="margin: 8px 0 0 20px; padding: 0;">
                ${result.stats.addedImages > 0 ? `<li>新增图片：${result.stats.addedImages} 张</li>` : ''}
                ${result.stats.skippedImages > 0 ? `<li>跳过图片：${result.stats.skippedImages} 张（已存在）</li>` : ''}
                ${result.stats.addedAnnotations > 0 ? `<li>添加标注：${result.stats.addedAnnotations} 个</li>` : ''}
              </ul>
            </div>
          </div>`
          
          await ElMessageBox({
            title: '回溯成功',
            message: resultMessage,
            dangerouslyUseHTMLString: true,
            confirmButtonText: '确定',
            type: 'success'
          })
          
          // 刷新数据集列表（如果需要）
          await loadDatasets()
        } catch (err) {
          // 关闭遮罩层
          if (closeLoading) {
            closeLoading()
            closeLoading = null
          }
          
          console.error('回溯数据集失败:', err)
          
          // 显示错误对话框
          await ElMessageBox({
            title: '回溯失败',
            message: `回溯数据集失败：${err.message || '未知错误'}`,
            confirmButtonText: '确定',
            type: 'error'
          })
        }
      } catch (err) {
        // 处理确认对话框取消等情况
        if (err !== 'close' && err !== 'cancel' && err !== false) {
          console.error('回溯数据集失败:', err)
          error('回溯数据集失败: ' + (err.message || err))
        }
      }
    }
    
    // 格式化日期
    const formatDate = (dateStr) => {
      if (!dateStr) return '-'
      const date = new Date(dateStr)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    onMounted(() => {
      loadProjects()
      loadDatasets()
    })

    return {
      projects,
      datasets,
      loadingProjects,
      loadingDatasets,
      createDialogVisible,
      creating,
      createForm,
      // 导出相关
      exportDialogVisible,
      exporting,
      exportForm,
      exportProgressVisible,
      exportProgress,
      exportStatus,
      exportMessage,
      splitRange,
      handleSplitOptionChange,
      adjustRatios,
      adjustRatiosFromRange,
      getSplitHint,
      getTrainCount,
      getValCount,
      getTestCount,
      selectExportPath,
      confirmExportDataset,
      closeExportProgress,
      // 其他
      selectedProjectCount,
      selectedCategoryCount,
      hasSelection,
      selectedProjects,
      projectTreeData,
      selectionTreeData,
      refreshDatasets,
      getAvailableVersions,
      toggleProject,
      toggleProjectSelection,
      toggleCategorySelection,
      handleProjectSelect,
      handleCategorySelect,
      handleNodeClick,
      showCreateDialog,
      confirmCreateDataset,
      switchVersion,
      updateDataset,
      exportDataset,
      restoreDataset,
      deleteDataset,
      confirmDelete,
      formatDate,
      // 删除相关
      deleteDialogVisible,
      deletingDataset,
      // Icons
      Plus,
      PictureFilled,
      PriceTag,
      ArrowRight,
      ArrowDown,
      Refresh,
      View,
      RefreshRight,
      Download,
      Delete,
      Folder,
      Upload,
      Close,
      Document,
      WarningFilled
    }
  }
}
</script>

<style scoped>


/* 整体页面布局 */
.datasets-page {
  width: 100%;
  height: 100vh;
  background: var(--color-bg-secondary, #f5f5f5);
  display: flex;
  flex-direction: column;
}

body[data-theme="dark"] .datasets-page {
  background: #1e1e1e;
}

/* 页面滚动条美化 */
.datasets-page::-webkit-scrollbar {
  width: 10px;
}

.datasets-page::-webkit-scrollbar-track {
  background: transparent;
}

.datasets-page::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #d0d0d0 0%, #b0b0b0 100%);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: padding-box;
  transition: all 0.3s ease;
}

.datasets-page::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #b0b0b0 0%, #909090 100%);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.datasets-page::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #909090 0%, #707070 100%);
}

/* 深色主题滚动条 */
body[data-theme="dark"] .datasets-page::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #4a4a4a 0%, #3c3c3c 100%);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

body[data-theme="dark"] .datasets-page::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #5a5a5a 0%, #4a4a4a 100%);
  box-shadow: 0 0 6px rgba(0, 122, 204, 0.3);
}

body[data-theme="dark"] .datasets-page::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #007acc 0%, #005a9e 100%);
  box-shadow: 0 0 8px rgba(0, 122, 204, 0.5);
}

/* 主内容区 */
.page-content {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 12px;
  overflow: hidden;
}

/* 左右面板 */
.left-panel,
.right-panel {
  flex: 1;
  background: var(--color-bg-primary, #ffffff);
  border-radius: 4px;
  border: 1px solid var(--color-border, #e0e0e0);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

body[data-theme="dark"] .left-panel,
body[data-theme="dark"] .right-panel {
  background: #252526;
  border-color: #3c3c3c;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--color-bg-secondary, #fafafa);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  flex-shrink: 0;
}

body[data-theme="dark"] .panel-header {
  background: #2d2d30;
  border-bottom-color: #3c3c3c;
}

.panel-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #333333);
}

body[data-theme="dark"] .panel-header h3 {
  color: #cccccc;
}

.selection-info {
  font-size: 12px;
  color: var(--color-text-primary, #606266);
  padding: 3px 10px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 3px;
  font-weight: 500;
}

body[data-theme="dark"] .selection-info {
  color: #cccccc;
  background: rgba(0, 122, 204, 0.2);
}

/* 项目列表和数据集列表 */
.project-list,
.dataset-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  background: var(--color-bg-secondary, #fafafa);
}

body[data-theme="dark"] .project-list,
body[data-theme="dark"] .dataset-list {
  background: #1e1e1e;
}

/* 项目树形结构 */
.project-list :deep(.el-tree) {
  background: transparent;
}

.project-list :deep(.el-tree-node__content) {
  height: auto;
  min-height: 30px;
  padding: 4px 6px;
  background: transparent;
  border: none;
}

.project-list :deep(.el-tree-node__content:hover) {
  background: var(--color-bg-tertiary, rgba(0, 0, 0, 0.04));
}

body[data-theme="dark"] .project-list :deep(.el-tree-node__content:hover) {
  background: rgba(255, 255, 255, 0.05);
}

.project-list :deep(.el-tree-node__expand-icon) {
  margin-right: 4px;
  font-size: 12px;
}

.project-list :deep(.el-tree-node__children) {
  padding-left: 24px;
}

.project-list :deep(.el-tree-node__children .el-tree-node__content) {
  min-height: 26px;
  padding: 2px 6px;
}

/* 项目节点 */
.tree-project-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  padding: 2px 0;
}

.tree-project-node .node-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tree-project-node .project-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary, #303133);
  cursor: pointer;
  user-select: none;
}

body[data-theme="dark"] .tree-project-node .project-name {
  color: #cccccc;
}

.tree-project-node .project-name:hover {
  color: var(--color-primary, #409eff);
}

body[data-theme="dark"] .tree-project-node .project-name:hover {
  color: #007acc;
}

.tree-project-node .project-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: var(--color-text-secondary, #909399);
}

body[data-theme="dark"] .tree-project-node .project-stats {
  color: #9d9d9d;
}

.tree-project-node .stat-item {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.tree-project-node .stat-item .el-icon {
  font-size: 12px;
}

.tree-project-node .stat-item.negative {
  color: #f56c6c;
}

/* 类别节点 */
.tree-category-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  padding: 0;
  cursor: pointer;
}

.tree-category-node .node-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tree-category-node .category-color {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.tree-category-node .category-name {
  font-size: 12px;
  color: var(--color-text-primary, #606266);
  user-select: none;
}

body[data-theme="dark"] .tree-category-node .category-name {
  color: #cccccc;
}

.tree-category-node .category-count {
  font-size: 11px;
  color: var(--color-text-secondary, #909399);
}

body[data-theme="dark"] .tree-category-node .category-count {
  color: #9d9d9d;
}

/* 数据集卡片 */
.dataset-card {
  margin-bottom: 8px;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #dcdfe6);
  border-radius: 4px;
  padding: 14px;
  transition: all 0.2s;
}

body[data-theme="dark"] .dataset-card {
  background: #252526;
  border-color: #3c3c3c;
}

.dataset-card:hover {
  border-color: var(--color-primary, #c0c4cc);
  box-shadow: 0 2px 6px var(--color-shadow, rgba(0, 0, 0, 0.08));
}

body[data-theme="dark"] .dataset-card:hover {
  border-color: #007acc;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.dataset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border, #ebeef5);
}

body[data-theme="dark"] .dataset-header {
  border-bottom-color: #3c3c3c;
}

.dataset-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #303133);
}

body[data-theme="dark"] .dataset-header h4 {
  color: #cccccc;
}

.dataset-info {
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  padding: 4px 0;
  font-size: 12px;
  line-height: 1.5;
}

.info-row .label {
  color: #909399;
  width: 80px;
  flex-shrink: 0;
}

.info-row .value {
  color: #606266;
}

.dataset-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* 空状态提示 */
.empty-hint {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-secondary, #909399);
  font-size: 13px;
}

body[data-theme="dark"] .empty-hint {
  color: #9d9d9d;
}

/* 创建对话框中的选择摘要 */
.selection-summary {
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

body[data-theme="dark"] .selection-summary {
  background: #2d2d2d;
  border-color: #3c3c3c;
}

.selection-summary::-webkit-scrollbar {
  width: 6px;
}

.selection-summary::-webkit-scrollbar-track {
  background: #f5f5f5;
}

body[data-theme="dark"] .selection-summary::-webkit-scrollbar-track {
  background: #252526;
}

.selection-summary::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}

body[data-theme="dark"] .selection-summary::-webkit-scrollbar-thumb {
  background: #424242;
}

.selection-summary::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}

body[data-theme="dark"] .selection-summary::-webkit-scrollbar-thumb:hover {
  background: #4e4e4e;
}

/* 树形结构样式 */
.selection-summary :deep(.el-tree) {
  background: transparent;
}

.selection-summary :deep(.el-tree-node__content) {
  height: 28px;
  padding: 0 6px;
}

.selection-summary :deep(.el-tree-node__expand-icon) {
  color: #909399;
}

body[data-theme="dark"] .selection-summary :deep(.el-tree-node__expand-icon) {
  color: #9d9d9d;
}

.selection-summary :deep(.el-tree-node__content:hover) {
  background-color: rgba(0, 0, 0, 0.04);
}

body[data-theme="dark"] .selection-summary :deep(.el-tree-node__content:hover) {
  background-color: rgba(255, 255, 255, 0.05);
}

.selection-summary :deep(.el-tree-node__content:focus) {
  background-color: rgba(0, 0, 0, 0.06);
}

body[data-theme="dark"] .selection-summary :deep(.el-tree-node__content:focus) {
  background-color: rgba(255, 255, 255, 0.08);
}

.selection-summary :deep(.el-tree-node__content:active) {
  background-color: rgba(0, 0, 0, 0.08);
}

body[data-theme="dark"] .selection-summary :deep(.el-tree-node__content:active) {
  background-color: rgba(255, 255, 255, 0.1);
}

.selection-summary :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: rgba(0, 0, 0, 0.06);
}

body[data-theme="dark"] .selection-summary :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: rgba(255, 255, 255, 0.08);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.node-icon {
  color: #409eff;
  font-size: 14px;
  flex-shrink: 0;
}

body[data-theme="dark"] .node-icon {
  color: #007acc;
}

.node-label {
  font-size: 12px;
  color: #303133;
  font-weight: 500;
}

body[data-theme="dark"] .node-label {
  color: #cccccc;
}

.category-color-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

body[data-theme="dark"] .category-color-dot {
  border-color: rgba(255, 255, 255, 0.2);
}

.category-count {
  font-size: 11px;
  color: #909399;
  margin-left: auto;
}

body[data-theme="dark"] .category-count {
  color: #9d9d9d;
}

/* 内部列表滚动条样式 */
.project-list::-webkit-scrollbar,
.dataset-list::-webkit-scrollbar {
  width: 8px;
}

.project-list::-webkit-scrollbar-track,
.dataset-list::-webkit-scrollbar-track {
  background: transparent;
}

.project-list::-webkit-scrollbar-thumb,
.dataset-list::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #d0d0d0 0%, #b0b0b0 100%);
  border-radius: 4px;
  border: 1px solid transparent;
  background-clip: padding-box;
  transition: all 0.3s ease;
}

.project-list::-webkit-scrollbar-thumb:hover,
.dataset-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #b0b0b0 0%, #909090 100%);
}

.project-list::-webkit-scrollbar-thumb:active,
.dataset-list::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #909090 0%, #707070 100%);
}

/* 深色主题内部列表滚动条 */
body[data-theme="dark"] .project-list::-webkit-scrollbar-thumb,
body[data-theme="dark"] .dataset-list::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #4a4a4a 0%, #3c3c3c 100%);
}

body[data-theme="dark"] .project-list::-webkit-scrollbar-thumb:hover,
body[data-theme="dark"] .dataset-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #5a5a5a 0%, #4a4a4a 100%);
  box-shadow: 0 0 4px rgba(0, 122, 204, 0.2);
}

body[data-theme="dark"] .project-list::-webkit-scrollbar-thumb:active,
body[data-theme="dark"] .dataset-list::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #007acc 0%, #005a9e 100%);
  box-shadow: 0 0 6px rgba(0, 122, 204, 0.4);
}

/* Element Plus 组件样式覆盖 */
:deep(.el-checkbox) {
  color: #606266;
}

:deep(.el-checkbox__label) {
  color: #606266;
  font-size: 13px;
}

:deep(.el-button) {
  font-size: 13px;
}

:deep(.el-button--small) {
  padding: 5px 11px;
}

:deep(.el-tag--small) {
  height: 22px;
  padding: 0 6px;
  font-size: 12px;
}

:deep(.el-dialog) {
  border-radius: 4px;
}

:deep(.el-dialog__header) {
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

:deep(.el-dialog__title) {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

:deep(.el-form-item__label) {
  color: #606266;
  font-size: 13px;
}

body[data-theme="dark"] :deep(.el-form-item__label) {
  color: #9d9d9d;
}

:deep(.el-input__inner) {
  font-size: 13px;
}

/* 深色模式下的字数统计 */
body[data-theme="dark"] :deep(.el-input__count) {
  background-color: #2d2d2d !important;
  color: #9d9d9d !important;
}

body[data-theme="dark"] :deep(.el-input__count-inner) {
  background-color: transparent !important;
  color: #9d9d9d !important;
}

/* 数据划分样式 */
.split-config {
  width: 100%;
}

.split-options {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

body[data-theme="dark"] .split-options {
  background: #2d2d2d;
  border-color: #3c3c3c;
}

.split-options :deep(.el-checkbox) {
  font-size: 14px;
  color: #606266;
}

body[data-theme="dark"] .split-options :deep(.el-checkbox) {
  color: #9d9d9d;
}

body[data-theme="dark"] .split-options :deep(.el-checkbox__label) {
  color: #9d9d9d;
}

.split-single {
  width: 100%;
}

.slider-group {
  margin-bottom: 20px;
}

.slider-group:last-of-type {
  margin-bottom: 0;
}

.slider-label {
  display: block;
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
  font-weight: 500;
}

body[data-theme="dark"] .slider-label {
  color: #9d9d9d;
}

.range-legend {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  gap: 12px;
}

body[data-theme="dark"] .range-legend {
  background: #2d2d2d;
}

.legend-item {
  font-size: 12px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 6px;
}

body[data-theme="dark"] .legend-item {
  color: #9d9d9d;
}

.legend-item::before {
  content: '';
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-item.train::before {
  background: #409eff;
}

.legend-item.val::before {
  background: #67c23a;
}

.legend-item.test::before {
  background: #e6a23c;
}

.split-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%);
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  position: relative;
  z-index: 0;
}

body[data-theme="dark"] .split-info {
  background: linear-gradient(135deg, #2d2d2d 0%, #333333 100%);
  border-color: #3c3c3c;
}

.split-info-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.split-info-label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

body[data-theme="dark"] .split-info-label {
  color: #9d9d9d;
}

.split-info-value {
  font-size: 18px;
  color: #303133;
  font-weight: 700;
  min-width: 50px;
  text-align: right;
}

body[data-theme="dark"] .split-info-value {
  color: #cccccc;
}

.split-hint {
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}

body[data-theme="dark"] .split-hint {
  color: #6d6d6d;
}

/* 导出预览样式 */
.export-preview {
  width: 100%;
}

.preview-grid {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}

.preview-grid.two-col {
  grid-template-columns: repeat(2, 1fr);
}

.preview-grid.three-col {
  grid-template-columns: repeat(3, 1fr);
}

.preview-grid.four-col {
  grid-template-columns: repeat(4, 1fr);
}

.preview-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border: 2px solid #e4e7ed;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

body[data-theme="dark"] .preview-card {
  background: #2d2d2d;
  border-color: #3c3c3c;
}

body[data-theme="dark"] .preview-card:hover {
  border-color: #4a4a4a;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.preview-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #909399 0%, #c0c4cc 100%);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.preview-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: #909399;
}

.preview-card:hover::before {
  transform: scaleX(1);
}

.preview-card.train::before {
  background: linear-gradient(90deg, #67c23a 0%, #85ce61 100%);
}

.preview-card.val::before {
  background: linear-gradient(90deg, #409eff 0%, #66b1ff 100%);
}

.preview-card.accent {
  border-color: #303133;
}

.preview-card.accent::before {
  background: linear-gradient(90deg, #303133 0%, #606266 100%);
}

.preview-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%);
  flex-shrink: 0;
  transition: all 0.3s;
}

.preview-card.train .preview-icon {
  background: linear-gradient(135deg, #f0f9ff 0%, #e1f3ff 100%);
  color: #409eff;
}

body[data-theme="dark"] .preview-card.train .preview-icon {
  background: linear-gradient(135deg, #1a3a4a 0%, #2a4a5a 100%);
  color: #66b1ff;
}

.preview-card.val .preview-icon {
  background: linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%);
  color: #67c23a;
}

body[data-theme="dark"] .preview-card.val .preview-icon {
  background: linear-gradient(135deg, #2a3a2a 0%, #3a4a3a 100%);
  color: #85ce61;
}

.preview-card.test .preview-icon {
  background: linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%);
  color: #e6a23c;
}

body[data-theme="dark"] .preview-card.test .preview-icon {
  background: linear-gradient(135deg, #3a3020 0%, #4a4030 100%);
  color: #f0a020;
}

.preview-card.accent .preview-icon {
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
  color: #303133;
}

body[data-theme="dark"] .preview-card.accent .preview-icon {
  background: linear-gradient(135deg, #3c3c3c 0%, #4a4a4a 100%);
  color: #cccccc;
}

.preview-icon :deep(.el-icon) {
  font-size: 24px;
}

.preview-card:hover .preview-icon {
  transform: scale(1.1) rotate(5deg);
}

.preview-content {
  flex: 1;
  text-align: left;
}

.preview-number {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  line-height: 1;
  margin-bottom: 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

body[data-theme="dark"] .preview-number {
  color: #cccccc;
}

.preview-text {
  font-size: 13px;
  color: #909399;
  font-weight: 500;
  letter-spacing: 0.3px;
}

body[data-theme="dark"] .preview-text {
  color: #6d6d6d;
}

/* 预览摘要 */
.preview-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 16px;
  background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
  border-radius: 10px;
  border: 1px solid #e4e7ed;
}

body[data-theme="dark"] .preview-summary {
  background: linear-gradient(135deg, #2d2d2d 0%, #333333 100%);
  border-color: #3c3c3c;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.summary-label {
  font-size: 13px;
  color: #909399;
  font-weight: 500;
}

body[data-theme="dark"] .summary-label {
  color: #6d6d6d;
}

.summary-value {
  font-size: 15px;
  color: #303133;
  font-weight: 600;
}

body[data-theme="dark"] .summary-value {
  color: #cccccc;
}

.summary-divider {
  width: 1px;
  height: 24px;
  background: #dcdfe6;
}

body[data-theme="dark"] .summary-divider {
  background: #3c3c3c;
}

.export-progress {
  padding: 20px 0;
}

.progress-message {
  text-align: center;
  margin-top: 16px;
  font-size: 13px;
  color: #606266;
}

body[data-theme="dark"] .progress-message {
  color: #9d9d9d;
}

/* Element Plus 组件样式覆盖 */
:deep(.el-slider) {
  width: 100%;
  position: relative;
  z-index: 1;
}

:deep(.el-slider__runway) {
  height: 6px;
}

body[data-theme="dark"] :deep(.el-slider__runway) {
  background-color: #3c3c3c;
}

:deep(.el-slider__bar) {
  height: 6px;
  background: linear-gradient(90deg, #303133 0%, #606266 100%);
}

body[data-theme="dark"] :deep(.el-slider__bar) {
  background: linear-gradient(90deg, #007acc 0%, #66b1ff 100%);
}

:deep(.el-slider__button) {
  width: 16px;
  height: 16px;
  border: 2px solid #303133;
}

body[data-theme="dark"] :deep(.el-slider__button) {
  border-color: #007acc;
  background-color: #1e1e1e;
}

:deep(.el-slider__button:hover) {
  transform: scale(1.2);
}

:deep(.el-slider__tooltip) {
  z-index: 9999 !important;
}

:deep(.el-popper) {
  z-index: 9999 !important;
}

:deep(.el-tooltip__popper) {
  z-index: 9999 !important;
}

/* 自定义导出对话框样式 */
/* 导出对话框内容容器 */
.export-dialog-body {
  padding: 0;
}

.export-form {
  width: 100%;
}

/* 表单区块 */
.form-section {
  margin-bottom: 32px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #303133);
  margin-bottom: 16px;
}

body[data-theme="dark"] .form-label {
  color: #cccccc;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dataset-name-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dataset-name-section .form-label {
  margin-bottom: 0;
  min-width: 100px;
  flex-shrink: 0;
}

.form-value {
  font-size: 15px;
  color: var(--color-text-primary, #303133);
  font-weight: 600;
}

body[data-theme="dark"] .form-value {
  color: #cccccc;
}

.format-group {
  width: 100%;
  display: flex;
  gap: 0; /* 移除间隙，让按钮连在一起 */
}

.format-group :deep(.el-radio-button) {
  flex: 1;
}

.format-group :deep(.el-radio-button__inner) {
  width: 100%;
  padding: 12px 24px;
  font-size: 14px;
  border: 2px solid var(--color-border, #e4e7ed);
  background-color: var(--color-bg-primary, #ffffff);
  color: var(--color-text-primary, #606266);
  transition: all 0.3s ease;
  border-radius: 0;
  margin-left: -2px; /* 重叠边框，避免中间边框加倍 */
}

.format-group :deep(.el-radio-button:not(.is-active) .el-radio-button__inner:hover) {
  background-color: var(--color-bg-secondary, #f5f5f5);
  border-color: var(--color-text-tertiary, #909399);
}

.format-group :deep(.el-radio-button:first-child .el-radio-button__inner) {
  margin-left: 0; /* 第一个不需要重叠 */
  border-radius: 4px 0 0 4px;
}

.format-group :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 0 4px 4px 0;
}

/* 选中状态 - 呼吸灯效果 */
.format-group :deep(.el-radio-button.is-active .el-radio-button__inner) {
  border-color: #007acc;
  animation: breathing-border 2s ease-in-out infinite;
  position: relative;
  z-index: 1; /* 确保选中的按钮边框在上层 */
}

body[data-theme="dark"] .format-group :deep(.el-radio-button.is-active .el-radio-button__inner) {
  border-color: #007acc;
  background-color: rgba(0, 122, 204, 0.1);
}

body[data-theme="dark"] .format-group :deep(.el-radio-button__inner) {
  background-color: #2d2d2d;
  border-color: #3c3c3c;
  color: #cccccc;
}

body[data-theme="dark"] .format-group :deep(.el-radio-button:not(.is-active) .el-radio-button__inner:hover) {
  background-color: #333333;
  border-color: #4a4a4a;
}

/* 呼吸灯动画 */
@keyframes breathing-border {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(0, 122, 204, 0.4),
                0 0 10px rgba(0, 122, 204, 0.2);
  }
  50% {
    box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.2),
                0 0 20px rgba(0, 122, 204, 0.4);
  }
}

/* 路径输入组 */
.path-input-group {
  display: flex;
  gap: 12px;
}

.path-input-group .el-input {
  flex: 1;
}

/* 删除对话框样式 */
.delete-dialog-content {
  display: flex;
  gap: 16px;
  padding: 8px 0;
}

.delete-dialog-content .warning-icon {
  font-size: 48px;
  flex-shrink: 0;
}

.delete-message {
  flex: 1;
}

.delete-message p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--color-text-primary, #303133);
}

body[data-theme="dark"] .delete-message p {
  color: #cccccc;
}

.delete-message p strong {
  font-weight: 600;
  color: var(--color-text-primary, #303133);
}

body[data-theme="dark"] .delete-message p strong {
  color: #ffffff;
}

.delete-hint {
  margin-top: 16px !important;
  font-weight: 600;
}

.delete-options {
  margin: 8px 0 0 0;
  padding-left: 20px;
  list-style-type: disc;
}

.delete-options li {
  margin: 8px 0;
  font-size: 13px;
  color: var(--color-text-secondary, #606266);
  line-height: 1.6;
}

body[data-theme="dark"] .delete-options li {
  color: #9d9d9d;
}

.delete-options li strong {
  color: var(--color-text-primary, #303133);
  font-weight: 600;
}

body[data-theme="dark"] .delete-options li strong {
  color: #cccccc;
}

.danger-text {
  color: #f56c6c;
  font-weight: 600;
}

</style>
