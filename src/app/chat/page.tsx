'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import EmailCard from '@/components/EmailCard'; // 导入邮件卡片组件

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// 定义邮件工具调用参数的类型
interface EmailToolArgs {
  title: string;
  body: string;
  receiver: string;
}

// 定义 API 返回的 ToolCall 类型 (根据 Vercel AI SDK 简化)
interface ToolCall {
  toolCallId: string; // 通常 SDK 会生成 ID
  toolName: string;
  args: unknown; // 使用 unknown 代替 any
}

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 新增：管理邮件卡片显示状态和数据
  const [showEmailCard, setShowEmailCard] = useState(false);
  const [emailArgs, setEmailArgs] = useState<EmailToolArgs | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: input }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // 定义 API 响应的类型
      const result: { text?: string; toolCalls?: ToolCall[] } = await response.json();

      // 检查是否有工具调用，特别是 sendEmail
      if (result.toolCalls && result.toolCalls.length > 0) {
        const sendEmailCall = result.toolCalls.find(
          (call): call is ToolCall & { args: EmailToolArgs } => 
            call.toolName === 'sendEmail'
        );
        
        if (sendEmailCall) {
          // 解析参数并显示邮件卡片
          setEmailArgs(sendEmailCall.args as EmailToolArgs);
          setShowEmailCard(true);
          // 注意：这里我们不添加任何 assistant 消息，因为 UI 由卡片接管
        } else if (result.text) {
          // 如果有其他工具调用或仅有文本
          const assistantMessage: Message = { role: 'assistant', content: result.text };
          setMessages(prev => [...prev, assistantMessage]);
        }
      } else if (result.text) {
        // 仅有文本回复
        const assistantMessage: Message = { role: 'assistant', content: result.text };
        setMessages(prev => [...prev, assistantMessage]);
      }

    } catch (error) {
      console.error('Failed to fetch chat response:', error);
      const errorMessage: Message = { role: 'assistant', content: '抱歉，无法获取回复。' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理邮件卡片的确认操作
  const handleEmailAccept = async (data: EmailToolArgs) => {
    console.log('尝试保存邮件数据:', data);
    // 添加 loading 状态？可以在这里加一个 emailCardLoading state
    try {
      const response = await fetch('/api/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data), // 发送邮件数据
      });

      if (!response.ok) {
        // 处理 API 错误
        const errorText = await response.text();
        throw new Error(`Failed to save email: ${response.status} ${errorText}`);
      }

      // 成功保存
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '邮件已发送' // 更新成功消息
          // 如果实际发送了邮件，可以在这里说"邮件已发送"
        }
      ]);

    } catch (error) {
      console.error('Error saving email via API:', error);
      // 显示错误消息给用户
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `保存邮件时出错：${error instanceof Error ? error.message : '未知错误'}`
        }
      ]);
    } finally {
      // 无论成功失败，都隐藏卡片
      setShowEmailCard(false);
      setEmailArgs(null);
      // 停止 loading 状态
    }
  };

  // 处理邮件卡片的取消操作
  const handleEmailCancel = () => {
    console.log('邮件发送已取消');
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: '邮件发送已取消。'
      }
    ]);
    setShowEmailCard(false); // 隐藏卡片
    setEmailArgs(null);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl flex flex-col h-[calc(100vh-2rem)]">
        <CardHeader>
          <CardTitle>邮件助手聊天机器人</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4 pr-6">
          {messages.map((msg, index) => (
            <div key={`msg-${index}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`p-3 rounded-lg max-w-[75%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && !showEmailCard && ( // 仅在非邮件卡片加载时显示
             <div className="flex justify-start">
               <div className="p-3 rounded-lg bg-muted animate-pulse">
                 正在思考中...
               </div>
            </div>
          )}
          {/* 条件渲染邮件卡片 */} 
          {showEmailCard && emailArgs && (
            <EmailCard 
              key="email-card" // 添加 key 确保 state 正确重置
              initialData={emailArgs} 
              onAccept={handleEmailAccept} 
              onCancel={handleEmailCancel} 
            />
          )}
        </CardContent>
        <CardFooter className="mt-auto border-t pt-4">
          {/* 只有在不显示邮件卡片时才显示聊天输入框 */} 
          {!showEmailCard && (
            <form onSubmit={handleSubmit} className="flex w-full space-x-2">
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入你的消息..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? '发送中...' : '发送'}
              </Button>
            </form>
          )}
        </CardFooter>
      </Card>
    </div>
  );
} 