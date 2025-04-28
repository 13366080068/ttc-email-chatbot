import { generateText, CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// 允许 Edge 函数运行时，如果你想部署到 Vercel Edge
// export const runtime = 'edge';

// 从环境变量读取自定义配置
const dmxApiKey = process.env.DMX_API_KEY;
const dmxBaseUrl = process.env.DMX_API_BASE_URL;

if (!dmxApiKey) {
  throw new Error('Missing environment variable: DMX_API_KEY');
}

// 创建自定义配置的 OpenAI 客户端实例
const openai = createOpenAI({
  apiKey: dmxApiKey,
  baseURL: dmxBaseUrl,
});

// 定义发送邮件工具的 schema 和描述
const sendEmailSchema = z.object({
  title: z.string().describe('邮件标题'),
  body: z.string().describe('邮件正文内容'),
  receiver: z.string().email().describe('接收者的电子邮件地址'),
});

export async function POST(req: Request) {
  try {
    // 修改：接收完整的消息历史
    const { messages }: { messages: CoreMessage[] } = await req.json();

    // (可选) 校验 messages 数组是否有效
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response('Invalid request body: messages array is required.', { status: 400 });
    }

    // 使用消息历史调用 generateText
    const { text, toolCalls } = await generateText({
      model: openai('gpt-4o'),
      system: '你是一个乐于助人的 AI 助手。你可以使用提供的工具来发送邮件。请在收集齐发送邮件所需的所有信息（接收者、标题、正文）后再调用 sendEmail 工具。',
      messages: messages, // 传递完整的消息历史
      tools: {
        sendEmail: {
          description: '发送一封邮件给指定的接收者。',
          parameters: sendEmailSchema,
        }
      },
      toolChoice: 'auto',
    });

    // 返回生成的文本和可能的工具调用信息
    return Response.json({ text, toolCalls });

  } catch (error) {
    console.error('API /api/chat error:', error);
    // 返回错误信息
    return new Response('生成回复时出错', { status: 500 });
  }
} 