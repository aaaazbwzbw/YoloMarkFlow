// Canvas 标注工具类
import { fabric } from 'fabric'

export class AnnotationCanvas {
  constructor(canvasElement, containerElement, options = {}) {
    this.canvasElement = canvasElement
    this.containerElement = containerElement
    
    this.canvas = new fabric.Canvas(canvasElement, {
      selection: false,
      preserveObjectStacking: true,
      fireRightClick: true, // 允许触发右键事件
      stopContextMenu: true, // 阻止浏览器默认的右键菜单
      ...options
    })
    
    this.currentImage = null // 原始图片对象
    this.imageObject = null // Fabric图片对象
    this.annotations = [] // 标注框数组
    this.isDrawing = false
    this.startPoint = null
    this.currentRect = null
    this.selectedClass = null
    this.classList = []
    this.interactionEnabled = true // 是否允许交互（空格平移时为false）
    
    // 容器尺寸
    this.containerWidth = 0
    this.containerHeight = 0
    
    // 图片显示尺寸和缩放比例
    this.displayWidth = 0
    this.displayHeight = 0
    this.scale = 1
    
    // 虚线尺相关
    this.crosshairLines = null // 虚线尺对象 { horizontal: Line, vertical: Line }
    this.crosshairEnabled = true // 是否启用虚线尺
    this.rafId = null // requestAnimationFrame ID，用于性能优化
    this.lastCrosshairX = -1 // 上次虚线尺的X位置，用于判断是否需要更新
    this.lastCrosshairY = -1 // 上次虚线尺的Y位置，用于判断是否需要更新
    this.crosshairRenderPending = false // 是否有待渲染的虚线尺更新
    // 注意：不再使用时间节流，让 requestAnimationFrame 自动匹配屏幕刷新率（支持60Hz/120Hz等）
    
    this.setupCanvas()
  }
  
  setupCanvas() {
    // 设置画布背景色
    this.canvas.backgroundColor = '#f5f5f5'
    
    // 全局设置：禁用strokeWidth缩放
    fabric.Object.prototype.strokeUniform = true
    
    // 启用高质量渲染
    this.canvas.enableRetinaScaling = true
    
    // 获取底层canvas context并设置高质量插值
    const ctx = this.canvas.getContext()
    if (ctx) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high' // 使用最高质量插值
    }
    
    // 监听鼠标事件用于绘制矩形
    this.canvas.on('mouse:down', this.handleMouseDown.bind(this))
    this.canvas.on('mouse:move', this.handleMouseMove.bind(this))
    this.canvas.on('mouse:up', this.handleMouseUp.bind(this))
    
    // 监听鼠标移动用于更新虚线尺
    this.canvas.on('mouse:move', this.handleCrosshairMove.bind(this))
    this.canvas.on('mouse:out', this.handleCrosshairOut.bind(this))
    
    // 监听右键菜单事件
    this.canvas.on('mouse:down', this.handleRightClick.bind(this))
    
    // 监听对象变换开始
    this.canvas.on('object:moving', this.handleObjectMoving.bind(this))
    this.canvas.on('object:scaling', this.handleObjectScaling.bind(this))
    this.canvas.on('object:modified', this.handleObjectModified.bind(this))
    
    // 监听对象选中和取消选中
    this.canvas.on('selection:created', this.handleSelectionCreated.bind(this))
    this.canvas.on('selection:updated', this.handleSelectionUpdated.bind(this))
    this.canvas.on('selection:cleared', this.handleSelectionCleared.bind(this))
    
