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
  originalPrompt?: string; // 原始提示
}

// 定义 API 返回的 ToolCall 类型 (根据 Vercel AI SDK 简化)
interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

const CONTEXT_WINDOW_SIZE = 5; // 定义发送给 API 的历史消息数量

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
    const currentInput = input;
    if (!currentInput.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString() + '-user',
      role: 'user',
      type: 'text',
      content: currentInput,
    };
    
    // 将新用户消息添加到当前消息列表，以便构造发送给 API 的历史
    const updatedMessages = [...messages, userMessage]; 
    setMessages(updatedMessages); // 更新 UI 显示
    setInput('');
    setIsLoading(true);

    // 构造要发送到 API 的消息历史 (最近 N 条 + 当前输入)
    const messagesForApi = updatedMessages.slice(-CONTEXT_WINDOW_SIZE).map(msg => ({
        role: msg.role,
        content: msg.content,
        // 如果需要传递 tool_calls 和 tool_results 以实现更复杂的工具交互，
        // Vercel AI SDK 的 CoreMessage 支持这些字段，但 generateText 可能需要特定处理
        // 对于当前场景（仅发送历史和新提示）， role 和 content 通常足够
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // 修改：发送 messages 数组
        body: JSON.stringify({ messages: messagesForApi }), 
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${errorText}`);
      }

      const result: { text?: string; toolCalls?: ToolCall[] } = await response.json();
      const newAssistantMessages: Message[] = []; // 注意这里变量名改了下

      // 检查是否有工具调用
      if (result.toolCalls && result.toolCalls.length > 0) {
        const toolMessages: Message[] = result.toolCalls.map((call) => ({
          id: call.toolCallId ?? Date.now().toString() + '-tool-' + call.toolName,
          role: 'assistant',
          type: 'tool',
          content: '',
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          toolData: call.args,
          // 不再需要在消息中保存 originalPrompt，因为历史已发送
          // originalPrompt: isFeedbackForTool ? promptForApi : currentInput,
        }));
        newAssistantMessages.push(...toolMessages);
      }
      
      // 如果有文本回复
      if (result.text) {
         const assistantTextMessage: Message = {
           id: Date.now().toString() + '-text',
           role: 'assistant',
           type: 'text',
           content: result.text,
         };
         newAssistantMessages.push(assistantTextMessage);
      }

      // 更新消息列表：直接追加新消息
      // 移除之前复杂的 isFeedbackForTool 判断和替换逻辑
      setMessages(prev => [...prev, ...newAssistantMessages]);

    } catch (error) {
      console.error('Failed to fetch chat response:', error);
      const errorMessage: Message = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        type: 'text',
        content: `抱歉，处理请求时出错: ${error instanceof Error ? error.message : '未知错误'}`
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
              ) : msg.type === 'tool' && msg.toolName === 'sendEmail' && msg.toolData ? (
                // Email Card 渲染 (移除 onSubmitFeedback prop)
                <EmailCard 
                  initialData={msg.toolData as EmailToolArgs} 
                  onAccept={(data) => handleEmailAccept(msg.id, data)} 
                  onCancel={() => handleEmailCancel(msg.id)} 
                  isLoading={isSendingEmail} // 只需传递 isSendingEmail
                />
              ) : msg.type === 'tool' && msg.toolName === 'sendEmail' && !msg.toolData ? (
                <div className="p-3 rounded-lg bg-destructive text-destructive-foreground">
                  无效的邮件工具数据
                </div>
              ) : (
                // 可以为其他工具类型或未知类型添加占位符
                <div className="p-3 rounded-lg bg-destructive text-destructive-foreground">
                  不支持的工具类型或消息
                </div>
              )}
            </div>
          ))}
          {isLoading && ( // 主加载指示器
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
              disabled={isLoading || isSendingEmail}
            />
            <Button type="submit" disabled={isLoading || isSendingEmail}> 
              {isLoading || isSendingEmail ? '处理中...' : '发送'}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
} 