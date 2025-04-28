import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // 如果你需要更新 cookie，比如在服务器操作中
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // 如果你需要删除 cookie
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // 刷新过期的会话 - 服务器组件需要
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  await supabase.auth.getSession()

  // 可选: 重定向逻辑可以放在这里，或者在页面/布局服务器组件中处理
  // const { data: { session } } = await supabase.auth.getSession();
  // if (!session && request.nextUrl.pathname.startsWith('/protected')) {
  //   return NextResponse.redirect(new URL('/login', request.url))
  // }

  return response
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，但以下开头的除外:
     * - _next/static (静态文件)
     * - _next/image (图像优化文件)
     * - favicon.ico (favicon 文件)
     * 你可以自由修改此模式以包含更多路径。
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 