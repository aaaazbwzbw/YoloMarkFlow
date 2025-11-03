<template>
  <!-- 下拉菜单 -->
  <el-dropdown trigger="click" @command="handleCommand" :teleported="false" style="width: 100%; display: block;">
    <span style="width: 100%; display: block;">
      <slot>
        <el-button style="width: 100%;">
          <el-icon><FolderAdd /></el-icon>
          <span>新建/打开项目</span>
        </el-button>
      </slot>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="new">
          <el-icon><DocumentAdd /></el-icon>
          <span>新建项目</span>
        </el-dropdown-item>
        <el-dropdown-item command="open">
          <el-icon><FolderOpened /></el-icon>
          <span>打开项目</span>
        </el-dropdown-item>
        <el-dropdown-item command="import" divided>
          <el-icon><Upload /></el-icon>
          <span>导入数据集</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <!-- 新建项目对话框 -->
  <el-dialog
    v-model="newProjectDialogVisible"
    title="新建项目"
    width="500px"
    :close-on-click-modal="false">
    <el-form :model="newProjectForm" :rules="newProjectRules" ref="newProjectFormRef" label-width="80px">
      <el-form-item label="项目名称" prop="name">
        <el-input 
          v-model="newProjectForm.name" 
          placeholder="请输入项目名称"
          @input="autoFillPath" />
      </el-form-item>
      
      <el-form-item label="项目路径" prop="path">
        <el-input 
          v-model="newProjectForm.path" 
          placeholder="请选择项目保存位置"
          @input="handlePathInput">
          <template #append>
            <el-button @click="selectPath" :icon="Folder">浏览</el-button>
          </template>
        </el-input>
      </el-form-item>
      
      <el-form-item label="项目描述">
        <el-input 
          v-model="newProjectForm.description" 
          type="textarea" 
          :rows="3"
          placeholder="请输入项目描述（可选）" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="newProjectDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="createProject" :loading="creating">创建</el-button>
    </template>
  </el-dialog>

  <!-- 打开项目对话框 -->
  <el-dialog
    v-model="openProjectDialogVisible"
    title="打开项目"
    width="500px"
    :close-on-click-modal="false">
    <div class="open-project-content">
      <el-button class="select-folder-btn" @click="selectProjectFolder" :icon="FolderOpened" size="large">
        选择项目文件夹
      </el-button>
      
      <!-- 最近项目列表 -->
      <div v-if="recentProjects.length > 0" class="recent-projects">
        <div class="recent-title">最近打开的项目</div>
        <div class="recent-list">
          <div 
            v-for="(project, index) in recentProjects" 
            :key="index"
            class="recent-item"
            @click="openRecentProject(project)">
            <div class="recent-info">
              <el-icon class="recent-icon"><Folder /></el-icon>
              <div class="recent-details">
                <div class="recent-name">{{ project.name }}</div>
                <div class="recent-path">{{ project.path }}</div>
              </div>
            </div>
            <div class="recent-time">{{ formatTime(project.lastOpened) }}</div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="openProjectDialogVisible = false">取消</el-button>
    </template>
  </el-dialog>

  <!-- 导入数据集对话框 -->
  <el-dialog
    v-model="importDialogVisible"
    title="导入数据集"
    width="600px"
    :close-on-click-modal="false">
    
    <el-steps :active="importStep" align-center>
      <el-step title="选择类型" />
      <el-step title="选择数据集" />
      <el-step title="配置选项" />
      <el-step title="导入进度" />
    </el-steps>

    <div class="import-content">
      <!-- 步骤1: 选择导入类型 -->
      <div v-if="importStep === 0" class="import-step">
        <div class="import-type-selector">
          <div 
            class="import-type-card"
            :class="{ selected: importConfig.type === 'coco' }"
            @click="importConfig.type = 'coco'">
            <el-icon size="48"><DataBoard /></el-icon>
            <h3>COCO数据集</h3>
            <p>支持标准COCO JSON格式</p>
          </div>
          <div 
            class="import-type-card"
            :class="{ selected: importConfig.type === 'yolo' }"
            @click="importConfig.type = 'yolo'">
            <el-icon size="48"><Files /></el-icon>
            <h3>YOLO数据集</h3>
            <p>支持YOLO标注格式</p>
          </div>
        </div>
      </div>

      <!-- 步骤2: 选择数据集 -->
      <div v-if="importStep === 1" class="import-step">
        <el-form label-width="100px">
          <el-form-item label="数据集路径">
            <el-input 
              v-model="importConfig.datasetPath" 
              placeholder="选择数据集目录"
              readonly>
              <template #append>
                <el-button @click="selectDatasetPath" :icon="Folder">浏览</el-button>
              </template>
            </el-input>
          </el-form-item>
          <el-alert 
            v-if="datasetValidation.message"
            :title="datasetValidation.message"
            :type="datasetValidation.valid ? 'success' : 'warning'"
            :closable="false"
            show-icon
            style="margin-top: 12px;">
          </el-alert>
        </el-form>
      </div>

      <!-- 步骤3: 配置选项 -->
      <div v-if="importStep === 2" class="import-step">
        <el-form label-width="120px">
          <el-form-item label="导入目标">
            <el-radio-group v-model="importConfig.target">
              <el-radio label="new">创建新项目</el-radio>
              <el-radio label="current" :disabled="!hasCurrentProject">导入到当前项目</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="importConfig.target === 'new'" label="项目名称">
            <el-input v-model="importConfig.projectName" placeholder="请输入项目名称" />
          </el-form-item>

          <el-form-item v-if="importConfig.target === 'new'" label="项目路径">
            <el-input 
              v-model="importConfig.projectPath" 
              placeholder="选择项目保存位置"
              readonly>
              <template #append>
                <el-button @click="selectProjectPath" :icon="Folder">浏览</el-button>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="图片处理">
            <el-radio-group v-model="importConfig.copyImages">
              <el-radio :label="true">
                <span>复制到图片池</span>
                <el-tag type="success" size="small" style="margin-left: 8px;">推荐</el-tag>
              </el-radio>
              <el-radio :label="false" disabled>引用原始位置（暂未实现）</el-radio>
            </el-radio-group>
            <div class="form-tip">
              复制到图片池可以避免源文件被移动或删除导致的问题
            </div>
          </el-form-item>
        </el-form>
      </div>

      <!-- 步骤4: 导入进度 -->
      <div v-if="importStep === 3" class="import-step">
        <div class="import-progress">
          <el-progress 
            :percentage="importProgress.percent" 
            :status="importProgress.status"
            :stroke-width="20">
          </el-progress>
          <p class="progress-message">{{ importProgress.message }}</p>
          
          <div v-if="importProgress.status === 'success'" class="import-result">
            <el-result icon="success" title="导入完成">
              <template #sub-title>
                <p>成功导入 {{ importStats.importedImages }} 张新图片</p>
                <p v-if="importStats.skippedImages > 0" style="color: #909399;">
                  跳过 {{ importStats.skippedImages }} 张重复图片
                </p>
                <p>共 {{ importStats.totalImages }} 张图片，导入 {{ importStats.importedAnnotations }} 个标注，{{ importStats.categories }} 个类别</p>
                <p v-if="importErrors.length > 0" style="color: #E6A23C;">
                  {{ importErrors.length }} 个文件导入失败
                </p>
              </template>
              <template #extra>
                <el-button type="primary" @click="finishImport">完成</el-button>
                <el-button v-if="importErrors.length > 0" @click="showErrors">查看错误</el-button>
              </template>
            </el-result>
          </div>

          <div v-if="importProgress.status === 'exception'" class="import-result">
            <el-result icon="error" title="导入失败">
              <template #sub-title>
                <p>{{ importProgress.error }}</p>
              </template>
              <template #extra>
                <el-button @click="resetImport">返回</el-button>
              </template>
            </el-result>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div v-if="importStep < 3">
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button v-if="importStep > 0" @click="importStep--">上一步</el-button>
        <el-button 
          v-if="importStep < 2"
          type="primary" 
          @click="nextImportStep"
          :disabled="!canGoNextStep">
          下一步
        </el-button>
        <el-button 
          v-if="importStep === 2"
          type="primary" 
          @click="startImport"
          :disabled="!canStartImport"
          :loading="importing">
          开始导入
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import { ref, reactive, computed } from 'vue'
import { FolderAdd, DocumentAdd, FolderOpened, Folder, Upload, DataBoard, Files } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import toast from '../utils/toast'
import { 
  createProjectConfig, 
  setCurrentProject,
  getCurrentProject,
  addToRecentProjects,
  getRecentProjects,
  validateProjectConfig,
  fixCorruptedConfig,
  needsFix,
  PROJECT_CONFIG_FILE 
} from '../utils/projectManager'
import { CocoImporter } from '../utils/importers/CocoImporter'
import { YoloImporter } from '../utils/importers/YoloImporter'

