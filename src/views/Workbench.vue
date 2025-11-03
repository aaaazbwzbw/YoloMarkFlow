<template>
  <div class="workbench">
    <!-- 左侧栏：文件/缩略图列表 -->
    <aside class="file-list-panel">
      <div class="panel-content-wrapper" :class="{ expanded: imageListExpanded }">
      <div class="panel-header">
        <h3>图片列表</h3>
          <div class="header-actions">
        <el-button size="small" @click="handleImportImages">
          <el-icon><FolderOpened /></el-icon>
          导入图片
        </el-button>
            <el-button 
              size="small" 
              @click="toggleImageListExpand"
              :icon="imageListExpanded ? 'fold' : 'expand'">
              {{ imageListExpanded ? '折叠' : '展开' }}
        </el-button>
          </div>
      </div>

      <!-- 状态筛选器 -->
      <div class="filter-bar">
          <el-radio-group v-model="filterStatus" size="small" class="filter-radio-group">
          <el-radio-button label="all">全部 ({{ images.length }})</el-radio-button>
          <el-radio-button label="annotated">已标注 ({{ annotatedCount }})</el-radio-button>
          <el-radio-button label="unannotated">未标注 ({{ unannotatedCount }})</el-radio-button>
            <el-radio-button label="negative">负样本 ({{ negativeCount }})</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 缩略图列表 - 虚拟滚动 -->
      <div v-if="filteredImages.length === 0" class="empty-state">
        <el-empty description="暂无图片" />
      </div>
      <RecycleScroller
        v-else
        ref="thumbnailList"
        :key="`scroller-${filterStatus}`"
        class="thumbnail-list"
        :class="{ 'grid-expanded': imageListExpanded }"
        :items="gridRows"
        :item-size="estimatedItemHeight"
        :buffer="200"
        key-field="rowIndex"
      >
        <template #default="{ item: row }">
          <div class="thumbnail-row" :style="{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }">
            <div 
              v-for="image in row.images"
              :key="image.index"
              class="thumbnail-item"
              :class="{ active: currentImageIndex === image.index }"
              :data-image-index="image.index"
              @click="selectImage(image.index)"
              @contextmenu.prevent="showImageContextMenu($event, image.index)">
              <div class="thumbnail-img-wrapper">
                <img :src="image.src" :alt="image.name" class="thumbnail-img" loading="lazy" />
                <!-- 状态标签 -->
                <div 
                  class="status-badge"
                  :class="getImageStatusClass(image)">
                  {{ getImageStatusText(image) }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </RecycleScroller>

        <!-- 缩略图大小控制（仅在展开时显示） -->
        <transition name="fade">
          <div v-if="imageListExpanded" class="thumbnail-size-control">
            <span class="size-label">缩放</span>
            <el-slider 
              v-model="thumbnailScale" 
              :min="50" 
              :max="200" 
              :step="10"
              :show-tooltip="false" />
            <span class="size-value">{{ thumbnailScale }}%</span>
          </div>
        </transition>
      </div>
    </aside>

    <!-- 中间栏：主标注区 -->
    <main class="annotation-canvas">
      <!-- Canvas Header - 独立出来,不受canvas缩放影响 -->
      <div class="canvas-header">
        <div class="image-info">
          <span class="current-image-name">{{ currentImage?.name || '未选择图片' }}</span>
          <span class="image-counter">{{ currentImageIndex + 1 }} / {{ images.length }}</span>
        </div>
        <div class="canvas-controls">
          <el-button 
            size="small" 
            @click="$router.push('/datasets')">
            <el-icon><FolderOpened /></el-icon>
            数据集管理
          </el-button>
          <el-button 
            size="small" 
            type="primary" 
            :disabled="!currentImage"
            @click="handleSaveAnnotations">
            <el-icon><DocumentChecked /></el-icon>
            保存标注
          </el-button>
          <el-button 
            size="small" 
            type="warning" 
            :disabled="!currentImage"
            @click="handleSaveAsNegative">
            <el-icon><CircleClose /></el-icon>
            保存为负样本
          </el-button>
          <el-button size="small" :disabled="currentImageIndex === 0" @click="prevImage">
            <el-icon><ArrowLeft /></el-icon>
            上一张
          </el-button>
          <el-button size="small" :disabled="currentImageIndex === images.length - 1" @click="nextImage">
            下一张
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 悬浮工具栏卡片 -->
      <div 
        v-show="toolbarVisible"
        class="floating-toolbar-card"
        :style="toolbarCardStyle"
        @mousedown.stop>
        <div class="toolbar-card-header" @mousedown="startDragCard">
          <div class="toolbar-card-title">
            <el-icon><Tools /></el-icon>
            <span>工具栏</span>
          </div>
          <div class="toolbar-card-close" @click="closeToolbar">
            <el-icon><Close /></el-icon>
          </div>
        </div>
        
        <div class="toolbar-card-content">
          <div class="setting-item">
            <div class="setting-header">
              <div class="setting-info">
                <span class="setting-label">自动保存</span>
                <span class="setting-description">切换图片时自动保存标注</span>
              </div>
              <el-switch 
                v-model="autoSaveEnabled" 
                @change="handleAutoSaveToggle"
                size="default"
              />
            </div>
          </div>
          
          <div class="setting-item">
            <div class="setting-header">
              <div class="setting-info">
                <span class="setting-label">模型辅助</span>
                <span class="setting-description">使用训练好的模型自动识别图片</span>
              </div>
              <el-switch 
                v-model="modelAssistEnabled" 
                @change="handleModelAssistToggle"
                size="default"
              />
            </div>
            
            <!-- 模型选择折叠区域 -->
            <transition name="fade">
              <div v-show="modelAssistEnabled" class="model-select-area">
                <div class="model-select-label">选择模型</div>
                <div v-if="completedModels.length === 0" class="no-models">
                  <span>暂无已完成的训练模型</span>
                  <el-button size="small" type="text" @click="$router.push('/training')">
                    去训练
                  </el-button>
                </div>
                <div v-else class="model-list">
                  <div 
                    v-for="model in completedModels" 
                    :key="model.id"
                    class="model-option"
                    :class="{ selected: selectedModel?.id === model.id }"
                    @click="selectModel(model)">
                    <div class="model-name">{{ model.name }}</div>
                    <div class="model-meta">
                      <span class="model-version">{{ model.config?.yoloVersion || 'v8' }}{{ model.config?.modelSize || 's' }}</span>
                      <span class="model-time">{{ formatModelTime(model.completedAt) }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="selectedModel" class="model-conf-threshold">
                  <span class="conf-label">置信度阈值</span>
                  <el-slider 
                    v-model="confThreshold" 
                    :min="0.1" 
                    :max="0.9" 
                    :step="0.05"
                    :show-tooltip="true"
                    :format-tooltip="val => (val * 100).toFixed(0) + '%'" />
                  <span class="conf-value">{{ (confThreshold * 100).toFixed(0) }}%</span>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <!-- 快捷键设置对话框 -->
      <Modal
        v-model="shortcutsDialogVisible"
        title="快捷键设置"
        size="large"
        custom-width="650px"
        :show-footer="false"
        @close="closeShortcutsDialog">
        <div 
          class="shortcuts-content"
          tabindex="0"
          @keydown="handleShortcutKeyDown" 
          @keyup="handleShortcutKeyUp">
          <div class="shortcuts-tip">
            <el-icon><InfoFilled /></el-icon>
            <span>点击"设置"按钮后，按下您想要设置的快捷键组合</span>
          </div>
          
          <div class="shortcuts-warning">
            <el-icon><WarningFilled /></el-icon>
            <div class="warning-content">
              <div class="warning-title">快捷键冲突提醒</div>
              <div class="warning-text">部分快捷键可能与您系统中的其他软件相冲突，请自行尝试并调整。建议避免使用系统常用快捷键（如Ctrl+C、Ctrl+V等）。</div>
            </div>
          </div>
          
          <div class="shortcuts-list">
            <div 
              v-for="(value, key) in shortcuts" 
              :key="key"
              class="shortcut-item">
              <div class="shortcut-label">{{ getShortcutLabel(key) }}</div>
              <div class="shortcut-value-wrapper">
                <div class="shortcut-value">
                  <el-tag 
                    :type="editingShortcut === key && conflictKey ? 'danger' : (editingShortcut === key ? 'warning' : 'info')"
                    size="large">
                    {{ editingShortcut === key && isCapturingKey ? (tempShortcut || '请按下快捷键...') : value }}
                  </el-tag>
                </div>
                <div v-if="editingShortcut === key && conflictKey" class="conflict-hint">
                  与"{{ getShortcutLabel(conflictKey) }}"冲突
                </div>
              </div>
              <div class="shortcut-actions">
                <el-button 
                  v-if="editingShortcut !== key"
                  size="small" 
                  @click="startCaptureKey(key)">
                  设置
                </el-button>
                <el-button 
                  v-else
                  size="small" 
                  type="warning"
                  disabled>
                  按键中...
                </el-button>
                <el-button 
                  size="small" 
                  @click="resetShortcut(key)"
                  :disabled="editingShortcut === key">
                  重置
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <!-- Canvas Container Wrapper - 包裹canvas-container -->
      <div class="canvas-container-wrapper">
        <div 
          class="canvas-container" 
          ref="canvasContainer" 
          @wheel="handleCanvasWheel"
          @mousedown="handleCanvasPanStart"
          @mousemove="handleCanvasPan"
          @mouseup="handleCanvasPanEnd"
          @mouseleave="handleCanvasPanEnd"
          @keydown="handleCanvasKeyDown"
          @keyup="handleCanvasKeyUp"
          tabindex="0">
          <div 
            class="canvas-wrapper" 
            :style="canvasWrapperStyle">
          <canvas 
            ref="canvas" 
              class="annotation-canvas-element">
          </canvas>
        </div>
          <div v-if="!currentImage" class="empty-canvas-overlay">
          <el-empty description="请导入图片开始标注" />
          </div>
        </div>
      </div>

      <!-- Canvas Toolbar - 独立出来,不受canvas缩放影响 -->
      <div class="canvas-toolbar">
        <div class="toolbar-info">
          <span class="toolbar-label">绘制模式</span>
          <span class="toolbar-hint">点击图片空白处拖拽绘制标注框</span>
        </div>
        <div class="zoom-controls">
          <el-button 
            size="small" 
            @click="handleZoomOut" 
            :disabled="!currentImage"
            title="缩小">
            <el-icon><ZoomOut /></el-icon>
          </el-button>
          <span class="zoom-level">{{ canvasZoom }}%</span>
          <el-button 
            size="small" 
            @click="handleZoomIn" 
            :disabled="!currentImage"
            title="放大">
            <el-icon><ZoomIn /></el-icon>
          </el-button>
          <el-button 
            size="small" 
            @click="handleResetView" 
            :disabled="!currentImage"
            title="重置视图">
            <el-icon><Refresh /></el-icon>
          </el-button>
          <el-button size="small" @click="toggleFullscreen" title="全屏工作台">
            <el-icon><FullScreen /></el-icon>
          </el-button>
        </div>
      </div>
    </main>

    <!-- 右侧栏：类别与工具区 -->
    <aside class="class-tool-panel">
      <div class="panel-header">
        <h3>类别标签</h3>
        <el-button size="small" @click="handleAddClass">
          <el-icon><Plus /></el-icon>
          添加
        </el-button>
      </div>

      <!-- 类别列表 -->
      <div class="class-list">
        <div 
          v-for="(cls, index) in classList" 
          :key="index"
          class="class-item"
          :class="{ active: selectedClass === index, dragging: draggedClassIndex === index }"
          draggable="true"
          @click="selectClass(index)"
          @contextmenu.prevent="showClassContextMenu($event, index)"
          @dragstart="handleClassDragStart($event, index)"
          @dragover.prevent="handleClassDragOver($event, index)"
          @drop="handleClassDrop($event, index)"
          @dragend="handleClassDragEnd">
          <a-color-picker 
            v-model="cls.color" 
            @change="handleColorChange(index, $event)"
            @popup-visible-change="handleColorPickerPopupChange(index, $event)"
            :show-alpha="false"
            format="hex"
            :show-preset="true"
            :preset-colors="presetColors"
            size="mini">
            <div 
              class="custom-color-trigger" 
              :style="{ backgroundColor: cls.color }"
              title="点击修改颜色">
            </div>
          </a-color-picker>
          <div class="class-name">{{ cls.name }}</div>
          <div class="class-count">{{ cls.count }}</div>
        </div>
        
        <!-- 添加类别输入框 -->
        <div v-if="isAddingClass" class="class-item class-item-input">
          <a-color-picker 
            v-model="newClassColor" 
            @change="handleNewClassColorChange"
            @popup-visible-change="handleNewClassColorPickerPopupChange"
            :show-alpha="false"
            format="hex"
            :show-preset="true"
            :preset-colors="presetColors"
            size="mini">
            <div 
              class="custom-color-trigger" 
              :style="{ backgroundColor: newClassColor }"
              title="点击修改颜色">
        </div>
          </a-color-picker>
          <el-input 
            v-model="newClassName" 
            ref="classNameInput"
            size="small" 
            placeholder="输入类别名称"
            @keyup.enter="confirmAddClass"
            @blur="cancelAddClass" />
      </div>

        <div v-if="classList.length === 0 && !isAddingClass" class="empty-class">
          <el-empty description="暂无类别，请先添加类别标签" :image-size="80" />
        </div>
      </div>

      <!-- 类别右键菜单 -->
      <div 
        v-if="contextMenuVisible" 
        class="class-context-menu"
        :style="contextMenuStyle"
        @click="deleteClass">
        <div class="context-menu-item">
            <el-icon><Delete /></el-icon>
          <span>删除</span>
        </div>
      </div>

      <!-- 标注框右键菜单 -->
      <div 
        v-if="annotationContextMenuVisible" 
        class="annotation-context-menu"
        :style="annotationContextMenuStyle">
        <div class="context-menu-item" @click="performDeleteAnnotation" @click.stop>
          <el-icon><Delete /></el-icon>
          <span>删除标注框</span>
        </div>
      </div>

      <!-- 图片右键菜单 -->
      <div 
        v-if="imageContextMenuVisible" 
        class="image-context-menu"
        :style="imageContextMenuStyle">
        <div class="context-menu-item danger" @click="confirmDeleteImage" @click.stop>
          <el-icon><Delete /></el-icon>
          <span>删除图片</span>
        </div>
      </div>

    </aside>

    <!-- 保存状态遮罩层 -->
    <transition name="saving-fade">
      <div v-if="savingModalVisible" class="saving-overlay">
        <div class="saving-box">
          <div class="saving-header">
            <el-icon class="is-loading" :size="32">
              <Loading />
            </el-icon>
            <div class="saving-text-group">
              <p class="saving-text">{{ getModalMainText() }}</p>
              <p class="saving-tip">{{ getModalTipText() }}</p>
            </div>
          </div>
        <el-button class="force-close-btn" @click="handleForceClose">
          {{ getModalButtonText() }}
        </el-button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { markRaw } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import toast from '../utils/toast'
import { getCurrentProject, fixCorruptedConfig, needsFix, clearCurrentProject } from '../utils/projectManager'
import { AnnotationCanvas } from '../utils/canvas'
import { dbManager } from '../utils/database'
import { importImages, getImagePath } from '../utils/imagePool'
import trainingManager from '../utils/trainingManager'
import { RecycleScroller } from 'vue3-virtual-scroller'
import 'vue3-virtual-scroller/dist/vue3-virtual-scroller.css'
import Modal from '../components/Modal.vue'

export default {
  name: 'Workbench',
  components: {
    RecycleScroller,
    Loading,
    Modal
  },
  data() {
    return {
      // 项目信息
      project: null,
      
      // 图片数据
      images: [],
      currentImageIndex: -1,
      filterStatus: 'all',
      imageListExpanded: false, // 图片列表是否展开
      thumbnailScale: 100, // 缩略图缩放百分比（仅展开时生效）
      savedScrollState: null, // 保存的滚动状态
      
      // 类别数据
      classList: [],
      selectedClass: -1,
      isAddingClass: false, // 是否正在添加类别
      newClassName: '', // 新类别名称
      newClassColor: '', // 新类别颜色
      contextMenuVisible: false, // 右键菜单可见性
      contextMenuStyle: {}, // 右键菜单位置
      contextMenuTargetIndex: -1, // 右键菜单目标索引
      annotationContextMenuVisible: false, // 标注框右键菜单可见性
      annotationContextMenuStyle: {}, // 标注框右键菜单位置
      selectedAnnotation: null, // 选中的标注框
      imageContextMenuVisible: false, // 图片右键菜单可见性
      imageContextMenuStyle: {}, // 图片右键菜单位置
      imageContextMenuTargetIndex: -1, // 右键菜单目标图片索引
      draggedClassIndex: -1, // 正在拖拽的类别索引
      presetColors: [
        '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', 
        '#F38181', '#AA96DA', '#FECA57', '#48DBFB',
        '#FF9FF3', '#54A0FF', '#00D2D3', '#1DD1A1',
        '#FD79A8', '#A29BFE', '#6C5CE7', '#FDCB6E',
        '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
        '#9B59B6', '#1ABC9C', '#34495E', '#E67E22'
      ], // 预设颜色
      colorBeforeEdit: {}, // 存储编辑前的颜色 { classIndex: originalColor }
      
      // 标注数据
      annotations: {}, // { imageIndex: [annotations] }
      
      // 画布状态
      canvasTool: 'select',
      zoom: 1,
      canvasZoom: 100, // 画布缩放百分比
      canvasOffsetX: 0, // 画布X偏移
      canvasOffsetY: 0, // 画布Y偏移
      isPanning: false, // 是否正在拖拽画布
      panStartX: 0, // 拖拽开始X
      panStartY: 0, // 拖拽开始Y
      isSpacePressed: false, // 是否按下空格键
      fabricCanvas: null, // Fabric画布实例（非响应式）
      canvasDisplayWidth: 0,  // 响应式的画布显示宽度
      canvasDisplayHeight: 0, // 响应式的画布显示高度
      panX: 0,
      panY: 0,
      isDrawing: false,
      startPoint: null,
      currentRect: null,
      
      // 工具栏状态
      toolbarVisible: false,
      autoSaveEnabled: false, // 自动保存开关
      
      // 模型辅助
      modelAssistEnabled: false, // 模型辅助开关
      selectedModel: null, // 选中的模型
      completedModels: [], // 已完成的训练模型列表
      modelInferenceResults: [], // 当前图片的推理结果
      isInferring: false, // 是否正在推理
      confThreshold: 0.25, // 置信度阈值
      
      // 工具栏卡片位置（像素坐标）
      cardPosition: { x: 0, y: 0 },
      isDraggingCard: false,
      
      // 快捷键设置对话框
      shortcutsDialogVisible: false,
      shortcuts: {
        deleteAnnotation: 'Backspace',
        saveAnnotation: 'Enter',
        saveAsNegative: 'Ctrl+Shift+S',
        nextImage: 'ArrowRight',
        prevImage: 'ArrowLeft',
        jumpToNextUnannotated: 'Ctrl+ArrowRight',
        jumpToPrevUnannotated: 'Ctrl+ArrowLeft',
        zoomIn: 'Plus',
        zoomOut: 'Minus',
        resetZoom: 'Ctrl+0'
      },
      editingShortcut: null,
      isCapturingKey: false,
      capturedKeys: [],
      tempShortcut: '',
      conflictKey: null,
      
      // 保存状态 modal
      savingModalVisible: false,
      savingModalType: null, // 'closeProject' 或 'closeWindow' 或 'importing' 或 'loading'
      cancelRequested: false // 用户是否请求取消操作
    }
  },
  watch: {
    selectedClass() {
      this.updateCanvasTool()
    },
    // 监听筛选状态变化，重置滚动位置
    filterStatus() {
      this.$nextTick(() => {
        const scroller = this.$refs.thumbnailList
        if (scroller && scroller.$el) {
          scroller.scrollToPosition(0)
        }
      })
    },
    // 监听置信度阈值变化，重新运行推理
    confThreshold() {
      if (this.modelAssistEnabled && this.selectedModel && this.currentImage) {
        // 使用防抖避免频繁调用
        clearTimeout(this._confThresholdTimer)
        this._confThresholdTimer = setTimeout(() => {
          this.runModelInference()
        }, 500)
      }
    }
  },
  computed: {
    canvasWrapperStyle() {
      let cursor = 'default'
      if (this.isSpacePressed && !this.isPanning) {
        cursor = 'grab'
      } else if (this.isSpacePressed && this.isPanning) {
        cursor = 'grabbing'
      }
      
      // 使用transform来移动canvas-wrapper的位置
      return {
        cursor: cursor,
        transform: `translate(${this.panX}px, ${this.panY}px)`,
        left: '50%',
        top: '50%',
        marginLeft: `-${this.canvasDisplayWidth / 2}px`,
        marginTop: `-${this.canvasDisplayHeight / 2}px`
      }
    },
    toolbarCardStyle() {
      return {
        left: `${this.cardPosition.x}px`,
        top: `${this.cardPosition.y}px`
      }
    },
    currentImage() {
      return this.images[this.currentImageIndex]
    },
    filteredImages() {
      return this.images.filter((img, index) => {
        const status = this.getImageStatus(index)
        if (this.filterStatus === 'all') return true
        if (this.filterStatus === 'annotated') return status === 'annotated'
        if (this.filterStatus === 'unannotated') return status === 'unannotated'
        if (this.filterStatus === 'negative') return status === 'negative'
        return true
      }).map((img, idx) => ({
        ...img,
        index: this.images.indexOf(img)
      }))
    },
    thumbnailGridColumns() {
      // 统一基础大小为120px
      const baseSize = 120
      
      if (!this.imageListExpanded) {
        // 折叠状态也使用120px基础，确保尺寸一致
        return 'repeat(auto-fill, minmax(120px, 1fr))'
      }
      
      // 展开状态根据缩放百分比计算
      const scaledSize = Math.round(baseSize * (this.thumbnailScale / 100))
      return `repeat(auto-fill, minmax(${scaledSize}px, 1fr))`
    },
    // 虚拟滚动：计算网格列数
    gridColumns() {
      const baseSize = 120
      const scaledSize = this.imageListExpanded ? Math.round(baseSize * (this.thumbnailScale / 100)) : baseSize
      // 假设容器宽度为320px（折叠）或60vw（展开）
      const containerWidth = this.imageListExpanded ? window.innerWidth * 0.6 : 320
      const gap = 8
      return Math.max(1, Math.floor((containerWidth - gap) / (scaledSize + gap)))
    },
    // 将图片按行分组
    gridRows() {
      const cols = this.gridColumns
      const rows = []
      const images = this.filteredImages
      
      for (let i = 0; i < images.length; i += cols) {
        rows.push({
          rowIndex: i,
          images: images.slice(i, i + cols)
        })
      }
      
      return rows
    },
    // 虚拟滚动：估算每行的高度
    estimatedItemHeight() {
      const baseSize = 120
      const scaledSize = this.imageListExpanded ? Math.round(baseSize * (this.thumbnailScale / 100)) : baseSize
      // aspect-ratio 4:3, 所以高度 = width * 3/4
      const imgHeight = scaledSize * 3 / 4
      // 高度包括: 图片高度 + border(6) + 行间距(8) + 选中状态额外空间(10)
      const height = Math.ceil(imgHeight + 24)
      return height
    },
    annotatedCount() {
      return this.images.filter((_, index) => this.getImageStatus(index) === 'annotated').length
    },
    unannotatedCount() {
      return this.images.filter((_, index) => this.getImageStatus(index) === 'unannotated').length
    },
    negativeCount() {
      return this.images.filter((_, index) => this.getImageStatus(index) === 'negative').length
    },
    currentAnnotations() {
      return this.annotations[this.currentImageIndex] || []
    }
  },
  async mounted() {
    // 初始化Fabric画布
    await this.initCanvas()
    
    // 监听窗口大小变化
    window.addEventListener('resize', this.resizeCanvas)
    
    // 加载保存的工具栏位置
    this.loadToolbarPosition()
    
    // 加载自动保存设置
    this.loadAutoSaveSetting()
    
    // 加载已完成的训练模型
    await this.loadCompletedModels()
    
    // 监听工具栏打开事件
    window.addEventListener('toggle-workbench-toolbar', this.toggleToolbar)
    window.addEventListener('open-shortcuts-modal', this.openShortcutsDialog)
    window.addEventListener('close-project-requested', this.handleCloseProject)
    window.addEventListener('project-switch-requested', this.handleProjectSwitchRequested)
    window.addEventListener('dataset-imported', this.handleDatasetImported)
    
    // 监听标注框右键菜单事件
    this.$nextTick(() => {
      if (this.fabricCanvas && this.fabricCanvas.canvas) {
        this.fabricCanvas.canvas.on('annotation:rightclick', this.handleAnnotationRightClick.bind(this))
      }
    })
    
    // 清理旧的快捷键数据
    this.cleanupOldShortcuts()
    
    // 聚焦到canvas容器以捕获键盘事件
    this.$nextTick(() => {
      if (this.$refs.canvasContainer) {
        this.$refs.canvasContainer.focus()
      }
    })
    
    // 全局监听空格键，防止触发按钮等默认行为
    this.preventSpaceDefault = (event) => {
      if (event.code === 'Space' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', this.preventSpaceDefault)
    
    // 加载快捷键设置
    this.loadShortcuts()
    
    // 添加全局键盘监听器（捕获阶段），统一处理所有快捷键
    window.addEventListener('keydown', this.handleGlobalKeydown, true)
    
    // 监听窗口关闭事件
    window.addEventListener('beforeunload', this.handleBeforeUnload)
    
    // 异步初始化数据库和加载数据
    this.initializeApp()
  },
  async beforeRouteLeave(to, from, next) {
    // 离开工作台时保存项目状态
    if (this.project) {
      try {
        await this.saveWorkspaceState()
        console.log('路由切换：已保存工作状态')
      } catch (error) {
        console.error('路由切换时保存工作状态失败:', error)
      }
    }
    next()
  },
  async beforeUnmount() {
    // 清理模型推理服务
    if (this.modelAssistEnabled) {
      try {
        await window.electronAPI.model.clearModels()
        console.log('[Workbench] Cleaned up inference service on unmount')
      } catch (error) {
        console.error('Failed to cleanup inference service:', error)
      }
    }
    
    // 销毁Fabric画布
    if (this.fabricCanvas) {
      this.fabricCanvas.destroy()
    }
    
    // 移除全局键盘监听器
    window.removeEventListener('keydown', this.handleGlobalKeydown, true)
    
    window.removeEventListener('resize', this.resizeCanvas)
    window.removeEventListener('toggle-workbench-toolbar', this.toggleToolbar)
    window.removeEventListener('open-shortcuts-modal', this.openShortcutsDialog)
    window.removeEventListener('close-project-requested', this.handleCloseProject)
    window.removeEventListener('project-switch-requested', this.handleProjectSwitchRequested)
    window.removeEventListener('dataset-imported', this.handleDatasetImported)
    
    // 移除全局空格键监听
    if (this.preventSpaceDefault) {
      window.removeEventListener('keydown', this.preventSpaceDefault)
    }
    
    // 移除窗口关闭事件监听
    window.removeEventListener('beforeunload', this.handleBeforeUnload)
  },
  methods: {
    // 切换图片列表展开/折叠，并保持滚动位置
    toggleImageListExpand() {
      const thumbnailListComponent = this.$refs.thumbnailList
      if (!thumbnailListComponent) {
        this.imageListExpanded = !this.imageListExpanded
        return
      }
      
      // RecycleScroller 组件需要通过 $el 访问 DOM
      const thumbnailList = thumbnailListComponent.$el
      if (!thumbnailList) {
        this.imageListExpanded = !this.imageListExpanded
        return
      }
      
      let targetImageIndex = null
      
      // 逻辑1: 优先检查选中的图片是否在视线范围内
      if (this.currentImageIndex >= 0) {
        const selectedItem = thumbnailList.querySelector(`[data-image-index="${this.currentImageIndex}"]`)
        if (selectedItem) {
          const containerRect = thumbnailList.getBoundingClientRect()
          const itemRect = selectedItem.getBoundingClientRect()
          const relativeTop = itemRect.top - containerRect.top
          const relativeBottom = itemRect.bottom - containerRect.top
          
          // 检查选中的图片是否在视口内（部分或完全可见）
          if (relativeTop < containerRect.height && relativeBottom > 0) {
            targetImageIndex = this.currentImageIndex
          }
        }
      }
      
      // 逻辑2: 如果选中的图片不在视线范围内或没有选中的图片，找第一个可见的图片
      if (targetImageIndex === null) {
        const containerRect = thumbnailList.getBoundingClientRect()
        const items = thumbnailList.querySelectorAll('.thumbnail-item')
        
        for (let item of items) {
          const rect = item.getBoundingClientRect()
          const relativeTop = rect.top - containerRect.top
          
          // 找到第一个在视口内的图片（容差20px）
          if (relativeTop >= -20) {
            const imageIndex = item.dataset.imageIndex
            if (imageIndex) {
              targetImageIndex = parseInt(imageIndex)
              break
            }
          }
        }
      }
      
      // 如果还是没找到，使用索引0
      if (targetImageIndex === null) {
        targetImageIndex = 0
      }
      
      // 保存目标图片索引
      this.savedScrollState = {
        targetImageIndex
      }
      
      // 切换展开状态
      this.imageListExpanded = !this.imageListExpanded
      
      // 等待DOM更新完成
      this.$nextTick(() => {
        // 使用 setTimeout 确保布局完全更新
        setTimeout(() => {
          this.restoreScrollPosition()
        }, 50)
      })
    },
    
    // 恢复滚动位置
    restoreScrollPosition() {
      if (!this.savedScrollState) return
      
      const thumbnailListComponent = this.$refs.thumbnailList
      if (!thumbnailListComponent) return
      
      const { targetImageIndex } = this.savedScrollState
      
      // 计算目标图片在 gridRows 中的行索引
      const cols = this.gridColumns
      const rowIndex = Math.floor(targetImageIndex / cols)
      
      // 使用 RecycleScroller 的 scrollToItem 方法滚动到目标行
      // 第二个参数为 true 表示滚动到顶部
      if (thumbnailListComponent.scrollToItem) {
        thumbnailListComponent.scrollToItem(rowIndex)
      } else {
        // 备用方案：直接操作 DOM
        const thumbnailList = thumbnailListComponent.$el
        if (thumbnailList) {
          // 等待虚拟滚动渲染目标元素
          this.$nextTick(() => {
            const targetItem = thumbnailList.querySelector(`[data-image-index="${targetImageIndex}"]`)
            if (targetItem) {
              // 获取目标图片的行容器
              const rowContainer = targetItem.closest('.thumbnail-row')
              if (rowContainer) {
                // 将行容器滚动到视口顶部
                const containerRect = thumbnailList.getBoundingClientRect()
                const rowRect = rowContainer.getBoundingClientRect()
                const scrollOffset = rowRect.top - containerRect.top
                thumbnailList.scrollTop += scrollOffset
              }
            }
          })
        }
      }
      
      // 清空保存的状态
      this.savedScrollState = null
    },
    
    // 保存工作状态到项目配置
    async saveWorkspaceState() {
      if (!this.project) {
        return
      }
      
      const state = {
        currentImageIndex: this.currentImageIndex,
        scrollPosition: this.getCurrentScrollPosition(),
        lastSaved: new Date().toISOString()
      }
      
      // 调用 Electron API 保存到项目配置文件
      await window.electronAPI.saveProjectWorkspaceState(this.project.path, state)
    },
    
    // 获取当前滚动位置
    getCurrentScrollPosition() {
      const scroller = this.$refs.thumbnailList
      if (scroller && scroller.$el) {
        return scroller.$el.scrollTop || 0
      }
      return 0
    },
    
    // 恢复工作状态
    async restoreWorkspaceState() {
      if (!this.project) {
        return
      }
      
      const state = await window.electronAPI.loadProjectWorkspaceState(this.project.path)
      
      if (state && state.currentImageIndex >= 0 && state.currentImageIndex < this.images.length) {
        // 恢复选中图片（不要提前设置 currentImageIndex，让 selectImage 自己设置）
        await this.selectImage(state.currentImageIndex)
        
        // 恢复滚动位置 - 需要等待虚拟滚动渲染完成
        await this.$nextTick()
        
        // 再等待一帧确保DOM已更新
        await new Promise(resolve => requestAnimationFrame(resolve))
        
        const scroller = this.$refs.thumbnailList
        
        if (scroller && scroller.$el && state.scrollPosition) {
          scroller.$el.scrollTop = state.scrollPosition
        }
      } else {
        // 没有保存的状态，或状态无效，选中第一张图片
        if (this.images.length > 0) {
          await this.selectImage(0)
        }
      }
    },
    
    // 处理项目切换请求（先保存再切换）
    // 处理数据集导入完成
    async handleDatasetImported(event) {
      const { isNewProject } = event.detail || {}
      
      console.log('数据集导入完成，重新加载数据...', { isNewProject })
      
      // 显示加载modal
      this.savingModalVisible = true
      this.savingModalType = 'loading'
      this.cancelRequested = false
      
      const startTime = Date.now()
      
      try {
        // 如果是导入到新项目，需要完全重新初始化
        if (isNewProject) {
          // 清理当前画布
          if (this.fabricCanvas) {
            this.fabricCanvas.destroy()
            this.fabricCanvas = null
          }
          
          // 重置所有状态
          this.images = []
          this.currentImageIndex = -1
          this.classList = []
          this.selectedClass = -1
          this.annotations = {}
          this.project = null
          
          // 等待DOM更新
          await this.$nextTick()
          
          // 重新初始化画布
          await this.initCanvas()
        }
        
        // 重新初始化应用（加载数据）
        await this.initializeApp()
        
        // 确保至少显示500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
        
        console.log('数据加载完成')
        this.$message.success('数据已更新')
      } catch (error) {
        console.error('重新加载数据失败:', error)
        this.$message.error('加载数据失败: ' + error.message)
        
        // 确保至少显示500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } finally {
        this.savingModalVisible = false
      }
    },
    
    async handleProjectSwitchRequested(event) {
      const { newProject, needSave } = event.detail
      
      console.log('收到项目切换请求，先保存当前项目状态...')
      
      // 显示保存modal
      this.savingModalVisible = true
      this.savingModalType = 'loading'
      this.cancelRequested = false
      
      const startTime = Date.now()
      
      try {
        // 1. 先保存当前项目状态
        if (needSave && this.project) {
          await this.saveWorkspaceState()
          console.log('当前项目状态已保存')
        }
        
        // 2. 清理当前画布
        if (this.fabricCanvas) {
          this.fabricCanvas.destroy()
          this.fabricCanvas = null
        }
        
        // 3. 重置所有状态
        this.images = []
        this.currentImageIndex = -1
        this.classList = []
        this.selectedClass = -1
        this.annotations = {}
        this.project = null
        
        // 4. 等待DOM更新
        await this.$nextTick()
        
        // 5. 重新初始化画布
        await this.initCanvas()
        
        // 6. 重新初始化应用（加载新项目）
        await this.initializeApp()
        
        // 确保至少显示500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
        
        console.log('项目切换完成')
      } catch (error) {
        console.error('项目切换失败:', error)
        this.$message.error('项目切换失败')
        
        // 确保至少显示500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } finally {
        this.savingModalVisible = false
      }
    },
    
    // 处理关闭项目
    async handleCloseProject() {
      // 立即显示 modal，无需确认
      this.savingModalVisible = true
      this.savingModalType = 'closeProject'
      
      const startTime = Date.now()
      
      try {
        // 后台自动保存
        await this.saveWorkspaceState()
        
        // 计算已经过去的时间
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        
        // 如果不足500ms，等待剩余时间
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } catch (error) {
        console.error('保存工作状态失败:', error)
        // 即使保存失败，也至少等待500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } finally {
        // 自动关闭 modal 并执行关闭
        this.savingModalVisible = false
        this.confirmCloseProject()
      }
    },
    
    // 确认关闭项目
    confirmCloseProject() {
      clearCurrentProject()
      
      // 清除上次打开的项目记录
      localStorage.removeItem('lastOpenedProject')
      console.log('已清除上次打开的项目记录')
      
      // 触发全局项目变化事件
      window.dispatchEvent(new CustomEvent('project-changed', { detail: null }))
      
      // 跳转到欢迎页
      this.$router.push('/welcome')
    },
    
    // 获取modal主文字
    getModalMainText() {
      switch (this.savingModalType) {
        case 'closeProject':
        case 'closeWindow':
          return '正在保存工作状态...'
        case 'importing':
          return '正在导入图片...'
        case 'loading':
          return '正在加载项目...'
        default:
          return '正在处理...'
      }
    },
    
    // 获取modal提示文字
    getModalTipText() {
      switch (this.savingModalType) {
        case 'closeProject':
        case 'closeWindow':
          return '如果不需要保存，可以点击下方按钮强制关闭'
        case 'importing':
        case 'loading':
          return '请稍候，或点击下方按钮取消操作'
        default:
          return '请稍候...'
      }
    },
    
    // 获取modal按钮文字
    getModalButtonText() {
      switch (this.savingModalType) {
        case 'closeProject':
          return '强制关闭项目'
        case 'closeWindow':
          return '强制关闭窗口'
        case 'importing':
        case 'loading':
          return '取消'
        default:
          return '取消'
      }
    },
    
    // 强制关闭（跳过保存）
    handleForceClose() {
      if (this.savingModalType === 'importing' || this.savingModalType === 'loading') {
        // 对于导入/加载操作，设置取消标志
        this.cancelRequested = true
        this.savingModalVisible = false
      } else {
        // 对于关闭操作，直接执行关闭
        this.savingModalVisible = false
        
        if (this.savingModalType === 'closeProject') {
          this.confirmCloseProject()
        } else if (this.savingModalType === 'closeWindow') {
          window.removeEventListener('beforeunload', this.handleBeforeUnload)
          window.close()
        }
      }
    },
    
    // 处理窗口关闭前事件
    async handleBeforeUnload(e) {
      if (!this.project) return
      
      // 阻止默认关闭行为
      e.preventDefault()
      e.returnValue = ''
      
      // 显示保存 modal
      this.savingModalVisible = true
      this.savingModalType = 'closeWindow'
      
      const startTime = Date.now()
      
      try {
        // 执行保存
        await this.saveWorkspaceState()
        
        // 计算已经过去的时间
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        
        // 如果不足500ms，等待剩余时间
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } catch (error) {
        console.error('保存工作状态失败:', error)
        // 即使保存失败，也至少等待500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } finally {
        this.savingModalVisible = false
        // 保存完成后允许关闭
        window.removeEventListener('beforeunload', this.handleBeforeUnload)
        window.close()
      }
    },
    
    // 异步初始化应用
    async initializeApp() {
      // 显示加载modal
      this.savingModalVisible = true
      this.savingModalType = 'loading'
      this.cancelRequested = false
      
      const startTime = Date.now()
      
      try {
        // 获取当前项目
        this.project = getCurrentProject()
        
        if (!this.project) {
          this.$message.error('未找到当前项目')
          return
        }
        
        // 初始化数据库
        await this.initDatabase()
        
        // 检查是否被取消
        if (this.cancelRequested) {
          this.$message.info('加载操作已取消')
          this.$router.push('/welcome')
          return
        }
        
        // 加载类别列表
        await this.loadClassListFromDatabase()
        
        // 检查是否被取消
        if (this.cancelRequested) {
          this.$message.info('加载操作已取消')
          this.$router.push('/welcome')
          return
        }
        
        // 加载项目图片（必须等待完成）
        await this.loadProjectImages()
        
        // 检查是否被取消
        if (this.cancelRequested) {
          this.$message.info('加载操作已取消')
          this.$router.push('/welcome')
          return
        }
        
        // 恢复工作状态
        await this.restoreWorkspaceState()
        
        // 保存当前打开的项目路径到 localStorage（用于下次启动自动恢复）
        if (this.project && this.project.path) {
          localStorage.setItem('lastOpenedProject', this.project.path)
          console.log('已记录当前打开的项目:', this.project.path)
        }
        
        // 确保至少显示500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } catch (error) {
        console.error('应用初始化失败:', error)
        if (!this.cancelRequested) {
          this.$message.error('应用初始化失败')
        }
        
        // 确保至少显示500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } finally {
        this.savingModalVisible = false
      }
    },

    // 初始化数据库
    async initDatabase() {
      try {
        await dbManager.init()
        console.log('数据库初始化成功')
      } catch (error) {
        console.error('数据库初始化失败:', error)
        this.$message.error('数据库初始化失败，请检查项目路径')
        throw error
      }
    },

    // 导入图片
    async handleImportImages() {
      if (!this.project || !this.project.path) {
        this.$message.warning('请先打开一个项目')
        return
      }
      
      // 显示选择对话框
      this.$confirm('请选择导入方式', '导入图片', {
        distinguishCancelAndClose: true,
        confirmButtonText: '选择文件',
        cancelButtonText: '选择文件夹',
        type: 'info'
      }).then(async () => {
        // 选择文件
        await this.importImageFiles(this.project.path)
      }).catch(async (action) => {
        if (action === 'cancel') {
          // 选择文件夹
          await this.importImageDirectory(this.project.path)
        }
      })
    },
    
    // 从文件导入
    async importImageFiles(projectPath) {
      try {
        const result = await window.electronAPI.selectImageFiles()
        
        if (!result.success) {
          this.$message.error('选择文件失败: ' + result.error)
          return
        }
        
        if (!result.files || result.files.length === 0) {
          return
        }
        
        await this.copyAndLoadImages(result.files, projectPath)
      } catch (error) {
        console.error('导入图片文件失败', error)
        this.$message.error('导入图片失败')
      }
    },
    
    // 从文件夹导入
    async importImageDirectory(projectPath) {
      try {
        const result = await window.electronAPI.selectImageDirectory()
        
        if (!result.success) {
          this.$message.error('选择文件夹失败: ' + result.error)
          return
        }
        
        if (!result.directory) {
          return
        }
        
        // 扫描目录中的图片
        const scanResult = await window.electronAPI.scanImageDirectory(
          result.directory,
          ['.jpg', '.jpeg', '.png', '.bmp', '.webp']
        )
        
        if (!scanResult.success) {
          this.$message.error('扫描文件夹失败: ' + scanResult.error)
          return
        }
        
        if (!scanResult.files || scanResult.files.length === 0) {
          this.$message.warning('该文件夹中没有找到图片文件')
          return
        }
        
        await this.copyAndLoadImages(scanResult.files, projectPath)
      } catch (error) {
        console.error('导入图片文件夹失败', error)
        this.$message.error('导入图片失败')
      }
    },
    
    // 复制图片到项目并加载
    async copyAndLoadImages(sourceFiles, projectPath) {
      // 显示modal
      this.savingModalVisible = true
      this.savingModalType = 'importing'
      this.cancelRequested = false
      
      const startTime = Date.now()
      
      try {
        // 使用图片池导入
        const projectName = this.project.name || 'project'
        
        const result = await importImages(projectName, sourceFiles)
        
        // 检查是否被取消
        if (this.cancelRequested) {
          this.$message.info('导入操作已取消')
          return
        }
        
        if (!result.success) {
          this.$message.error('导入图片失败')
          return
        }
        
        // 将图片引用添加到项目数据库
        let newImagesCount = 0
        let skippedCount = 0
        
        for (const imgResult of result.results) {
          const originalName = imgResult.originalPath.split(/[/\\]/).pop()
          const addResult = await dbManager.addProjectImage(imgResult.imageId, originalName)
          
          if (addResult.isNew) {
            newImagesCount++
          } else {
            skippedCount++
          }
        }
        
        // 显示导入结果
        const errorCount = result.errors.length
        
        if (skippedCount > 0) {
          this.$message.success(`成功导入 ${newImagesCount} 张新图片，跳过 ${skippedCount} 张重复图片${errorCount > 0 ? `，${errorCount} 张失败` : ''}`)
        } else if (errorCount > 0) {
          this.$message.warning(`成功导入 ${newImagesCount} 张图片，${errorCount} 张失败`)
          console.error('导入失败的图片:', result.errors)
        } else {
          this.$message.success(`成功导入 ${newImagesCount} 张图片`)
        }
        
        // 重新加载项目图片
        await this.loadProjectImages()
        
        // 如果之前没有选中图片，自动选中第一张
        if (this.currentImageIndex === -1 && this.images.length > 0) {
          this.selectImage(0)
        }
        
        // 确保至少显示500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } catch (error) {
        console.error('导入图片失败', error)
        if (!this.cancelRequested) {
          this.$message.error('导入图片失败: ' + error.message)
        }
        
        // 确保至少显示500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } finally {
        this.savingModalVisible = false
      }
    },
    
    // 加载项目中的图片
    async loadProjectImages() {
      if (!this.project || !this.project.path) {
        return
      }
      
      try {
        // 从项目数据库加载图片列表
        const projectImages = await dbManager.getProjectImages()
        
        if (!projectImages || projectImages.length === 0) {
          this.images = []
          console.log('项目中没有图片')
          return
        }
        
        // 转换为组件需要的格式
        const imagesPromises = projectImages.map(async (img, index) => {
          try {
            // 从图片池获取实际路径
            const imagePath = await getImagePath(img.image_id)
            
            return {
              index: index,
              id: img.id,  // project_images 表的主键
              imageId: img.image_id,  // image_pool.db 的图片ID
              name: img.original_name,
              path: imagePath,
              src: `file://${imagePath}`,
              status: 'unannotated', // 默认未标注
              hasAnnotations: false,
              isNegative: false
            }
          } catch (error) {
            console.error(`加载图片失败 (image_id: ${img.image_id}):`, error)
            return null
          }
        })
        
        const imagesArray = await Promise.all(imagesPromises)
        this.images = imagesArray.filter(Boolean) // 过滤掉加载失败的图片
        
        console.log(`已加载 ${this.images.length} 张图片`)
        
        // 批量获取图片的标注状态
        await this.updateImagesStatus()
      } catch (error) {
        console.error('加载项目图片失败', error)
      }
    },
    
    // 批量更新图片的标注状态
    async updateImagesStatus() {
      if (!this.images || this.images.length === 0) {
        return
      }
      
      try {
        // 获取所有图片的image_id
        const imageIds = this.images.map(img => img.imageId).filter(Boolean)
        
        if (imageIds.length === 0) {
          return
        }
        
        // 批量查询状态（基于image_id）
        const statusMap = await dbManager.getImagesStatusByIds(imageIds)
        
        // 更新每张图片的状态
        this.images.forEach(img => {
          const status = statusMap[img.imageId]
          if (status) {
            img.hasAnnotations = status.hasAnnotations
            img.isNegative = status.isNegative
            
            // 更新 status 字段用于显示
            if (status.isNegative) {
              img.status = 'negative'
            } else if (status.hasAnnotations) {
              img.status = 'annotated'
            } else {
              img.status = 'unannotated'
            }
          }
        })
      } catch (error) {
        console.error('更新图片状态失败', error)
      }
    },
    
    // 图片状态管理
    getImageStatus(index) {
      if (!this.images[index]) return 'unannotated'
      
      // 只使用图片对象上的状态（从数据库加载）
      const img = this.images[index]
      
      // 如果明确标记为负样本
      if (img.isNegative) {
        return 'negative'
      }
      
      // 如果有标注数据标记（保存到数据库后才会设置此标志）
      if (img.hasAnnotations) {
        return 'annotated'
      }
      
      // 否则为未标注
      return 'unannotated'
    },
    
    getImageStatusText(image) {
      const status = this.getImageStatus(image.index)
      switch (status) {
        case 'annotated': return '已标注'
        case 'negative': return '负样本'
        case 'unannotated': return '未标注'
        default: return ''
      }
    },
    
    getImageStatusClass(image) {
      const status = this.getImageStatus(image.index)
      return {
        'status-annotated': status === 'annotated',
        'status-negative': status === 'negative',
        'status-unannotated': status === 'unannotated'
      }
    },
    
    // 初始化画布
    async initCanvas() {
      await this.$nextTick()
      
      if (!this.$refs.canvas) {
        console.error('Canvas ref not found')
        return
      }
      
      const container = this.$refs.canvasContainer
      if (!container) {
        console.error('Canvas container not found')
        return
      }
      
      // 创建画布实例，传入canvas元素和容器元素
      // 🔧 使用 markRaw 标记为非响应式，防止 Vue 包装 Fabric.js 对象及其内部的 annotations 数组
      // 这样 canvas.annotations 中的 Fabric.js 对象不会被 Vue 包装成 Proxy，避免破坏 Fabric.js 的内部机制
      const canvasInstance = new AnnotationCanvas(this.$refs.canvas, container)
      this.fabricCanvas = markRaw(canvasInstance)
      
      // 传递类别列表（使用普通对象副本，避免响应式污染）
      this.fabricCanvas.classList = JSON.parse(JSON.stringify(this.classList))
      
      // 监听标注框右键菜单事件
      this.fabricCanvas.canvas.on('annotation:rightclick', this.handleAnnotationRightClick.bind(this))
    },
    
    // 选择图片
    async selectImage(index) {
      // 如果是同一张图片，不处理
      if (this.currentImageIndex === index) {
        return
      }
      
      // 保存当前图片的标注到内存
      if (this.currentImageIndex >= 0 && this.fabricCanvas) {
        this.annotations[this.currentImageIndex] = this.fabricCanvas.getAnnotations()
        
        // 如果开启了自动保存，保存到数据库
        if (this.autoSaveEnabled && this.currentImage) {
          try {
            await this.saveCurrentImageAnnotations()
          } catch (error) {
            console.error('自动保存失败:', error)
            // 继续切换图片，不阻止用户操作
          }
        }
      }
      
      this.currentImageIndex = index
      
      // 等待DOM更新后加载图片
      await this.$nextTick()
      await this.loadImageToCanvas()
      
      // 如果开启了模型辅助且已选择模型，运行推理
      if (this.modelAssistEnabled && this.selectedModel) {
        await this.runModelInference()
      }
    },
    
    // 上一张/下一张
    prevImage() {
      if (this.currentImageIndex > 0) {
        this.selectImage(this.currentImageIndex - 1)
      }
    },
    nextImage() {
      if (this.currentImageIndex < this.images.length - 1) {
        this.selectImage(this.currentImageIndex + 1)
      }
    },
    
    // 跳转到下一张未标注图片
    jumpToNextUnannotated() {
      const startIndex = this.currentImageIndex + 1
      for (let i = startIndex; i < this.images.length; i++) {
        if (this.images[i].status === 'unannotated') {
          this.selectImage(i)
          this.$message.success(`跳转到第 ${i + 1} 张未标注图片`)
          return
        }
      }
      this.$message.info('后面没有未标注的图片了')
    },
    
    // 跳转到上一张未标注图片
    jumpToPrevUnannotated() {
      const startIndex = this.currentImageIndex - 1
      for (let i = startIndex; i >= 0; i--) {
        if (this.images[i].status === 'unannotated') {
          this.selectImage(i)
          this.$message.success(`跳转到第 ${i + 1} 张未标注图片`)
          return
        }
      }
      this.$message.info('前面没有未标注的图片了')
    },
    
    // 加载图片到画布
    async loadImageToCanvas() {
      if (!this.currentImage || !this.fabricCanvas) return
      
      try {
        await this.fabricCanvas.loadImage(this.currentImage.src)
        
        // 🔧 更新响应式的画布尺寸（因为 fabricCanvas 使用 markRaw 不是响应式的）
        this.canvasDisplayWidth = this.fabricCanvas.displayWidth
        this.canvasDisplayHeight = this.fabricCanvas.displayHeight
        
        // 从数据库加载该图片的标注数据（每次切换都重新查询）
        await this.loadAnnotationsFromDatabase()
        
        // 根据当前工具模式设置
        this.updateCanvasTool()
      } catch (error) {
        console.error('加载图片失败', error)
        this.$message.error('加载图片失败')
      }
    },

    // 从数据库加载标注数据并创建到画布
    async loadAnnotationsFromDatabase() {
      if (!this.currentImage || !this.fabricCanvas) return
      
      try {
        const imageId = this.currentImage.imageId
        
        if (!imageId) {
          console.error('当前图片缺少imageId')
          return
        }
        
        // 查询数据库获取该图片的所有标注（使用imageId）
        const dbAnnotations = await dbManager.getImageAnnotations(imageId)
        
        if (!dbAnnotations || dbAnnotations.length === 0) {
          // 清空内存中的标注数据
          this.annotations[this.currentImageIndex] = []
          return
        }
        
        // 转换数据库格式为画布需要的格式
        const canvasAnnotations = dbAnnotations.map(dbAnn => {
          // 跳过负样本数据（class_id 和 position 都为 null）
          if (dbAnn.class_id === null && dbAnn.position === null) {
            return null
          }
          
          // 跳过没有 position 的数据（可能是部分负样本）
          if (!dbAnn.position) {
            return null
          }
          
          // 根据class_id查找类别信息
          const classInfo = this.classList.find(c => c.id === dbAnn.class_id)
          
          if (!classInfo) {
            return null
          }
          
          return {
            classId: classInfo.id,
            className: classInfo.name,
            position: dbAnn.position // position已经是正确的格式 {centerX, centerY, width, height}
          }
        }).filter(Boolean) // 过滤掉null值
        
        // 使用画布的loadAnnotations方法加载标注（与手动创建使用相同的逻辑）
        this.fabricCanvas.loadAnnotations(canvasAnnotations, this.classList)
        
        // 同步更新内存中的标注数据
        this.annotations[this.currentImageIndex] = this.fabricCanvas.getAnnotations()
      } catch (error) {
        console.error('从数据库加载标注失败:', error)
        // 不显示错误提示，避免影响用户体验
      }
    },
    
    // 更新画布工具模式
    updateCanvasTool() {
      if (!this.fabricCanvas) return
      
      // 始终为绘制模式
      if (this.selectedClass >= 0 && this.classList[this.selectedClass]) {
        const selectedClassItem = this.classList[this.selectedClass]
        const classInfo = {
          id: selectedClassItem.id,  // 使用真实的数据库ID，而不是数组索引
          name: selectedClassItem.name,
          color: selectedClassItem.color
        }
        this.fabricCanvas.startDrawing(classInfo)
      } else {
        // 没有选中类别时，停止绘制但仍可编辑已有标注
        this.fabricCanvas.stopDrawing()
      }
    },
    
    // 调整画布大小
    resizeCanvas() {
      if (!this.fabricCanvas) return
      
      // 调用canvas的resize方法，它会自动计算容器大小
      this.fabricCanvas.resize()
      
      // 🔧 更新响应式的画布尺寸
      this.canvasDisplayWidth = this.fabricCanvas.displayWidth
      this.canvasDisplayHeight = this.fabricCanvas.displayHeight
    },
    
    // 缩放控制
    handleZoomIn() {
      const newZoom = Math.min(500, this.canvasZoom + 10)
      this.applyCanvasZoom(newZoom)
      // 聚焦回画布
      this.$nextTick(() => {
        if (this.$refs.canvasContainer) {
          this.$refs.canvasContainer.focus()
        }
      })
    },
    
    handleZoomOut() {
      const newZoom = Math.max(10, this.canvasZoom - 10)
      this.applyCanvasZoom(newZoom)
      // 聚焦回画布
      this.$nextTick(() => {
        if (this.$refs.canvasContainer) {
          this.$refs.canvasContainer.focus()
        }
      })
    },
    
    // 应用画布缩放（使用Fabric.js原生缩放）
    applyCanvasZoom(newZoom) {
      if (!this.fabricCanvas || !this.fabricCanvas.canvas) return
      
      const oldZoom = this.canvasZoom
      this.canvasZoom = newZoom
      const canvas = this.fabricCanvas.canvas
      const zoomRatio = newZoom / 100
      
      // 使用Fabric.js的原生缩放
      canvas.setZoom(zoomRatio)
      
      // 同时缩放canvas容器尺寸
      const newWidth = this.fabricCanvas.displayWidth * zoomRatio
      const newHeight = this.fabricCanvas.displayHeight * zoomRatio
      canvas.setDimensions({
        width: newWidth,
        height: newHeight
      })
      
      // 不使用Fabric.js的viewport transform，保持为0
      canvas.viewportTransform[4] = 0
      canvas.viewportTransform[5] = 0
      
      // 更新所有标签位置
      this.fabricCanvas.updateAllLabels()
      
      canvas.requestRenderAll()
    },
    
    // 重置视图
    handleResetView() {
      if (!this.fabricCanvas || !this.fabricCanvas.canvas) return
      
      const canvas = this.fabricCanvas.canvas
      canvas.setZoom(1)
      
      // 恢复canvas容器原始尺寸
      canvas.setDimensions({
        width: this.fabricCanvas.displayWidth,
        height: this.fabricCanvas.displayHeight
      })
      
      // 重置Fabric.js的viewport transform
      canvas.viewportTransform[4] = 0
      canvas.viewportTransform[5] = 0
      
      // 重置缩放和平移
      this.canvasZoom = 100
      this.panX = 0
      this.panY = 0
      
      // 更新所有标签位置
      this.fabricCanvas.updateAllLabels()
      
      canvas.requestRenderAll()
      
      // 聚焦回画布
      this.$nextTick(() => {
        if (this.$refs.canvasContainer) {
          this.$refs.canvasContainer.focus()
        }
      })
    },
    
    // 滚轮缩放
    handleCanvasWheel(event) {
      // Ctrl/Cmd + 滚轮 或 单独滚轮 都可以缩放
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        
        const delta = -event.deltaY
        
        if (delta > 0) {
          this.handleZoomIn()
        } else {
          this.handleZoomOut()
        }
      } else {
        // 普通滚轮也支持缩放
        // 检查是否是横向滚动（触控板双指左右滑）
        if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
          event.preventDefault()
          
          const delta = -event.deltaY
          
          if (delta > 0) {
            this.handleZoomIn()
          } else {
            this.handleZoomOut()
          }
        }
      }
    },
    
    // 画布容器的键盘按下事件（处理空格键平移）
    handleCanvasKeyDown(event) {
      if (event.code === 'Space') {
        // 阻止空格键的所有默认行为（滚动、触发按钮等）
        event.preventDefault()
        event.stopPropagation()
        
        if (!this.isSpacePressed) {
          this.isSpacePressed = true
          
          // 禁用画布交互（停止绘制）
          if (this.fabricCanvas) {
            this.fabricCanvas.setInteractionEnabled(false)
          }
        }
      }
    },
    
    // 画布容器的键盘释放事件（处理空格键平移）
    handleCanvasKeyUp(event) {
      if (event.code === 'Space') {
        this.isSpacePressed = false
        this.isPanning = false
        
        // 恢复画布交互
        if (this.fabricCanvas) {
          this.fabricCanvas.setInteractionEnabled(true)
        }
      }
    },
    
    // 开始拖拽画布
    handleCanvasPanStart(event) {
      // 按住空格键 + 鼠标左键才能拖拽
      if (event.button === 0 && this.isSpacePressed) {
        if (!this.fabricCanvas || !this.fabricCanvas.canvas) return
        
        this.isPanning = true
        this.panStartX = event.clientX
        this.panStartY = event.clientY
        
        event.preventDefault()
      }
    },
    
    // 拖拽画布
    handleCanvasPan(event) {
      if (this.isPanning && this.isSpacePressed && this.fabricCanvas && this.fabricCanvas.canvas) {
        const deltaX = event.clientX - this.panStartX
        const deltaY = event.clientY - this.panStartY
        
        // 更新canvas-wrapper的位置
        this.panX += deltaX
        this.panY += deltaY
        
        // 更新起始点
        this.panStartX = event.clientX
        this.panStartY = event.clientY
        
        event.preventDefault()
      }
    },
    
    // 结束拖拽画布
    handleCanvasPanEnd(event) {
      if (event.button === 0) {
        this.isPanning = false
      }
    },
    
    // 全屏切换（整个工作台）
    toggleFullscreen() {
      const workbench = this.$el
      if (!workbench) return
      
      if (!document.fullscreenElement) {
        // 进入全屏
        if (workbench.requestFullscreen) {
          workbench.requestFullscreen()
        } else if (workbench.webkitRequestFullscreen) {
          workbench.webkitRequestFullscreen()
        } else if (workbench.mozRequestFullScreen) {
          workbench.mozRequestFullScreen()
        } else if (workbench.msRequestFullscreen) {
          workbench.msRequestFullscreen()
        }
      } else {
        // 退出全屏
        if (document.exitFullscreen) {
          document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen()
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen()
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen()
        }
      }
    },
    
    // 类别管理
    // 类别管理方法
    handleAddClass() {
      this.isAddingClass = true
      this.newClassName = ''
      this.newClassColor = this.getRandomColor()
      this.$nextTick(() => {
        if (this.$refs.classNameInput) {
          this.$refs.classNameInput.focus()
        }
      })
    },
    
    async confirmAddClass() {
      if (!this.newClassName.trim()) {
        this.cancelAddClass()
        return
      }
      
      // 检查类别名称是否已存在
      if (this.classList.some(cls => cls.name === this.newClassName.trim())) {
        this.$message.warning('类别名称已存在')
        return
      }
      
      // 添加到数据库
      const categoryId = await dbManager.addCategory(
        this.newClassName.trim(),
        this.newClassColor
      )
      
      const newClass = {
        id: categoryId,
        name: this.newClassName.trim(),
        color: this.newClassColor,
        count: 0
      }
      
      this.classList.push(newClass)
      this.isAddingClass = false
      this.newClassName = ''
      
      this.$message.success('类别添加成功')
    },
    
    cancelAddClass() {
      this.isAddingClass = false
      this.newClassName = ''
      this.newClassColor = ''
    },
    
    // 处理新类别颜色变化
    handleNewClassColorChange(color) {
      this.newClassColor = color
    },
    
    selectClass(index) {
      this.selectedClass = index
    },
    
    // 修改类别颜色（实时预览，不保存到数据库）
    handleColorChange(classIndex, newColor) {
      if (!newColor) return
      
      const category = this.classList[classIndex]
      if (!category) return
      
      // 只更新类别颜色视图，不保存到数据库
      this.classList[classIndex].color = newColor
      
      // 如果当前图片有该类别的标注，同步更新颜色
      if (this.fabricCanvas && this.currentImageIndex >= 0) {
        const currentAnnotations = this.fabricCanvas.annotations || []
        let hasUpdate = false
        
        currentAnnotations.forEach(rect => {
          // 使用 category.id 而不是 classIndex（索引）
          if (rect.classId === category.id) {
            // 更新标注框颜色
            rect.set({ stroke: newColor })
            
            // 更新原始颜色（用于选中/取消选中时的恢复）
            if (rect._originalStroke) {
              rect._originalStroke = newColor
            }
            
            // 更新标签背景色
            if (rect._label) {
              rect._label.set({ backgroundColor: newColor })
            }
            
            hasUpdate = true
          }
        })
        
        if (hasUpdate) {
          this.fabricCanvas.canvas.requestRenderAll()
        }
      }
    },
    
    // 处理颜色面板的打开和关闭
    async handleColorPickerPopupChange(classIndex, visible) {
      if (visible) {
        // 颜色面板打开时，记录原始颜色
        this.colorBeforeEdit[classIndex] = this.classList[classIndex].color
      } else {
        // 颜色面板关闭时，保存到数据库
        const category = this.classList[classIndex]
        if (category) {
          const newColor = category.color
          const oldColor = this.colorBeforeEdit[classIndex]
          
          // 只有颜色真的改变了才保存到数据库
          if (newColor !== oldColor) {
            await dbManager.updateCategory(category.id, category.name, newColor)
          }
          
          // 清除临时存储
          delete this.colorBeforeEdit[classIndex]
        }
        
        // 保存到项目配置
        this.saveClassListToProject()
      }
    },
    
    // 处理新类别颜色面板的打开和关闭
    handleNewClassColorPickerPopupChange(visible) {
      // 新类别颜色变化不需要保存，因为还没有创建类别
    },
    
    
    // 处理标注框右键菜单
    handleAnnotationRightClick(event) {
      const annotation = event.target
      this.selectedAnnotation = annotation
      
      // 使用原始鼠标事件的位置
      const originalEvent = event.originalEvent
      
      this.annotationContextMenuStyle = {
        position: 'fixed',
        left: originalEvent.clientX + 'px',
        top: originalEvent.clientY + 'px',
        zIndex: 9999
      }
      
      this.annotationContextMenuVisible = true
      
      // 点击其他地方关闭菜单
      const closeMenu = (event) => {
        // 检查点击是否在菜单内部
        const menuElement = document.querySelector('.annotation-context-menu')
        if (menuElement && menuElement.contains(event.target)) {
          return // 如果点击在菜单内部，不关闭菜单
        }
        this.annotationContextMenuVisible = false
        document.removeEventListener('click', closeMenu)
      }
      
      setTimeout(() => {
        document.addEventListener('click', closeMenu)
      }, 100)
    },
    
    // 删除标注框
    performDeleteAnnotation() {
      if (!this.fabricCanvas) {
        return
      }
      
      // 直接从 canvas 获取当前激活的对象，避免使用响应式属性导致 Proxy 包装
      const activeObject = this.fabricCanvas.canvas.getActiveObject()
      if (!activeObject || activeObject === this.fabricCanvas.imageObject) {
        toast.warning('请先选中要删除的标注框')
        return
      }
      
      // 从canvas中删除标注框
      this.fabricCanvas.deleteAnnotation(activeObject)
      
      // 关闭右键菜单
      this.annotationContextMenuVisible = false
      this.selectedAnnotation = null
      
      // 保存标注数据
      if (this.currentImageIndex >= 0) {
        this.annotations[this.currentImageIndex] = this.fabricCanvas.getAnnotations()
      }
      
      toast.success('标注框已删除')
    },
    
    getRandomColor() {
      const colors = this.presetColors
      // 获取已使用的颜色
      const usedColors = this.classList.map(cls => cls.color)
      // 找到未使用的颜色
      const availableColors = colors.filter(c => !usedColors.includes(c))
      
      if (availableColors.length > 0) {
        return availableColors[Math.floor(Math.random() * availableColors.length)]
      }
      
      // 如果所有颜色都用过了，随机返回一个
      return colors[Math.floor(Math.random() * colors.length)]
    },
    
    showClassContextMenu(event, index) {
      this.contextMenuTargetIndex = index
      this.contextMenuVisible = true
      this.contextMenuStyle = {
        position: 'fixed',
        left: event.clientX + 'px',
        top: event.clientY + 'px'
      }
      
      // 点击其他地方关闭菜单
      const closeMenu = () => {
        this.contextMenuVisible = false
        document.removeEventListener('click', closeMenu)
      }
      
      this.$nextTick(() => {
        document.addEventListener('click', closeMenu)
      })
    },
    
    async deleteClass() {
      if (this.contextMenuTargetIndex < 0 || this.contextMenuTargetIndex >= this.classList.length) {
        return
      }
      
      const category = this.classList[this.contextMenuTargetIndex]
      const className = category.name
      
      this.$confirm(`确定要删除类别"${className}"吗？删除后该类别的所有标注也将被删除。`, '删除确认', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        // 从数据库删除类别
        await dbManager.deleteCategory(category.id)
        
        // 删除类别
        this.classList.splice(this.contextMenuTargetIndex, 1)
        
        // 删除该类别的所有标注（使用类别的真实 id，而不是索引）
        Object.keys(this.annotations).forEach(imageIndex => {
          this.annotations[imageIndex] = this.annotations[imageIndex].filter(
            ann => ann.classId !== category.id
          )
        })
        
        // 更新selectedClass（索引相关）
        if (this.selectedClass === this.contextMenuTargetIndex) {
          this.selectedClass = -1
        } else if (this.selectedClass > this.contextMenuTargetIndex) {
          this.selectedClass--
        }
        
        // 重新渲染画布
        if (this.fabricCanvas && this.fabricCanvas.canvas) {
          // 删除画布上该类别的标注框
          const objects = this.fabricCanvas.canvas.getObjects()
          objects.forEach(obj => {
            if (obj.classId === category.id && obj !== this.fabricCanvas.imageObject) {
              this.fabricCanvas.canvas.remove(obj)
            }
          })
          this.fabricCanvas.canvas.requestRenderAll()
        }
        
        this.$message.success('类别删除成功')
      }).catch(() => {})
      
      this.contextMenuVisible = false
    },
    
    // 显示图片右键菜单
    showImageContextMenu(event, imageIndex) {
      this.imageContextMenuTargetIndex = imageIndex
      this.imageContextMenuVisible = true
      this.imageContextMenuStyle = {
        position: 'fixed',
        left: event.clientX + 'px',
        top: event.clientY + 'px'
      }
      
      // 点击其他地方关闭菜单
      const closeMenu = () => {
        this.imageContextMenuVisible = false
        document.removeEventListener('click', closeMenu)
      }
      
      this.$nextTick(() => {
        document.addEventListener('click', closeMenu)
      })
    },
    
    // 确认删除图片
    async confirmDeleteImage() {
      const imageIndex = this.imageContextMenuTargetIndex
      if (imageIndex < 0 || imageIndex >= this.images.length) {
        return
      }
      
      const image = this.images[imageIndex]
      
      this.$confirm(`确定要删除图片"${image.name}"吗？\n\n删除后将：\n1. 从当前项目中移除该图片\n2. 删除该图片的所有标注\n3. 如果该图片不被其他项目引用，将从图片池中彻底删除`, '删除确认', {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false
      }).then(async () => {
        await this.deleteImage(imageIndex)
      }).catch(() => {})
      
      this.imageContextMenuVisible = false
    },
    
    // 删除图片
    async deleteImage(imageIndex) {
      try {
        const image = this.images[imageIndex]
        const currentProject = getCurrentProject()
        
        if (!currentProject) {
          this.$message.error('未找到当前项目')
          return
        }
        
        // 1. 从当前项目数据库中删除该图片的所有标注
        await dbManager.deleteImageAnnotations(image.id)
        
        // 2. 从项目的图片引用中移除
        await window.electronAPI.project.removeImage({
          projectPath: currentProject.path,
          imageId: image.id
        })
        
        // 3. 检查该图片是否还被其他项目引用
        const result = await window.electronAPI.imagePool.checkImageReferences(image.id)
        
        if (result.success && result.referenceCount === 0) {
          // 没有其他项目引用了，删除物理文件和图片池记录
          await window.electronAPI.imagePool.deleteImage(image.id)
          this.$message.success('图片已从项目和图片池中删除')
        } else {
          this.$message.success('图片已从当前项目中移除')
        }
        
        // 4. 更新本地数据
        // 删除图片
        this.images.splice(imageIndex, 1)
        
        // 删除该图片的标注数据
        if (this.annotations[imageIndex]) {
          delete this.annotations[imageIndex]
        }
        
        // 更新后续图片的索引
        const newAnnotations = {}
        Object.keys(this.annotations).forEach(key => {
          const idx = parseInt(key)
          if (idx < imageIndex) {
            newAnnotations[idx] = this.annotations[key]
          } else if (idx > imageIndex) {
            newAnnotations[idx - 1] = this.annotations[key]
          }
        })
        this.annotations = newAnnotations
        
        // 5. 调整当前选中的图片索引
        if (this.currentImageIndex === imageIndex) {
          // 如果删除的是当前图片，切换到前一张或后一张
          if (this.images.length > 0) {
            const newIndex = Math.min(imageIndex, this.images.length - 1)
            this.currentImageIndex = -1 // 先重置
            await this.$nextTick()
            await this.selectImage(newIndex)
          } else {
            // 没有图片了
            this.currentImageIndex = -1
            this.currentImage = null
            if (this.fabricCanvas) {
              this.fabricCanvas.clear()
            }
          }
        } else if (this.currentImageIndex > imageIndex) {
          // 如果删除的图片在当前图片之前，索引需要-1
          this.currentImageIndex--
        }
        
      } catch (error) {
        console.error('删除图片失败:', error)
        this.$message.error('删除图片失败: ' + error.message)
      }
    },
    
    // 拖拽排序方法
    handleClassDragStart(event, index) {
      this.draggedClassIndex = index
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/html', event.target.innerHTML)
    },
    
    handleClassDragOver(event, index) {
      if (this.draggedClassIndex !== index) {
        event.dataTransfer.dropEffect = 'move'
      }
    },
    
    handleClassDrop(event, targetIndex) {
      if (this.draggedClassIndex === targetIndex) {
        return
      }
      
      // 保存拖拽的类别
      const draggedClass = this.classList[this.draggedClassIndex]
      
      // 从原位置删除
      this.classList.splice(this.draggedClassIndex, 1)
      
      // 插入到新位置
      this.classList.splice(targetIndex, 0, draggedClass)
      
      // ⚠️ 注意：不修改标注框的 classId！
      // classId 存储的是类别的真实 id（数据库 ID），不是索引
      // 拖拽排序只改变 classList 数组的顺序，不改变类别的 id
      // 因此标注框会自动匹配正确的类别颜色
      
      // 更新 selectedClass（当前选中的类别索引）
      if (this.selectedClass === this.draggedClassIndex) {
        // 如果拖拽的就是当前选中的类别，更新为新位置
        this.selectedClass = targetIndex
      } else if (this.draggedClassIndex < targetIndex) {
        // 向后拖拽，中间的索引需要前移
        if (this.selectedClass > this.draggedClassIndex && this.selectedClass <= targetIndex) {
          this.selectedClass--
        }
      } else {
        // 向前拖拽，中间的索引需要后移
        if (this.selectedClass >= targetIndex && this.selectedClass < this.draggedClassIndex) {
          this.selectedClass++
        }
      }
      
      // 保存到项目配置
      this.saveClassListToProject()
      
      // 更新画布上所有标注框的颜色（根据 classId 重新匹配颜色）
      if (this.fabricCanvas && this.fabricCanvas.canvas) {
        const objects = this.fabricCanvas.canvas.getObjects()
        objects.forEach(obj => {
          // 如果是标注框（有 classId 属性）
          if (obj.classId !== undefined && obj !== this.fabricCanvas.imageObject) {
            // 根据 classId 在 classList 中查找对应的类别
            const classInfo = this.classList.find(c => c.id === obj.classId)
            if (classInfo) {
              // 只更新边框颜色，不修改填充（保持透明）
              obj.set({
                stroke: classInfo.color
              })
              // 更新原始边框颜色（用于选中/取消选中状态）
              obj._originalStroke = classInfo.color
            }
          }
        })
        this.fabricCanvas.canvas.requestRenderAll()
      }
    },
    
    handleClassDragEnd() {
      this.draggedClassIndex = -1
    },
    
    // 从数据库加载类别列表
    async loadClassListFromDatabase() {
      try {
        const categories = await dbManager.getCategories()
        if (categories && Array.isArray(categories)) {
          this.classList = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            color: cat.color,
            count: 0 // count将从标注数据中计算
          }))
        } else {
          this.classList = []
        }
        
        // 更新count（如果有标注数据）
        await this.updateClassCounts()
        
        console.log('类别列表已从数据库加载', this.classList)
      } catch (error) {
        console.error('加载类别列表失败:', error)
        this.classList = []
        this.$message.warning('加载类别列表失败，将使用空列表')
      }
    },

    // 类别持久化方法
    async saveClassListToProject() {
      if (!this.project || !this.project.path) {
        console.warn('没有打开的项目，无法保存类别列表')
        return
      }
      
      try {
        // 读取当前项目配置
        const result = await window.electronAPI.readProjectConfig(this.project.path)
        
        if (!result || !result.success || !result.config) {
          console.error('无法读取项目配置', result?.error)
          return
        }
        
        let config = result.config
        
        console.log('Workbench保存 - 读取到的原始项目配置:', JSON.stringify(config, null, 2))
        
        // 只在需要时修复配置
        if (needsFix(config)) {
          console.log('检测到配置需要修复，正在修复...')
          config = fixCorruptedConfig(config)
          console.log('Workbench保存 - 修复后的项目配置:', JSON.stringify(config, null, 2))
        } else {
          console.log('配置正常，无需修复')
        }
        
        // 更新类别列表
        if (!config.settings) {
          config.settings = {}
        }
        config.settings.classes = this.classList.map(cls => ({
          name: cls.name,
          color: cls.color
        }))
        config.updatedAt = new Date().toISOString()
        
        console.log('准备保存的项目配置:', config)
        
        // 保存到文件
        const writeResult = await window.electronAPI.writeProjectConfig(this.project.path, config)
        
        if (!writeResult || !writeResult.success) {
          console.error('写入项目配置失败', writeResult?.error)
          this.$message.error('保存类别列表失败')
          return
        }
        
        console.log('类别列表已保存到项目配置')
      } catch (error) {
        console.error('保存类别列表失败', error)
        this.$message.error('保存类别列表失败')
      }
    },
    
    async loadClassListFromProject() {
      if (!this.project || !this.project.path) {
        console.warn('没有打开的项目，无法加载类别列表')
        return
      }
      
      try {
        // 读取项目配置
        const result = await window.electronAPI.readProjectConfig(this.project.path)
        
        if (!result || !result.success || !result.config) {
          console.log('无法读取项目配置', result?.error)
          return
        }
        
        let config = result.config
        
        console.log('Workbench加载 - 读取到的原始项目配置:', JSON.stringify(config, null, 2))
        
        // 只在需要时修复配置
        if (needsFix(config)) {
          console.log('检测到配置需要修复，正在修复...')
          config = fixCorruptedConfig(config)
          console.log('Workbench加载 - 修复后的项目配置:', JSON.stringify(config, null, 2))
        } else {
          console.log('配置正常，无需修复')
        }
        
        if (!config.settings || !config.settings.classes) {
          console.log('项目配置中没有类别列表')
          return
        }
        
        // 加载类别列表
        this.classList = config.settings.classes.map(cls => ({
          name: cls.name,
          color: cls.color,
          count: 0 // count将从标注数据中计算
        }))
        
        // 更新count（如果有标注数据）
        this.updateClassCounts()
        
        console.log('类别列表已从项目配置加载', this.classList)
      } catch (error) {
        console.error('加载类别列表失败', error)
        this.$message.error('加载类别列表失败')
      }
    },
    
    async updateClassCounts() {
      // 从数据库获取类别统计
      const counts = await dbManager.getCategoryCounts()
      
      // 更新类别统计
      this.classList.forEach(cls => {
        const categoryCount = counts.find(c => c.id === cls.id)
        cls.count = categoryCount ? categoryCount.count : 0
      })
      
      console.log('类别统计已更新', this.classList)
    },
    
    // 标注管理
    deleteAnnotation(index) {
      this.currentAnnotations.splice(index, 1)
    },
    
    getClassName(classId) {
      // classId 是类别的真实 id，不是索引
      const cls = this.classList.find(c => c.id === classId)
      return cls?.name || '未知'
    },
    
    getClassColor(classId) {
      // classId 是类别的真实 id，不是索引
      const cls = this.classList.find(c => c.id === classId)
      return cls?.color || '#999'
    },
    
    // 静默保存当前图片的标注（用于自动保存）
    async saveCurrentImageAnnotations(includeModelPredictions = false) {
      if (!this.currentImage) {
        return
      }

      const imageId = this.currentImage.imageId
      if (!imageId) {
        console.error('当前图片缺少imageId')
        return
      }

      // 获取当前图片的标注数据
      // includeModelPredictions 为 true 时（手动保存），包含模型推理的标注框
      const currentAnnotations = this.fabricCanvas ? this.fabricCanvas.getAnnotations(includeModelPredictions) : []
      
      // 更新内存中的标注数据
      this.annotations[this.currentImageIndex] = currentAnnotations
      
      // 转换标注数据格式
      const annotations = currentAnnotations.map(annotation => {
        let realClassId = annotation.classId
        
        // 验证classId是否有效
        const classExists = this.classList.find(c => c.id === realClassId)
        if (!classExists && annotation.className) {
          const foundClass = this.classList.find(c => c.name === annotation.className)
          if (foundClass) {
            realClassId = foundClass.id
          }
        }
        
        if (annotation.position) {
          return {
            classId: realClassId,
            position: {
              centerX: annotation.position.centerX,
              centerY: annotation.position.centerY,
              width: annotation.position.width,
              height: annotation.position.height
            }
          }
        } else {
          return {
            classId: realClassId,
            position: null
          }
        }
      })

      // 保存到数据库（使用imageId）
      await dbManager.saveImageAnnotations(imageId, annotations)
      
      // 更新当前图片的状态
      if (this.currentImage && this.images[this.currentImageIndex]) {
        const hasAnnotationFrames = annotations.some(ann => ann.position !== null)
        const hasOnlyNegative = annotations.length > 0 && annotations.every(ann => ann.position === null)
        
        this.images[this.currentImageIndex].hasAnnotations = annotations.length > 0
        this.images[this.currentImageIndex].isNegative = hasOnlyNegative
        
        if (hasOnlyNegative) {
          this.images[this.currentImageIndex].status = 'negative'
        } else if (hasAnnotationFrames) {
          this.images[this.currentImageIndex].status = 'annotated'
        } else {
          this.images[this.currentImageIndex].status = 'unannotated'
        }
      }
      
      // 更新类别统计
      await this.updateClassCounts()
      
      // 静默保存，不显示提示
      console.log('自动保存成功:', this.currentImage.name)
    },
    
    // 保存和导出
    async handleSaveAnnotations() {
      if (!this.currentImage) {
        this.$message.warning('没有选中的图片')
        return
      }

      // 手动保存时包含模型推理的标注框
      await this.saveCurrentImageAnnotations(true)
      
      // 显示成功提示
      this.$message.success('标注已保存')
    },
    
    // 保存为负样本
    async handleSaveAsNegative() {
      if (!this.currentImage) {
        this.$message.warning('没有选中的图片')
        return
      }

      // 确认对话框
      try {
        await this.$confirm(
          '将此图片标记为负样本，会删除所有现有标注框。是否继续？',
          '确认保存为负样本',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
      } catch {
        // 用户取消
        return
      }

      try {
        // 保存负样本数据（class_id 和 position 都为 null）
        const negativeAnnotation = [{
          classId: null,
          position: null
        }]

        // 保存到数据库（使用 imageId 而不是 imageName）
        await dbManager.saveImageAnnotations(this.currentImage.id, negativeAnnotation)
        
        // 清空内存中的标注数据
        this.annotations[this.currentImageIndex] = []
        
        // 清空画布上的标注框
        if (this.fabricCanvas) {
          this.fabricCanvas.clearAnnotations()
        }
        
        // 更新当前图片的状态为负样本
        if (this.images[this.currentImageIndex]) {
          this.images[this.currentImageIndex].hasAnnotations = true
          this.images[this.currentImageIndex].isNegative = true
          this.images[this.currentImageIndex].status = 'negative'
        }
        
        // 更新类别统计
        await this.updateClassCounts()
        
        this.$message.success('已保存为负样本')
      } catch (error) {
        console.error('保存负样本失败:', error)
        this.$message.error('保存失败: ' + error.message)
      }
    },
    
    handleExportDataset() {
      this.$message.info('导出数据集功能开发中...')
    },
    
    // 工具栏控制
    toggleToolbar() {
      this.toolbarVisible = !this.toolbarVisible
    },
    
    closeToolbar() {
      this.toolbarVisible = false
    },
    
    // 拖拽工具栏卡片
    startDragCard(e) {
      if (e.button !== 0) return
      
      const startX = e.clientX
      const startY = e.clientY
      const startPosX = this.cardPosition.x
      const startPosY = this.cardPosition.y
      
      this.isDraggingCard = true
      
      const onMouseMove = (moveEvent) => {
        if (this.isDraggingCard) {
          const deltaX = moveEvent.clientX - startX
          const deltaY = moveEvent.clientY - startY
          
          let newX = startPosX + deltaX
          let newY = startPosY + deltaY
          
          // 计算拖拽边界
          const titleBarHeight = 32 // 顶部标题栏高度
          const sidebarWidth = 260 // 左侧菜单栏宽度（假设未折叠）
          const cardWidth = 320 // 工具栏卡片宽度
          const cardHeight = 200 // 工具栏卡片估计高度
          
          // 边界限制：
          // 左边：左侧菜单栏右边
          const minX = sidebarWidth
          // 右边：窗口右边减去卡片宽度
          const maxX = window.innerWidth - cardWidth
          // 上边：顶部栏下边
          const minY = titleBarHeight
          // 下边：窗口底部减去卡片高度
          const maxY = window.innerHeight - cardHeight
          
          // 应用边界限制
          newX = Math.max(minX, Math.min(newX, maxX))
          newY = Math.max(minY, Math.min(newY, maxY))
          
          this.cardPosition = { x: newX, y: newY }
        }
      }
      
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        
        if (this.isDraggingCard) {
          this.isDraggingCard = false
          this.saveToolbarPosition()
        }
      }
      
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      
      e.preventDefault()
    },
    
    // 保存工具栏位置
    saveToolbarPosition() {
      localStorage.setItem('workbench-toolbar-position', JSON.stringify(this.cardPosition))
    },
    
    // 加载工具栏位置
    loadToolbarPosition() {
      const saved = localStorage.getItem('workbench-toolbar-position')
      if (saved) {
        try {
          const position = JSON.parse(saved)
          if (position.x !== undefined && position.y !== undefined) {
            // 验证位置是否在合法范围内
            const titleBarHeight = 32
            const sidebarWidth = 260
            const cardWidth = 320
            const cardHeight = 200
            
            const minX = sidebarWidth
            const maxX = window.innerWidth - cardWidth
            const minY = titleBarHeight
            const maxY = window.innerHeight - cardHeight
            
            // 限制在合法范围内
            this.cardPosition = {
              x: Math.max(minX, Math.min(position.x, maxX)),
              y: Math.max(minY, Math.min(position.y, maxY))
            }
          } else {
            this.setDefaultPosition()
          }
        } catch (e) {
          this.setDefaultPosition()
        }
      } else {
        this.setDefaultPosition()
      }
    },
    
    // 加载自动保存设置
    loadAutoSaveSetting() {
      const saved = localStorage.getItem('workbench-auto-save')
      if (saved !== null) {
        this.autoSaveEnabled = saved === 'true'
      }
    },
    
    // 自动保存开关切换
    handleAutoSaveToggle(value) {
      localStorage.setItem('workbench-auto-save', value.toString())
      if (value) {
        this.$message.success('自动保存已开启')
      } else {
        this.$message.info('自动保存已关闭')
      }
    },
    
    // 加载已完成的训练模型
    async loadCompletedModels() {
      try {
        // 初始化训练管理器
        await trainingManager.init()
        
        const allTasks = trainingManager.getAllTasks()
        this.completedModels = allTasks.filter(task => 
          task.status === 'completed' && task.outputPath
        )
        console.log('[Workbench] Loaded', this.completedModels.length, 'completed models')
      } catch (error) {
        console.error('Failed to load completed models:', error)
      }
    },
    
    // 选择模型
    async selectModel(model) {
      // 如果切换模型，先卸载旧模型
      if (this.selectedModel && this.selectedModel.id !== model.id) {
        try {
          await window.electronAPI.model.unloadModel(this.selectedModel.outputPath)
          console.log('[Workbench] Unloaded previous model:', this.selectedModel.name)
        } catch (error) {
          console.error('Failed to unload model:', error)
        }
      }
      
      this.selectedModel = model
      console.log('[Workbench] Selected model:', model.name)
      
      // 清除旧的推理结果
      this.fabricCanvas?.clearModelAnnotations()
      this.modelInferenceResults = []
      
      // 如果当前有图片，立即运行推理
      if (this.currentImage) {
        await this.runModelInference()
      }
    },
    
    // 模型辅助开关切换
    async handleModelAssistToggle(value) {
      if (value) {
        this.$message.success('模型辅助已开启')
      } else {
        this.$message.info('模型辅助已关闭')
        
        // 清除模型推理的标注框
        this.fabricCanvas?.clearModelAnnotations()
        this.modelInferenceResults = []
        this.selectedModel = null
        
        // 清空所有已加载的模型并停止推理服务
        try {
          await window.electronAPI.model.clearModels()
          console.log('[Workbench] Cleared all models and stopped inference service')
        } catch (error) {
          console.error('Failed to clear models:', error)
        }
      }
    },
    
    // 计算两个标注框的交并比 (IoU)
    calculateIoU(box1, box2) {
      // box1, box2 格式: { centerX, centerY, width, height } (归一化坐标)
      
      // 转换为左上角坐标
      const x1_1 = box1.centerX - box1.width / 2
      const y1_1 = box1.centerY - box1.height / 2
      const x2_1 = box1.centerX + box1.width / 2
      const y2_1 = box1.centerY + box1.height / 2
      
      const x1_2 = box2.centerX - box2.width / 2
      const y1_2 = box2.centerY - box2.height / 2
      const x2_2 = box2.centerX + box2.width / 2
      const y2_2 = box2.centerY + box2.height / 2
      
      // 计算交集区域
      const x1_inter = Math.max(x1_1, x1_2)
      const y1_inter = Math.max(y1_1, y1_2)
      const x2_inter = Math.min(x2_1, x2_2)
      const y2_inter = Math.min(y2_1, y2_2)
      
      const interWidth = Math.max(0, x2_inter - x1_inter)
      const interHeight = Math.max(0, y2_inter - y1_inter)
      const interArea = interWidth * interHeight
      
      // 计算并集区域
      const area1 = box1.width * box1.height
      const area2 = box2.width * box2.height
      const unionArea = area1 + area2 - interArea
      
      // 返回 IoU
      return unionArea > 0 ? interArea / unionArea : 0
    },
    
    // 过滤与已存在标注框高度重叠的推理结果
    filterOverlappingPredictions(predictions) {
      // 获取当前图片的已有标注（不包含模型推理的）
      const existingAnnotations = this.fabricCanvas.getAnnotations(false)
      
      const IOU_THRESHOLD = 0.5
      
      return predictions.filter(pred => {
        // 对每个推理结果，检查是否与已有标注重叠
        const hasOverlap = existingAnnotations.some(existing => {
          // 仅当类别相同时才检查重叠
          if (existing.classId !== pred.classId) {
            return false
          }
          
          // 计算 IoU
          const iou = this.calculateIoU(pred.position, existing.position)
          
          return iou >= IOU_THRESHOLD
        })
        
        // 如果有高度重叠，则过滤掉（返回 false）
        return !hasOverlap
      })
    },
    
    // 运行模型推理
    async runModelInference() {
      if (!this.selectedModel || !this.currentImage) return
      
      this.isInferring = true
      
      try {
        const result = await window.electronAPI.model.inference({
          modelPath: this.selectedModel.outputPath,
          imagePath: this.currentImage.path,
          confThreshold: this.confThreshold
        })
        
        if (result.success) {
          // 清除之前的模型推理结果
          this.fabricCanvas.clearModelAnnotations()
          
          // 转换预测结果为画布标注格式
          const canvasAnnotations = result.predictions.map(pred => {
            const classInfo = this.classList.find(c => c.id === pred.classId || c.name === pred.className)
            if (!classInfo) return null
            
            return {
              classId: classInfo.id,
              className: classInfo.name,
              confidence: pred.confidence,
              position: pred.position
            }
          }).filter(Boolean)
          
          // 🔧 过滤与已存在标注框高度重叠的推理结果
          const filteredAnnotations = this.filterOverlappingPredictions(canvasAnnotations)
          
          // 加载过滤后的模型推理结果
          this.fabricCanvas.loadModelAnnotations(filteredAnnotations, this.classList)
          
          // 同步更新内存中的标注数据（包含模型推理的标注框）
          if (this.currentImageIndex >= 0) {
            this.annotations[this.currentImageIndex] = this.fabricCanvas.getAnnotations(true)
          }
          
          this.modelInferenceResults = result.predictions
          
          // 显示推理结果消息
          if (filteredAnnotations.length > 0) {
            const filtered = canvasAnnotations.length - filteredAnnotations.length
            if (filtered > 0) {
              this.$message.success(`检测到 ${result.count} 个对象，过滤 ${filtered} 个重叠标注，添加 ${filteredAnnotations.length} 个新标注`)
            } else {
              this.$message.success(`检测到 ${filteredAnnotations.length} 个对象`)
            }
          } else {
            if (canvasAnnotations.length > 0) {
              this.$message.info(`检测到 ${canvasAnnotations.length} 个对象，但全部与已有标注重叠`)
            } else {
              this.$message.info('未检测到对象')
            }
          }
        } else {
          this.$message.error(result.error || '模型推理失败')
        }
      } catch (error) {
        console.error('Model inference failed:', error)
        this.$message.error('模型推理失败')
      } finally {
        this.isInferring = false
      }
    },
    
    // 格式化模型时间
    formatModelTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now - date
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      
      if (days === 0) {
        return '今天'
      } else if (days === 1) {
        return '昨天'
      } else if (days < 7) {
        return `${days}天前`
      } else {
        return date.toLocaleDateString()
      }
    },
    
    // 设置默认位置（工作区域中央）
    setDefaultPosition() {
      const titleBarHeight = 32 // 顶部标题栏高度
      const sidebarWidth = 260 // 左侧菜单栏宽度
      const cardWidth = 320 // 工具栏卡片宽度
      const cardHeight = 200 // 工具栏卡片估计高度
      
      // 计算工作区域的尺寸
      const workAreaWidth = window.innerWidth - sidebarWidth
      const workAreaHeight = window.innerHeight - titleBarHeight
      
      // 放在工作区域的中央
      this.cardPosition = {
        x: sidebarWidth + (workAreaWidth - cardWidth) / 2,
        y: titleBarHeight + (workAreaHeight - cardHeight) / 2
      }
    },
    
    // 视图控制
    fitToScreen() {
      this.zoom = 1
      this.panX = 0
      this.panY = 0
      this.drawCanvas()
      this.$message.success('已适应屏幕')
    },
    
    centerView() {
      this.panX = 0
      this.panY = 0
      this.drawCanvas()
      this.$message.success('已居中显示')
    },
    
    // 快捷键设置
    openShortcutsDialog() {
      this.shortcutsDialogVisible = true
      // 对话框打开后自动聚焦
      this.$nextTick(() => {
        const content = document.querySelector('.shortcuts-content')
        if (content) {
          content.focus()
          console.log('对话框已聚焦')
        }
      })
    },
    
    closeShortcutsDialog() {
      this.shortcutsDialogVisible = false
      this.editingShortcut = null
      this.isCapturingKey = false
      this.capturedKeys = []
      this.tempShortcut = ''
      this.conflictKey = null
    },
    
    startCaptureKey(shortcutKey) {
      this.editingShortcut = shortcutKey
      this.isCapturingKey = true
      this.capturedKeys = []
      this.tempShortcut = ''
      this.conflictKey = null
      console.log('开始捕获快捷键:', shortcutKey)
      // 确保对话框获得焦点
      this.$nextTick(() => {
        const content = document.querySelector('.shortcuts-content')
        if (content) {
          content.focus()
        }
      })
    },
    
    // 快捷键设置对话框的键盘按下事件
    handleShortcutKeyDown(event) {
      if (!this.isCapturingKey || !this.editingShortcut) {
        return
      }
      
      event.preventDefault()
      event.stopPropagation()
      
      const key = event.key
      
      // 忽略单独的修饰键
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        console.log('忽略修饰键')
        return
      }
      
      // 构建快捷键字符串
      const keys = []
      if (event.ctrlKey || event.metaKey) keys.push('Ctrl')
      if (event.shiftKey) keys.push('Shift')
      if (event.altKey) keys.push('Alt')
      
      // 处理按键名称
      let keyName = key
      if (keyName === ' ') keyName = 'Space'
      else if (keyName.length === 1) keyName = keyName.toUpperCase()
      
      keys.push(keyName)
      
      this.tempShortcut = keys.join('+')
      
      // 检查是否与其他快捷键冲突
      this.conflictKey = this.checkConflict(this.tempShortcut, this.editingShortcut)
    },
    
    // 快捷键设置对话框的键盘释放事件
    handleShortcutKeyUp(event) {
      if (!this.isCapturingKey || !this.editingShortcut) return
      
      event.preventDefault()
      event.stopPropagation()
      
      // 检查是否所有按键都已松开
      if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
        // 如果有捕获到的快捷键且没有冲突
        if (this.tempShortcut && !this.conflictKey) {
          this.shortcuts[this.editingShortcut] = this.tempShortcut
          this.saveShortcuts()
          this.isCapturingKey = false
          this.editingShortcut = null
          this.capturedKeys = []
          this.tempShortcut = ''
        } else if (this.conflictKey) {
          // 有冲突，不保存，显示提示
          this.$message.warning(`快捷键与"${this.getShortcutLabel(this.conflictKey)}"冲突，请重新设置`)
        }
      }
    },
    
    checkConflict(newShortcut, currentKey) {
      // 检查新快捷键是否与其他快捷键冲突
      for (const [key, value] of Object.entries(this.shortcuts)) {
        if (key !== currentKey && value === newShortcut) {
          return key
        }
      }
      return null
    },
    
    resetShortcut(shortcutKey) {
      const defaults = {
        deleteAnnotation: 'Backspace',
        saveAnnotation: 'Enter',
        saveAsNegative: 'Ctrl+Shift+S',
        nextImage: 'ArrowRight',
        prevImage: 'ArrowLeft',
        jumpToNextUnannotated: 'Ctrl+ArrowRight',
        jumpToPrevUnannotated: 'Ctrl+ArrowLeft',
        zoomIn: 'Plus',
        zoomOut: 'Minus',
        resetZoom: 'Ctrl+0'
      }
      this.shortcuts[shortcutKey] = defaults[shortcutKey]
      this.saveShortcuts()
    },
    
    saveShortcuts() {
      localStorage.setItem('workbench-shortcuts', JSON.stringify(this.shortcuts))
      this.$message.success('快捷键已保存')
    },
    
    cleanupOldShortcuts() {
      // 清理localStorage中的旧快捷键数据
      const saved = localStorage.getItem('workbench-shortcuts')
      if (saved) {
        try {
          const savedShortcuts = JSON.parse(saved)
          const validKeys = ['deleteAnnotation', 'saveAnnotation', 'saveAsNegative', 'nextImage', 'prevImage', 'zoomIn', 'zoomOut', 'resetZoom']
          const filteredShortcuts = {}
          validKeys.forEach(key => {
            if (savedShortcuts[key]) {
              filteredShortcuts[key] = savedShortcuts[key]
            }
          })
          // 保存清理后的数据
          localStorage.setItem('workbench-shortcuts', JSON.stringify(filteredShortcuts))
        } catch (e) {
          console.error('清理快捷键失败', e)
        }
      }
    },
    
    loadShortcuts() {
      const saved = localStorage.getItem('workbench-shortcuts')
      if (saved) {
        try {
          const savedShortcuts = JSON.parse(saved)
          // 只加载我们需要的快捷键，过滤掉已删除的
          const validKeys = ['deleteAnnotation', 'saveAnnotation', 'saveAsNegative', 'nextImage', 'prevImage', 'zoomIn', 'zoomOut', 'resetZoom']
          const filteredShortcuts = {}
          validKeys.forEach(key => {
            if (savedShortcuts[key]) {
              filteredShortcuts[key] = savedShortcuts[key]
            }
          })
          this.shortcuts = { ...this.shortcuts, ...filteredShortcuts }
        } catch (e) {
          console.error('加载快捷键失败', e)
        }
      }
    },
    
    getShortcutLabel(key) {
      const labels = {
        deleteAnnotation: '删除标注',
        saveAnnotation: '保存标注',
        saveAsNegative: '保存为负样本',
        nextImage: '下一张图片',
        prevImage: '上一张图片',
        jumpToNextUnannotated: '跳转到下一张未标注',
        jumpToPrevUnannotated: '跳转到上一张未标注',
        zoomIn: '放大',
        zoomOut: '缩小',
        resetZoom: '重置缩放'
      }
      return labels[key] || key
    },
    
    // 全局键盘事件处理器（捕获阶段，统一处理所有快捷键）
    handleGlobalKeydown(event) {
      // 如果在输入框中，不处理自定义快捷键，让输入正常工作
      if (this.isInInputField(event.target)) {
        return
      }
      
      // 如果在快捷键设置对话框中，不处理
      if (this.shortcutsDialogVisible) {
        return
      }
      
      // 构建当前按下的快捷键字符串
      const keys = []
      if (event.ctrlKey || event.metaKey) keys.push('Ctrl')
      if (event.shiftKey) keys.push('Shift')
      if (event.altKey) keys.push('Alt')
      
      // 获取主键
      let mainKey = event.key
      
      // 处理特殊键名
      const keyNameMap = {
        ' ': 'Space',
        '+': 'Plus',
        '-': 'Minus',
        'ArrowRight': 'ArrowRight',
        'ArrowLeft': 'ArrowLeft',
        'ArrowUp': 'ArrowUp',
        'ArrowDown': 'ArrowDown',
        'Backspace': 'Backspace',
        'Delete': 'Delete',
        'Enter': 'Enter',
        'Escape': 'Escape',
        'Tab': 'Tab'
      }
      
      if (keyNameMap[mainKey]) {
        mainKey = keyNameMap[mainKey]
      } else if (mainKey.length === 1) {
        mainKey = mainKey.toUpperCase()
      }
      
      keys.push(mainKey)
      const pressedShortcut = keys.join('+')
      
      // 检查是否匹配任何已配置的快捷键
      let matched = false
      for (const [key, shortcut] of Object.entries(this.shortcuts)) {
        if (shortcut === pressedShortcut) {
          matched = true
          event.preventDefault()
          event.stopPropagation()
          
          // 手动触发对应的处理函数
          switch (key) {
            case 'saveAnnotation':
              this.handleSaveAnnotations()
              break
            case 'saveAsNegative':
              this.handleSaveAsNegative()
              break
            case 'deleteAnnotation':
              if (this.fabricCanvas && this.fabricCanvas.canvas) {
                const activeObject = this.fabricCanvas.canvas.getActiveObject()
                if (activeObject && activeObject !== this.fabricCanvas.imageObject) {
                  this.fabricCanvas.deleteAnnotation(activeObject)
                  if (this.currentImageIndex >= 0) {
                    this.annotations[this.currentImageIndex] = this.fabricCanvas.getAnnotations()
                  }
                  toast.success('标注框已删除')
                } else {
                  toast.warning('请先选中要删除的标注框')
                }
              }
              break
            case 'nextImage':
              this.nextImage()
              break
            case 'prevImage':
              this.prevImage()
              break
            case 'jumpToNextUnannotated':
              this.jumpToNextUnannotated()
              break
            case 'jumpToPrevUnannotated':
              this.jumpToPrevUnannotated()
              break
            case 'zoomIn':
              this.handleZoomIn()
              break
            case 'zoomOut':
              this.handleZoomOut()
              break
            case 'resetZoom':
              this.handleResetView()
              break
          }
          
          return false
        }
      }
      
      // 不匹配的快捷键让 Electron 层处理，不在这里阻止
      // 这样用户自定义的快捷键（如 Ctrl+- 用于缩放）可以正常工作
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
    }
  }
}
</script>

