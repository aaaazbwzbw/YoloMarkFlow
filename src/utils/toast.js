import { createApp } from 'vue'
import Toast from '../components/Toast.vue'

// 存储所有活动的Toast实例
const activeToasts = []
let toastIdCounter = 0

/**
 * 更新所有Toast的位置
 */
function updateToastPositions() {
  activeToasts.forEach((toast, index) => {
    if (toast.element) {
      const bottomPosition = 20 + (index * 92)
      toast.element.style.bottom = `${bottomPosition}px`
    }
  })
}

/**
 * 显示Toast消息
 * @param {Object} options 配置选项
 * @param {String} options.message 消息内容
 * @param {String} options.type 类型: success, error, warning, info
 * @param {Number} options.duration 持续时间（毫秒），0表示不自动关闭
 * @param {Boolean} options.closable 是否显示关闭按钮
 * @param {Boolean} options.hideIcon 是否隐藏图标
 */
function showToast(options = {}) {
  const defaultOptions = {
    message: '',
    type: 'info',
    duration: 3000,
    closable: false,
    hideIcon: false
  }

  const finalOptions = { ...defaultOptions, ...options }
  const toastId = toastIdCounter++

  const container = document.createElement('div')
  document.body.appendChild(container)

  const toastInstance = {
    id: toastId,
    container: container,
    element: null,
    app: null
  }

  const app = createApp(Toast, {
    ...finalOptions,
    onClose: () => {
      cleanup()
    }
  })

  function cleanup() {
    try {
      // 先从活动列表中移除
      const index = activeToasts.findIndex(t => t.id === toastId)
      if (index > -1) {
        activeToasts.splice(index, 1)
      }
      
      // 稍微延迟一下更新位置，让关闭动画先开始
      setTimeout(() => {
        updateToastPositions()
      }, 50)
      
      // 延迟 unmount，等待退出动画完成（300ms）
      setTimeout(() => {
        app.unmount()
        if (container && container.parentNode) {
          document.body.removeChild(container)
        }
      }, 350)
    } catch (error) {
      console.warn('清理Toast容器失败:', error)
    }
  }

  toastInstance.app = app
  app.mount(container)
  
  // 添加到活动列表
  activeToasts.push(toastInstance)
  
  // 等待DOM更新后获取通知元素并更新位置
  setTimeout(() => {
    const notificationElement = container.querySelector('.notification')
    if (notificationElement) {
      toastInstance.element = notificationElement
      // 元素获取成功后立即更新所有Toast的位置
      updateToastPositions()
    }
  }, 50)
}

/**
 * 显示成功消息
 * @param {String} message 消息内容
 * @param {Number} duration 持续时间
 */
export function success(message, duration = 3000) {
  showToast({
    message,
    type: 'success',
    duration
  })
}

/**
 * 显示错误消息
 * @param {String} message 消息内容
 * @param {Number} duration 持续时间
 */
export function error(message, duration = 4000) {
  showToast({
    message,
    type: 'error',
    duration,
    closable: true
  })
}

/**
 * 显示警告消息
 * @param {String} message 消息内容
 * @param {Number} duration 持续时间
 */
export function warning(message, duration = 3500) {
  showToast({
    message,
    type: 'warning',
    duration
  })
}

/**
 * 显示信息消息
 * @param {String} message 消息内容
 * @param {Number} duration 持续时间
 */
export function info(message, duration = 3000) {
  showToast({
    message,
    type: 'info',
    duration
  })
}

/**
 * 显示加载中消息（不自动关闭）
 * @param {String} message 消息内容
 * @returns {Function} 调用返回的函数可关闭此Toast
 */
export function loading(message = '加载中...') {
  const toastId = toastIdCounter++
  const container = document.createElement('div')
  document.body.appendChild(container)

  const toastInstance = {
    id: toastId,
    container: container,
    element: null,
    app: null
  }

  const app = createApp(Toast, {
    message,
    type: 'info',
    duration: 0,
    closable: false,
    hideIcon: false,
    onClose: () => {
      try {
        // 先从活动列表中移除
        const index = activeToasts.findIndex(t => t.id === toastId)
        if (index > -1) {
          activeToasts.splice(index, 1)
        }
        
        // 稍微延迟一下更新位置，让关闭动画先开始
        setTimeout(() => {
          updateToastPositions()
        }, 50)
        
        // 延迟 unmount，等待退出动画完成（300ms）
        setTimeout(() => {
          app.unmount()
          if (container && container.parentNode) {
            document.body.removeChild(container)
          }
        }, 350)
      } catch (error) {
        console.warn('清理Toast容器失败:', error)
      }
    }
  })

  toastInstance.app = app
  const instance = app.mount(container)
  
  // 添加到活动列表
  activeToasts.push(toastInstance)
  
  // 等待DOM更新后获取通知元素并更新位置
  setTimeout(() => {
    const notificationElement = container.querySelector('.notification')
    if (notificationElement) {
      toastInstance.element = notificationElement
      // 元素获取成功后立即更新所有Toast的位置
      updateToastPositions()
    }
  }, 50)
  
  // 返回关闭函数
  return () => {
    if (instance && instance.close) {
      instance.close()
    }
  }
}

export default {
  success,
  error,
  warning,
  info,
  loading
}

