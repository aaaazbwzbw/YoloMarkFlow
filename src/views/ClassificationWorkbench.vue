<template>
  <div class="classification-workbench">
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
          </el-radio-group>
        </div>

        <!-- 缩略图列表 - 虚拟滚动 -->
        <div v-if="filteredImages.length === 0" class="empty-state">
          <el-empty description="暂无图片" />
        </div>
        <div 
          v-else
          ref="thumbnailListContainer"
          class="thumbnail-list-container">
          <RecycleScroller
            ref="thumbnailList"
            :key="`scroller-${filterStatus}`"
            class="thumbnail-list"
            :class="{ 'grid-expanded': imageListExpanded }"
            :items="gridRows"
            :item-size="estimatedItemHeight"
            :buffer="200"
            key-field="rowIndex">
            <template #default="{ item: row }">
              <div class="thumbnail-row" :style="{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }">
                <div 
                  v-for="image in row.images"
                  :key="image.index"
                  class="thumbnail-item"
                  :class="{ active: currentImageIndex === image.index }"
                  :data-image-index="image.index"
                  @click="selectImage(image.index)">
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
        </div>

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

    <!-- 中间栏：图片显示区 -->
    <main class="image-display-area">
      <div class="image-header">
        <div class="image-info">
          <span class="current-image-name">{{ currentImage?.name || '未选择图片' }}</span>
          <span class="image-counter">{{ currentImageIndex + 1 }} / {{ images.length }}</span>
        </div>
        <div class="image-controls">
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
            @click="handleSaveClassification">
            <el-icon><DocumentChecked /></el-icon>
            保存标注
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

      <!-- 图片显示容器 -->
      <div class="image-container-wrapper" ref="imageContainerWrapper">
        <div class="image-container" ref="imageContainer">
          <img 
            v-if="currentImage"
            :src="currentImage.src" 
            :alt="currentImage.name"
            class="display-image"
            :style="imageStyle"
            @load="handleImageLoad" />
          <div v-else class="empty-image-overlay">
            <el-empty description="请选择图片开始分类标注" />
          </div>
        </div>
      </div>
    </main>

    <!-- 右侧栏：类别标签 -->
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
        <!-- 添加类别输入框 -->
        <div v-if="isAddingClass" class="class-item class-item-input">
          <el-input 
            v-model="newClassName" 
            class="class-name-input"
            size="small" 
            placeholder="输入类别名称"
            @keyup.enter="confirmAddClass"
            @blur="cancelAddClass" />
        </div>
        
        <div 
          v-for="(cls, index) in classList" 
          :key="index"
          class="class-item"
          :class="{ active: selectedClasses.has(index) }"
          @click="selectClass(index)"
          @contextmenu.prevent="showClassContextMenu($event, index)">
          <span class="class-name">{{ cls.name }}</span>
          <div class="class-actions">
            <el-button 
              size="small" 
              type="text" 
              @click.stop="editClass(index)"
              :icon="Edit">
            </el-button>
            <el-button 
              size="small" 
              type="text" 
              @click.stop="deleteClassByIndex(index)"
              :icon="Delete">
            </el-button>
          </div>
        </div>
        <div v-if="classList.length === 0 && !isAddingClass" class="empty-class">
          <el-empty description="暂无类别，请添加类别标签" />
        </div>
      </div>
      
      <!-- 右键菜单 -->
      <div 
        v-if="contextMenuVisible"
        class="context-menu"
        :style="contextMenuStyle">
        <div class="context-menu-item" @click="deleteClass">
          <el-icon><Delete /></el-icon>
          <span>删除类别</span>
        </div>
      </div>
    </aside>
    
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
            {{ savingModalType === 'importing' || savingModalType === 'loading' ? '取消' : '强制关闭' }}
          </el-button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Check, FolderOpened, DocumentChecked, ArrowLeft, ArrowRight, Plus, Edit, Delete, Loading, InfoFilled, WarningFilled } from '@element-plus/icons-vue'
import { RecycleScroller } from 'vue3-virtual-scroller'
import 'vue3-virtual-scroller/dist/vue3-virtual-scroller.css'
import { ElMessageBox } from 'element-plus'
import toast from '../utils/toast'
import { getCurrentProject } from '../utils/projectManager'
import { dbManager } from '../utils/database'
import { importImages, getImagePath } from '../utils/imagePool'
import Modal from '../components/Modal.vue'

