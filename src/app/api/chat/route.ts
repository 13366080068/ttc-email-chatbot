import { generateText } from 'ai';
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
    const { prompt }: { prompt: string } = await req.json();

    // 使用自定义配置的客户端实例调用 generateText，并提供工具定义
    const { text, toolCalls } = await generateText({
      model: openai('gpt-4o'),
      system: '你是一个乐于助人的 AI 助手。你可以使用提供的工具来发送邮件。',
      prompt,
      // 修正 tools 对象的结构
      tools: {
        sendEmail: {
          description: '发送一封邮件给指定的接收者。',
          parameters: sendEmailSchema,
          execute: async (response) => {
            console.log('response:', response)
          },
          // 注意：这里不定义 execute，因为我们希望在前端处理
        }
      },
      toolChoice: 'auto', // 让模型自动选择是否调用工具
    });

    // 返回生成的文本和可能的工具调用信息
    return Response.json({ text, toolCalls });

  } catch (error) {
    console.error('API /api/chat error:', error);
    // 返回错误信息
    return new Response('生成回复时出错', { status: 500 });
  }
} 