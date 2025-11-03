<template>
  <teleport to="body">
    <transition name="modal-fade">
      <div 
        v-if="modelValue" 
        class="modal-overlay"
        @click="handleOverlayClick">
        <transition name="modal-scale">
          <div 
            v-if="modelValue"
            class="modal-container"
            :class="`modal-${size}`"
            :style="customWidth ? { width: customWidth } : {}"
            @click.stop>
            
            <!-- 标题栏 - VS Code风格 -->
            <div class="modal-header">
              <span class="modal-title">{{ title }}</span>
              <button 
                v-if="showClose"
                class="modal-close" 
                @click="handleClose"
                aria-label="关闭">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <!-- 内容区 -->
            <div class="modal-content" :class="{ 'no-padding': noPadding }">
              <slot></slot>
            </div>

            <!-- 底部按钮区 -->
            <div v-if="showFooter || footerButtons?.length" class="modal-footer">
              <slot name="footer">
                <!-- 自定义按钮数组 -->
                <template v-if="footerButtons && footerButtons.length">
                  <button 
                    v-for="(btn, index) in footerButtons"
                    :key="index"
                    class="modal-btn"
                    :class="[
                      btn.type ? `btn-${btn.type}` : 'modal-btn-cancel',
                      { 'modal-btn-confirm': btn.type }
                    ]"
                    :disabled="btn.disabled || btn.loading"
                    @click="btn.onClick">
                    <span v-if="btn.loading">...</span>
                    <span v-else>{{ btn.label }}</span>
                  </button>
                </template>
                <!-- 默认按钮 -->
                <template v-else>
                  <button 
                    v-if="showCancel"
                    class="modal-btn modal-btn-cancel" 
                    @click="handleCancel">
                    {{ cancelText }}
                  </button>
                  <button 
                    class="modal-btn modal-btn-confirm" 
                    :class="`btn-${confirmType}`"
                    @click="handleConfirm"
                    :disabled="confirmDisabled">
                    {{ confirmText }}
                  </button>
                </template>
              </slot>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<script>
export default {
  name: 'Modal',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: '标题'
    },
    size: {
      type: String,
      default: 'medium', // small, medium, large
      validator: (value) => ['small', 'medium', 'large'].includes(value)
    },
    customWidth: {
      type: String,
      default: ''
    },
    showClose: {
      type: Boolean,
      default: true
    },
    showFooter: {
      type: Boolean,
      default: true
    },
    showCancel: {
      type: Boolean,
      default: true
    },
    confirmText: {
      type: String,
      default: '确定'
    },
    cancelText: {
      type: String,
      default: '取消'
    },
    confirmType: {
      type: String,
      default: 'primary', // primary, danger, warning, success
      validator: (value) => ['primary', 'danger', 'warning', 'success'].includes(value)
    },
    confirmDisabled: {
      type: Boolean,
      default: false
    },
    closeOnOverlay: {
      type: Boolean,
      default: true
    },
    noPadding: {
      type: Boolean,
      default: false
    },
    footerButtons: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update:modelValue', 'confirm', 'cancel', 'close'],
  watch: {
    modelValue(newVal) {
      // 当对话框显示时播放提示音
      if (newVal) {
        this.playSound()
      }
    }
  },
  methods: {
    handleClose() {
      this.$emit('update:modelValue', false)
      this.$emit('close')
    },
    handleConfirm() {
      this.$emit('confirm')
    },
    handleCancel() {
      this.$emit('cancel')
      this.handleClose()
    },
    handleOverlayClick() {
      if (this.closeOnOverlay) {
        this.handleClose()
      }
    },
    playSound() {
      // Modal 使用简单的提示音（info类型）
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // 使用 C5 音调
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime)
      
      // 音量设置为 0.3
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    }
  }
}
</script>

<style scoped>
/* 遮罩层 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

/* Modal容器 - VS Code风格 */
.modal-container {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
  width: 100%;
}

/* 尺寸变体 */
.modal-small {
  max-width: 400px;
}

.modal-medium {
  max-width: 600px;
}

.modal-large {
  max-width: 800px;
}

/* 标题栏 - 纯色扁平 */
.modal-header {
  height: 36px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.modal-title {
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-primary);
  letter-spacing: 0;
}

.modal-close {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s, color 0.15s;
  padding: 0;
}

.modal-close:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.modal-close:active {
  background: var(--color-border);
}

/* 内容区 */
.modal-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 12px 24px 24px; /* 上右下左：上下24px，左侧24px，右侧12px为滚动条留空间 */
  background: var(--color-bg-primary);
}

.modal-content.no-padding {
  padding: 0;
}

/* 滚动条 - 美化版，紧贴右侧 */
.modal-content::-webkit-scrollbar {
  width: 6px;
}

.modal-content::-webkit-scrollbar-track {
  background: transparent;
  margin-right: 2px; /* 距离右边缘2px */
}

.modal-content::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #d0d0d0 0%, #b0b0b0 100%);
  border-radius: 3px;
  transition: all 0.3s ease;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #b0b0b0 0%, #909090 100%);
}

.modal-content::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #909090 0%, #707070 100%);
}

/* 深色主题滚动条 */
body[data-theme="dark"] .modal-content::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #4a4a4a 0%, #3c3c3c 100%);
}

body[data-theme="dark"] .modal-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #5a5a5a 0%, #4a4a4a 100%);
  box-shadow: 0 0 4px rgba(0, 122, 204, 0.2);
}

body[data-theme="dark"] .modal-content::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #007acc 0%, #005a9e 100%);
  box-shadow: 0 0 6px rgba(0, 122, 204, 0.4);
}

/* 底部按钮区 */
.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

/* 按钮样式 - VS Code风格 */
.modal-btn {
  padding: 6px 14px;
  border-radius: 2px;
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
  border: 1px solid transparent;
  outline: none;
  height: 28px;
  line-height: 16px;
}

.modal-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.modal-btn-cancel {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.modal-btn-cancel:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
}

.modal-btn-cancel:active:not(:disabled) {
  background: var(--color-border);
}

.modal-btn-confirm {
  color: #ffffff;
}

.btn-primary {
  background: var(--color-info);
  border-color: var(--color-info);
}

.btn-primary:hover:not(:disabled) {
  background: #006cbe;
  border-color: #006cbe;
}

.btn-primary:active:not(:disabled) {
  background: #005a9e;
}

.btn-danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.btn-danger:hover:not(:disabled) {
  background: #b52e31;
  border-color: #b52e31;
}

.btn-danger:active:not(:disabled) {
  background: #9a2629;
}

.btn-warning {
  background: var(--color-warning);
  border-color: var(--color-warning);
}

.btn-warning:hover:not(:disabled) {
  background: #b0440e;
  border-color: #b0440e;
}

.btn-warning:active:not(:disabled) {
  background: #96390c;
}

.btn-success {
  background: var(--color-success);
  border-color: var(--color-success);
}

.btn-success:hover:not(:disabled) {
  background: #0e6b0e;
  border-color: #0e6b0e;
}

.btn-success:active:not(:disabled) {
  background: #0c5a0c;
}

/* 动画 - 弹性缩放 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active {
  animation: modal-scale-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.modal-scale-leave-active {
  animation: modal-scale-out 0.15s ease;
}

@keyframes modal-scale-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes modal-scale-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}
</style>