export default {
  name: 'ClassificationWorkbench',
  components: {
    RecycleScroller,
    Modal,
    Check,
    FolderOpened,
    DocumentChecked,
    ArrowLeft,
    ArrowRight,
    Plus,
    Edit,
    Delete
  },
  setup() {
    // 项目信息
    const project = ref(null)
    
    // 图片数据
    const images = ref([])
    const currentImageIndex = ref(-1)
    const filterStatus = ref('all')
    const imageListExpanded = ref(false)
    const thumbnailScale = ref(100)
    
    // 类别数据
    const classList = ref([])
    const selectedClasses = ref(new Set()) // 多选：使用 Set 存储选中的类别索引
    
    // 图片显示相关
    const imageContainerWrapper = ref(null)
    const imageContainer = ref(null)
    const imageStyle = ref({})
    
    // 导入相关
    const savingModalVisible = ref(false)
    const savingModalType = ref('loading') // 'loading' | 'importing'
    const cancelRequested = ref(false)
    
    // 快捷键相关
    const shortcutsDialogVisible = ref(false)
    const shortcuts = ref({
      saveAnnotation: 'Enter',
      nextImage: 'ArrowRight',
      prevImage: 'ArrowLeft',
      jumpToNextUnannotated: 'Ctrl+ArrowRight',
      jumpToPrevUnannotated: 'Ctrl+ArrowLeft'
    })
    const editingShortcut = ref(null)
    const isCapturingKey = ref(false)
    const tempShortcut = ref('')
    const conflictKey = ref(null)
    
    // 初始化应用
    const initializeApp = async (showSuccessMessage = true) => {
      try {
        // 获取当前项目
        project.value = getCurrentProject()
        
        if (!project.value) {
          toast.error('未找到当前项目')
          return
        }
        
        // 检查项目类型
        if (project.value.type !== 'classification') {
          toast.error('当前项目不是分类项目')
          return
        }
        
        // 初始化数据库（分类项目使用不同的数据库文件名）
        await initDatabase()
        
        // 加载类别列表
        await loadClassList()
        
        // 加载项目图片
        await loadProjectImages()
        
        // 恢复工作状态
        await restoreWorkspaceState()
        
        // 只在需要时显示成功提示（首次加载时显示，切换时不显示）
        // 同时检查是否是切换项目触发的（如果是切换，即使 showSuccessMessage 为 true 也不显示）
        if (showSuccessMessage && !isSwitchingProject.value) {
          toast.success('项目加载成功')
        }
        
        // 重置切换标志
        isSwitchingProject.value = false
      } catch (error) {
        console.error('初始化应用失败:', error)
        toast.error('加载项目失败: ' + error.message)
        // 重置切换标志（即使失败也要重置）
        isSwitchingProject.value = false
      }
    }
    
    // 初始化数据库
    const initDatabase = async () => {
      // 分类项目使用 classification.db 作为数据库文件名
      const dbPath = `${project.value.path}/classification.db`
      await dbManager.init(dbPath)
    }
    
    // 加载类别列表
    const loadClassList = async () => {
      const classes = await dbManager.getCategories()
      classList.value = classes.map((cls, index) => ({
        id: cls.id,
        name: cls.name,
        color: '' // 分类工作台不需要颜色
      }))
    }
    
    // 加载项目图片
    const loadProjectImages = async () => {
      const projectImages = await dbManager.getProjectImages()
      
      const imagesPromises = projectImages.map(async (img, index) => {
        try {
          // 从图片池获取实际路径（使用 image_id 而不是 filename）
          const imagePath = await getImagePath(img.image_id)
          
          // 加载该图片的分类标注
          let hasAnnotation = false
          let className = null
          try {
            const annotations = await dbManager.getImageAnnotations(img.image_id)
            if (annotations && annotations.length > 0) {
              hasAnnotation = true
              // 获取类别名称
              const annotation = annotations[0]
              const classItem = classList.value.find(cls => cls.id === annotation.class_id)
              if (classItem) {
                className = classItem.name
              }
            }
          } catch (error) {
            console.warn(`加载图片 ${img.image_id} 的标注失败:`, error)
          }
          
          return {
            imageId: img.image_id,  // image_pool.db 的图片ID
            name: img.original_name || img.filename,  // 原始文件名
            src: `file://${imagePath}`,
            hasAnnotation: hasAnnotation,
            className: className  // 类别名称（如果已标注）
          }
        } catch (error) {
          console.error(`加载图片失败 (image_id: ${img.image_id}):`, error)
          return null
        }
      })
      
      const imagesArray = await Promise.all(imagesPromises)
      images.value = imagesArray.filter(Boolean) // 过滤掉加载失败的图片
      
      // 重新设置索引（因为过滤后索引会变化）
      images.value.forEach((img, index) => {
        img.index = index
      })
      
      console.log(`已加载 ${images.value.length} 张图片`)
    }
    
    // 恢复工作状态
    const restoreWorkspaceState = async () => {
      if (!project.value) return
      
      const state = await window.electronAPI.loadProjectWorkspaceState(project.value.path)
      
      if (state && state.currentImageIndex >= 0 && state.currentImageIndex < images.value.length) {
        await selectImage(state.currentImageIndex)
      } else if (images.value.length > 0) {
        await selectImage(0)
      }
    }
    
    // 选择图片
    const selectImage = async (index) => {
      if (index < 0 || index >= images.value.length) return
      
      currentImageIndex.value = index
      
      // 加载该图片的分类标注
      await loadImageClassification(index)
      
      await nextTick()
      updateImageDisplay()
    }
    
    // 加载图片的分类标注（支持多选）
    const loadImageClassification = async (index) => {
      if (index < 0 || index >= images.value.length) return
      
      const image = images.value[index]
      if (!image || !image.imageId) return
      
      try {
        // 清空当前选中的类别
        selectedClasses.value.clear()
        
        // 从数据库获取该图片的标注
        const annotations = await dbManager.getImageAnnotations(image.imageId)
        
        if (annotations && annotations.length > 0) {
          // 分类标注支持多个，遍历所有标注
          const selectedClassIndices = new Set()
          const classNames = []
          
          for (const annotation of annotations) {
            // 找到对应的类别索引
            const classIndex = classList.value.findIndex(cls => cls.id === annotation.class_id)
            
            if (classIndex >= 0) {
              selectedClassIndices.add(classIndex)
              classNames.push(classList.value[classIndex].name)
            }
          }
          
          // 更新选中的类别集合
          selectedClasses.value = selectedClassIndices
          
          // 更新图片的标注状态和类别名称
          image.hasAnnotation = selectedClassIndices.size > 0
          image.className = classNames.length > 0 ? classNames.join(', ') : null
        } else {
          // 没有标注
          selectedClasses.value.clear()
          image.hasAnnotation = false
          image.className = null
        }
      } catch (error) {
        console.error('加载分类标注失败:', error)
        selectedClasses.value.clear()
        image.hasAnnotation = false
        image.className = null
      }
    }
    
    // 更新图片显示（自适应窗口大小）
    const updateImageDisplay = () => {
      if (!imageContainerWrapper.value || !currentImage.value) return
      
      const containerWidth = imageContainerWrapper.value.clientWidth
      const containerHeight = imageContainerWrapper.value.clientHeight
      
      const img = new Image()
      img.onload = () => {
        const imgWidth = img.width
        const imgHeight = img.height
        
        // 计算缩放比例（保持宽高比）
        const scaleX = containerWidth / imgWidth
        const scaleY = containerHeight / imgHeight
        const scale = Math.min(scaleX, scaleY, 1) // 不放大，只缩小
        
        const displayWidth = imgWidth * scale
        const displayHeight = imgHeight * scale
        
        imageStyle.value = {
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain'
        }
      }
      img.src = currentImage.value.src
    }
    
    // 图片加载完成
    const handleImageLoad = () => {
      updateImageDisplay()
    }
    
    // 窗口大小变化时更新图片显示
    const handleResize = () => {
      updateImageDisplay()
    }
    
    // 上一张图片
    const prevImage = async () => {
      if (currentImageIndex.value > 0) {
        await selectImage(currentImageIndex.value - 1)
      }
    }
    
    // 下一张图片
    const nextImage = async () => {
      if (currentImageIndex.value < images.value.length - 1) {
        await selectImage(currentImageIndex.value + 1)
      }
    }
    
    // 跳转到下一张未标注图片
    const jumpToNextUnannotated = () => {
      const startIndex = currentImageIndex.value + 1
      for (let i = startIndex; i < images.value.length; i++) {
        if (getImageStatus(i) === 'unannotated') {
          selectImage(i)
          toast.success(`跳转到第 ${i + 1} 张未标注图片`)
          return
        }
      }
      toast.info('后面没有未标注的图片了')
    }
    
    // 跳转到上一张未标注图片
    const jumpToPrevUnannotated = () => {
      const startIndex = currentImageIndex.value - 1
      for (let i = startIndex; i >= 0; i--) {
        if (getImageStatus(i) === 'unannotated') {
          selectImage(i)
          toast.success(`跳转到第 ${i + 1} 张未标注图片`)
          return
        }
      }
      toast.info('前面没有未标注的图片了')
    }
    
    // 保存分类标注（支持多选，取消选中的类别会被移除）
    const handleSaveClassification = async () => {
      if (currentImageIndex.value < 0) {
        toast.warning('请选择图片')
        return
      }
      
      try {
        const image = images.value[currentImageIndex.value]
        
        if (!image || !image.imageId) {
          toast.error('图片信息不完整')
          return
        }
        
        // 将选中的类别索引转换为类别ID数组
        const selectedClassIds = Array.from(selectedClasses.value)
          .map(index => classList.value[index])
          .filter(cls => cls) // 过滤掉无效的类别
          .map(cls => cls.id)
        
        // 分类标注：每张图片可以有多个类别标签，不需要位置信息（position 为 null）
        // 如果 selectedClassIds 为空数组，则清除所有标注
        const annotations = selectedClassIds.map(classId => ({
          classId: classId,
          position: null  // 分类标注不需要位置信息
        }))
        
        // 保存分类标注到数据库（先删除旧的，再插入新的）
        // 如果 annotations 为空数组，则只会删除旧的标注，不会插入新的，从而实现清除所有标注
        await dbManager.saveImageAnnotations(image.imageId, annotations)
        
        // 更新图片的标注状态和类别名称
        const selectedClassNames = Array.from(selectedClasses.value)
          .map(index => classList.value[index])
          .filter(cls => cls)
          .map(cls => cls.name)
        
        image.hasAnnotation = selectedClassNames.length > 0
        image.className = selectedClassNames.length > 0 
          ? selectedClassNames.join(', ') 
          : null
        
        if (selectedClassNames.length === 0) {
          toast.success('已清除所有类别标注')
        } else {
          toast.success(`分类标注已保存：${selectedClassNames.join(', ')}`)
        }
      } catch (error) {
        console.error('保存分类标注失败:', error)
        toast.error('保存失败: ' + error.message)
      }
    }
    
    // 添加类别相关状态
    const isAddingClass = ref(false)
    const newClassName = ref('')
    
    // 右键菜单相关状态
    const contextMenuVisible = ref(false)
    const contextMenuStyle = ref({})
    const contextMenuTargetIndex = ref(-1)
    
    // 添加类别
    const handleAddClass = () => {
      isAddingClass.value = true
      newClassName.value = ''
      nextTick(() => {
        const input = document.querySelector('.class-name-input input')
        if (input) {
          input.focus()
        }
      })
    }
    
    // 确认添加类别
    const confirmAddClass = async () => {
      if (!newClassName.value.trim()) {
        cancelAddClass()
        return
      }
      
      // 检查类别名称是否已存在
      if (classList.value.some(cls => cls.name === newClassName.value.trim())) {
        toast.warning('类别名称已存在')
        return
      }
      
      try {
        // 添加到数据库（分类工作台不需要颜色，设置为空字符串）
        const categoryId = await dbManager.addCategory(
          newClassName.value.trim(),
          '' // 分类工作台不需要颜色
        )
        
        const newClass = {
          id: categoryId,
          name: newClassName.value.trim(),
          color: '', // 分类工作台不需要颜色
          count: 0
        }
        
        classList.value.push(newClass)
        isAddingClass.value = false
        newClassName.value = ''
        
        toast.success('类别添加成功')
      } catch (error) {
        console.error('添加类别失败:', error)
        toast.error('添加类别失败: ' + error.message)
      }
    }
    
    // 取消添加类别
    const cancelAddClass = () => {
      isAddingClass.value = false
      newClassName.value = ''
    }
    
    // 选择类别（支持多选，点击已选中的类别可以取消选中）
    const selectClass = (index) => {
      if (selectedClasses.value.has(index)) {
        // 如果已选中，则取消选中
        selectedClasses.value.delete(index)
      } else {
        // 如果未选中，则添加到选中集合
        selectedClasses.value.add(index)
      }
    }
    
    // 编辑类别
    const editClass = (index) => {
      // TODO: 实现编辑类别逻辑
      toast.info('编辑类别功能开发中')
    }
    
    // 显示类别右键菜单
    const showClassContextMenu = (event, index) => {
      contextMenuTargetIndex.value = index
      contextMenuVisible.value = true
      contextMenuStyle.value = {
        position: 'fixed',
        left: event.clientX + 'px',
        top: event.clientY + 'px'
      }
      
      // 点击其他地方关闭菜单
      const closeMenu = () => {
        contextMenuVisible.value = false
        document.removeEventListener('click', closeMenu)
      }
      
      nextTick(() => {
        document.addEventListener('click', closeMenu)
      })
    }
    
    // 删除类别（通过索引）
    const deleteClassByIndex = async (index) => {
      if (index < 0 || index >= classList.value.length) {
        return
      }
      
      const category = classList.value[index]
      const className = category.name
      
      try {
        await ElMessageBox.confirm(
          `确定要删除类别"${className}"吗？删除后该类别的所有标注也将被删除。`,
          '删除确认',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        // 从数据库删除类别
        await dbManager.deleteCategory(category.id)
        
        // 删除类别
        classList.value.splice(index, 1)
        
        // 更新selectedClasses（索引相关）
        // 删除类别后，需要调整后续类别的索引
        const newSelectedClasses = new Set()
        for (const selectedIndex of selectedClasses.value) {
          if (selectedIndex === index) {
            // 删除的是当前选中的类别，不保留
            continue
          } else if (selectedIndex > index) {
            // 索引大于被删除的类别，索引减1
            newSelectedClasses.add(selectedIndex - 1)
          } else {
            // 索引小于被删除的类别，保持不变
            newSelectedClasses.add(selectedIndex)
          }
        }
        selectedClasses.value = newSelectedClasses
        
        // 删除该类别的所有标注（从内存中）
        // 注意：分类工作台的标注存储在数据库中，删除类别时会自动删除相关标注
        // 更新所有引用该类别的图片状态（需要重新加载所有图片的标注，因为可能包含多个类别）
        // 由于删除类别会影响所有图片的标注，这里需要重新加载当前图片的标注（如果有）
        if (currentImageIndex.value >= 0 && currentImageIndex.value < images.value.length) {
          const currentImage = images.value[currentImageIndex.value]
          if (currentImage && currentImage.imageId) {
            // 重新加载当前图片的标注（会清除已删除类别的引用）
            loadImageClassification(currentImageIndex.value)
          }
        }
        
        // 更新所有图片的标注状态（如果类别名称包含被删除的类别）
        images.value.forEach(img => {
          if (img.className && img.className.includes(category.name)) {
            // 如果类别名称包含被删除的类别，需要重新加载标注
            // 但这里不直接修改，因为可能包含多个类别，让 loadImageClassification 处理
            // 如果当前图片就是要更新的图片，已经在上面的 loadImageClassification 中处理了
          }
        })
        
        toast.success('类别删除成功')
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除类别失败:', error)
          toast.error('删除类别失败: ' + error.message)
        }
      }
    }
    
    // 删除类别（通过右键菜单）
    const deleteClass = async () => {
      if (contextMenuTargetIndex.value < 0 || contextMenuTargetIndex.value >= classList.value.length) {
        return
      }
      
      await deleteClassByIndex(contextMenuTargetIndex.value)
      contextMenuVisible.value = false
    }
    
    // 重新加载所有图片的标注信息（用于类别列表更新后）
    const reloadAllImageClassifications = async () => {
      // 重新加载类别列表
      await loadClassList()
      
      // 重新加载每张图片的标注信息
      for (let i = 0; i < images.value.length; i++) {
        const image = images.value[i]
        if (!image || !image.imageId) continue
        
        try {
          const annotations = await dbManager.getImageAnnotations(image.imageId)
          if (annotations && annotations.length > 0) {
            const annotation = annotations[0]
            const classItem = classList.value.find(cls => cls.id === annotation.class_id)
            if (classItem) {
              image.hasAnnotation = true
              image.className = classItem.name
            } else {
              image.hasAnnotation = false
              image.className = null
            }
          } else {
            image.hasAnnotation = false
            image.className = null
          }
        } catch (error) {
          console.warn(`重新加载图片 ${image.imageId} 的标注失败:`, error)
          image.hasAnnotation = false
          image.className = null
        }
      }
    }
    
    // 导入图片
    const handleImportImages = async () => {
      if (!project.value || !project.value.path) {
        toast.warning('请先打开一个项目')
        return
      }
      
      try {
        // 显示选择对话框
        await ElMessageBox({
          title: '导入图片',
          message: '请选择导入方式',
          distinguishCancelAndClose: true,
          confirmButtonText: '选择文件',
          cancelButtonText: '选择文件夹',
          type: 'info'
        })
        
        // 选择文件
        await importImageFiles(project.value.path)
      } catch (action) {
        if (action === 'cancel') {
          // 选择文件夹
          await importImageDirectory(project.value.path)
        }
        // 'close' 或其他情况，用户取消
      }
    }
    
    // 从文件导入
    const importImageFiles = async (projectPath) => {
      try {
        const result = await window.electronAPI.selectImageFiles()
        
        if (!result.success) {
          toast.error('选择文件失败: ' + result.error)
          return
        }
        
        if (!result.files || result.files.length === 0) {
          return
        }
        
        await copyAndLoadImages(result.files, projectPath)
      } catch (error) {
        console.error('导入图片文件失败', error)
        toast.error('导入图片失败')
      }
    }
    
    // 从文件夹导入
    const importImageDirectory = async (projectPath) => {
      try {
        const result = await window.electronAPI.selectImageDirectory()
        
        if (!result.success) {
          toast.error('选择文件夹失败: ' + result.error)
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
          toast.error('扫描文件夹失败: ' + scanResult.error)
          return
        }
        
        if (!scanResult.files || scanResult.files.length === 0) {
          toast.warning('该文件夹中没有找到图片文件')
          return
        }
        
        await copyAndLoadImages(scanResult.files, projectPath)
      } catch (error) {
        console.error('导入图片文件夹失败', error)
        toast.error('导入图片失败')
      }
    }
    
    // 复制图片到项目并加载
    const copyAndLoadImages = async (sourceFiles, projectPath) => {
      // 显示modal
      savingModalVisible.value = true
      savingModalType.value = 'importing'
      cancelRequested.value = false
      
      const startTime = Date.now()
      
      try {
        // 使用图片池导入
        const projectName = project.value.name || 'project'
        
        const result = await importImages(projectName, sourceFiles)
        
        // 检查是否被取消
        if (cancelRequested.value) {
          toast.info('导入操作已取消')
          return
        }
        
        if (!result.success) {
          toast.error('导入图片失败')
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
          toast.success(`成功导入 ${newImagesCount} 张新图片，跳过 ${skippedCount} 张重复图片${errorCount > 0 ? `，${errorCount} 张失败` : ''}`)
        } else if (errorCount > 0) {
          toast.warning(`成功导入 ${newImagesCount} 张图片，${errorCount} 张失败`)
          console.error('导入失败的图片:', result.errors)
        } else {
          toast.success(`成功导入 ${newImagesCount} 张图片`)
        }
        
        // 重新加载项目图片
        await loadProjectImages()
        
        // 如果之前没有选中图片，自动选中第一张
        if (currentImageIndex.value === -1 && images.value.length > 0) {
          await selectImage(0)
        }
        
        // 确保至少显示500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } catch (error) {
        console.error('导入图片失败', error)
        if (!cancelRequested.value) {
          toast.error('导入图片失败: ' + error.message)
        }
        
        // 确保至少显示500ms
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      } finally {
        savingModalVisible.value = false
      }
    }
    
    // 获取modal主文字
    const getModalMainText = () => {
      switch (savingModalType.value) {
        case 'importing':
          return '正在导入图片...'
        case 'loading':
          return '正在加载项目...'
        default:
          return '正在处理...'
      }
    }
    
    // 获取modal提示文字
    const getModalTipText = () => {
      switch (savingModalType.value) {
        case 'importing':
        case 'loading':
          return '请稍候，或点击下方按钮取消操作'
        default:
          return '请稍候...'
      }
    }
    
    // 强制关闭（跳过保存）
    const handleForceClose = () => {
      if (savingModalType.value === 'importing' || savingModalType.value === 'loading') {
        // 对于导入/加载操作，设置取消标志
        cancelRequested.value = true
        savingModalVisible.value = false
      }
    }
    
    // 切换图片列表展开/折叠
    const toggleImageListExpand = () => {
      imageListExpanded.value = !imageListExpanded.value
    }
    
    // 计算属性
    const currentImage = computed(() => images.value[currentImageIndex.value])
    
    const filteredImages = computed(() => {
      const filtered = []
      images.value.forEach((img, index) => {
        const status = getImageStatus(index)
        let shouldInclude = false
        if (filterStatus.value === 'all') shouldInclude = true
        else if (filterStatus.value === 'annotated') shouldInclude = status === 'annotated'
        else if (filterStatus.value === 'unannotated') shouldInclude = status === 'unannotated'
        else shouldInclude = true
        
        if (shouldInclude) {
          filtered.push({
            ...img,
            index: index  // 使用原始索引
          })
        }
      })
      return filtered
    })
    
    const gridColumns = computed(() => {
      const baseSize = 120
      const scaledSize = imageListExpanded.value ? Math.round(baseSize * (thumbnailScale.value / 100)) : baseSize
      const containerWidth = imageListExpanded.value ? window.innerWidth * 0.6 : 320
      const gap = 8
      return Math.max(1, Math.floor((containerWidth - gap) / (scaledSize + gap)))
    })
    
    const gridRows = computed(() => {
      const cols = gridColumns.value
      const rows = []
      const imgs = filteredImages.value
      
      for (let i = 0; i < imgs.length; i += cols) {
        rows.push({
          rowIndex: i,
          images: imgs.slice(i, i + cols)
        })
      }
      
      return rows
    })
    
    const estimatedItemHeight = computed(() => {
      const baseSize = 120
      const scaledSize = imageListExpanded.value ? Math.round(baseSize * (thumbnailScale.value / 100)) : baseSize
      const imgHeight = scaledSize * 3 / 4
      return Math.ceil(imgHeight + 24)
    })
    
    const annotatedCount = computed(() => {
      return images.value.filter((_, index) => getImageStatus(index) === 'annotated').length
    })
    
    const unannotatedCount = computed(() => {
      return images.value.filter((_, index) => getImageStatus(index) === 'unannotated').length
    })
    
    // 获取图片状态
    const getImageStatus = (index) => {
      const img = images.value[index]
      if (!img) return 'unannotated'
      return img.hasAnnotation ? 'annotated' : 'unannotated'
    }
    
    const getImageStatusText = (image) => {
      const status = getImageStatus(image.index)
      if (status === 'annotated' && image.className) {
        // 已标注且有关别名称，显示类别名称
        return image.className
      }
      // 未标注，显示"未标注"
      return '未标注'
    }
    
    const getImageStatusClass = (image) => {
      const status = getImageStatus(image.index)
      return {
        'status-annotated': status === 'annotated',
        'status-unannotated': status === 'unannotated'
      }
    }
    
    // 处理关闭项目
    const handleCloseProject = async () => {
      console.log('[ClassificationWorkbench] 收到关闭项目请求')
      
      if (!project.value) {
        console.log('[ClassificationWorkbench] 没有当前项目，直接跳转到欢迎页')
        window.location.hash = '#/welcome'
        return
      }
      
      try {
        console.log('[ClassificationWorkbench] 开始关闭项目:', project.value.name)
        
        // 保存工作状态（如果有需要保存的数据）
        await saveWorkspaceState()
        
        // 清除当前项目
        const { clearCurrentProject } = await import('../utils/projectManager')
        clearCurrentProject()
        
        // 清除上次打开的项目记录
        localStorage.removeItem('lastOpenedProject')
        console.log('[ClassificationWorkbench] 已清除项目记录')
        
        // 触发全局项目变化事件
        window.dispatchEvent(new CustomEvent('project-changed', { detail: null }))
        
        // 跳转到欢迎页
        console.log('[ClassificationWorkbench] 跳转到欢迎页')
        window.location.hash = '#/welcome'
      } catch (error) {
        console.error('[ClassificationWorkbench] 关闭项目失败:', error)
        toast.error('关闭项目失败: ' + error.message)
      }
    }
    
    // 保存工作状态
    const saveWorkspaceState = async () => {
      if (!project.value) return
      
      try {
        const state = {
          currentImageIndex: currentImageIndex.value,
          scrollPosition: 0, // 分类项目可能不需要滚动位置
          lastSaved: new Date().toISOString()
        }
        
        await window.electronAPI.saveProjectWorkspaceState(project.value.path, state)
      } catch (error) {
        console.error('保存工作状态失败:', error)
        // 不抛出错误，允许继续关闭
      }
    }
    
    // 处理项目切换请求
    const handleProjectSwitchRequested = async (event) => {
      const { newProject, needSave } = event.detail || {}
      
      console.log('[ClassificationWorkbench] 收到项目切换请求', {
        newProjectType: newProject?.type || 'classification',
        currentProjectType: project.value?.type || 'classification'
      })
      
      // 检查新项目类型，如果是目标检测项目，应该跳转到目标检测工作台
      if (newProject && newProject.type !== 'classification') {
        console.log('[ClassificationWorkbench] 新项目是目标检测项目，应该跳转到目标检测工作台')
        
        // 先保存当前项目状态
        if (needSave && project.value) {
          try {
            await saveWorkspaceState()
            console.log('[ClassificationWorkbench] 当前项目状态已保存')
          } catch (error) {
            console.error('[ClassificationWorkbench] 保存当前项目状态失败:', error)
          }
        }
        
        // 跳转到目标检测工作台（目标检测工作台会处理项目切换）
        window.location.hash = '#/workbench'
        return
      }
      
      // 新项目是分类项目，在当前工作台处理
      console.log('[ClassificationWorkbench] 切换到分类项目，在当前工作台处理')
      
      try {
        // 设置切换标志，避免重复提示
        isSwitchingProject.value = true
        
        // 1. 先保存当前项目状态
        if (needSave && project.value) {
          await saveWorkspaceState()
          console.log('[ClassificationWorkbench] 当前项目状态已保存')
        }
        
        // 2. 重置所有状态
        images.value = []
        currentImageIndex.value = -1
        classList.value = []
        selectedClasses.value.clear()
        project.value = null
        
        // 3. 等待DOM更新
        await nextTick()
        
        // 4. 重新初始化应用（加载新项目，不显示成功提示）
        await initializeApp(false)
        
        console.log('[ClassificationWorkbench] 项目切换完成')
      } catch (error) {
        console.error('[ClassificationWorkbench] 项目切换失败:', error)
        toast.error('项目切换失败: ' + error.message)
        // 重置切换标志
        isSwitchingProject.value = false
      }
    }
    
    // 标记是否是切换项目触发的加载（用于避免重复提示）
    const isSwitchingProject = ref(false)
    
    // 加载快捷键设置
    const loadShortcuts = () => {
      const saved = localStorage.getItem('workbench-shortcuts')
      if (saved) {
        try {
          const savedShortcuts = JSON.parse(saved)
          // 只加载分类工作台需要的快捷键（排除放大、缩小、重置缩放、保存负样本、删除标注）
          const validKeys = ['saveAnnotation', 'nextImage', 'prevImage', 'jumpToNextUnannotated', 'jumpToPrevUnannotated']
          const filteredShortcuts = {}
          validKeys.forEach(key => {
            if (savedShortcuts[key]) {
              filteredShortcuts[key] = savedShortcuts[key]
            }
          })
          shortcuts.value = { ...shortcuts.value, ...filteredShortcuts }
        } catch (e) {
          console.error('加载快捷键失败', e)
        }
      }
    }
    
    // 获取快捷键标签
    const getShortcutLabel = (key) => {
      const labels = {
        saveAnnotation: '保存标注',
        nextImage: '下一张图片',
        prevImage: '上一张图片',
        jumpToNextUnannotated: '跳转到下一张未标注',
        jumpToPrevUnannotated: '跳转到上一张未标注'
      }
      return labels[key] || key
    }
    
    // 保存快捷键设置
    const saveShortcuts = () => {
      localStorage.setItem('workbench-shortcuts', JSON.stringify(shortcuts.value))
      toast.success('快捷键已保存')
    }
    
    // 重置快捷键
    const resetShortcut = (shortcutKey) => {
      const defaults = {
        saveAnnotation: 'Enter',
        nextImage: 'ArrowRight',
        prevImage: 'ArrowLeft',
        jumpToNextUnannotated: 'Ctrl+ArrowRight',
        jumpToPrevUnannotated: 'Ctrl+ArrowLeft'
      }
      if (defaults[shortcutKey]) {
        shortcuts.value[shortcutKey] = defaults[shortcutKey]
        saveShortcuts()
      }
    }
    
    // 检查是否在输入框中
    const isInInputField = (element) => {
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
      
      // 递归检查父元素
      return isInInputField(element.parentElement)
    }
    
    // 全局键盘事件处理器（捕获阶段，统一处理所有快捷键）
    const handleGlobalKeydown = (event) => {
      // 如果在输入框中，不处理自定义快捷键，让输入正常工作
      if (isInInputField(event.target)) {
        return
      }
      
      // 如果在快捷键设置对话框中，不处理
      if (shortcutsDialogVisible.value) {
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
      for (const [key, shortcut] of Object.entries(shortcuts.value)) {
        if (shortcut === pressedShortcut) {
          event.preventDefault()
          event.stopPropagation()
          
          // 手动触发对应的处理函数
          switch (key) {
            case 'saveAnnotation':
              handleSaveClassification()
              break
            case 'nextImage':
              nextImage()
              break
            case 'prevImage':
              prevImage()
              break
            case 'jumpToNextUnannotated':
              jumpToNextUnannotated()
              break
            case 'jumpToPrevUnannotated':
              jumpToPrevUnannotated()
              break
          }
          
          return false
        }
      }
      
      // 不匹配的快捷键让 Electron 层处理，不在这里阻止
    }
    
    // 打开快捷键设置对话框
    const openShortcutsDialog = () => {
      shortcutsDialogVisible.value = true
      // 对话框打开后自动聚焦
      nextTick(() => {
        const content = document.querySelector('.shortcuts-content')
        if (content) {
          content.focus()
        }
      })
    }
    
    // 关闭快捷键设置对话框
    const closeShortcutsDialog = () => {
      shortcutsDialogVisible.value = false
      editingShortcut.value = null
      isCapturingKey.value = false
      tempShortcut.value = ''
      conflictKey.value = null
    }
    
    // 开始捕获快捷键
    const startCaptureKey = (shortcutKey) => {
      editingShortcut.value = shortcutKey
      isCapturingKey.value = true
      tempShortcut.value = ''
      conflictKey.value = null
      // 确保对话框获得焦点
      nextTick(() => {
        const content = document.querySelector('.shortcuts-content')
        if (content) {
          content.focus()
        }
      })
    }
    
    // 快捷键设置对话框的键盘按下事件
    const handleShortcutKeyDown = (event) => {
      if (!isCapturingKey.value || !editingShortcut.value) {
        return
      }
      
      event.preventDefault()
      event.stopPropagation()
      
      const key = event.key
      
      // 忽略单独的修饰键
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
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
      
      tempShortcut.value = keys.join('+')
      
      // 检查是否与其他快捷键冲突
      conflictKey.value = checkConflict(tempShortcut.value, editingShortcut.value)
    }
    
    // 快捷键设置对话框的键盘释放事件
    const handleShortcutKeyUp = (event) => {
      if (!isCapturingKey.value || !editingShortcut.value) return
      
      event.preventDefault()
      event.stopPropagation()
      
      // 检查是否所有按键都已松开
      if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
        // 如果有捕获到的快捷键且没有冲突
        if (tempShortcut.value && !conflictKey.value) {
          shortcuts.value[editingShortcut.value] = tempShortcut.value
          saveShortcuts()
          isCapturingKey.value = false
          editingShortcut.value = null
          tempShortcut.value = ''
        } else if (conflictKey.value) {
          // 有冲突，不保存，显示提示
          toast.warning(`快捷键与"${getShortcutLabel(conflictKey.value)}"冲突，请重新设置`)
        }
      }
    }
    
    // 检查快捷键冲突
    const checkConflict = (newShortcut, currentKey) => {
      // 检查新快捷键是否与其他快捷键冲突
      for (const [key, value] of Object.entries(shortcuts.value)) {
        if (key !== currentKey && value === newShortcut) {
          return key
        }
      }
      return null
    }
    
    // 生命周期
    onMounted(() => {
      // 先注册事件监听器（在初始化之前）
      window.addEventListener('resize', handleResize)
      window.addEventListener('close-project-requested', handleCloseProject)
      window.addEventListener('project-switch-requested', handleProjectSwitchRequested)
      // 监听快捷键设置对话框打开事件（但不监听工具栏事件，因为分类工作台不需要工具栏）
      window.addEventListener('open-shortcuts-modal', openShortcutsDialog)
      
      // 加载快捷键设置
      loadShortcuts()
      
      // 添加全局键盘监听器（捕获阶段），统一处理所有快捷键
      window.addEventListener('keydown', handleGlobalKeydown, true)
      
      // 检查是否是项目切换触发的路由跳转（通过全局标志判断）
      const isSwitching = window.__isProjectSwitching === true
      
      // 延迟一点时间，让切换事件先处理（如果存在）
      setTimeout(() => {
        // 如果切换标志未设置，说明是首次加载或非切换场景，显示提示
        // 使用全局标志或本地标志来判断
        const shouldShowMessage = !isSwitching && !isSwitchingProject.value
        initializeApp(shouldShowMessage)
      }, 150)
    })
    
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('close-project-requested', handleCloseProject)
      window.removeEventListener('project-switch-requested', handleProjectSwitchRequested)
      window.removeEventListener('open-shortcuts-modal', openShortcutsDialog)
      
      // 移除全局键盘监听器
      window.removeEventListener('keydown', handleGlobalKeydown, true)
    })
    
    return {
      project,
      images,
      currentImageIndex,
      filterStatus,
      imageListExpanded,
      thumbnailScale,
      classList,
      selectedClasses,
      imageContainerWrapper,
      imageContainer,
      imageStyle,
      currentImage,
      filteredImages,
      gridColumns,
      gridRows,
      estimatedItemHeight,
      annotatedCount,
      unannotatedCount,
      selectImage,
      prevImage,
      nextImage,
      handleSaveClassification,
      handleAddClass,
      isAddingClass,
      newClassName,
      confirmAddClass,
      cancelAddClass,
      selectClass,
      editClass,
      deleteClass,
      deleteClassByIndex,
      showClassContextMenu,
      contextMenuVisible,
      contextMenuStyle,
      handleImportImages,
      toggleImageListExpand,
      getImageStatus,
      getImageStatusText,
      getImageStatusClass,
      handleImageLoad,
      savingModalVisible,
      savingModalType,
      getModalMainText,
      getModalTipText,
      handleForceClose,
      shortcutsDialogVisible,
      shortcuts,
      editingShortcut,
      isCapturingKey,
      tempShortcut,
      conflictKey,
      getShortcutLabel,
      startCaptureKey,
      resetShortcut,
      handleShortcutKeyDown,
      handleShortcutKeyUp,
      openShortcutsDialog,
      closeShortcutsDialog,
      jumpToNextUnannotated,
      jumpToPrevUnannotated
    }
  }
}
</script>

