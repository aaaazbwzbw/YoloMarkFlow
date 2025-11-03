<template>
  <teleport to="body">
    <transition name="loading-fade">
      <div v-if="visible" class="loading-overlay" @click.stop>
        <div class="loading-content">
          <div class="spinner"></div>
          <div class="loading-text">{{ message }}</div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script>
export default {
  name: 'Loading',
  props: {
    message: {
      type: String,
      default: '加载中...'
    }
  },
  emits: ['close'],
  data() {
    return {
      visible: false
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.visible = true
    })
  },
  methods: {
    close() {
      this.visible = false
      setTimeout(() => {
        this.$emit('close')
      }, 300)
    }
  }
}
</script>

<style scoped>
/* 默认（浅色主题） */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid #e8e8e8;
  border-top-color: #007acc;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
  color: #3c3c3c;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* 淡入淡出动画 */
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.3s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}

/* 深色主题适配 */
body[data-theme="dark"] .loading-overlay {
  background: rgba(0, 0, 0, 0.75);
}

body[data-theme="dark"] .spinner {
  border-color: #3c3c3c;
  border-top-color: #007acc;
}

body[data-theme="dark"] .loading-text {
  color: #cccccc;
}
</style>

