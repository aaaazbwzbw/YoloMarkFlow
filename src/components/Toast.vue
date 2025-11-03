<template>
  <transition name="notification-slide">
    <div 
      v-show="visible" 
      class="notification"
      :class="`notification-${type}`"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave">
      
      <!-- 图标 -->
      <div class="notification-icon">
        <!-- Success -->
        <svg v-if="type === 'success'" width="20" height="20" viewBox="0 0 16 16">
          <path fill="currentColor" d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 8 3zm2.02 3.5l-3.23 3.86L5.3 9l-.71.71 2.25 2.25 3.95-4.71-.77-.75z"/>
        </svg>
        <!-- Error -->
        <svg v-else-if="type === 'error'" width="20" height="20" viewBox="0 0 16 16">
          <path fill="currentColor" d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 8 3zm.5 7V6H7v4h1.5zm0 1.5v1H7v-1h1.5z"/>
        </svg>
        <!-- Warning -->
        <svg v-else-if="type === 'warning'" width="20" height="20" viewBox="0 0 16 16">
          <path fill="currentColor" d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.7L8 2.28zM8.625 12v-1h-1.25v1h1.25zm0-2V6h-1.25v4h1.25z"/>
        </svg>
        <!-- Info -->
        <svg v-else width="20" height="20" viewBox="0 0 16 16">
          <path fill="currentColor" d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 8 3zm.5 7V6H7v4h1.5zm0 1.5v1H7v-1h1.5z"/>
        </svg>
      </div>

      <!-- 内容区 -->
      <div class="notification-content">
        <div class="notification-title">{{ getTitle() }}</div>
        <div class="notification-message">{{ message }}</div>
      </div>

      <!-- 关闭按钮 -->
      <button 
        class="notification-close" 
        @click.stop="close">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'Toast',
  props: {
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      default: 'info', // success, error, warning, info
      validator: (value) => ['success', 'error', 'warning', 'info'].includes(value)
    },
    duration: {
      type: Number,
      default: 3000 // 0表示不自动关闭
    },
    closable: {
      type: Boolean,
      default: false
    },
    hideIcon: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  data() {
    return {
      visible: false,  // 初始隐藏，然后触发进入动画
      timer: null,
      isPaused: false
    }
  },
  mounted() {
    // 播放提示音
    this.playSound()
    
    // 使用 nextTick 触发进入动画
    this.$nextTick(() => {
      this.visible = true
      if (this.duration > 0) {
        this.startTimer()
      }
    })
  },
  beforeUnmount() {
    if (this.timer) {
      clearTimeout(this.timer)
    }
  },
  methods: {
    getTitle() {
      const titles = {
        success: '成功',
        error: '错误',
        warning: '警告',
        info: '提示'
      }
      return titles[this.type] || '通知'
    },
    playSound() {
      // 不同类型使用不同频率的提示音
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // 根据类型设置不同的音调
      const frequencies = {
        success: [523.25, 659.25], // C5-E5
        error: [392, 349.23],       // G4-F4
        warning: [440, 440],        // A4-A4
        info: [523.25]              // C5
      }
      
      const freq = frequencies[this.type] || frequencies.info
      
      oscillator.frequency.setValueAtTime(freq[0], audioContext.currentTime)
      if (freq[1]) {
        oscillator.frequency.setValueAtTime(freq[1], audioContext.currentTime + 0.1)
      }
      
      // 增大音量：从0.1改为0.3
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    },
    startTimer() {
      this.timer = setTimeout(() => {
        if (!this.isPaused) {
          this.close()
        }
      }, this.duration)
    },
    handleMouseEnter() {
      this.isPaused = true
      if (this.timer) {
        clearTimeout(this.timer)
      }
    },
    handleMouseLeave() {
      this.isPaused = false
      if (this.duration > 0) {
        this.startTimer()
      }
    },
    close() {
      // 禁用 bottom 过渡，防止在退出动画期间位置变化导致闪烁
      if (this.$el && this.$el.style) {
        this.$el.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      }
      
      // 立即通知父组件关闭，从 activeToasts 中移除
      this.$emit('close')
      // 开始退出动画
      this.visible = false
    }
  }
}
</script>

<style scoped>
/* 通知容器 - 右下角 */
.notification {
  position: fixed;
  right: 20px;
  bottom: 20px; /* 默认位置，会被JavaScript动态覆盖 */
  width: 320px;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #d4d4d4);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 12px;
  display: flex;
  gap: 12px;
  z-index: 9999;
  cursor: pointer;
  /* 只对 transform 和 box-shadow 添加过渡效果，bottom 需要平滑过渡 */
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
              box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* 图标区域 */
.notification-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.notification-success .notification-icon {
  color: var(--color-success, #107c10);
}

.notification-error .notification-icon {
  color: var(--color-danger, #d13438);
}

.notification-warning .notification-icon {
  color: var(--color-warning, #ca5010);
}

.notification-info .notification-icon {
  color: var(--color-info, #0078d4);
}

/* 内容区域 */
.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #3c3c3c);
  margin-bottom: 4px;
  line-height: 1.4;
}

.notification-message {
  font-size: 12px;
  color: var(--color-text-secondary, #616161);
  line-height: 1.5;
  word-break: break-word;
}

/* 关闭按钮 */
.notification-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary, #8e8e8e);
  cursor: pointer;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s, color 0.15s;
  padding: 0;
  align-self: flex-start;
}

.notification-close:hover {
  background: var(--color-bg-tertiary, #e8e8e8);
  color: var(--color-text-secondary, #616161);
}

.notification-close:active {
  background: var(--color-border, #d4d4d4);
}

/* 动画 - 从右侧滑入 */
.notification-slide-enter-active {
  animation: notification-slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.notification-slide-leave-active {
  animation: notification-slide-out 0.2s ease;
}

@keyframes notification-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes notification-slide-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

/* 深色主题适配 */
body[data-theme="dark"] .notification {
  background: #2d2d30;
  border-color: #3c3c3c;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

body[data-theme="dark"] .notification-title {
  color: #cccccc;
}

body[data-theme="dark"] .notification-message {
  color: #9d9d9d;
}

body[data-theme="dark"] .notification-close {
  color: #6d6d6d;
}

body[data-theme="dark"] .notification-close:hover {
  background: #3c3c3c;
  color: #9d9d9d;
}
</style>

