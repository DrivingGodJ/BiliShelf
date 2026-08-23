# 拾光 · B站收藏时光机

这是 BiliShelf 的 GitHub Pages 网页版实验入口。它读取公开的 B站收藏夹，把收藏时间、标题、UP 主、简介和封面保存到当前浏览器的 IndexedDB，并提供年月日筛选、关键词搜索、时间轴、随机回忆和“那年今日”。

## 工作方式

```text
GitHub Pages 前端
  -> 只读 Cloudflare Worker
  -> B站公开收藏接口

浏览器 IndexedDB
  <- 收藏元数据、上次收藏夹、同步时间
```

网页不会接收或保存 B站 Cookie，也不会移动、删除或新增 B站收藏。私密收藏夹不能仅凭链接读取，第一版只支持公开收藏夹。

## 本地运行

前端需要 Node.js 20.11+；当前 Worker 工具链建议使用 Node.js 22+。同时需要 pnpm。

```bash
pnpm --dir worker install
pnpm --dir frontend install
```

终端一：

```bash
pnpm --dir worker dev
```

终端二：

```bash
pnpm web:dev
```

打开 `http://localhost:5173`。本地网页会默认使用 `http://localhost:8787` 代理。

## 部署只读代理

1. 注册或登录 Cloudflare，安装依赖后运行：

```bash
pnpm --dir worker deploy
```

2. 记下部署得到的 `https://...workers.dev` 地址。
3. 为减少滥用，建议将 `worker/wrangler.toml` 中的 `ALLOWED_ORIGINS` 从 `*` 改成最终 GitHub Pages 地址，例如：

```toml
ALLOWED_ORIGINS = "https://your-name.github.io"
```

代理只开放两个 GET 路由：

- `/api/health`
- `/api/favorites?mediaId=...&page=...&pageSize=40`

它不能转发任意 URL，也不接受写请求。

## 部署 GitHub Pages

1. 将仓库推送到 GitHub。
2. 在仓库 `Settings -> Pages` 中把 Source 设为 `GitHub Actions`。
3. 在 `Settings -> Secrets and variables -> Actions -> Variables` 新建：

```text
BILI_MEMORY_PROXY_URL=https://你的-worker.workers.dev
```

4. 运行 `Deploy Memory Web to GitHub Pages` 工作流，或推送到 `main`。

部署完成后，访客只需粘贴公开收藏夹链接。收藏夹 ID 和已经同步的视频保存在访问者自己的浏览器里；再次打开网页会自动恢复，并在数据超过 30 分钟未刷新时检查最新收藏。

## 同步策略

- 第一次连接执行完整分页同步，每页 40 条，请求之间主动降速。
- 再次打开或点击“刷新最新”时，从最新一页开始读取；连续命中已有记录后停止。
- “完整同步”会重新遍历全部页面，并把 B站中已经移除的条目标记为本地留档，而不是删除旧元数据。
- B站约 2020 年 7 月以前的部分收藏可能共享一个迁移时间。网页会按接口原值显示，不推测不存在的精确日期。

## 基于上游

本项目基于 [TLRKFXE/BiliShelf](https://github.com/TLRKFXE/BiliShelf) 修改，继续遵守仓库内的 MIT License 并保留原作者版权声明。
