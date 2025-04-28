import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button Component', () => {
  it('应该正确渲染按钮文本', () => {
    render(<Button>Click Me</Button>)
    
    // 使用 screen 查询元素
    const buttonElement = screen.getByRole('button', { name: /click me/i })
    
    // 使用 @testing-library/jest-dom 提供的断言
    expect(buttonElement).toBeInTheDocument()
    expect(buttonElement).toHaveTextContent('Click Me')
  })

  it('应该应用默认 variant', () => {
    render(<Button>Default Button</Button>)
    const buttonElement = screen.getByRole('button', { name: /default button/i })
    
    // Shadcn Button 默认 variant 通常包含 'bg-primary', 'text-primary-foreground' 等类
    // 注意：这个断言依赖于 Button 组件的内部实现和你的 Tailwind 配置，可能需要调整
    expect(buttonElement).toHaveClass('bg-primary') 
  })

  it('应该应用 destructive variant 类', () => {
    render(<Button variant="destructive">Delete</Button>)
    const buttonElement = screen.getByRole('button', { name: /delete/i })
    
    // destructive variant 通常包含 'bg-destructive', 'text-destructive-foreground' 等类
    expect(buttonElement).toHaveClass('bg-destructive')
  })

  // 你可以添加更多测试用例，例如测试点击事件、禁用状态等
}) 