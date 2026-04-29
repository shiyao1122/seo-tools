# Google Console Tools

本地部署的 Google Console SEO 工具平台，当前包含：

- 批量提交 Google Indexing API
- 批量查询 Google Search Console URL Inspection API
- 重复关键词筛选与结果导出
- Excel 导入、后台任务执行、结果回写与下载
- 本地用户管理与角色权限控制

## 技术栈

- 前端：Vue 3 + Vite + Element Plus + Pinia
- 后端：Node.js + Express
- 数据存储：本地 JSON 文件 `backend/data/db.json`

## 用户与权限

- 默认管理员账号：`admin / 123456`
- 管理员可以：
  - 访问系统设置
  - 访问用户管理
  - 创建普通用户或新的管理员
  - 执行全部任务功能
- 普通用户可以：
  - 访问概览
  - 执行批量提交收录
  - 执行批量查询收录
  - 执行重复关键词筛选
  - 查看和下载任务结果
- 普通用户不能：
  - 查看系统设置菜单
  - 查看用户管理菜单
  - 访问系统设置接口
  - 访问用户管理接口

## 本地启动

### 1. 安装依赖

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. 启动后端

```bash
cd backend
copy .env.example .env
npm run dev
```

### 3. 启动前端

```bash
cd frontend
npm run dev
```

默认地址：

- 前端：http://127.0.0.1:5173
- 后端：http://127.0.0.1:3002

## Google 接入说明

1. 在 Google Cloud 创建 Service Account，并启用：
   - Indexing API
   - Search Console API
2. 将 Service Account 邮箱加入对应 Search Console 站点。
3. 使用管理员账号登录后台。
4. 在“系统设置”中填写：
   - GSC Site URL
   - Service Account JSON
   - Indexing / Inspection 延迟参数
5. 导入包含 `url` 列的 Excel 文件开始任务。

## Excel 约定

- 所有批量任务都要求首个工作表包含 `url` 列
- 重复关键词筛选会从 URL 最后一个路径片段提取关键词
- 重复关键词筛选会忽略停用词，再输出全部命中的有效重复词

## 结果列

### 批量提交收录

- `submit_status`
- `submit_message`
- `submit_time`

### 批量查询收录

- `inspect_status`
- `inspect_message`
- `inspect_time`
- `indexed`
- `inspection_verdict`
- `inspection_coverage`
- `inspection_indexing_state`
- `inspection_last_crawl_time`

### 重复关键词筛选

- `页面地址`
- `原关键词`
- `重复词`

## 常见问题

### 前端报 Vite proxy error

如果看到：

```text
connect ECONNREFUSED 127.0.0.1:3002
```

说明前端开发服务器无法连接后端，优先检查：

- backend 是否启动
- backend 是否监听在 `127.0.0.1:3002`
- 本机端口是否被占用

### 普通用户为什么看不到系统设置

这是权限设计。系统设置和用户管理只对管理员开放。
