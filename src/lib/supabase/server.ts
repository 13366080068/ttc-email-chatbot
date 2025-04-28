import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 注意: 这个函数现在是异步的，因为它需要 `await cookies()`
export async function createClient() {
  const cookieStore = await cookies() // 使用 await 获取 cookie store

  // 基于提供的 CookieStore 为服务器组件创建一个 Supabase 客户端。
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            console.error('Error setting cookie in Server Component:', error); // 打印错误
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            console.error('Error removing cookie in Server Component:', error); // 打印错误
          }
        },
      },
    }
  )
}

// 注意: 如果你需要在 Route Handlers 或 Server Actions 中使用，
// 你可能需要调整 cookie 的获取方式，因为它们不直接使用 `cookies()` from `next/headers`。
// 例如，在 Route Handlers 中，你可以从 `NextRequest` 对象中获取 cookies。
// 在 Server Actions 中，你可能需要通过不同的方式传递或访问 cookie store。
// 这个基本的 `createClient` 主要适用于服务器组件。 