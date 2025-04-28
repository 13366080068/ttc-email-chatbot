import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// 允许 Edge 函数运行时，如果你想部署到 Vercel Edge
// export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { prompt }: { prompt: string } = await req.json();

    // 请求 OpenAI 生成文本
    const { text } = await generateText({
      model: openai('gpt-4o'), // 或者使用 gpt-3.5-turbo 等其他模型
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