<style scoped>
.classification-workbench {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* 左侧栏样式（复用 Workbench 的样式） */
.file-list-panel {
  width: 320px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  position: relative;
}

.panel-content-wrapper {
  width: 320px;
  height: 100%;
  background: var(--color-bg-primary);
  border-right: 1px solid var(--color-border);
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
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.15);
}

body[data-theme="dark"] .panel-content-wrapper.expanded {
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.5);
}

.panel-header {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
}

body[data-theme="dark"] .panel-header {
  border-bottom-color: #3c3c3c;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
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
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  overflow-y: hidden;
}

body[data-theme="dark"] .filter-bar {
  border-bottom-color: #3c3c3c;
}

.filter-radio-group {
  display: flex;
  white-space: nowrap;
}

.filter-bar :deep(.el-radio-button__inner) {
  padding: 6px 10px;
  font-size: 11px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

/* 图片列表容器 */
.thumbnail-list-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.thumbnail-list {
  flex: 1;
  overflow: hidden;
  padding: 8px;
  position: relative;
  min-height: 200px;
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
body[data-theme="dark"] .thumbnail-list :deep(.vue-recycle-scroller)::-webkit-scrollbar-track {
  background: #252526 !important;
}

body[data-theme="dark"] .thumbnail-list :deep(.vue-recycle-scroller)::-webkit-scrollbar-thumb {
  background: #424242 !important;
}

body[data-theme="dark"] .thumbnail-list :deep(.vue-recycle-scroller)::-webkit-scrollbar-thumb:hover {
  background: #4e4e4e !important;
}

/* RecycleScroller 内部布局 */
.thumbnail-list :deep(.vue-recycle-scroller__item-wrapper) {
  box-sizing: border-box;
  overflow: visible;
}

.thumbnail-list :deep(.vue-recycle-scroller__slot) {
  padding: 0;
}

.thumbnail-list :deep(.vue-recycle-scroller__item-view) {
  margin-bottom: 12px;
  overflow: visible;
}

/* 图片行容器 */
.thumbnail-row {
  display: grid;
  gap: 8px;
  width: 100%;
  overflow: visible;
}

/* 折叠状态下增加列间距 */
.thumbnail-list:not(.grid-expanded) .thumbnail-row {
  gap: 12px;
}

/* 缩略图项 */
.thumbnail-item {
  padding: 0;
  border: 3px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--color-bg-secondary);
  will-change: transform;
  position: relative;
  box-sizing: border-box;
}

body[data-theme="dark"] .thumbnail-item {
  background: #2d2d2d;
}

.thumbnail-img-wrapper {
  position: relative;
  width: 100%;
  padding-top: 75%; /* 4:3 宽高比 */
  overflow: hidden;
  border-radius: 4px;
}

.thumbnail-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.65;
  filter: grayscale(0.3) brightness(0.85);
}

