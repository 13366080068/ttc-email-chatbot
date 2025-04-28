'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import EmailCard from '@/components/EmailCard'; // 导入邮件卡片组件

// 定义邮件工具调用参数的类型
interface EmailToolArgs {
  title: string;
  body: string;
  receiver: string;
}

// 更新 Message 接口
interface Message {
  id: string; // 添加唯一 ID
  role: 'user' | 'assistant';
  type: 'text' | 'tool'; // 消息类型
  content: string; // 用于文本消息
  toolCallId?: string; // 关联的工具调用 ID (如果 type === 'tool')
  toolName?: string; // 工具名称 (例如 'sendEmail')
  toolData?: unknown; // 使用 unknown 代替 any
}

// 定义 API 返回的 ToolCall 类型 (根据 Vercel AI SDK 简化)
interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null); // 用于引用消息容器 (CardContent) 的 ref

  // 滚动到底部的函数
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // 当消息列表变化时，滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]); // 仅依赖 messages

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString() + '-user', // 简单唯一 ID
      role: 'user',
      type: 'text',
      content: input,
    };
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

      const result: { text?: string; toolCalls?: ToolCall[] } = await response.json();

      // 检查是否有工具调用
      if (result.toolCalls && result.toolCalls.length > 0) {
        const toolMessages: Message[] = result.toolCalls.map((call) => ({
          id: call.toolCallId ?? Date.now().toString() + '-tool-' + call.toolName, // 使用 toolCallId 或生成 ID
          role: 'assistant',
          type: 'tool',
          content: '', // Tool message doesn't have direct text content initially
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          toolData: call.args,
        }));
        setMessages(prev => [...prev, ...toolMessages]);

        // 如果除了 tool call 还有文本回复，也添加它
        if (result.text) {
          const assistantTextMessage: Message = {
            id: Date.now().toString() + '-text',
            role: 'assistant',
            type: 'text',
            content: result.text,
          };
          setMessages(prev => [...prev, assistantTextMessage]);
        }

      } else if (result.text) {
        // 仅有文本回复
        const assistantMessage: Message = {
          id: Date.now().toString() + '-text',
          role: 'assistant',
          type: 'text',
          content: result.text,
        };
        setMessages(prev => [...prev, assistantMessage]);
      }

    } catch (error) {
      console.error('Failed to fetch chat response:', error);
      const errorMessage: Message = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        type: 'text',
        content: `抱歉，无法获取回复: ${error instanceof Error ? error.message : '未知错误'}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理邮件卡片的确认操作
  const handleEmailAccept = async (messageId: string, data: EmailToolArgs) => {
    console.log(`尝试保存邮件数据 (来自消息 ID: ${messageId}):`, data);
    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save email: ${response.status} ${errorText}`);
      }

      // 更新消息：将工具消息替换为确认文本消息
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
        ? { ...msg, type: 'text', content: '邮件已发送' } 
        : msg
      ));

    } catch (error) {
      console.error('Error saving email via API:', error);
      // 更新消息：将工具消息替换为错误文本消息
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
        ? { 
            ...msg, 
            type: 'text', 
            content: `保存邮件时出错：${error instanceof Error ? error.message : '未知错误'}` 
          } 
        : msg
      ));
    } finally {
      setIsSendingEmail(false);
    }
  };

  // 处理邮件卡片的取消操作
  const handleEmailCancel = (messageId: string) => {
    console.log(`邮件发送已取消 (来自消息 ID: ${messageId})`);
    // 更新消息：将工具消息替换为取消文本消息
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
      ? { ...msg, type: 'text', content: '邮件发送已取消。' } 
      : msg
    ));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl flex flex-col h-[calc(100vh-2rem)]">
        <CardHeader>
          <CardTitle>邮件助手聊天机器人</CardTitle>
        </CardHeader>
        <CardContent ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {/* 根据消息类型渲染 */} 
              {msg.type === 'text' ? (
                <div
                  className={`p-3 rounded-lg max-w-[75%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                >
                  {msg.content}
                </div>
              ) : msg.type === 'tool' && msg.toolName === 'sendEmail' ? (
                // 渲染 EmailCard，传递必要的回调和数据
                <EmailCard 
                  initialData={msg.toolData as EmailToolArgs} // 需要类型断言
                  onAccept={(data) => handleEmailAccept(msg.id, data)} // 传递消息 ID
                  onCancel={() => handleEmailCancel(msg.id)} // 传递消息 ID
                  isLoading={isSendingEmail} // 传递加载状态
                />
              ) : (
                // 可以为其他工具类型或未知类型添加占位符
                <div className="p-3 rounded-lg bg-destructive text-destructive-foreground">
                  不支持的工具类型或消息
                </div>
              )}
            </div>
          ))}
          {isLoading && ( // 加载指示器
            <div className="flex justify-start">
              <div className="p-3 rounded-lg bg-muted animate-pulse">
                正在思考中...
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="mt-auto border-t pt-4">
          <form onSubmit={handleSubmit} className="flex w-full space-x-2">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的消息..."
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || isSendingEmail}>
              {isLoading ? '获取回复...' : '发送'}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
} 