export default {
  name: 'ProjectDialog',
  components: {
    FolderAdd,
    DocumentAdd,
    FolderOpened,
    Folder,
    Upload,
    DataBoard,
    Files
  },
  emits: ['project-created', 'project-opened'],
  setup(props, { emit }) {
    // 下拉菜单
    const handleCommand = (command) => {
      if (command === 'new') {
        showNewProjectDialog()
      } else if (command === 'open') {
        showOpenProjectDialog()
      } else if (command === 'import') {
        showImportDialog()
      }
    }

    // 新建项目
    const newProjectDialogVisible = ref(false)
    const newProjectFormRef = ref(null)
    const creating = ref(false)
    const selectedBasePath = ref('')
    
    const newProjectForm = reactive({
      name: '',
      path: '',
      description: ''
    })
    
    const isPathManuallyEdited = ref(false) // 标记路径是否被用户手动编辑

    const newProjectRules = {
      name: [
        { required: true, message: '请输入项目名称', trigger: 'blur' },
        { min: 1, max: 50, message: '长度在 1 到 50 个字符', trigger: 'blur' }
      ],
      path: [
        { required: true, message: '请选择项目路径', trigger: 'blur' }
      ]
    }

    const showNewProjectDialog = () => {
      newProjectDialogVisible.value = true
      // 重置表单
      newProjectForm.name = ''
      newProjectForm.path = ''
      newProjectForm.description = ''
      selectedBasePath.value = ''
      isPathManuallyEdited.value = false
    }

    // 拼接路径（跨平台）
    const joinPath = (basePath, projectName) => {
      if (!basePath || !projectName) return ''
      // 确保路径分隔符正确
      const separator = basePath.includes('/') ? '/' : '\\'
      return basePath.replace(/[/\\]+$/, '') + separator + projectName
    }

    // 自动填充路径
    const autoFillPath = () => {
      // 如果路径被手动编辑过，不自动更新
      if (isPathManuallyEdited.value) return
      
      if (newProjectForm.name) {
        if (selectedBasePath.value) {
          // 有基础路径，拼接项目名
          newProjectForm.path = joinPath(selectedBasePath.value, newProjectForm.name)
        } else {
          // 没有基础路径，使用默认 D:\ + 项目名
          newProjectForm.path = `D:\\${newProjectForm.name}`
        }
      } else {
        // 项目名为空
        newProjectForm.path = selectedBasePath.value || ''
      }
    }

    // 选择路径（浏览按钮）
    const selectPath = async () => {
      const selectedPath = await window.electronAPI.selectProjectDirectory()
      if (selectedPath) {
        selectedBasePath.value = selectedPath
        // 浏览选择的路径，自动拼接项目名
        if (newProjectForm.name) {
          newProjectForm.path = joinPath(selectedPath, newProjectForm.name)
        } else {
          newProjectForm.path = selectedPath
        }
      }
    }
    
    // 监听路径的手动输入
    const handlePathInput = () => {
      isPathManuallyEdited.value = true
    }

    // 创建项目
    const createProject = async () => {
      if (!newProjectFormRef.value) return
      
      await newProjectFormRef.value.validate(async (valid) => {
        if (!valid) return
        
        creating.value = true
        
        try {
          // 检查项目是否已存在
          const exists = await window.electronAPI.checkProjectExists(newProjectForm.path)
          if (exists) {
            toast.warning('该目录已存在YoloMarkFlow项目')
            creating.value = false
            return
          }

          // 创建项目目录
          const createResult = await window.electronAPI.createProjectDirectory(newProjectForm.path)
          if (!createResult.success) {
            throw new Error(createResult.error)
          }

          // 创建项目配置
          const config = createProjectConfig({
            name: newProjectForm.name,
            path: newProjectForm.path,
            description: newProjectForm.description
          })

          // 写入配置文件
          const writeResult = await window.electronAPI.writeProjectConfig(newProjectForm.path, config)
          if (!writeResult.success) {
            throw new Error(writeResult.error)
          }

          // 设置为当前项目
          setCurrentProject(config)
          addToRecentProjects(config)

          toast.success('项目创建成功！')
          newProjectDialogVisible.value = false
          
          // 触发事件
          emit('project-created', config)
          
          // 自动跳转到工作台
          setTimeout(() => {
            window.location.hash = '#/workbench'
          }, 100)
        } catch (error) {
          console.error('创建项目失败', error)
          toast.error('创建项目失败: ' + error.message)
        } finally {
          creating.value = false
        }
      })
    }

    // 打开项目
    const openProjectDialogVisible = ref(false)
    const recentProjects = ref([])

    const showOpenProjectDialog = () => {
      openProjectDialogVisible.value = true
      recentProjects.value = getRecentProjects()
    }

    // 选择项目文件夹
    const selectProjectFolder = async () => {
      const selectedPath = await window.electronAPI.selectProjectDirectory()
      if (selectedPath) {
        await openProjectByPath(selectedPath)
      }
    }

    // 打开最近项目
    const openRecentProject = async (project) => {
      await openProjectByPath(project.path)
    }

    // 通过路径打开项目
    const openProjectByPath = async (projectPath) => {
      try {
        // 检查项目是否存在
        const exists = await window.electronAPI.checkProjectExists(projectPath)
        if (!exists) {
          toast.error('该目录不是有效的YoloMarkFlow项目')
          return
        }

        // 读取项目配置
        const readResult = await window.electronAPI.readProjectConfig(projectPath)
        if (!readResult.success) {
          throw new Error(readResult.error)
        }

        let config = readResult.config

        console.log('ProjectDialog - 读取到的原始项目配置:', JSON.stringify(config, null, 2))

        // 只在需要时修复配置
        if (needsFix(config)) {
          console.log('检测到配置需要修复，正在修复...')
          config = fixCorruptedConfig(config)
          console.log('ProjectDialog - 修复后的项目配置:', JSON.stringify(config, null, 2))
        } else {
          console.log('配置正常，无需修复')
        }

        // 验证配置
        if (!validateProjectConfig(config)) {
          console.error('ProjectDialog - 项目配置验证失败:', config)
          toast.error('项目配置文件格式不正确')
          return
        }

        // 保存修复后的配置（如果配置被修复过）
        if (readResult.config !== config) {
          console.log('保存修复后的配置到文件...')
          await window.electronAPI.writeProjectConfig(projectPath, config)
        }

        // 检查是否是项目切换
        const currentProject = getCurrentProject()
        const isProjectSwitch = currentProject && currentProject.path !== projectPath
        
        if (isProjectSwitch) {
          // 项目切换：先保存当前状态，再切换
          console.log('切换项目：先保存当前项目状态...')
          
          // 设置为当前项目
          setCurrentProject(config)
          addToRecentProjects(config)
          
          toast.success('正在切换项目...')
          openProjectDialogVisible.value = false
          
          // 触发项目切换事件（带保存逻辑）
          window.dispatchEvent(new CustomEvent('project-switch-requested', { 
            detail: { 
              newProject: config,
              needSave: true 
            } 
          }))
        } else {
          // 首次打开项目：直接打开
          setCurrentProject(config)
          addToRecentProjects(config)
          
          toast.success('项目打开成功！')
          openProjectDialogVisible.value = false
          
          emit('project-opened', config)
          
          // 跳转到工作台
          setTimeout(() => {
            window.location.hash = '#/workbench'
          }, 100)
        }
      } catch (error) {
        console.error('打开项目失败', error)
        toast.error('打开项目失败: ' + error.message)
      }
    }

    // 格式化时间
    const formatTime = (isoString) => {
      const date = new Date(isoString)
      const now = new Date()
      const diff = now - date
      
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)
      
      if (minutes < 1) return '刚刚'
      if (minutes < 60) return `${minutes}分钟前`
      if (hours < 24) return `${hours}小时前`
      if (days < 7) return `${days}天前`
      
      return date.toLocaleDateString()
    }

    // ========== 导入数据集相关 ==========
    const importDialogVisible = ref(false)
    const importStep = ref(0)
    const importing = ref(false)
    
    const importConfig = reactive({
      type: 'coco', // 'coco' | 'yolo'
      datasetPath: '',
      target: 'new', // 'new' | 'current'
      projectName: '',
      projectPath: '',
      copyImages: true
    })

    const datasetValidation = reactive({
      valid: false,
      message: ''
    })

    const importProgress = reactive({
      percent: 0,
      status: '', // '' | 'success' | 'exception'
      message: '',
      error: ''
    })

    const importStats = reactive({
      totalImages: 0,
      importedImages: 0,
      skippedImages: 0,
      totalAnnotations: 0,
      importedAnnotations: 0,
      categories: 0
    })

    const importErrors = ref([])

    // 计算属性
    const hasCurrentProject = computed(() => {
      return !!getCurrentProject()
    })

    const canGoNextStep = computed(() => {
      if (importStep.value === 0) {
        return !!importConfig.type
      }
      if (importStep.value === 1) {
        return datasetValidation.valid
      }
      return true
    })

    const canStartImport = computed(() => {
      if (importConfig.target === 'new') {
        return importConfig.projectName && importConfig.projectPath
      }
      return true
    })

    // 显示导入对话框
    const showImportDialog = () => {
      importDialogVisible.value = true
      importStep.value = 0
      resetImportConfig()
    }

    // 重置导入配置
    const resetImportConfig = () => {
      importConfig.type = 'coco'
      importConfig.datasetPath = ''
      importConfig.target = hasCurrentProject.value ? 'current' : 'new'
      importConfig.projectName = ''
      importConfig.projectPath = ''
      importConfig.copyImages = true
      datasetValidation.valid = false
      datasetValidation.message = ''
      importProgress.percent = 0
      importProgress.status = ''
      importProgress.message = ''
      importProgress.error = ''
      Object.assign(importStats, {
        totalImages: 0,
        importedImages: 0,
        skippedImages: 0,
        totalAnnotations: 0,
        importedAnnotations: 0,
        categories: 0
      })
      importErrors.value = []
    }

    // 选择数据集路径
    const selectDatasetPath = async () => {
      const result = await window.electronAPI.selectDirectory({
        title: '选择数据集目录'
      })
      
      if (result.success && result.directory) {
        importConfig.datasetPath = result.directory
        await validateDataset()
      }
    }

    // 验证数据集
    const validateDataset = async () => {
      if (!importConfig.datasetPath) {
        datasetValidation.valid = false
        datasetValidation.message = ''
        return
      }

      try {
        const importer = importConfig.type === 'coco' 
          ? new CocoImporter() 
          : new YoloImporter()
        
        const validation = await importer.validateDataset(importConfig.datasetPath)
        datasetValidation.valid = validation.valid
        datasetValidation.message = validation.message || '数据集验证通过'
      } catch (error) {
        datasetValidation.valid = false
        datasetValidation.message = '验证失败: ' + error.message
      }
    }

    // 选择项目路径
    const selectProjectPath = async () => {
      const result = await window.electronAPI.selectDirectory({
        title: '选择项目保存位置'
      })
      
      if (result.success && result.directory) {
        if (importConfig.projectName) {
          importConfig.projectPath = `${result.directory}\\${importConfig.projectName}`
        } else {
          importConfig.projectPath = result.directory
        }
      }
    }

    // 下一步
    const nextImportStep = async () => {
      if (importStep.value === 1) {
        // 从步骤2到步骤3时，如果是创建新项目，自动填充项目名
        if (importConfig.target === 'new' && !importConfig.projectName) {
          // 从数据集路径提取项目名
          const pathParts = importConfig.datasetPath.split(/[\\/]/)
          importConfig.projectName = pathParts[pathParts.length - 1] || 'Imported_Project'
        }
      }
      importStep.value++
    }

    // 开始导入
    const startImport = async () => {
      importing.value = true
      importStep.value = 3
      importProgress.status = ''
      importProgress.percent = 0
      importProgress.message = '准备导入...'

      try {
        let projectPath = importConfig.projectPath
        let projectName = importConfig.projectName

        // 如果是创建新项目
        if (importConfig.target === 'new') {
          // 检查项目是否已存在
          const exists = await window.electronAPI.checkProjectExists(projectPath)
          if (exists) {
            throw new Error('该目录已存在YoloMarkFlow项目')
          }

          // 创建项目目录
          const createResult = await window.electronAPI.createProjectDirectory(projectPath)
          if (!createResult.success) {
            throw new Error(createResult.error)
          }

          // 创建项目配置
          const config = createProjectConfig({
            name: projectName,
            path: projectPath,
            description: `从${importConfig.type.toUpperCase()}数据集导入`
          })

          // 写入配置文件
          const writeResult = await window.electronAPI.writeProjectConfig(projectPath, config)
          if (!writeResult.success) {
            throw new Error(writeResult.error)
          }

          // 设置为当前项目
          setCurrentProject(config)
          addToRecentProjects(config)
        } else {
          // 使用当前项目
          const currentProject = getCurrentProject()
          projectPath = currentProject.path
          projectName = currentProject.name
        }

        // 创建导入器
        const importer = importConfig.type === 'coco' 
          ? new CocoImporter() 
          : new YoloImporter()

        // 执行导入
        const result = await importer.import({
          datasetPath: importConfig.datasetPath,
          projectPath: projectPath,
          projectName: projectName,
          copyImages: importConfig.copyImages,
          onProgress: (percent, total, message) => {
            importProgress.percent = Math.round(percent)
            importProgress.message = message
          }
        })

        if (result.success) {
          importProgress.status = 'success'
          importProgress.percent = 100
          importProgress.message = '导入完成'
          Object.assign(importStats, result.stats)
          importErrors.value = result.errors || []

          // 触发事件
          if (importConfig.target === 'new') {
            emit('project-created', getCurrentProject())
          }

          // 触发全局项目变化事件
          window.dispatchEvent(new CustomEvent('project-changed'))
        } else {
          importProgress.status = 'exception'
          importProgress.error = result.error
        }
      } catch (error) {
        console.error('导入失败:', error)
        importProgress.status = 'exception'
        importProgress.error = error.message
      } finally {
        importing.value = false
      }
    }

    // 完成导入
    const finishImport = () => {
      importDialogVisible.value = false
      
      // 触发数据导入完成事件
      const importedToNewProject = importConfig.target === 'new'
      
      // 延迟一下，确保对话框关闭
      setTimeout(() => {
        // 触发全局事件，通知需要重新加载数据
        window.dispatchEvent(new CustomEvent('dataset-imported', {
          detail: {
            isNewProject: importedToNewProject
          }
        }))
        
        // 判断当前是否在工作台
        const currentPath = window.location.hash.replace('#', '')
        
        if (currentPath === '/workbench') {
          // 已经在工作台，事件会触发重新加载
          console.log('已在工作台，等待自动重新加载')
        } else {
          // 不在工作台，跳转过去
          console.log('跳转到工作台')
          window.location.hash = '#/workbench'
        }
      }, 100)
    }

    // 重置导入
    const resetImport = () => {
      importStep.value = 0
      resetImportConfig()
    }

    // 显示错误
    const showErrors = () => {
      const errorList = importErrors.value.map(err => 
        `${err.image || err.split || '未知'}: ${err.error}`
      ).join('\n')
      
      ElMessageBox.alert(errorList, '导入错误列表', {
        confirmButtonText: '确定',
        type: 'warning'
      })
    }

    return {
      // Icons
      FolderAdd,
      Folder,
      DataBoard,
      Files,
      
      // 下拉菜单
      handleCommand,
      
      // 新建项目
      newProjectDialogVisible,
      newProjectFormRef,
      newProjectForm,
      newProjectRules,
      creating,
      selectPath,
      autoFillPath,
      handlePathInput,
      createProject,
      
      // 打开项目
      openProjectDialogVisible,
      recentProjects,
      selectProjectFolder,
      openRecentProject,
      openProjectByPath,
      formatTime,

      // 导入数据集
      importDialogVisible,
      importStep,
      importing,
      importConfig,
      datasetValidation,
      importProgress,
      importStats,
      importErrors,
      hasCurrentProject,
      canGoNextStep,
      canStartImport,
      showImportDialog,
      selectDatasetPath,
      validateDataset,
      selectProjectPath,
      nextImportStep,
      startImport,
      finishImport,
      resetImport,
      showErrors
    }
  }
}
</script>

