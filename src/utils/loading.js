import { createApp } from 'vue'
import Loading from '../components/Loading.vue'

let loadingInstance = null

/**
 * 显示全屏加载框
 * @param {String} message 加载提示文本
 * @returns {Function} 关闭加载框的函数
 */
export function showLoading(message = '加载中...') {
  // 如果已经有加载框在显示，先关闭它
  if (loadingInstance) {
    hideLoading()
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

  return hideLoading
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