    // 在缩放/移动开始时保存初始状态
    this.canvas.on('mouse:down', (event) => {
      if (event.target && event.target !== this.imageObject) {
        const obj = event.target
        obj._initialState = {
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          width: obj.width,
          height: obj.height,
          left: obj.left,
          top: obj.top
        }
      }
    })
  }
  
  // 更新容器尺寸
  updateContainerSize() {
    if (!this.containerElement) return
    
    const rect = this.containerElement.getBoundingClientRect()
    this.containerWidth = rect.width
    this.containerHeight = rect.height
  }
  
  // 计算图片显示尺寸
  calculateImageSize(imgWidth, imgHeight) {
    this.updateContainerSize()
    
    const scaleX = this.containerWidth / imgWidth
    const scaleY = this.containerHeight / imgHeight
    const scale = Math.min(scaleX, scaleY)
    
    return {
      scale: scale,
      displayWidth: imgWidth * scale,
      displayHeight: imgHeight * scale
    }
  }
  
  // 加载图片到画布
  loadImage(imageSrc) {
    return new Promise((resolve, reject) => {
      fabric.Image.fromURL(imageSrc, (img) => {
        if (!img) {
          reject(new Error('Failed to load image'))
          return
        }
        
        // 清除之前的内容
        this.clear()
        
        // 重置缩放比例为1.0
        this.canvas.setZoom(1)
        
        this.currentImage = img
        
        const imgWidth = img.width
        const imgHeight = img.height
        
        // 计算显示尺寸
        const sizeInfo = this.calculateImageSize(imgWidth, imgHeight)
        this.scale = sizeInfo.scale
        this.displayWidth = sizeInfo.displayWidth
        this.displayHeight = sizeInfo.displayHeight
        
        // 设置画布大小为图片显示大小
        this.canvas.setDimensions({
          width: this.displayWidth,
          height: this.displayHeight
        })
        
        // 图片缩放并填充整个画布
        img.scale(this.scale)
        img.set({
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          objectCaching: false // 禁用对象缓存以提高缩放质量
        })
        
        this.imageObject = img
        this.canvas.add(img)
        this.canvas.sendToBack(img)
        this.canvas.renderAll()
        
        resolve({
          width: imgWidth,
          height: imgHeight,
          scale: this.scale,
          displayWidth: this.displayWidth,
          displayHeight: this.displayHeight
        })
      }, { crossOrigin: 'anonymous' })
    })
  }
  
  // 调整画布大小（窗口大小改变时调用）
  resize() {
    if (!this.currentImage) return
    
    const imgWidth = this.currentImage.width
    const imgHeight = this.currentImage.height
    
    // 获取当前的zoom值
    const currentZoom = this.canvas.getZoom()
    
    // 重新计算显示尺寸（基础尺寸，不包含zoom）
    const sizeInfo = this.calculateImageSize(imgWidth, imgHeight)
    const newScale = sizeInfo.scale
    const newDisplayWidth = sizeInfo.displayWidth
    const newDisplayHeight = sizeInfo.displayHeight
    
    // 如果尺寸没有实质性变化，跳过
    if (Math.abs(newDisplayWidth - this.displayWidth) < 1 && 
        Math.abs(newDisplayHeight - this.displayHeight) < 1) {
      return
    }
    
    const scaleRatio = newScale / this.scale
    
    // 更新画布大小（应用当前zoom）
    this.canvas.setDimensions({
      width: newDisplayWidth * currentZoom,
      height: newDisplayHeight * currentZoom
    })
    
    // 缩放图片
    this.imageObject.scale(newScale)
    this.imageObject.set({ left: 0, top: 0 })
    
    // 缩放所有标注框
    this.annotations.forEach(rect => {
      // 先规范化（如果有缩放）
      const currentWidth = rect.width * rect.scaleX
      const currentHeight = rect.height * rect.scaleY
      
      rect.set({
        left: rect.left * scaleRatio,
        top: rect.top * scaleRatio,
        width: currentWidth * scaleRatio,
        height: currentHeight * scaleRatio,
        scaleX: 1,
        scaleY: 1,
        strokeWidth: 2 // 保持线宽不变
      })
      rect.setCoords()
      
      // 更新标签位置
      this.updateLabelPosition(rect)
    })
    
    this.scale = newScale
    this.displayWidth = newDisplayWidth
    this.displayHeight = newDisplayHeight
    
    // 如果虚线尺已创建，更新其尺寸
    if (this.crosshairLines) {
      this.crosshairLines.horizontal.set({
        x2: this.displayWidth
      })
      this.crosshairLines.vertical.set({
        y2: this.displayHeight
      })
    }
    
    this.canvas.renderAll()
  }
  
  // 开始绘制模式
  startDrawing(classInfo) {
    this.isDrawing = true
    this.selectedClass = classInfo
  }
  
  // 停止绘制模式
  stopDrawing() {
    this.isDrawing = false
    this.selectedClass = null
  }
  
  // 设置是否允许交互（用于空格平移时禁用绘制）
  setInteractionEnabled(enabled) {
    this.interactionEnabled = enabled
  }
  
  // 处理右键点击
  handleRightClick(event) {
    if (event.button === 3) { // 右键点击
      const target = event.target
      
      if (target && target !== this.imageObject && target.classId !== undefined) {
        // 选中标注框并触发右键菜单事件
        this.canvas.setActiveObject(target)
        this.canvas.fire('annotation:rightclick', { target, originalEvent: event.e })
      }
    }
  }

  // 鼠标按下
  handleMouseDown(event) {
    if (!this.isDrawing || !this.selectedClass) return
    
    // 如果交互被禁用（比如正在平移画布），不响应
    if (!this.interactionEnabled) return
    
    // 如果点击到了已有的对象，不开始新的绘制
    if (event.target && event.target !== this.imageObject) {
      return
    }
    
    const pointer = this.canvas.getPointer(event.e)
    
    // 限制在画布范围内
    this.startPoint = {
      x: Math.max(0, Math.min(pointer.x, this.displayWidth)),
      y: Math.max(0, Math.min(pointer.y, this.displayHeight))
    }
    
    // 创建临时矩形
    this.currentRect = new fabric.Rect({
      left: this.startPoint.x,
      top: this.startPoint.y,
      width: 0,
      height: 0,
      fill: 'transparent',
      stroke: this.selectedClass.color || '#ff0000',
      strokeWidth: 2,
      strokeUniform: true, // 禁用strokeWidth随缩放变化
      selectable: false,
      evented: false
    })
    
    this.canvas.add(this.currentRect)
  }
  
  // 鼠标移动
  handleMouseMove(event) {
    if (!this.isDrawing || !this.currentRect || !this.startPoint) return
    
    const pointer = this.canvas.getPointer(event.e)
    
    // 限制在画布范围内
    const x = Math.max(0, Math.min(pointer.x, this.displayWidth))
    const y = Math.max(0, Math.min(pointer.y, this.displayHeight))
    
    const width = x - this.startPoint.x
    const height = y - this.startPoint.y
    
    if (width < 0) {
      this.currentRect.set({ left: x, width: Math.abs(width) })
    } else {
      this.currentRect.set({ width: Math.abs(width) })
    }
    
    if (height < 0) {
      this.currentRect.set({ top: y, height: Math.abs(height) })
    } else {
      this.currentRect.set({ height: Math.abs(height) })
    }
    
    // 如果虚线尺有待渲染的更新，一起渲染（避免双重渲染）
    // 在绘制时，虚线尺的更新会和绘制矩形一起渲染，减少渲染次数
    if (this.crosshairRenderPending) {
      this.crosshairRenderPending = false
    }
    
    // 渲染画布（绘制时不需要节流，需要实时响应）
    this.canvas.renderAll()
  }
  
  // 创建虚线尺
  createCrosshairLines() {
    if (this.crosshairLines) {
      return // 已创建，不重复创建
    }
    
    // 确保 displayWidth 和 displayHeight 已初始化
    const width = this.displayWidth || this.canvas.width || 1000
    const height = this.displayHeight || this.canvas.height || 1000
    
    const lineStyle = {
      stroke: '#ffffff', // 白色
      strokeWidth: 1,
      strokeDashArray: [5, 5], // 虚线样式
      selectable: false,
      evented: false, // 不响应事件
      excludeFromExport: true, // 导出时不包含
      strokeUniform: true, // 禁用strokeWidth随缩放变化
      visible: true, // 初始可见
      objectCaching: false // 禁用缓存，确保实时渲染
    }
    
    // 创建水平线 [x1, y1, x2, y2]
    const horizontalLine = new fabric.Line([0, 0, width, 0], lineStyle)
    
    // 创建垂直线 [x1, y1, x2, y2]
    const verticalLine = new fabric.Line([0, 0, 0, height], lineStyle)
    
    // 设置层级，确保在所有对象之上
    horizontalLine.moveTo = function() {
      this.bringToFront()
    }
    verticalLine.moveTo = function() {
      this.bringToFront()
    }
    
    this.crosshairLines = {
      horizontal: horizontalLine,
      vertical: verticalLine
    }
    
    // 添加到画布
    this.canvas.add(horizontalLine)
    this.canvas.add(verticalLine)
    
    // 确保在最上层
    horizontalLine.bringToFront()
    verticalLine.bringToFront()
  }
  
  // 更新虚线尺位置（优化性能版本）
  updateCrosshair(event) {
    if (!this.crosshairEnabled || !this.imageObject) {
      return
    }
    
    // 如果还未创建虚线尺，先创建
    if (!this.crosshairLines) {
      this.createCrosshairLines()
    }
    
    // 确保 displayWidth 和 displayHeight 有效
    if (!this.displayWidth || !this.displayHeight) {
      return
    }
    
    // 使用 requestAnimationFrame 优化性能
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
    }
    
    this.rafId = requestAnimationFrame(() => {
      const pointer = this.canvas.getPointer(event.e)
      
      // 限制在图片显示区域内
      const x = Math.max(0, Math.min(pointer.x, this.displayWidth))
      const y = Math.max(0, Math.min(pointer.y, this.displayHeight))
      
      // 检查位置是否真的改变了（避免不必要的更新）
      // 首次显示时（lastCrosshairX/Y 为 -1），需要强制更新
      const isFirstUpdate = this.lastCrosshairX === -1 || this.lastCrosshairY === -1
      const xChanged = isFirstUpdate || Math.abs(x - this.lastCrosshairX) > 0.5
      const yChanged = isFirstUpdate || Math.abs(y - this.lastCrosshairY) > 0.5
      
      if (!xChanged && !yChanged && !isFirstUpdate) {
        // 位置没有变化，不需要更新
        this.rafId = null
        return
      }
      
      // 更新位置记录
      this.lastCrosshairX = x
      this.lastCrosshairY = y
      
      // 确保虚线尺可见
      if (!this.crosshairLines.horizontal.visible) {
        this.crosshairLines.horizontal.set({ visible: true })
        this.crosshairLines.vertical.set({ visible: true })
        this.crosshairLines.horizontal.bringToFront()
        this.crosshairLines.vertical.bringToFront()
      }
      
      // 更新水平线位置
      if (yChanged || isFirstUpdate) {
        // 直接更新 Line 的坐标（Fabric.js Line 使用 x1, y1, x2, y2）
        this.crosshairLines.horizontal.set({
          x1: 0,
          y1: y,
          x2: this.displayWidth,
          y2: y
        })
        // 更新边界框
        this.crosshairLines.horizontal.setCoords()
      }
      
      // 更新垂直线位置
      if (xChanged || isFirstUpdate) {
        // 直接更新 Line 的坐标（Fabric.js Line 使用 x1, y1, x2, y2）
        this.crosshairLines.vertical.set({
          x1: x,
          y1: 0,
          x2: x,
          y2: this.displayHeight
        })
        // 更新边界框
        this.crosshairLines.vertical.setCoords()
      }
      
      // 标记有待渲染的更新
      this.crosshairRenderPending = true
      
      // 如果不在绘制状态，每次都渲染（避免拖影）
      // 如果在绘制状态，延迟渲染，等待 handleMouseMove 的 renderAll 一起渲染
      if (!this.isDrawing || !this.currentRect) {
        // 每次位置变化时都立即渲染，确保清除旧线条，避免拖影
        // requestAnimationFrame 会自动匹配屏幕刷新率（60Hz/120Hz等），无需手动节流
        this.canvas.renderAll()
        this.crosshairRenderPending = false
      } else {
        // 在绘制状态下，标记需要渲染，但由 handleMouseMove 统一处理
        // 这样可以避免在绘制时出现拖影
      }
      
      this.rafId = null
    })
  }
  
  // 隐藏虚线尺
  hideCrosshair() {
    if (this.crosshairLines) {
      this.crosshairLines.horizontal.set({ visible: false })
      this.crosshairLines.vertical.set({ visible: false })
      this.lastCrosshairX = -1
      this.lastCrosshairY = -1
      this.crosshairRenderPending = false
      this.canvas.renderAll()
    }
  }
  
  // 处理鼠标移动（虚线尺）
  handleCrosshairMove(event) {
    if (!this.imageObject) {
      return
    }
    
    // 无论是否在绘制，都显示虚线尺
    this.updateCrosshair(event)
  }
  
  // 处理鼠标离开画布（隐藏虚线尺）
  handleCrosshairOut(event) {
    this.hideCrosshair()
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
  
  // 销毁虚线尺
  destroyCrosshairLines() {
    if (this.crosshairLines) {
      this.canvas.remove(this.crosshairLines.horizontal)
      this.canvas.remove(this.crosshairLines.vertical)
      this.crosshairLines = null
    }
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
  
  // 鼠标释放
  handleMouseUp(event) {
    if (!this.currentRect) return
    
    const width = this.currentRect.width
    const height = this.currentRect.height
    
    // 如果框太小，删除
    if (width < 5 || height < 5) {
      this.canvas.remove(this.currentRect)
      this.currentRect = null
      this.startPoint = null
      return
    }
    
    // 保存当前矩形的引用
    const newRect = this.currentRect
    
    // 立即清理绘制状态，防止继续绘制
    this.currentRect = null
    this.startPoint = null
    
    // 转换为正式的标注框
    newRect.set({
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockScalingX: false,
      lockScalingY: false,
      lockMovementX: false,
      lockMovementY: false,
      classId: this.selectedClass.id,
      className: this.selectedClass.name,
      strokeWidth: 2,
      strokeUniform: true,
      scaleX: 1,
      scaleY: 1
    })
    
    // 保存原始边框样式（用于选中/取消选中逻辑）
    newRect._originalStroke = this.selectedClass.color
    newRect._originalStrokeWidth = 2
    
    this.setupRectControls(newRect)
    this.annotations.push(newRect)
    
    // 确保矩形坐标已更新
    newRect.setCoords()
    
    // 存储归一化坐标
    this.storeNormalizedCoords(newRect)
    
    // 创建类别标签（只创建一次）
    if (this.selectedClass.name && !newRect._label) {
      const label = new fabric.Text(this.selectedClass.name, {
        fontSize: 18,
        fill: '#FFFFFF',
        backgroundColor: this.selectedClass.color,
        padding: 4,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        hoverCursor: 'default',
        originX: 'center',
        originY: 'top'
      })
      
      newRect._label = label
      this.canvas.add(label)
      this.updateLabelPosition(newRect)
      
      // 确保矩形在标签上方，避免标签遮挡控制点
      this.canvas.bringToFront(newRect)
    }
    
    // 优化标注框层级：小标注框显示在大标注框上方
    this.optimizeAnnotationLayers()
    
    // 立即选中新创建的标注框
    this.canvas.setActiveObject(newRect)
    
    this.canvas.renderAll()
  }
  
  // 优化标注框层级：小标注框显示在大标注框上方
  optimizeAnnotationLayers() {
    if (this.annotations.length <= 1) return
    
    // 保存当前选中的对象
    const activeObject = this.canvas.getActiveObject()
    
    // 按面积从小到大排序（小标注框在前）
    const sortedAnnotations = [...this.annotations].sort((a, b) => {
      const areaA = this.getObjectArea(a)
      const areaB = this.getObjectArea(b)
      return areaA - areaB
    })
    
    // 使用bringToFront方法设置层级：小对象移动到最前面
    // 先处理大对象，再处理小对象，这样小对象就会在最前面
    for (let i = sortedAnnotations.length - 1; i >= 0; i--) {
      const annotation = sortedAnnotations[i]
      
      // 先移动标签（如果有的话），再移动标注框
      // 这样标注框就会在标签上方，不会遮挡控制点
      if (annotation._label) {
        this.canvas.bringToFront(annotation._label)
      }
      this.canvas.bringToFront(annotation)
    }
    
    // 恢复选中状态（这会触发selection事件，自动处理边框隐藏）
    if (activeObject) {
      this.canvas.setActiveObject(activeObject)
    }
    
    this.canvas.renderAll()
  }
  
  // 计算对象的面积
  getObjectArea(obj) {
    const bounds = obj.getBoundingRect()
    return bounds.width * bounds.height
  }

  // 设置矩形控制点（启用全部8个控制点）
  setupRectControls(rect) {
    rect.setControlsVisibility({
      mt: true,  // 中上
      mb: true,  // 中下
      ml: true,  // 中左
      mr: true,  // 中右
      tl: true,  // 左上
      tr: true,  // 右上
      bl: true,  // 左下
      br: true,  // 右下
      mtr: false // 旋转（禁用）
    })
    
    // 控制点样式 - 让控制点更明显
    rect.set({
      cornerSize: 12,              // 控制点大小
      cornerColor: '#2196F3',      // 控制点填充颜色（蓝色）
      cornerStrokeColor: '#FFFFFF', // 控制点边框颜色（白色）
      cornerStyle: 'circle',       // 控制点形状（圆形）
      transparentCorners: false,   // 控制点不透明
      borderColor: '#2196F3',      // 边框颜色
      borderScaleFactor: 2,        // 边框粗细
      lockRotation: true,          // 锁定旋转
      lockScalingFlip: true,       // 禁止翻转
      strokeUniform: true          // 禁用strokeWidth随缩放变化
    })
  }
  
  // 创建标注矩形
  createAnnotationRect(options) {
    const rect = new fabric.Rect({
      left: options.left || 0,
      top: options.top || 0,
      width: options.width || 100,
      height: options.height || 100,
      fill: 'transparent',
      stroke: options.color || '#ff0000',
      strokeWidth: 2,
      strokeUniform: true,
      strokeDashArray: options.strokeDashArray || null, // 支持虚线边框
      scaleX: 1,
      scaleY: 1,
      // 直接创建为可交互状态（与手动创建时在 handleMouseUp 中 set 的属性一致）
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockScalingX: false,
      lockScalingY: false,
      lockMovementX: false,
      lockMovementY: false,
      classId: options.classId,
      className: options.className
    })
    
    // 标记是否为模型推理的标注框
    if (options.isModelPrediction) {
      rect.isModelPrediction = true
      rect.confidence = options.confidence || 0
    }
    
    // 保存原始边框样式（用于选中/取消选中逻辑）
    rect._originalStroke = options.color || '#ff0000'
    rect._originalStrokeWidth = 2
    
    // 注意：不在这里调用setupRectControls，而是在添加到画布后调用
    
    // 如果提供了归一化坐标，直接存储
    if (options.normalized) {
      rect._normalized = options.normalized
    } else {
      // 否则从当前像素坐标计算
      this.storeNormalizedCoords(rect)
    }
    
    // 创建类别标签（独立的Text对象）
    if (options.className) {
      // 如果是模型推理且有置信度，显示"className confidence%"
      let labelText = options.className
      if (options.isModelPrediction && options.confidence !== undefined) {
        labelText = `${options.className} ${(options.confidence * 100).toFixed(1)}%`
      }
      
      const label = new fabric.Text(labelText, {
        fontSize: 18,
        fill: '#FFFFFF',
        backgroundColor: options.color || '#ff0000',
        padding: 4,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        hoverCursor: 'default',
        originX: 'center',
        originY: 'top'
      })
      
      // 绑定标签到矩形
      rect._label = label
      // 暂不添加到画布，由调用者添加以确保正确的层级
    }
    
    return rect
  }
  
  // 存储归一化坐标
  storeNormalizedCoords(rect) {
    if (!this.currentImage) return
    
    const bounds = rect.getBoundingRect()
    const currentZoom = this.canvas.getZoom()
    
    // 转换为原始图片像素坐标（需要先除以 zoom，再除以 scale）
    const imgX = bounds.left / currentZoom / this.scale
    const imgY = bounds.top / currentZoom / this.scale
    const imgWidth = bounds.width / currentZoom / this.scale
    const imgHeight = bounds.height / currentZoom / this.scale
    
    // 归一化坐标（0-1）
    rect._normalized = {
      x: imgX / this.currentImage.width,
      y: imgY / this.currentImage.height,
      width: imgWidth / this.currentImage.width,
      height: imgHeight / this.currentImage.height
    }
  }
  
  // 更新标签位置（直接使用标注框的实际显示位置）
  updateLabelPosition(rect) {
    if (!rect._label) return
    
    const zoom = this.canvas.getZoom()
    
    // 获取标注框的实际边界框（包含所有变换）
    const bounds = rect.getBoundingRect(true, true)
    
    // 计算标注框底部中心点
    const centerX = bounds.left + bounds.width / 2
    const bottomY = bounds.top + bounds.height
    
    // 标签位置：底部中心点向下偏移
    const labelLeft = centerX
    const labelTop = bottomY + 4 / zoom
    
    // 确保标签位置在画布范围内
    const canvasWidth = this.canvas.getWidth()
    const canvasHeight = this.canvas.getHeight()
    
    // 如果标签会超出画布边界，调整位置
    let finalLabelLeft = labelLeft
    let finalLabelTop = labelTop
    
    // 获取标签的尺寸（考虑缩放）
    const labelBounds = rect._label.getBoundingRect()
    const labelWidth = labelBounds.width * (1 / zoom)
    const labelHeight = labelBounds.height * (1 / zoom)
    
    // 水平边界检查
    if (finalLabelLeft - labelWidth / 2 < 0) {
      finalLabelLeft = labelWidth / 2
    } else if (finalLabelLeft + labelWidth / 2 > canvasWidth) {
      finalLabelLeft = canvasWidth - labelWidth / 2
    }
    
    // 垂直边界检查
    if (finalLabelTop + labelHeight > canvasHeight) {
      // 如果标签会超出底部，放在标注框上方
      finalLabelTop = bounds.top - 4 / zoom
    }
    
    rect._label.set({
      left: finalLabelLeft,
      top: finalLabelTop,
      scaleX: 1 / zoom, // 反向缩放，保持标签大小不变
      scaleY: 1 / zoom
    })
    rect._label.setCoords()
  }
  
  // 更新所有标签位置
  updateAllLabels() {
    this.annotations.forEach(rect => {
      this.updateLabelPosition(rect)
    })
  }
  
  // 限制对象移动在画布范围内（墙壁式限制）
  handleObjectMoving(event) {
    const obj = event.target
    if (!obj || obj === this.imageObject) return
    
    // 立即更新坐标
    obj.setCoords()
    
    const bound = obj.getBoundingRect(true, true) // 使用绝对坐标，包含所有变换
    
    // 计算修正值
    let correctionX = 0
    let correctionY = 0
    
    // 左边界
    if (bound.left < 0) {
      correctionX = -bound.left
    }
    // 右边界
    else if (bound.left + bound.width > this.displayWidth) {
      correctionX = this.displayWidth - (bound.left + bound.width)
    }
    
    // 上边界
    if (bound.top < 0) {
      correctionY = -bound.top
    }
    // 下边界
    else if (bound.top + bound.height > this.displayHeight) {
      correctionY = this.displayHeight - (bound.top + bound.height)
    }
    
    // 应用修正
    if (correctionX !== 0 || correctionY !== 0) {
      obj.left += correctionX
      obj.top += correctionY
      obj.setCoords()
    }
    
    // 在位置修正后再更新标签位置，确保标签跟随修正后的位置
    this.updateLabelPosition(obj)
  }
  
  // 限制对象缩放在画布范围内
  handleObjectScaling(event) {
    const obj = event.target
    if (!obj || obj === this.imageObject) return
    
    // 如果没有保存的初始状态，先保存
    if (!obj._initialState) {
      obj._initialState = {
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        width: obj.width,
        height: obj.height,
        left: obj.left,
        top: obj.top
      }
    }
    
    // 强制更新坐标
    obj.setCoords()
    
    const objBounds = obj.getBoundingRect(true)
    
    // 严格检查边界
    const isOutOfBounds = 
      objBounds.left < 0 || 
      objBounds.top < 0 ||
      objBounds.left + objBounds.width > this.displayWidth ||
      objBounds.top + objBounds.height > this.displayHeight
    
    if (isOutOfBounds) {
      // 恢复到上一个有效状态
      obj.set({
        scaleX: obj._initialState.scaleX,
        scaleY: obj._initialState.scaleY,
        width: obj._initialState.width,
        height: obj._initialState.height,
        left: obj._initialState.left,
        top: obj._initialState.top,
        stroke: 'transparent',  // 保持边框透明
        strokeWidth: 0
      })
      obj.setCoords()
    } else {
      // 更新有效状态
      obj._initialState = {
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        width: obj.width,
        height: obj.height,
        left: obj.left,
        top: obj.top
      }
    }
    
    // 在边界检查和处理后再更新标签位置，确保标签跟随最终的有效位置
    this.updateLabelPosition(obj)
  }
  
  // 对象修改完成 - 规范化矩形（将scale应用到width/height）
  handleObjectModified(event) {
    const obj = event.target
    if (!obj || obj === this.imageObject) return
    
    // 规范化：将缩放因子应用到宽高，然后重置缩放为1
    if (obj.scaleX !== 1 || obj.scaleY !== 1) {
      const newWidth = obj.width * obj.scaleX
      const newHeight = obj.height * obj.scaleY
      
      obj.set({
        width: newWidth,
        height: newHeight,
        scaleX: 1,
        scaleY: 1
      })
      obj.setCoords()
      this.canvas.renderAll()
    }
    
    // 更新归一化坐标（在移动/缩放后）
    this.storeNormalizedCoords(obj)
    
    // 更新标签位置
    this.updateLabelPosition(obj)
    
    // 重新优化标注框层级（因为对象大小可能已改变）
    this.optimizeAnnotationLayers()
    
    // 清理临时状态
    if (obj._initialState) {
      delete obj._initialState
    }
  }
  
  // 对象被选中
  handleSelectionCreated(event) {
    const obj = event.selected[0]
    if (obj && obj !== this.imageObject) {
      // 保存原始stroke（如果还没保存过）
      if (!obj._originalStroke) {
        obj._originalStroke = obj.stroke
        obj._originalStrokeWidth = obj.strokeWidth
      }
      obj.set({
        stroke: 'transparent',  // 隐藏原始边框
        strokeWidth: 0
      })
      
      // 强制刷新控制点（特别是对自动加载的标注框）
      if (obj.__fromDatabase) {
        // 创建一个全新的矩形对象来替换现有对象
        const newRect = new fabric.Rect({
          left: obj.left,
          top: obj.top,
          width: obj.width,
          height: obj.height,
          fill: obj.fill,
          stroke: obj._originalStroke || obj.stroke,
          strokeWidth: obj._originalStrokeWidth || obj.strokeWidth,
          strokeUniform: true,
          scaleX: 1,
          scaleY: 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockMovementX: false,
          lockMovementY: false,
          classId: obj.classId,
          className: obj.className
        })
        
        // 复制原始边框样式
        newRect._originalStroke = obj._originalStroke
        newRect._originalStrokeWidth = obj._originalStrokeWidth
        
        // 复制标签
        if (obj._label) {
          newRect._label = obj._label
        }
        
        // 复制归一化坐标
        if (obj._normalized) {
          newRect._normalized = obj._normalized
        }
        
        // 设置控制点
        this.setupRectControls(newRect)
        newRect.setCoords()
        
        // 从画布中移除旧对象
        this.canvas.remove(obj)
        
        // 添加新对象
        this.canvas.add(newRect)
        
        // 确保新对象在标签上方
        if (newRect._label) {
          this.canvas.bringToFront(newRect)
        }
        
        // 更新annotations数组中的引用
        const index = this.annotations.indexOf(obj)
        if (index > -1) {
          this.annotations[index] = newRect
        }
        
        // 渲染画布
        this.canvas.renderAll()
        
        // 延迟选中新对象
        setTimeout(() => {
          this.canvas.setActiveObject(newRect)
          this.canvas.renderAll()
        }, 10)
        
        // 提前返回，不继续处理旧对象
        return
      }
      
      // 关键：更新坐标，确保控制点位置正确（只调用一次）
      obj.setCoords()
      
      // 保持标签显示
      if (obj._label) {
        obj._label.set({ visible: true })
      }
      
      this.canvas.renderAll()
    }
  }
  
  // 选中对象切换
  handleSelectionUpdated(event) {
    // 恢复之前选中对象的边框和标签
    if (event.deselected && event.deselected[0]) {
      const oldObj = event.deselected[0]
      if (oldObj !== this.imageObject && oldObj._originalStroke) {
        oldObj.set({
          stroke: oldObj._originalStroke,
          strokeWidth: oldObj._originalStrokeWidth || 2
        })
        // 显示标签
        if (oldObj._label) {
          oldObj._label.set({ visible: true })
        }
      }
    }
    
    // 隐藏新选中对象的边框和标签
    if (event.selected && event.selected[0]) {
      const newObj = event.selected[0]
      if (newObj !== this.imageObject) {
        // 只在第一次选中时保存原始stroke
        if (!newObj._originalStroke) {
          newObj._originalStroke = newObj.stroke
          newObj._originalStrokeWidth = newObj.strokeWidth
        }
        newObj.set({
          stroke: 'transparent',
          strokeWidth: 0
        })
        // 保持标签显示
        if (newObj._label) {
          newObj._label.set({ visible: true })
        }
      }
    }
    
    this.canvas.renderAll()
  }
  
  // 取消选中
  handleSelectionCleared(event) {
    if (event.deselected && event.deselected[0]) {
      const obj = event.deselected[0]
      if (obj !== this.imageObject) {
        // 恢复原始边框
        obj.set({
          stroke: obj._originalStroke || obj.stroke,
          strokeWidth: obj._originalStrokeWidth || 2
        })
        // 显示标签
        if (obj._label) {
          obj._label.set({ visible: true })
        }
        // 强制重新渲染
        obj.dirty = true
        this.canvas.renderAll()
      }
    }
  }
  
  // 获取所有标注数据（归一化坐标 0-1）
  getAnnotations(includeModelPredictions = false) {
    if (!this.currentImage) return []
    
    const imgWidth = this.currentImage.width
    const imgHeight = this.currentImage.height
    const currentZoom = this.canvas.getZoom()
    
    // 过滤标注框：默认不包含模型推理的标注框
    const annotationsToExport = includeModelPredictions 
      ? this.annotations 
      : this.annotations.filter(rect => !rect.isModelPrediction)
    
    return annotationsToExport.map(rect => {
      const bounds = rect.getBoundingRect()
      
      // bounds 受 zoom 影响，需要先除以 zoom，再除以 scale 转换为原始图片坐标
      const x = bounds.left / currentZoom / this.scale
      const y = bounds.top / currentZoom / this.scale
      const width = bounds.width / currentZoom / this.scale
      const height = bounds.height / currentZoom / this.scale
      
      // 归一化为 0-1 范围，并转换为中心点坐标
      const normalizedWidth = width / imgWidth
      const normalizedHeight = height / imgHeight
      const normalizedX = x / imgWidth
      const normalizedY = y / imgHeight
      
      return {
        classId: rect.classId,
        className: rect.className,
        position: {
          centerX: normalizedX + normalizedWidth / 2,
          centerY: normalizedY + normalizedHeight / 2,
          width: normalizedWidth,
          height: normalizedHeight
        }
      }
    })
  }
  
  // 加载标注数据（从归一化坐标）
  loadAnnotations(annotations, classList) {
    if (!this.currentImage) return
    
    // 清除现有标注和标签
    this.annotations.forEach(ann => {
      if (ann._label) {
        this.canvas.remove(ann._label)
      }
      this.canvas.remove(ann)
    })
    this.annotations = []
    
    const imgWidth = this.currentImage.width
    const imgHeight = this.currentImage.height
    
    // 创建标注矩形
    annotations.forEach(ann => {
      // 跳过负样本数据（position 为 null 的不需要显示）
      if (!ann.position) return
      
      const classInfo = classList.find(c => c.name === ann.className || c.id === ann.classId)
      if (!classInfo) return
      
      // 🔧 提取纯值，避免Vue响应式污染
      const pureClassId = classInfo.id || ann.classId
      const pureClassName = String(classInfo.name)
      const pureColor = String(classInfo.color)
      
      // 从归一化中心点坐标转换为原始图片像素坐标
      const width = ann.position.width * imgWidth
      const height = ann.position.height * imgHeight
      const x = (ann.position.centerX - ann.position.width / 2) * imgWidth
      const y = (ann.position.centerY - ann.position.height / 2) * imgHeight
      
      // 转换为画布坐标
      const left = x * this.scale
      const top = y * this.scale
      
      const rect = this.createAnnotationRect({
        left: left,
        top: top,
        width: width * this.scale,
        height: height * this.scale,
        classId: pureClassId,
        className: pureClassName,
        color: pureColor,
        // 直接传递归一化坐标
        normalized: {
          x: ann.x,
          y: ann.y,
          width: ann.width,
          height: ann.height
        }
      })
      
      // 标记为来自数据库（用于后续的特殊处理）
      rect.__fromDatabase = true
      
      // 先添加矩形到画布（与手动创建保持一致：先添加再设置控制点）
      this.canvas.add(rect)
      
      // 强制渲染一次，确保对象完全初始化
      this.canvas.renderAll()
      
      // 然后设置控制点样式（与手动创建完全一致的流程）
      this.setupRectControls(rect)
      this.annotations.push(rect)
      
      // 更新坐标（确保在 setupRectControls 之后）
      rect.setCoords()
      
      // 创建并添加标签（如果有）
      if (rect._label) {
        // 确保标签完全不响应任何事件
        rect._label.set({
          evented: false,
          selectable: false,
          hasControls: false,
          hasBorders: false,
          hoverCursor: 'default',
          moveCursor: 'default'
        })
        this.canvas.add(rect._label)
        this.updateLabelPosition(rect)
        
        // 确保矩形在标签上方，避免标签遮挡控制点
        this.canvas.bringToFront(rect)
      }
    })
    
    // 优化标注框层级：小标注框显示在大标注框上方
    this.optimizeAnnotationLayers()
    
    this.canvas.renderAll()
  }
  
  // 加载模型推理的标注（虚线边框，显示置信度）
  loadModelAnnotations(predictions, classList) {
    if (!this.currentImage) return
    
    const imgWidth = this.currentImage.width
    const imgHeight = this.currentImage.height
    
    // 为每个预测结果创建标注矩形
    predictions.forEach(pred => {
      const classInfo = classList.find(c => c.name === pred.className || c.id === pred.classId)
      if (!classInfo) return
      
      // 🔧 提取纯值，避免Vue响应式污染Fabric.js对象
      const pureClassId = classInfo.id || pred.classId
      const pureClassName = String(classInfo.name)
      const pureColor = String(classInfo.color)
      const pureConfidence = Number(pred.confidence)
      
      // 从归一化中心点坐标转换为原始图片像素坐标
      const width = pred.position.width * imgWidth
      const height = pred.position.height * imgHeight
      const x = (pred.position.centerX - pred.position.width / 2) * imgWidth
      const y = (pred.position.centerY - pred.position.height / 2) * imgHeight
      
      // 转换为画布坐标
      const left = x * this.scale
      const top = y * this.scale
      
      const rect = this.createAnnotationRect({
        left: left,
        top: top,
        width: width * this.scale,
        height: height * this.scale,
        classId: pureClassId,
        className: pureClassName,
        color: pureColor,
        strokeDashArray: [5, 5], // 虚线边框
        isModelPrediction: true,
        confidence: pureConfidence,
        normalized: {
          x: pred.x,
          y: pred.y,
          width: pred.width,
          height: pred.height
        }
      })
      
      // 标记为模型推理（用于后续的特殊处理）
      rect.__fromModel = true
      
      // 先添加矩形到画布
      this.canvas.add(rect)
      this.canvas.renderAll()
      
      // 设置控制点样式
      this.setupRectControls(rect)
      this.annotations.push(rect)
      
      // 更新坐标
      rect.setCoords()
      
      // 创建并添加标签
      if (rect._label) {
        rect._label.set({
          evented: false,
          selectable: false,
          hasControls: false,
          hasBorders: false,
          hoverCursor: 'default',
          moveCursor: 'default'
        })
        this.canvas.add(rect._label)
        this.updateLabelPosition(rect)
        
        // 确保矩形在标签上方
        this.canvas.bringToFront(rect)
      }
    })
    
    // 优化标注框层级
    this.optimizeAnnotationLayers()
    
    this.canvas.renderAll()
  }
  
  // 清除模型推理的标注框
  clearModelAnnotations() {
    const modelAnnotations = this.annotations.filter(ann => ann.isModelPrediction)
    modelAnnotations.forEach(ann => {
      if (ann._label) {
        this.canvas.remove(ann._label)
      }
      this.canvas.remove(ann)
    })
    this.annotations = this.annotations.filter(ann => !ann.isModelPrediction)
    this.canvas.renderAll()
  }
  
  // 清除画布
  clear() {
    // 销毁虚线尺
    this.destroyCrosshairLines()
    
    this.canvas.clear()
    this.annotations = []
    this.currentImage = null
    this.imageObject = null
    this.currentRect = null
    this.startPoint = null
  }
  
  // 删除指定标注框
  deleteAnnotation(annotation) {
    // 从画布中移除
    this.canvas.remove(annotation)
    
    // 如果有标签，也移除
    if (annotation._label) {
      this.canvas.remove(annotation._label)
    }
    
    // 从标注数组中移除
    const index = this.annotations.indexOf(annotation)
    if (index > -1) {
      this.annotations.splice(index, 1)
    }
    
    // 如果当前选中的是这个标注框，清除选中
    if (this.canvas.getActiveObject() === annotation) {
      this.canvas.discardActiveObject()
    }
    
    this.canvas.renderAll()
  }

  // 清除所有标注
  clearAnnotations() {
    this.annotations.forEach(ann => {
      // 同时移除标签
      if (ann._label) {
        this.canvas.remove(ann._label)
      }
      this.canvas.remove(ann)
    })
    this.annotations = []
    this.canvas.renderAll()
  }
  
  // 这些缩放方法已废弃，由Workbench.vue通过CSS transform实现
  
  // 销毁画布
  destroy() {
    // 销毁虚线尺
    this.destroyCrosshairLines()
    
    if (this.canvas) {
      this.canvas.dispose()
      this.canvas = null
    }
  }
}