<style scoped>
.open-project-content {
  padding: 20px 0;
}

.select-folder-btn {
  width: 100%;
  height: 60px;
  font-size: 16px;
  margin-bottom: 30px;
}

.recent-projects {
  margin-top: 20px;
}

.recent-title {
  font-size: 14px;
  font-weight: 600;
  color: #333333;
  margin-bottom: 12px;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.recent-item:hover {
  background: #f5f7fa;
  border-color: #409eff;
}

.recent-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.recent-icon {
  font-size: 24px;
  color: #909399;
  flex-shrink: 0;
}

.recent-details {
  flex: 1;
  min-width: 0;
}

.recent-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.recent-path {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-time {
  font-size: 12px;
  color: #c0c4cc;
  flex-shrink: 0;
  margin-left: 16px;
}

/* 导入数据集样式 */
.import-content {
  min-height: 300px;
  padding: 30px 20px;
}

.import-step {
  display: flex;
  justify-content: center;
  align-items: center;
}

.import-type-selector {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.import-type-card {
  width: 200px;
  padding: 32px 24px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.import-type-card:hover {
  border-color: #409eff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
  transform: translateY(-2px);
}

.import-type-card.selected {
  border-color: #409eff;
  background: #f0f7ff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.3);
}

.import-type-card .el-icon {
  color: #409eff;
  margin-bottom: 16px;
}

.import-type-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #303133;
}

.import-type-card p {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

.import-progress {
  width: 100%;
  text-align: center;
}

.progress-message {
  font-size: 14px;
  color: #606266;
  margin-top: 16px;
}

.import-result {
  margin-top: 20px;
}
</style>

