/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // 允许全局使用 describe, it, expect 等
    environment: 'jsdom', // 使用 JSDOM 模拟浏览器环境
    setupFiles: './vitest.setup.ts', // 指定测试环境设置文件（下一步创建）ÔÔ
    // 如果你的 CSS 模块或其他文件处理与 Vitest 冲突，可以在这里添加 css: true 或其他配置
    // css: true,
    include: ['src/**/*.test.{ts,tsx}'], // 指定测试文件的查找模式
    exclude: ['node_modules', '.next'], // 排除的目录
  },
  resolve: {
    alias: {
      '@': '/src', // 与 tsconfig.json 中的路径别名保持一致
    },
  },
}) 