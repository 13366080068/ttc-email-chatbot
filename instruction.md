# 项目概览
在当前使用了App Router的Next.js项目中前端使用了Next.js 15、shadcn、tailwind、Lucid icon，后端连接数据库使用了Supabase。

# 目标

# 数据库设计
## 数据表结构
### users 表（用户表）
```
用户信息表 (与 Supabase Auth 集成)
- id: uuid PRIMARY KEY (与 Supabase Auth 用户ID保持一致)
- email: text UNIQUE NOT NULL (邮箱，与 Auth 一致)
- name: text (用户名)
- phone: text (电话号码)
- avatar: text (头像URL)
- role: text DEFAULT 'customer' (用户角色: customer/admin)
- email_verified: boolean DEFAULT false (邮箱是否已验证)
- auth_provider: text DEFAULT 'email' (认证提供商: email/google/facebook等)
- created_at: timestamptz DEFAULT now()
- last_login: timestamptz
```

## 数据关系与索引设计
### 表关系设计
### 索引设计

# 后端API接口

# 核心功能(PRD)
