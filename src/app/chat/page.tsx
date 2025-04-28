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
const MESSAGES_PER_PAGE = 10; // 每次加载的消息数量

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]); // 当前显示的消息
  const [isLoading, setIsLoading] = useState(false); // API 请求加载状态
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 新增 state 和 ref
  const allMessagesRef = useRef<Message[]>([]); // 存储所有本地消息
  const [visibleMessagesCount, setVisibleMessagesCount] = useState(MESSAGES_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allHistoryLoaded, setAllHistoryLoaded] = useState(false);

  // 新增：useEffect 用于在客户端加载 localStorage 中的消息
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMessages = localStorage.getItem('chatMessages');
      if (savedMessages) {
        try {
          const allLoadedMessages = JSON.parse(savedMessages) as Message[];
          allMessagesRef.current = allLoadedMessages; // 存储所有消息
          
          // 计算初始显示的最后 N 条消息
          const initialVisibleMessages = allLoadedMessages.slice(-MESSAGES_PER_PAGE);
          setMessages(initialVisibleMessages);
          setVisibleMessagesCount(initialVisibleMessages.length); // 更新可见数量
          
          // 检查是否已加载所有历史
          if (allLoadedMessages.length <= MESSAGES_PER_PAGE) {
            setAllHistoryLoaded(true);
          }
          
          // 初始加载后尝试滚动到底部
          // 使用 setTimeout 确保 DOM 更新后再滚动
          setTimeout(scrollToBottomImmediate, 0); 

        } catch (error) {
          console.error("Failed to parse messages from localStorage", error);
          allMessagesRef.current = [];
          setMessages([]);
          setVisibleMessagesCount(0);
          setAllHistoryLoaded(true); // 解析失败也认为加载完毕
        }
      } else {
         // 如果 localStorage 为空
         allMessagesRef.current = [];
         setMessages([]);
         setVisibleMessagesCount(0);
         setAllHistoryLoaded(true);
      }
    }
    // 这个 effect 只在组件挂载时运行一次
  }, []); // 空依赖数组确保只运行一次

  // 滚动到底部的函数 (立即执行版本)
  const scrollToBottomImmediate = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // 保存到 localStorage useEffect (依赖 allMessagesRef.current 的变化，需要更可靠的触发)
  // 简单的替代方法是在每次修改 ref 后手动调用保存
  const saveMessagesToLocalStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatMessages', JSON.stringify(allMessagesRef.current));
    }
  };

  // 处理 API 响应并更新状态的辅助函数
  const handleApiResponse = (newAssistantMessages: Message[]) => {
      // 更新 Ref (完整历史)
      allMessagesRef.current = [...allMessagesRef.current, ...newAssistantMessages];
      // 更新 State (追加显示的)
      setMessages(prev => [...prev, ...newAssistantMessages]);
      // 保存到 localStorage
      saveMessagesToLocalStorage();
      // 滚动到底部
      setTimeout(scrollToBottomImmediate, 0);
  };

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
    
    // 更新 Ref 和 State
    allMessagesRef.current = [...allMessagesRef.current, userMessage];
    const updatedMessagesWithUser = [...messages, userMessage];
    setMessages(updatedMessagesWithUser);
    setInput('');

    // 在这里立即滚动到底部
    // 使用 setTimeout 确保状态更新引起的 DOM 变化有机会渲染
    setTimeout(scrollToBottomImmediate, 0);

    setIsLoading(true);
    saveMessagesToLocalStorage(); // 保存用户消息
    
    // 构造要发送到 API 的消息历史 (最近 N 条 + 当前输入)
    const messagesForApi = updatedMessagesWithUser.slice(-CONTEXT_WINDOW_SIZE).map(msg => ({
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

      handleApiResponse(newAssistantMessages); // 调用辅助函数处理结果

    } catch (error) {
      console.error('Failed to fetch chat response:', error);
      const errorMessage: Message = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        type: 'text',
        content: `抱歉，处理请求时出错: ${error instanceof Error ? error.message : '未知错误'}`
      };
      handleApiResponse([errorMessage]); // 调用辅助函数处理错误
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
      const updatedMessageContent = '邮件已发送';
      allMessagesRef.current = allMessagesRef.current.map(msg => 
        msg.id === messageId ? { ...msg, type: 'text', content: updatedMessageContent, toolData: undefined } : msg
      );
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, type: 'text', content: updatedMessageContent, toolData: undefined } : msg
      ));
      saveMessagesToLocalStorage(); // 保存更新

    } catch (error) {
      console.error('Error saving email via API:', error);
      // 更新消息：将工具消息替换为错误文本消息
      const updatedMessageContent = `保存邮件时出错：${error instanceof Error ? error.message : '未知错误'}`;
      allMessagesRef.current = allMessagesRef.current.map(msg => 
        msg.id === messageId ? { ...msg, type: 'text', content: updatedMessageContent, toolData: undefined } : msg
      );
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, type: 'text', content: updatedMessageContent, toolData: undefined } : msg
      ));
      saveMessagesToLocalStorage(); // 保存更新
    } finally {
      setIsSendingEmail(false);
    }
  };

  // 处理邮件卡片的取消操作
  const handleEmailCancel = (messageId: string) => {
    console.log(`邮件发送已取消 (来自消息 ID: ${messageId})`);
    // 更新消息：将工具消息替换为取消文本消息
    const updatedMessageContent = '邮件发送已取消。';
    allMessagesRef.current = allMessagesRef.current.map(msg => 
      msg.id === messageId ? { ...msg, type: 'text', content: updatedMessageContent, toolData: undefined } : msg
    );
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, type: 'text', content: updatedMessageContent, toolData: undefined } : msg
    ));
    saveMessagesToLocalStorage(); // 保存更新
  };

  // 加载更多消息的函数
  const loadMoreMessages = () => {
    if (isLoadingMore || allHistoryLoaded) return;

    setIsLoadingMore(true);
    
    // 保留这些用于调试或未来可能的精细调整，但不再用于恢复滚动
    // const currentTopMessageId = messages[0]?.id; 
    // const currentScrollTop = messagesContainerRef.current?.scrollTop ?? 0;
    // const oldScrollHeight = messagesContainerRef.current?.scrollHeight ?? 0;

    const newVisibleCount = visibleMessagesCount + MESSAGES_PER_PAGE;
    const nextMessages = allMessagesRef.current.slice(-newVisibleCount);
    
    setMessages(nextMessages);
    setVisibleMessagesCount(nextMessages.length);

    if (nextMessages.length >= allMessagesRef.current.length) {
      setAllHistoryLoaded(true);
    }

    // 使用 requestAnimationFrame 确保 DOM 更新后再结束加载状态
    // 但不再调整滚动位置
    requestAnimationFrame(() => {
      // if (messagesContainerRef.current && currentTopMessageId) {
      //    const newScrollHeight = messagesContainerRef.current.scrollHeight;
      //    messagesContainerRef.current.scrollTop = currentScrollTop + (newScrollHeight - oldScrollHeight);
      // }
      setIsLoadingMore(false);
    });
  };

  // 处理滚动的 effect
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // 检查是否滚动到顶部附近
      if (container.scrollTop < 50 && !isLoadingMore && !allHistoryLoaded) {
        loadMoreMessages();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);

  }, [isLoadingMore, allHistoryLoaded, loadMoreMessages]); // 依赖项确保函数引用最新

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl flex flex-col h-[calc(100vh-2rem)]">
        <CardHeader>
          <CardTitle>邮件助手聊天机器人</CardTitle>
        </CardHeader>
        <CardContent ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-6">
          {/* 加载更多提示 - 移动到消息列表前 */} 
          {!allHistoryLoaded && (
            <div className="text-center text-muted-foreground text-xs py-4"> {/* 移除 sticky 相关类，调整 padding */} 
              {isLoadingMore ? '加载中...' : '上划加载历史消息'}
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} data-message-id={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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