.thumbnail-item:hover {
  background: var(--color-bg-tertiary);
  border-color: transparent;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

body[data-theme="dark"] .thumbnail-item:hover {
  background: #333333;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.thumbnail-item:hover .thumbnail-img {
  opacity: 1;
  filter: grayscale(0) brightness(1);
}

.thumbnail-item.active {
  border-color: var(--color-primary);
  background: var(--color-bg-primary);
  box-shadow: 0 0 0 2px var(--color-primary);
}

.thumbnail-item.active .thumbnail-img {
  opacity: 1;
  filter: grayscale(0) brightness(1);
}

.status-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  z-index: 1;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  max-width: calc(100% - 8px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge.status-annotated {
  background: rgba(103, 194, 58, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status-badge.status-unannotated {
  background: rgba(158, 158, 158, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 缩略图大小控制 */
.thumbnail-size-control {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-bg-primary);
}

body[data-theme="dark"] .thumbnail-size-control {
  border-top-color: #3c3c3c;
}

.size-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.thumbnail-size-control :deep(.el-slider) {
  flex: 1;
}

.size-value {
  font-size: 12px;
  color: var(--color-text-secondary);
  min-width: 40px;
  text-align: right;
}

/* 中间栏：图片显示区 */
.image-display-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
}

.image-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-primary);
}

.image-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.current-image-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.image-counter {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.image-controls {
  display: flex;
  gap: 8px;
}

.image-container-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 20px;
}

.image-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.display-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.empty-image-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* 右侧栏样式（复用 Workbench 的样式） */
.class-tool-panel {
  width: 280px;
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.class-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.class-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.class-item:hover {
  background: var(--color-bg-secondary);
}

/* 删除重复的样式定义，统一使用下面的样式 */

.class-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.class-item:hover .class-actions {
  opacity: 1;
}

.empty-class {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

/* 保存状态遮罩层样式（复用 Workbench 的样式） */
.saving-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.saving-box {
  background: var(--color-bg-primary);
  border-radius: 8px;
  padding: 32px 40px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 300px;
  text-align: center;
}

body[data-theme="dark"] .saving-box {
  background: var(--color-bg-primary);
}

.saving-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.saving-header .el-icon {
  color: var(--color-primary);
}

.saving-text-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.saving-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0;
}

.saving-tip {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.force-close-btn {
  margin-top: 16px;
}

.saving-fade-enter-active,
.saving-fade-leave-active {
  transition: opacity 0.3s;
}

.saving-fade-enter-from,
.saving-fade-leave-to {
  opacity: 0;
}

/* 快捷键设置对话框样式（复用 Workbench 的样式） */
.shortcuts-content {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.shortcuts-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--color-text-primary);
}

body[data-theme="dark"] .shortcuts-tip {
  background: #3c3c3c;
}

.shortcuts-tip .el-icon {
  color: var(--color-info);
  font-size: 16px;
}

.shortcuts-warning {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 4px;
  margin-bottom: 20px;
}

body[data-theme="dark"] .shortcuts-warning {
  background: rgba(255, 193, 7, 0.15);
  border-color: rgba(255, 193, 7, 0.4);
}

.shortcuts-warning .el-icon {
  color: #ffc107;
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

body[data-theme="dark"] .shortcuts-warning .el-icon {
  color: #ffd54f;
}

.warning-content {
  flex: 1;
}

.warning-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.warning-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  transition: background 0.15s;
}

.shortcut-item:hover {
  background: var(--color-bg-tertiary);
}

.shortcut-label {
  min-width: 120px;
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.shortcut-value-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shortcut-value {
  display: flex;
  align-items: center;
}

.conflict-hint {
  font-size: 11px;
  color: var(--color-danger);
}

.shortcut-actions {
  display: flex;
  gap: 8px;
}

/* 类别相关样式 */
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

.class-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
}

.class-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.class-item:hover .class-actions {
  opacity: 1;
}

.class-item-input {
  background: var(--color-bg-tertiary);
  padding: 8px 12px;
  cursor: default;
}

body[data-theme="dark"] .class-item-input {
  background: #333333;
}

.class-item-input:hover {
  background: var(--color-bg-tertiary);
}

body[data-theme="dark"] .class-item-input:hover {
  background: #333333;
}

.class-item-input .el-input {
  flex: 1;
}

.empty-class {
  padding: 40px 20px;
  text-align: center;
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px;
  min-width: 120px;
}

body[data-theme="dark"] .context-menu {
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
  color: var(--color-text-primary);
}

body[data-theme="dark"] .context-menu-item {
  color: #cccccc;
}

.context-menu-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-danger);
}

body[data-theme="dark"] .context-menu-item:hover {
  background: #3c3c3c;
  color: #f44747;
}

.context-menu-item .el-icon {
  font-size: 14px;
}
</style>

