<template>
  <div class="startup-loading">
    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 背景装饰 -->
      <div class="bg-decoration">
        <div class="circle circle-1"></div>
        <div class="circle circle-2"></div>
        <div class="circle circle-3"></div>
      </div>
      
      <!-- Logo容器 -->
      <div class="logo-container">
        <div class="logo">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M7 7 L12 13 L17 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 13 L12 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
            <circle cx="17" cy="7" r="1.2" fill="currentColor"/>
            <circle cx="12" cy="17" r="1.2" fill="currentColor"/>
          </svg>
        </div>
        <div class="logo-glow"></div>
      </div>
      
      <!-- 标题 -->
      <h1 class="app-title">YoloMarkFlow</h1>
      <p class="subtitle">一站式视觉AI训练平台</p>
      
      <!-- 加载进度 -->
      <div class="loading-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="status">{{ statusText }}<span class="dots">{{ dots }}</span></div>
      </div>
      
      <!-- 版本信息 -->
      <div class="version-info">v1.0.3</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StartupLoading',
  data() {
    return {
      statusText: '正在初始化',
      dots: '',
      dotsCount: 0,
      progress: 0
    }
  },
  mounted() {
    // 启动动画点效果
    this.startDotsAnimation()
    
    // 启动进度条动画
    this.startProgressAnimation()
  },
  methods: {
    startDotsAnimation() {
      setInterval(() => {
        this.dotsCount = (this.dotsCount + 1) % 4
        this.dots = '.'.repeat(this.dotsCount)
      }, 500)
    },
    startProgressAnimation() {
      const stages = [
        { progress: 20, text: '正在加载资源', duration: 400 },
        { progress: 40, text: '正在初始化模块', duration: 400 },
        { progress: 60, text: '正在配置环境', duration: 400 },
        { progress: 80, text: '正在准备界面', duration: 400 },
        { progress: 100, text: '启动完成', duration: 400 }
      ]
      
      let currentStage = 0
      
      const nextStage = () => {
        if (currentStage < stages.length) {
          const stage = stages[currentStage]
          this.statusText = stage.text
          this.animateProgress(stage.progress, stage.duration)
          currentStage++
          setTimeout(nextStage, stage.duration)
        } else {
          // 全部完成，短暂延迟后跳转
          setTimeout(() => {
            // 先跳转到欢迎页
            this.$router.push('/welcome').then(() => {
              // 跳转完成后，触发启动完成事件，让App.vue恢复上次打开的项目
              window.dispatchEvent(new Event('startup-completed'))
            })
          }, 300)
        }
      }
      
      nextStage()
    },
    animateProgress(targetProgress, duration) {
      const startProgress = this.progress
      const diff = targetProgress - startProgress
      const startTime = Date.now()
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // 使用缓动函数
        const easeOutQuart = 1 - Math.pow(1 - progress, 4)
        this.progress = startProgress + diff * easeOutQuart
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          this.progress = targetProgress
        }
      }
      
      animate()
    }
  }
}
</script>

<style scoped>
.startup-loading {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  color: #333333;
  overflow: hidden;
  position: relative;
}

body[data-theme="dark"] .startup-loading {
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  color: #ffffff;
}

/* 主内容 */
.main-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 122, 204, 0.1) 0%, transparent 70%);
  animation: float 20s ease-in-out infinite;
}

body[data-theme="dark"] .circle {
  background: radial-gradient(circle, rgba(0, 122, 204, 0.15) 0%, transparent 70%);
}

.circle-1 {
  width: 400px;
  height: 400px;
  top: -200px;
  right: -100px;
  animation-delay: 0s;
}

.circle-2 {
  width: 300px;
  height: 300px;
  bottom: -150px;
  left: -50px;
  animation-delay: 5s;
}

.circle-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: 10s;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.3;
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
    opacity: 0.5;
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
    opacity: 0.4;
  }
}

/* Logo容器 */
.logo-container {
  position: relative;
  margin-bottom: 32px;
  animation: fadeInScale 0.8s ease-out;
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.logo {
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333333;
  position: relative;
  z-index: 2;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  animation: logoFloat 3s ease-in-out infinite;
}

body[data-theme="dark"] .logo {
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  color: #ffffff;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

@keyframes logoFloat {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.logo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, rgba(0, 122, 204, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  z-index: 1;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.5;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0.8;
  }
}

/* 标题 */
.app-title {
  font-size: 42px;
  font-weight: 700;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #333333 0%, #666666 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: fadeInUp 0.8s ease-out 0.2s both;
  letter-spacing: -0.5px;
}

body[data-theme="dark"] .app-title {
  background: linear-gradient(135deg, #ffffff 0%, #cccccc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: 16px;
  color: #999999;
  margin-bottom: 60px;
  animation: fadeInUp 0.8s ease-out 0.4s both;
  font-weight: 500;
  letter-spacing: 0.5px;
}

body[data-theme="dark"] .subtitle {
  color: #888888;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 加载容器 */
.loading-container {
  width: 320px;
  animation: fadeInUp 0.8s ease-out 0.6s both;
}

/* 进度条 */
.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 16px;
  position: relative;
}

body[data-theme="dark"] .progress-bar {
  background: rgba(255, 255, 255, 0.1);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007acc 0%, #0098ff 100%);
  border-radius: 2px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 0 10px rgba(0, 122, 204, 0.5);
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* 状态文本 */
.status {
  font-size: 14px;
  color: #666666;
  text-align: center;
  font-weight: 500;
}

body[data-theme="dark"] .status {
  color: #999999;
}

.dots {
  display: inline-block;
  width: 20px;
  text-align: left;
}

/* 版本信息 */
.version-info {
  position: absolute;
  bottom: 24px;
  font-size: 12px;
  color: #999999;
  opacity: 0.6;
  font-weight: 500;
}

body[data-theme="dark"] .version-info {
  color: #666666;
}
</style>

