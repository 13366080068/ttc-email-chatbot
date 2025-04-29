'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import EmailCard from '@/components/EmailCard'; // 导入邮件卡片组件
import { Trash2 } from 'lucide-react'; // 导入 Trash2 图标
// 导入 User 和 Bot 图标
import { User, Bot } from 'lucide-react';
// 导入 Tooltip 组件
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
// 导入 AlertDialog 组件
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { type CoreMessage } from 'ai'; // 导入 CoreMessage

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

const MESSAGES_PER_PAGE = 10; // 每次加载的消息数量
const SIMULATED_STREAM_DELAY = 50; // Milliseconds between text chunks
const TOKEN_LIMIT = 120000; // 安全 token 上限
const SYSTEM_PROMPT = '你是一个乐于助人的 AI 助手。你可以使用提供的工具来发送邮件。请在收集齐发送邮件所需的所有信息（接收者、标题、正文）后再调用 sendEmail 工具。';

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
  const activeStreamingIntervals = useRef(0); // Ref to track active streams

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

  // --- Modified handleApiResponse for simulated streaming ---
  const handleApiResponse = useCallback((assistantResponses: Message[]) => {
    const textMessages = assistantResponses.filter(msg => msg.type === 'text' && msg.content);
    const toolMessages = assistantResponses.filter(msg => msg.type === 'tool');

    // Reset counter at the beginning of handling a new response batch
    activeStreamingIntervals.current = textMessages.length;

    // 1. Handle tool messages immediately
    if (toolMessages.length > 0) {
      allMessagesRef.current = [...allMessagesRef.current, ...toolMessages];
      setMessages(prev => [...prev, ...toolMessages]);
      // Save immediately after adding tool messages
      saveMessagesToLocalStorage(); 
       // Scroll after adding tool messages
      setTimeout(scrollToBottomImmediate, 0); 
    }

    // If there are no text messages to stream, and only tool messages were handled,
    // set loading to false now.
    if (textMessages.length === 0 && toolMessages.length > 0) {
        setIsLoading(false);
    }
    // If there are no messages at all (empty response), also set loading false.
    if (textMessages.length === 0 && toolMessages.length === 0) {
        setIsLoading(false);
    }

    // 2. Handle text messages with simulated streaming
    textMessages.forEach((textMsg) => {
      const fullText = textMsg.content;
      const messageId = textMsg.id; 
      
      const initialMessage: Message = { ...textMsg, content: '' };
      allMessagesRef.current = [...allMessagesRef.current, initialMessage];
      setMessages(prev => [...prev, initialMessage]);

      setTimeout(scrollToBottomImmediate, 0);

      let charIndex = 0;
      const intervalId = setInterval(() => {
        if (charIndex < fullText.length) {
          const nextChunk = fullText.substring(charIndex, charIndex + 2); // Stream 2 chars at a time
          charIndex += 2;
          setMessages(prev =>
            prev.map(m => 
              m.id === messageId ? { ...m, content: m.content + nextChunk } : m
            )
          );
          // Also update the ref during streaming (important for context window)
          const refMsgIndex = allMessagesRef.current.findIndex(m => m.id === messageId);
          if (refMsgIndex !== -1) {
              allMessagesRef.current[refMsgIndex].content += nextChunk;
          }
           // Scroll during streaming to keep up
          scrollToBottomImmediate(); 
        } else {
          clearInterval(intervalId);
          // Decrement counter when a stream finishes
          activeStreamingIntervals.current -= 1;
          // Save after this specific stream finishes
          saveMessagesToLocalStorage(); 
          // Only set loading false when ALL streams for this batch are done
          if (activeStreamingIntervals.current === 0) {
            setIsLoading(false);
          }
        }
      }, SIMULATED_STREAM_DELAY);
    });

  }, []); // Keep dependency array empty if setIsLoading is stable (from useState)

  // --- handleSubmit remains largely the same, calls handleApiResponse ---
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
    
    allMessagesRef.current = [...allMessagesRef.current, userMessage];
    const updatedMessagesWithUser = [...messages, userMessage];
    setMessages(updatedMessagesWithUser);
    setInput('');
    setTimeout(scrollToBottomImmediate, 0);
    setIsLoading(true);
    saveMessagesToLocalStorage();

    // --- Token Calculation Logic (using dynamic import) ---
    let messagesForApi: CoreMessage[] = [];
    try {
      // 动态导入 tiktoken
      const { get_encoding } = await import("@dqbd/tiktoken");
      const encoding = get_encoding("cl100k_base"); 
      let currentTokens = encoding.encode(SYSTEM_PROMPT).length;
      const latestMessages = [...allMessagesRef.current];
      for (let i = latestMessages.length - 1; i >= 0; i--) {
        const msg = latestMessages[i];
        let messageStringToTokenize = `role: ${msg.role}\ncontent: ${msg.content}\n`;
        if (msg.type === 'tool' && msg.toolName && msg.toolData) {
             messageStringToTokenize += `tool_name: ${msg.toolName}\ntool_data: ${JSON.stringify(msg.toolData)}\n`;
        } else if (msg.type === 'tool' && msg.toolCallId) {
             messageStringToTokenize += `tool_call_id: ${msg.toolCallId}\n`;
        }
        const messageTokens = encoding.encode(messageStringToTokenize).length;
        if (currentTokens + messageTokens <= TOKEN_LIMIT) {
          currentTokens += messageTokens;
          messagesForApi.unshift({ role: msg.role, content: msg.content });
        } else {
          break; 
        }
      }
      encoding.free(); 
      console.log(`[Token Calculation] Sending ${messagesForApi.length} messages, approx. ${currentTokens} tokens.`);
    } catch (e) {
        console.error("Token calculation failed, sending last 5 messages as fallback:", e);
        messagesForApi = allMessagesRef.current.slice(-5).map(msg => ({ role: msg.role, content: msg.content }));
    }
    // --- End Token Calculation ---

    try {
      // Ensure messagesForApi has at least the user's last message if calculation failed badly
      if (messagesForApi.length === 0 && allMessagesRef.current.length > 0) {
         console.warn("Token calculation resulted in zero messages, sending only the last user message.");
         const lastUserMsg = allMessagesRef.current[allMessagesRef.current.length - 1];
         messagesForApi = [{ role: lastUserMsg.role, content: lastUserMsg.content }];
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: messagesForApi }), 
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${errorText}`);
      }

      const result: { text?: string; toolCalls?: ToolCall[] } = await response.json();
      const newAssistantMessages: Message[] = [];

      if (result.toolCalls && result.toolCalls.length > 0) {
        const toolMessages: Message[] = result.toolCalls.map((call) => ({
          id: call.toolCallId ?? Date.now().toString() + '-tool-' + call.toolName,
          role: 'assistant',
          type: 'tool',
          content: '', 
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          toolData: call.args,
        }));
        newAssistantMessages.push(...toolMessages);
      } else if (result.text) {
        const assistantTextMessage: Message = {
          id: Date.now().toString() + '-text',
          role: 'assistant',
          type: 'text',
          content: result.text, 
        };
        newAssistantMessages.push(assistantTextMessage);
      }

      if (newAssistantMessages.length > 0) {
          handleApiResponse(newAssistantMessages); 
      } else {
          console.warn("API returned no text or tool calls.");
          setIsLoading(false); 
      }

    } catch (error) {
      console.error('Failed to fetch chat response:', error);
      const errorMessage: Message = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        type: 'text',
        content: `抱歉，处理请求时出错: ${error instanceof Error ? error.message : '未知错误'}`
      };
      handleApiResponse([errorMessage]); 
    } 
    // isLoading is set to false inside handleApiResponse when streaming finishes
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

  // 修改：这是实际执行清除操作的函数
  const executeClearChat = () => {
    setMessages([]); // 清空当前显示的消息
    allMessagesRef.current = []; // 清空所有历史消息的 Ref
    setVisibleMessagesCount(MESSAGES_PER_PAGE); // 重置可见消息计数
    setAllHistoryLoaded(true); // 清除后所有历史都已加载
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chatMessages'); // 从 localStorage 移除记录
    }
    console.log("聊天记录已清除。");
  };

  return (
    <TooltipProvider> 
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-2xl flex flex-col h-[calc(100vh-2rem)]">
          <CardHeader className="flex flex-row items-center justify-between"> 
            <CardTitle>邮件助手聊天机器人</CardTitle>
            {/* 使用 AlertDialog 替换 Tooltip 包裹 (Tooltip 可以放在 Trigger 内部) */}
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* 这个按钮现在是 AlertDialog 的触发器 */}
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      // onClick 不再需要，由 Trigger 处理
                      disabled={isLoading || isSendingEmail || messages.length === 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>清除聊天记录</p>
                </TooltipContent>
              </Tooltip>
              {/* AlertDialog 的内容 */}
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认清除？</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定要清除所有聊天记录吗？此操作不可恢复。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  {/* 点击确认按钮时调用 executeClearChat */}
                  <AlertDialogAction onClick={executeClearChat}>确认清除</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardHeader>
          <CardContent ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-6">
            {/* 加载更多提示 - 移动到消息列表前 */} 
            {!allHistoryLoaded && (
              <div className="text-center text-muted-foreground text-xs py-4"> {/* 移除 sticky 相关类，调整 padding */} 
                {isLoadingMore ? '加载中...' : '上划加载历史消息'}
              </div>
            )}
            {messages.map((msg, index) => {
              // 确定当前 EmailCard 是否已被后续助手消息取代
              const isSuperseded = 
                msg.type === 'tool' && 
                msg.toolName === 'sendEmail' && 
                messages.slice(index + 1).some(laterMsg => laterMsg.role === 'assistant');

              // 决定图标和对齐方式
              const isUser = msg.role === 'user';
              const IconComponent = isUser ? User : Bot;
              const alignmentClasses = isUser ? 'justify-end' : 'justify-start';
              const messageBubbleClasses = isUser ? 'bg-primary text-primary-foreground' : 'bg-muted';
              const iconOrderClass = isUser ? 'order-2' : 'order-1';
              const bubbleOrderClass = isUser ? 'order-1' : 'order-2';
              const containerGapClass = 'gap-2';

              return (
                // 最外层容器控制左右对齐, 添加 w-full
                <div key={msg.id} data-message-id={msg.id} className={`flex w-full ${alignmentClasses}`}>
                  {/* 内层容器控制图标和气泡的排列及间距，也根据用户/助手调整 */}
                  <div className={`flex w-full items-start ${containerGapClass} ${isUser ? 'justify-end' : ''}`}> {/* 用户时内层也 justify-end */}
                    {/* 头像图标 */}
                    <div className={`flex-shrink-0 ${iconOrderClass} mt-1`}> 
                      <IconComponent className="h-6 w-6 text-muted-foreground" />
                    </div>

                    {/* 根据消息类型渲染内容 */}
                    {msg.type === 'text' ? (
                      // 文本消息使用带 max-w 的容器
                      <div className={`${bubbleOrderClass} max-w-[75%]`}>
                        <div
                          className={`p-3 rounded-lg ${messageBubbleClasses}`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ) : msg.type === 'tool' && msg.toolName === 'sendEmail' && msg.toolData ? (
                      <div className={`${bubbleOrderClass} w-full max-w-md`}>
                        <EmailCard 
                          initialData={msg.toolData as EmailToolArgs} 
                          onAccept={(data) => handleEmailAccept(msg.id, data)} 
                          onCancel={() => handleEmailCancel(msg.id)} 
                          isLoading={isSendingEmail} 
                          isSuperseded={isSuperseded}
                        />
                      </div>
                    ) : msg.type === 'tool' && msg.toolName === 'sendEmail' && !msg.toolData ? (
                      <div className={`${bubbleOrderClass} max-w-[75%]`}> {/* 错误消息保持 max-w-[75%] */}
                        <div className="p-3 rounded-lg bg-destructive text-destructive-foreground">
                          无效的邮件工具数据
                        </div>
                      </div>
                    ) : (
                      <div className={`${bubbleOrderClass} max-w-[75%]`}> {/* 其他未知消息也加容器 */}
                        <div className="p-3 rounded-lg bg-destructive text-destructive-foreground">
                          不支持的工具类型或消息
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* 修改加载指示器的结构，使其包含 Bot 图标 */}
            {isLoading && activeStreamingIntervals.current === 0 && ( 
              <div className="flex w-full justify-start">
                <div className="flex items-start gap-2">
                  {/* 头像图标 */}
                  <div className="flex-shrink-0 order-1 mt-1">
                    <Bot className="h-6 w-6 text-muted-foreground" />
                  </div>
                  {/* 加载提示内容容器 */}
                  <div className="order-2">
                    <div className="p-3 rounded-lg bg-muted animate-pulse">
                      正在思考中...
                    </div>
                  </div>
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
    </TooltipProvider>
  );
} 