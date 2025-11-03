// 主题管理工具

/**
 * 获取当前主题
 * @returns {string} 主题名称 ('light' | 'dark')
 */
export function getTheme() {
  return localStorage.getItem('theme') || 'light'
}

/**
 * 设置主题
 * @param {string} theme - 主题名称 ('light' | 'dark')
 */
export function setTheme(theme) {
  localStorage.setItem('theme', theme)
  applyTheme(theme)
}

/**
 * 应用主题到DOM
 * @param {string} theme - 主题名称
 */
export function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.body.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.setAttribute('data-theme', 'light')
    document.body.setAttribute('data-theme', 'light')
  }
}

/**
 * 应用启动时初始化主题
 */
export function initTheme() {
  const theme = getTheme()
  applyTheme(theme)
}

export default {
  getTheme,
  setTheme,
  applyTheme,
  initTheme
}

