<template>
  <div class="page-container">
    <div class="page-header">
      <h2>模型仓库</h2>
      <p class="page-description">存放和管理所有训练好的模型，对比模型性能</p>
      <el-tag type="info" size="small">V3 功能</el-tag>
    </div>
    <div class="page-content">
      <el-empty description="V3 版本功能，敬请期待" :image-size="160" />
    </div>
  </div>
</template>

<script>
export default {
  name: 'ModelHub'
}
</script>

<style scoped>
.page-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.page-header {
  padding: 24px 32px;
  border-bottom: 1px solid var(--color-border);
}

.page-header h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.page-description {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 12px 0;
}

.page-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}
</style>

