import { createApp } from 'vue'
import Loading from '../components/Loading.vue'

let loadingInstance = null

/**
 * 显示全屏加载框
 * @param {String} message 加载提示文本
 * @returns {Function} 关闭加载框的函数，如果传入新消息则更新消息
 */
export function showLoading(message = '加载中...') {
  // 如果已经有加载框在显示，更新消息
  if (loadingInstance) {
    if (typeof message === 'string') {
      // 更新消息
      if (loadingInstance.instance && typeof loadingInstance.instance.updateMessage === 'function') {
        loadingInstance.instance.updateMessage(message)
      }
      return (newMessage) => {
        if (newMessage && typeof newMessage === 'string') {
          if (loadingInstance && loadingInstance.instance && typeof loadingInstance.instance.updateMessage === 'function') {
            loadingInstance.instance.updateMessage(newMessage)
          }
        } else {
          hideLoading()
        }
      }
    } else {
      // 如果传入的是函数，先关闭旧的
      hideLoading()
    }
  }

  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp(Loading, {
    message,
    onClose: () => {
      try {
        app.unmount()
        if (container && container.parentNode) {
          document.body.removeChild(container)
        }
        loadingInstance = null
      } catch (error) {
        console.warn('清理Loading容器失败:', error)
      }
    }
  })

  const instance = app.mount(container)
  
  loadingInstance = {
    app,
    instance,
    container
  }

  return (newMessage) => {
    if (newMessage && typeof newMessage === 'string') {
      // 更新消息
      if (loadingInstance && loadingInstance.instance && typeof loadingInstance.instance.updateMessage === 'function') {
        loadingInstance.instance.updateMessage(newMessage)
      }
    } else {
      // 关闭遮罩层
      hideLoading()
    }
  }
}

/**
 * 隐藏加载框
 */
export function hideLoading() {
  if (loadingInstance && loadingInstance.instance) {
    loadingInstance.instance.close()
  }
}

export default {
  showLoading,
  hideLoading
}

