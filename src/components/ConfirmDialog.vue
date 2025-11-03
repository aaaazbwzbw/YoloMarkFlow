<template>
  <teleport to="body">
    <transition name="confirm-fade">
      <div 
        v-if="visible" 
        class="confirm-overlay"
        @click="handleCancel">
        <transition name="confirm-scale">
          <div 
            v-if="visible"
            class="confirm-box"
            @click.stop>
            
            <!-- 图标 + 内容 -->
            <div class="confirm-body">
              <div class="confirm-icon" :class="`icon-${type}`">
                <!-- Info -->
                <svg v-if="type === 'info'" width="20" height="20" viewBox="0 0 16 16">
                  <path fill="currentColor" d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 8 3zm.5 7V6H7v4h1.5zm0 1.5v1H7v-1h1.5z"/>
                </svg>
                <!-- Warning -->
                <svg v-else-if="type === 'warning'" width="20" height="20" viewBox="0 0 16 16">
                  <path fill="currentColor" d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.7L8 2.28zM8.625 12v-1h-1.25v1h1.25zm0-2V6h-1.25v4h1.25z"/>
                </svg>
                <!-- Danger -->
                <svg v-else-if="type === 'danger'" width="20" height="20" viewBox="0 0 16 16">
                  <path fill="currentColor" d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 8 3zm.5 7V6H7v4h1.5zm0 1.5v1H7v-1h1.5z"/>
                </svg>
                <!-- Success -->
                <svg v-else width="20" height="20" viewBox="0 0 16 16">
                  <path fill="currentColor" d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 8 3zm2.02 3.5l-3.23 3.86L5.3 9l-.71.71 2.25 2.25 3.95-4.71-.77-.75z"/>
                </svg>
              </div>
              
              <div class="confirm-content">
                <div class="confirm-title">{{ title }}</div>
                <div class="confirm-message" v-html="message"></div>
                
                <!-- 自定义内容槽 -->
                <div v-if="hasCustomContent" class="confirm-custom">
                  <slot></slot>
                </div>
              </div>
            </div>

            <!-- 按钮组 -->
            <div class="confirm-actions">
              <button 
                v-if="showCancelButton"
                class="confirm-btn confirm-btn-cancel" 
                @click="handleCancel">
                {{ cancelButtonText }}
              </button>
              <button 
                class="confirm-btn confirm-btn-confirm"
                :class="`btn-${type}`"
                @click="handleConfirm">
                {{ confirmButtonText }}
              </button>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<script>
export default {
  name: 'ConfirmDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: '提示'
    },
    message: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      default: 'warning', // info, warning, danger, success
      validator: (value) => ['info', 'warning', 'danger', 'success'].includes(value)
    },
    confirmButtonText: {
      type: String,
      default: '确定'
    },
    cancelButtonText: {
      type: String,
      default: '取消'
    },
    showCancelButton: {
      type: Boolean,
      default: true
    }
  },
  emits: ['confirm', 'cancel', 'update:visible'],
  computed: {
    hasCustomContent() {
      return !!this.$slots.default
    }
  },
  watch: {
    visible(newVal) {
      // 当对话框显示时播放提示音
      if (newVal) {
        this.playSound()
      }
    }
  },
  methods: {
    handleConfirm() {
      this.$emit('confirm')
      this.$emit('update:visible', false)
    },
    handleCancel() {
      this.$emit('cancel')
      this.$emit('update:visible', false)
    },
    playSound() {
      // 根据对话框类型播放不同的提示音
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // 根据类型设置不同的音调
      const frequencies = {
        success: [523.25, 659.25], // C5-E5
        danger: [392, 349.23],      // G4-F4
        warning: [440, 440],        // A4-A4
        info: [523.25]              // C5
      }
      
      const freq = frequencies[this.type] || frequencies.info
      
      oscillator.frequency.setValueAtTime(freq[0], audioContext.currentTime)
      if (freq[1]) {
        oscillator.frequency.setValueAtTime(freq[1], audioContext.currentTime + 0.1)
      }
      
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
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 20px;
}

.confirm-box {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: var(--shadow-lg);
  padding: 16px;
  max-width: 460px;
  width: 100%;
}

/* 主体区域 */
.confirm-body {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

/* 图标 */
.confirm-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.icon-info {
  color: var(--color-info);
}

.icon-warning {
  color: var(--color-warning);
}

.icon-danger {
  color: var(--color-danger);
}

.icon-success {
  color: var(--color-success);
}

/* 内容 */
.confirm-content {
  flex: 1;
  min-width: 0;
}

.confirm-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.confirm-message {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  word-wrap: break-word;
}

.confirm-custom {
  margin-top: 12px;
}

/* 按钮组 */
.confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.confirm-btn {
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
  min-width: 60px;
}

.confirm-btn-cancel {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.confirm-btn-cancel:hover {
  background: var(--color-bg-tertiary);
}

.confirm-btn-cancel:active {
  background: var(--color-border);
}

.confirm-btn-confirm {
  color: #ffffff;
}

.btn-info {
  background: var(--color-info);
  border-color: var(--color-info);
}

.btn-info:hover {
  background: #006cbe;
  border-color: #006cbe;
}

.btn-info:active {
  background: #005a9e;
}

.btn-warning {
  background: var(--color-warning);
  border-color: var(--color-warning);
}

.btn-warning:hover {
  background: #b0440e;
  border-color: #b0440e;
}

.btn-warning:active {
  background: #96390c;
}

.btn-danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.btn-danger:hover {
  background: #b52e31;
  border-color: #b52e31;
}

.btn-danger:active {
  background: #9a2629;
}

.btn-success {
  background: var(--color-success);
  border-color: var(--color-success);
}

.btn-success:hover {
  background: #0e6b0e;
  border-color: #0e6b0e;
}

.btn-success:active {
  background: #0c5a0c;
}

/* 动画 - 弹性缩放 */
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.2s;
}

.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}

.confirm-scale-enter-active {
  animation: confirm-scale-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.confirm-scale-leave-active {
  animation: confirm-scale-out 0.15s ease;
}

@keyframes confirm-scale-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes confirm-scale-out {
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

