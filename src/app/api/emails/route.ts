import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // 导入服务器端 Supabase 客户端创建函数

export async function POST(req: Request) {
  try {
    // 1. 解析请求体中的邮件数据
    const { title, body, receiver } = await req.json();

    // 2. 数据校验 (基础)
    if (!title || !receiver) {
      return new Response('Missing required fields: title and receiver', { status: 400 });
    }

    // 3. 创建 Supabase 服务器端客户端
    // 注意：createClient 是异步的
    const supabase = await createClient(); 

    // 4. 插入数据到 emails 表
    const { error } = await supabase
      .from('emails')
      .insert([
        { title, body, receiver }
      ]);

    // 5. 处理数据库错误
    if (error) {
      console.error('Supabase insert error:', error);
      throw new Error(`Failed to save email: ${error.message}`);
    }

    // 6. 返回成功响应
    return NextResponse.json({ message: 'Email saved successfully' }, { status: 201 });

  } catch (error) {
    console.error('API /api/emails error:', error);
    // 返回通用错误信息
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Error saving email: ${errorMessage}`, { status: 500 });
  }
} 