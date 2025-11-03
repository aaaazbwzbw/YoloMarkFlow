// 标注相关工具函数

/**
 * 将像素坐标转换为YOLO格式 (x_center, y_center, width, height)
 * @param {Object} rect - 矩形框 {x, y, width, height}
 * @param {number} imgWidth - 图片宽度
 * @param {number} imgHeight - 图片高度
 * @returns {Object} YOLO格式坐标
 */
export function pixelToYolo(rect, imgWidth, imgHeight) {
  const x_center = (rect.x + rect.width / 2) / imgWidth
  const y_center = (rect.y + rect.height / 2) / imgHeight
  const width = rect.width / imgWidth
  const height = rect.height / imgHeight
  
  return {
    x_center: Math.max(0, Math.min(1, x_center)),
    y_center: Math.max(0, Math.min(1, y_center)),
    width: Math.max(0, Math.min(1, width)),
    height: Math.max(0, Math.min(1, height))
  }
}

/**
 * 将YOLO格式转换为像素坐标
 * @param {Object} yolo - YOLO格式 {x_center, y_center, width, height}
 * @param {number} imgWidth - 图片宽度
 * @param {number} imgHeight - 图片高度
 * @returns {Object} 像素坐标 {x, y, width, height}
 */
export function yoloToPixel(yolo, imgWidth, imgHeight) {
  const width = yolo.width * imgWidth
  const height = yolo.height * imgHeight
  const x = yolo.x_center * imgWidth - width / 2
  const y = yolo.y_center * imgHeight - height / 2
  
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  }
}

/**
 * 生成YOLO格式的标注文本
 * @param {Array} annotations - 标注数组
 * @returns {string} YOLO格式文本
 */
export function generateYoloText(annotations) {
  return annotations.map(ann => {
    return `${ann.classId} ${ann.x_center} ${ann.y_center} ${ann.width} ${ann.height}`
  }).join('\n')
}

/**
 * 解析YOLO格式的标注文本
 * @param {string} text - YOLO格式文本
 * @returns {Array} 标注数组
 */
export function parseYoloText(text) {
  const lines = text.trim().split('\n')
  return lines.map(line => {
    const parts = line.trim().split(/\s+/)
    if (parts.length !== 5) return null
    
    return {
      classId: parseInt(parts[0]),
      x_center: parseFloat(parts[1]),
      y_center: parseFloat(parts[2]),
      width: parseFloat(parts[3]),
      height: parseFloat(parts[4])
    }
  }).filter(Boolean)
}

/**
 * 检查两个矩形框是否重叠
 * @param {Object} rect1 - 矩形框1
 * @param {Object} rect2 - 矩形框2
 * @returns {boolean} 是否重叠
 */
export function isRectOverlap(rect1, rect2) {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  )
}

/**
 * 计算两个矩形框的IOU
 * @param {Object} rect1 - 矩形框1
 * @param {Object} rect2 - 矩形框2
 * @returns {number} IOU值
 */
export function calculateIOU(rect1, rect2) {
  const x1 = Math.max(rect1.x, rect2.x)
  const y1 = Math.max(rect1.y, rect2.y)
  const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width)
  const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height)
  
  if (x2 < x1 || y2 < y1) return 0
  
  const intersectionArea = (x2 - x1) * (y2 - y1)
  const rect1Area = rect1.width * rect1.height
  const rect2Area = rect2.width * rect2.height
  const unionArea = rect1Area + rect2Area - intersectionArea
  
  return intersectionArea / unionArea
}

export default {
  pixelToYolo,
  yoloToPixel,
  generateYoloText,
  parseYoloText,
  isRectOverlap,
  calculateIOU
}

