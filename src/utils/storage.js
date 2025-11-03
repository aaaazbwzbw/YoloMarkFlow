// 本地存储工具类

export const storage = {
  // 获取数据
  get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key)
      return value ? JSON.parse(value) : defaultValue
    } catch (error) {
      console.error('Storage get error:', error)
      return defaultValue
    }
  },

  // 设置数据
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (error) {
      console.error('Storage set error:', error)
      return false
    }
  },

  // 删除数据
  remove(key) {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error('Storage remove error:', error)
      return false
    }
  },

  // 清空所有数据
  clear() {
    try {
      localStorage.clear()
      return true
    } catch (error) {
      console.error('Storage clear error:', error)
      return false
    }
  },

  // 检查是否存在
  has(key) {
    return localStorage.getItem(key) !== null
  }
}

export default storage