<style scoped>
.workbench {
  position: relative; /* 为absolute定位的子元素提供参照 */
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--color-bg-primary, #ffffff);
}

body[data-theme="dark"] .workbench {
  background: #1e1e1e;
}

/* 左侧文件列表面板 */
.file-list-panel {
  width: 330px;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.panel-content-wrapper {
  width: 330px;
  height: 100%;
  background: var(--color-bg-primary, #ffffff);
  border-right: 1px solid var(--color-border, #e0e0e0);
  display: flex;
  flex-direction: column;
  position: relative;
  transition: width 0.3s ease, box-shadow 0.3s ease;
}

body[data-theme="dark"] .panel-content-wrapper {
  background: #252526;
  border-right-color: #3c3c3c;
}

.panel-content-wrapper.expanded {
  width: 60vw;
  min-width: 600px;
  position: absolute;
  left: 0;
  top: 0;
  z-index: 100;
  box-shadow: 4px 0 12px var(--color-shadow, rgba(0, 0, 0, 0.15));
}

body[data-theme="dark"] .panel-content-wrapper.expanded {
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.5);
}

.panel-header {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

body[data-theme="dark"] .panel-header {
  border-bottom-color: #3c3c3c;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #333333);
  margin: 0;
}

body[data-theme="dark"] .panel-header h3 {
  color: #cccccc;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.filter-bar {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  overflow-x: auto;
  overflow-y: hidden;
}

body[data-theme="dark"] .filter-bar {
  border-bottom-color: #3c3c3c;
}

/* 深色模式下的单选按钮样式 (VSCode 风格) */
body[data-theme="dark"] .filter-bar :deep(.el-radio-button__inner) {
  background-color: #3c3c3c;
  border-color: #3c3c3c;
  color: #cccccc;
  box-shadow: none;
}

body[data-theme="dark"] .filter-bar :deep(.el-radio-button:hover .el-radio-button__inner) {
  background-color: #505050;
  border-color: #505050;
  color: #ffffff;
}

body[data-theme="dark"] .filter-bar :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background-color: #007acc;
  border-color: #007acc;
  color: #ffffff;
}

.filter-radio-group {
  display: flex;
  white-space: nowrap;
}

.filter-bar :deep(.el-radio-button__inner) {
  padding: 6px 10px;
  font-size: 11px;
}

.filter-bar :deep(.el-radio-group) {
  flex-wrap: nowrap;
}

.thumbnail-list {
  flex: 1;
  overflow: hidden;
  padding: 8px;
  position: relative;
  min-height: 200px;
  height: 100%;
  box-sizing: border-box;
}

/* 图片列表滚动条样式 */
.thumbnail-list :deep(.vue-recycle-scroller)::-webkit-scrollbar {
  width: 10px;
}

.thumbnail-list :deep(.vue-recycle-scroller)::-webkit-scrollbar-track {
  background: #f0f0f0;
}

.thumbnail-list :deep(.vue-recycle-scroller)::-webkit-scrollbar-thumb {
  background: #c0c0c0;
  border-radius: 5px;
}

.thumbnail-list :deep(.vue-recycle-scroller)::-webkit-scrollbar-thumb:hover {
  background: #a0a0a0;
}

/* 深色模式下的滚动条样式 */
body[data-theme="dark"] .workbench .thumbnail-list :deep(.vue-recycle-scroller)::-webkit-scrollbar-track {
  background: #252526 !important;
}

body[data-theme="dark"] .workbench .thumbnail-list :deep(.vue-recycle-scroller)::-webkit-scrollbar-thumb {
  background: #424242 !important;
}

body[data-theme="dark"] .workbench .thumbnail-list :deep(.vue-recycle-scroller)::-webkit-scrollbar-thumb:hover {
  background: #4e4e4e !important;
}

/* RecycleScroller 内部布局 */
.thumbnail-list :deep(.vue-recycle-scroller__item-wrapper) {
  box-sizing: border-box;
  overflow: visible; /* 允许选中状态的阴影和缩放超出 */
}

/* RecycleScroller 的slot容器 */
.thumbnail-list :deep(.vue-recycle-scroller__slot) {
  padding: 0;
}

/* RecycleScroller的item容器 */
.thumbnail-list :deep(.vue-recycle-scroller__item-view) {
  margin-bottom: 8px;
  overflow: visible; /* 允许选中状态的阴影和缩放超出 */
}

/* 图片行容器 - 使用flex横向排列 */
.thumbnail-row {
  display: grid;
  gap: 8px;
  width: 100%;
  overflow: visible; /* 允许选中状态的阴影和缩放超出 */
}

/* 缩略图列表渐变动画 */
.thumbnail-fade-enter-active {
  transition: opacity 0.15s ease;
}

.thumbnail-fade-leave-active {
  transition: opacity 0.1s ease;
}

.thumbnail-fade-enter-from {
  opacity: 0;
}

.thumbnail-fade-leave-to {
  opacity: 0;
}

.thumbnail-fade-enter-to {
  opacity: 1;
}

/* 通用渐变动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.thumbnail-item {
  padding: 0;
  border: 3px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--color-bg-secondary, #fafafa);
  will-change: transform;
  position: relative;
  box-sizing: border-box;
}

body[data-theme="dark"] .thumbnail-item {
  background: #2d2d2d;
}

/* 未选中状态：只对图片应用效果 */
.thumbnail-item .thumbnail-img {
  opacity: 0.65;
  filter: grayscale(0.3) brightness(0.85);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.thumbnail-item:hover {
  background: var(--color-bg-tertiary, #f0f0f0);
  border-color: var(--color-border, #d0d0d0);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

body[data-theme="dark"] .thumbnail-item:hover {
  background: #333333;
  border-color: #4a4a4a;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

/* hover时图片稍微提亮 */
.thumbnail-item:hover .thumbnail-img {
  opacity: 0.85;
  filter: grayscale(0.15) brightness(0.92);
}

.thumbnail-item.active {
  border: 3px solid transparent;
  background: var(--color-bg-primary, #ffffff);
  transform: scale(1.05);
  z-index: 2;
  position: relative;
}

body[data-theme="dark"] .thumbnail-item.active {
  background: #252526;
}

/* 选中状态：图片恢复正常 */
.thumbnail-item.active .thumbnail-img {
  opacity: 1 !important;
  filter: grayscale(0) brightness(1) !important;
}

/* 蓝色呼吸光晕效果 */
.thumbnail-item.active::before {
  content: '';
  position: absolute;
  top: -12px;
  left: -12px;
  right: -12px;
  bottom: -12px;
  border-radius: 10px;
  background: #2563EB; /* 更深的蓝色 */
  z-index: -1;
  filter: blur(15px);
  animation: breathe-glow 2s ease-in-out infinite;
}

/* 光晕呼吸动画 */
@keyframes breathe-glow {
  0%, 100% {
    opacity: 0.5;
    transform: scale(0.95);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.05);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.4;
  }
}

.thumbnail-img-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: 4px;
  overflow: hidden;
  background: var(--color-bg-tertiary, #e0e0e0);
  transition: none;
}

body[data-theme="dark"] .thumbnail-img-wrapper {
  background: #3c3c3c;
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: none;
  display: block;
}

/* 状态标签 */
.status-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
  color: white;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.status-badge.status-annotated {
  background: rgba(103, 194, 58, 0.95);
}

.status-badge.status-unannotated {
  background: rgba(230, 162, 60, 0.95);
}

.status-badge.status-negative {
  background: rgba(245, 108, 108, 0.95);
}

/* 缩略图大小控制 */
.thumbnail-size-control {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border, #e0e0e0);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-bg-secondary, #fafafa);
}

body[data-theme="dark"] .thumbnail-size-control {
  background: #2d2d2d;
  border-top-color: #3c3c3c;
}

.thumbnail-size-control .size-label {
  font-size: 12px;
  color: var(--color-text-secondary, #666666);
  white-space: nowrap;
}

body[data-theme="dark"] .thumbnail-size-control .size-label {
  color: #9d9d9d;
}

.thumbnail-size-control .el-slider {
  flex: 1;
}

.thumbnail-size-control .size-value {
  font-size: 12px;
  color: var(--color-text-primary, #333333);
  font-weight: 600;
  min-width: 45px;
  text-align: right;
}

body[data-theme="dark"] .thumbnail-size-control .size-value {
  color: #cccccc;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;
}

/* 中间标注画布 */
.annotation-canvas {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary, #f5f5f5);
  margin-right: 280px; /* 为右侧类别栏留出空间 */
}

body[data-theme="dark"] .annotation-canvas {
  background: #1e1e1e;
}

.canvas-header {
  flex-shrink: 0;
  padding: 12px 16px;
  background: var(--color-bg-primary, #ffffff);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 2; /* 确保在canvas-wrapper上方 */
}

body[data-theme="dark"] .canvas-header {
  background: #252526;
  border-bottom-color: #3c3c3c;
}

.image-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-image-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #333333);
}

body[data-theme="dark"] .current-image-name {
  color: #cccccc;
}

.image-counter {
  font-size: 12px;
  color: var(--color-text-secondary, #999999);
  padding: 2px 8px;
  background: var(--color-bg-tertiary, #f0f0f0);
  border-radius: 4px;
}

body[data-theme="dark"] .image-counter {
  color: #9d9d9d;
  background: #3c3c3c;
}

.canvas-controls {
  display: flex;
  gap: 8px;
}

/* Canvas Container Wrapper - 占据剩余空间 */
.canvas-container-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--color-bg-secondary, #f5f5f5);
}

body[data-theme="dark"] .canvas-container-wrapper {
  background: #1e1e1e;
}

/* Canvas Container - 固定视口，不随canvas缩放变化 */
.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden; /* 裁剪超出的部分 */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary, #f5f5f5);
  outline: none;
  z-index: 1;
}

body[data-theme="dark"] .canvas-container {
  background: #1e1e1e;
}

/* Canvas Wrapper - 通过position移动，不用CSS transform缩放 */
.canvas-wrapper {
  position: absolute;
  /* 位置由panX, panY动态设置 */
  will-change: transform;
}

.annotation-canvas-element {
  display: block;
  image-rendering: auto;
  image-rendering: -webkit-optimize-contrast;
  /* 确保canvas以原始分辨率渲染 */
  -ms-interpolation-mode: nearest-neighbor;
}

.empty-canvas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 1;
}

.canvas-toolbar {
  flex-shrink: 0;
  padding: 12px 16px;
  background: var(--color-bg-primary, #ffffff);
  border-top: 1px solid var(--color-border, #e0e0e0);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 2; /* 确保在canvas-wrapper上方 */
}

body[data-theme="dark"] .canvas-toolbar {
  background: #252526;
  border-top-color: #3c3c3c;
}

.toolbar-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toolbar-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #333333);
}

body[data-theme="dark"] .toolbar-label {
  color: #cccccc;
}

.toolbar-hint {
  font-size: 12px;
  color: var(--color-text-secondary, #999999);
}

body[data-theme="dark"] .toolbar-hint {
  color: #9d9d9d;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-level {
  font-size: 12px;
  color: var(--color-text-secondary, #666666);
  min-width: 50px;
  text-align: center;
}

body[data-theme="dark"] .zoom-level {
  color: #9d9d9d;
}

/* 右侧类别工具面板 */
.class-tool-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 280px;
  background: var(--color-bg-primary, #ffffff);
  border-left: 1px solid var(--color-border, #e0e0e0);
  display: flex;
  flex-direction: column;
  z-index: 10; /* 确保在上层 */
}

body[data-theme="dark"] .class-tool-panel {
  background: #252526;
  border-left-color: #3c3c3c;
}

.class-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.class-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  background: var(--color-bg-secondary, #fafafa);
}

body[data-theme="dark"] .class-item {
  background: #2d2d2d;
}

.class-item:hover {
  background: var(--color-bg-tertiary, #f0f0f0);
}

body[data-theme="dark"] .class-item:hover {
  background: #333333;
}

.class-item.active {
  background: var(--color-text-primary, #000000);
  color: var(--color-bg-primary, #ffffff);
}

body[data-theme="dark"] .class-item.active {
  background: #007acc;
  color: #ffffff;
}

.class-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.class-color:hover {
  transform: scale(1.2);
  border-color: rgba(0, 0, 0, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.custom-color-trigger {
  width: 16px !important;
  height: 16px !important;
  border-radius: 3px !important;
  cursor: pointer !important;
  border: none !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
  transition: all 0.2s ease !important;
  display: inline-block !important;
  flex-shrink: 0 !important;
}

.custom-color-trigger:hover {
  transform: scale(1.1) !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
}

.class-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
}

.class-count {
  font-size: 12px;
  color: var(--color-text-secondary, #999999);
  padding: 2px 6px;
  background: var(--color-bg-tertiary, #e0e0e0);
  border-radius: 3px;
}

body[data-theme="dark"] .class-count {
  color: #9d9d9d;
  background: #3c3c3c;
}

.class-item.active .class-count {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

/* 拖拽样式 */
.class-item.dragging {
  opacity: 0.5;
  cursor: move;
}

/* 输入框样式 */
.class-item-input {
  background: var(--color-bg-tertiary, #f0f0f0);
  padding: 8px 12px;
}

body[data-theme="dark"] .class-item-input {
  background: #333333;
}

.class-item-input:hover {
  background: var(--color-bg-tertiary, #f0f0f0);
  cursor: default;
}

body[data-theme="dark"] .class-item-input:hover {
  background: #333333;
}

.class-item-input .el-input {
  flex: 1;
}

/* 右键菜单样式 */
.class-context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--color-shadow, rgba(0, 0, 0, 0.15));
  padding: 4px;
  min-width: 120px;
}

body[data-theme="dark"] .class-context-menu {
  background: #252526;
  border-color: #3c3c3c;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.2s;
  color: var(--color-text-primary, #333333);
}

body[data-theme="dark"] .context-menu-item {
  color: #cccccc;
}

.context-menu-item:hover {
  background: var(--color-bg-tertiary, #f0f0f0);
  color: var(--color-danger, #f56c6c);
}

body[data-theme="dark"] .context-menu-item:hover {
  background: #3c3c3c;
  color: #f44747;
}

/* 标注框右键菜单样式 */
.annotation-context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--color-shadow, rgba(0, 0, 0, 0.15));
  padding: 4px;
  min-width: 120px;
}

body[data-theme="dark"] .annotation-context-menu {
  background: #252526;
  border-color: #3c3c3c;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

/* 图片右键菜单样式 */
.image-context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--color-shadow, rgba(0, 0, 0, 0.15));
  padding: 4px;
  min-width: 120px;
}

body[data-theme="dark"] .image-context-menu {
  background: #252526;
  border-color: #3c3c3c;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.image-context-menu .context-menu-item.danger:hover {
  background: #fee;
  color: #f44747;
}

body[data-theme="dark"] .image-context-menu .context-menu-item.danger:hover {
  background: #3c2020;
  color: #f44747;
}

.context-menu-item .el-icon {
  font-size: 14px;
}

.empty-class {
  padding: 40px 20px;
  text-align: center;
}

/* 悬浮工具栏卡片 - VSCode 风格 */
.floating-toolbar-card {
  position: fixed;
  width: 320px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  overflow: hidden;
}

.toolbar-card-header {
  height: 36px;
  padding: 0 12px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
  border-bottom: 1px solid var(--color-border);
}

.toolbar-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 400;
}

.toolbar-card-title .el-icon {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.toolbar-card-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  cursor: pointer;
  transition: background-color 0.15s;
  color: var(--color-text-secondary);
}

.toolbar-card-close:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.toolbar-card-close:active {
  background: var(--color-border);
}

.toolbar-card-content {
  padding: 0;
  max-height: 500px;
  overflow-y: auto;
}

/* 设置项样式 */
.setting-item {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.15s;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:hover {
  background: var(--color-bg-secondary);
}

.setting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.setting-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.4;
}

.setting-description {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

/* 模型选择区域 */
.model-select-area {
  margin-top: 12px;
  padding: 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.model-select-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.no-models {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.model-option {
  padding: 10px 12px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.model-option:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-info);
}

.model-option.selected {
  background: var(--color-info);
  color: white;
  border-color: var(--color-info);
}

.model-option.selected .model-name,
.model-option.selected .model-meta {
  color: white;
}

.model-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.model-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.model-version {
  padding: 2px 6px;
  background: var(--color-bg-secondary);
  border-radius: 2px;
  font-family: 'Courier New', monospace;
}

.model-option.selected .model-version {
  background: rgba(255, 255, 255, 0.2);
}

.model-time {
  font-size: 11px;
}

.model-conf-threshold {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 12px;
}

.conf-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  min-width: 70px;
}

.conf-value {
  font-size: 12px;
  color: var(--color-text-primary);
  font-weight: 500;
  min-width: 40px;
  text-align: right;
}

.model-conf-threshold :deep(.el-slider) {
  flex: 1;
}

/* 滚动条样式 */
.model-list::-webkit-scrollbar {
  width: 6px;
}

.model-list::-webkit-scrollbar-track {
  background: var(--color-bg-secondary);
  border-radius: 3px;
}

.model-list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.model-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-info);
}

.tool-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-group .el-button {
  justify-content: flex-start;
  width: 100%;
  height: 36px;
  font-size: 13px;
}

.tool-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  font-size: 13px;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.tool-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 8px 0 0 0;
  line-height: 1.5;
}

.zoom-display {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

/* 工具栏内的 Switch 开关样式优化 */
.setting-item :deep(.el-switch) {
  --el-switch-on-color: var(--color-info);
  --el-switch-off-color: var(--color-bg-tertiary);
}

/* 工具栏卡片滚动条样式 */
.toolbar-card-content::-webkit-scrollbar {
  width: 6px;
}

.toolbar-card-content::-webkit-scrollbar-track {
  background: #f0f0f0;
  border-radius: 3px;
}

.toolbar-card-content::-webkit-scrollbar-thumb {
  background: #c0c0c0;
  border-radius: 3px;
}

.toolbar-card-content::-webkit-scrollbar-thumb:hover {
  background: #a0a0a0;
}

body[data-theme="dark"] .toolbar-card-content::-webkit-scrollbar-track {
  background: #252526 !important;
}

body[data-theme="dark"] .toolbar-card-content::-webkit-scrollbar-thumb {
  background: #424242 !important;
}

body[data-theme="dark"] .toolbar-card-content::-webkit-scrollbar-thumb:hover {
  background: #4e4e4e !important;
}

/* 快捷键设置对话框内容样式 */
.shortcuts-content {
  outline: none;
}

.shortcuts-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 4px;
  color: #1565c0;
  font-size: 13px;
  margin-bottom: 16px;
}

body[data-theme="dark"] .shortcuts-tip {
  background: rgba(0, 122, 204, 0.15);
  border-color: rgba(0, 122, 204, 0.3);
  color: #4fc3f7;
}

.shortcuts-tip .el-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.shortcuts-warning {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  margin-bottom: 20px;
}

body[data-theme="dark"] .shortcuts-warning {
  background: rgba(255, 193, 7, 0.15);
  border-color: rgba(255, 193, 7, 0.3);
}

.shortcuts-warning .el-icon {
  font-size: 18px;
  color: #f57c00;
  flex-shrink: 0;
  margin-top: 2px;
}

body[data-theme="dark"] .shortcuts-warning .el-icon {
  color: #ffb74d;
}

.warning-content {
  flex: 1;
}

.warning-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 6px;
  line-height: 1.4;
}

.warning-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  transition: all 0.2s;
}

.shortcut-item:hover {
  background: var(--color-bg-tertiary);
}

.shortcut-label {
  flex: 0 0 140px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.shortcut-value-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.shortcut-value {
  display: flex;
  justify-content: center;
  width: 100%;
}

.shortcut-value .el-tag {
  min-width: 140px;
  max-width: 200px;
  text-align: center;
  font-family: 'Consolas', 'Monaco', monospace;
  font-weight: 600;
}

.conflict-hint {
  font-size: 12px;
  color: var(--color-danger);
  text-align: center;
  white-space: nowrap;
}

.shortcut-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* 保存/加载状态遮罩层 - VSCode 风格 */
.saving-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-overlay);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.saving-box {
  position: relative;
  width: 500px;
  min-height: 200px;
  background: var(--color-bg-primary);
  padding: 50px 40px 80px 40px;
  box-sizing: border-box;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg), 0 0 30px rgba(0, 122, 204, 0.2);
  animation: saving-box-glow 2s ease-in-out infinite;
}

@keyframes saving-box-glow {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15),
                0 0 20px rgba(0, 122, 204, 0.2);
  }
  50% {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2),
                0 0 40px rgba(0, 122, 204, 0.4);
  }
}

body[data-theme="dark"] .saving-box {
  box-shadow: var(--shadow-lg), 0 0 30px rgba(0, 122, 204, 0.3);
}

.saving-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.saving-header .el-icon {
  color: var(--color-info);
  flex-shrink: 0;
}

.saving-text-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.saving-text {
  margin: 0;
  font-size: 16px;
  color: var(--color-text-primary);
  font-weight: 500;
  line-height: 1.4;
}

.saving-tip {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.force-close-btn {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: var(--color-info) !important;
  border-color: var(--color-info) !important;
  color: #ffffff !important;
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 400;
}

.force-close-btn:hover {
  background: #0098ff !important;
  border-color: #0098ff !important;
}

.force-close-btn:active {
  background: #005a9e !important;
  border-color: #005a9e !important;
}

/* 渐变动画 */
.saving-fade-enter-active,
.saving-fade-leave-active {
  transition: opacity 0.2s ease;
}

.saving-fade-enter-from,
.saving-fade-leave-to {
  opacity: 0;
}

/* 深色模式下的默认按钮样式 (VSCode 风格 - 灰色) */
body[data-theme="dark"] .workbench :deep(.el-button:not(.el-button--primary):not(.el-button--warning):not(.el-button--danger):not(.el-button--success)) {
  background-color: #3c3c3c;
  border-color: #3c3c3c;
  color: #cccccc;
}

body[data-theme="dark"] .workbench :deep(.el-button:not(.el-button--primary):not(.el-button--warning):not(.el-button--danger):not(.el-button--success):hover) {
  background-color: #505050;
  border-color: #505050;
  color: #ffffff;
}

body[data-theme="dark"] .workbench :deep(.el-button:not(.el-button--primary):not(.el-button--warning):not(.el-button--danger):not(.el-button--success):active) {
  background-color: #2d2d2d;
  border-color: #2d2d2d;
}

body[data-theme="dark"] .workbench :deep(.el-button:not(.el-button--primary):not(.el-button--warning):not(.el-button--danger):not(.el-button--success):disabled) {
  background-color: #2d2d2d;
  border-color: #2d2d2d;
  color: #6d6d6d;
  opacity: 0.5;
}

/* 深色模式下的占位图样式优化 */
body[data-theme="dark"] .empty-state :deep(.el-empty__description),
body[data-theme="dark"] .empty-canvas-overlay :deep(.el-empty__description),
body[data-theme="dark"] .empty-class :deep(.el-empty__description) {
  color: #9d9d9d !important;
}
</style>

