import { createApp, h } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

/**
 * 显示确认对话框
 * @param {Object} options 配置选项
 * @param {String} options.title 标题
 * @param {String} options.message 消息内容（支持HTML）
 * @param {String} options.type 类型: info, warning, danger, success
 * @param {String} options.confirmButtonText 确认按钮文本
 * @param {String} options.cancelButtonText 取消按钮文本
 * @param {Boolean} options.showCancelButton 是否显示取消按钮
 * @returns {Promise} 返回Promise，确认时resolve，取消时reject
 */
export function confirm(options = {}) {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const defaultOptions = {
      title: '提示',
      message: '',
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      showCancelButton: true
    }

    const finalOptions = { ...defaultOptions, ...options }

    const app = createApp({
      data() {
        return {
          visible: false
        }
      },
      mounted() {
        // 使用nextTick确保DOM已挂载，然后触发进入动画
        this.$nextTick(() => {
          this.visible = true
        })
      },
      methods: {
        handleConfirm() {
          this.visible = false
          cleanup()
          resolve()
        },
        handleCancel() {
          this.visible = false
          cleanup()
          reject('cancel')
        }
      },
      render() {
        return h(ConfirmDialog, {
          visible: this.visible,
          title: finalOptions.title,
          message: finalOptions.message,
          type: finalOptions.type,
          confirmButtonText: finalOptions.confirmButtonText,
          cancelButtonText: finalOptions.cancelButtonText,
          showCancelButton: finalOptions.showCancelButton,
          onConfirm: this.handleConfirm,
          onCancel: this.handleCancel,
          'onUpdate:visible': (val) => {
            if (!val) {
              this.handleCancel()
            }
          }
        })
      }
    })

    function cleanup() {
      setTimeout(() => {
        try {
          app.unmount()
          if (container && container.parentNode) {
            document.body.removeChild(container)
          }
        } catch (error) {
          console.warn('清理对话框容器失败:', error)
        }
      }, 300) // 等待动画完成
    }

    app.mount(container)
  })
}

/**
 * 显示警告对话框（无取消按钮）
 */
export function alert(options = {}) {
  return confirm({
    ...options,
    showCancelButton: false
  })
}

/**
 * 显示警告确认框
 */
export function warning(message, title = '警告') {
  return confirm({
    title,
    message,
    type: 'warning'
  })
}

/**
 * 显示危险确认框
 */
export function danger(message, title = '危险操作') {
  return confirm({
    title,
    message,
    type: 'danger',
    confirmButtonText: '确认删除'
  })
}

/**
 * 显示信息确认框
 */
export function info(message, title = '提示') {
  return confirm({
    title,
    message,
    type: 'info'
  })
}

export default {
  confirm,
  alert,
  warning,
  danger,
  info
}

