import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

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
  baseURL: dmxBaseUrl, // 可选，如果 base URL 不同于 OpenAI 官方地址
});

export async function POST(req: Request) {
  try {
    const { prompt }: { prompt: string } = await req.json();

    // 使用自定义配置的客户端实例调用 generateText
    const { text } = await generateText({
      model: openai('gpt-4o'), // 这里仍然需要指定模型名称，但会通过自定义客户端发送请求
      system: '你是一个乐于助人的 AI 助手。',
      prompt,
    });

    // 返回生成的文本
    return Response.json({ text });

  } catch (error) {
    console.error('API /api/chat error:', error);
    // 返回错误信息
    return new Response('生成回复时出错', { status: 500 });
  }
} 