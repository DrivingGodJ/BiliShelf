# 拾光 · B站收藏时光机

这是 BiliShelf 的 GitHub Pages 网页版实验入口。它可以根据 UID 查询账号下无需登录即可访问的收藏夹，也支持直接粘贴收藏夹链接；随后把收藏时间、标题、UP 主、简介和封面保存到当前浏览器的 IndexedDB，并提供年月日筛选、关键词搜索、时间轴、随机回忆和“那年今日”。

## 工作方式

```text
GitHub Pages 前端
  -> 只读 Cloudflare Worker 固定入口
  -> Workers VPC 私网服务
  -> Cloudflare Tunnel
  -> Mac 本地代理（127.0.0.1:8787）
  -> B站公开收藏接口

浏览器 IndexedDB
  <- 收藏元数据、上次收藏夹、同步时间
```

网页不会接收或保存 B站 Cookie，也不会移动、删除或新增 B站收藏。私密收藏夹不能仅凭链接读取，第一版只支持公开收藏夹。

Cloudflare 只负责公网入口和私网转发，访问 B站接口的出口是这台 Mac 当前使用的家庭网络 IP。这个架构不需要购买域名，也不使用 Browser Rendering 时长。

## 本地运行

前端需要 Node.js 20.11+；当前 Worker 工具链建议使用 Node.js 22+。同时需要 pnpm。

```bash
pnpm --dir worker install
pnpm --dir frontend install
```

终端一启动 Mac 本地代理：

```bash
pnpm --dir worker start:local
```

终端二：

```bash
pnpm web:dev
```

打开 `http://localhost:5173`。本地网页会默认使用 `http://localhost:8787` 代理。

## 当前线上部署

线上入口是 `https://bilishelf-memory-proxy.bilishelf-memory-proxy.workers.dev`，只开放三个 GET 路由：

- `/api/health`（也兼容 `/health`）
- `/api/folders?uid=...`
- `/api/favorites?mediaId=...&page=...&pageSize=40`（主动刷新可附带 `fresh=1` 绕过两层缓存）

它不能转发任意 URL，也不接受写请求。收藏页在 Mac 上缓存 5 分钟；未命中缓存的请求会排队、限速，并按访客 IP 限制频率，降低公共服务被滥用后触发 B站风控的风险。

重新部署 Worker 网关：

```bash
pnpm --dir worker exec wrangler deploy
```

`worker/wrangler.jsonc` 已绑定现有的 Workers VPC 服务。若在新的 Cloudflare 账号重新部署，需要先创建 Tunnel、把 VPC 服务指向 Tunnel 的 `127.0.0.1:8787`，再把新服务 ID 写入配置。

## Mac 常驻服务

这台 Mac 已配置三个登录级 LaunchAgent：

- `com.drivinggodj.bilishelf-mac-proxy`：启动本地只读代理。
- `com.drivinggodj.bilishelf-tunnel`：通过 HTTP/2 建立到 Workers VPC 的出站 Tunnel。
- `com.drivinggodj.bilishelf-watchdog`：每两分钟检查公网健康状态，连续失败两次才重启 Tunnel，并设置十分钟重启冷却。

登录 Mac 后它们会自动启动，异常退出时也会自动重启。查看状态或手动重启：

```bash
launchctl print gui/$(id -u)/com.drivinggodj.bilishelf-mac-proxy
launchctl print gui/$(id -u)/com.drivinggodj.bilishelf-tunnel
launchctl print gui/$(id -u)/com.drivinggodj.bilishelf-watchdog
launchctl kickstart -k gui/$(id -u)/com.drivinggodj.bilishelf-mac-proxy
launchctl kickstart -k gui/$(id -u)/com.drivinggodj.bilishelf-tunnel
launchctl kickstart -k gui/$(id -u)/com.drivinggodj.bilishelf-watchdog
```

日志位于 `~/Library/Logs/BiliShelf/`。本地代理仅监听 `127.0.0.1`，家庭路由器无需开放端口。
守护脚本源码位于 `worker/scripts/tunnel-watchdog.sh`，本机运行副本安装在 `~/Library/Application Support/BiliShelf/`，避免 macOS 登录项无法读取“文稿”目录。

Mac 必须处于已登录、联网且未睡眠状态；关机、退出登录或睡眠期间，网页仍能打开，但新的收藏同步会暂时失败。访客已存入自己浏览器的数据仍可离线检索。

## 部署 GitHub Pages

1. 将仓库推送到 GitHub。
2. 在仓库 `Settings -> Pages` 中把 Source 设为 `GitHub Actions`。
3. 在 `Settings -> Secrets and variables -> Actions -> Variables` 新建：

```text
BILI_MEMORY_PROXY_URL=https://你的-worker.workers.dev
```

4. 运行 `Deploy Memory Web to GitHub Pages` 工作流，或推送到 `main`。

部署完成后，访客只需输入 UID 并选择收藏夹，也可以直接粘贴公开收藏夹链接。收藏夹 ID 和已经同步的视频保存在访问者自己的浏览器里；再次打开网页会自动恢复，并在数据超过 30 分钟未刷新时检查最新收藏。

## 同步策略

- 第一次连接执行完整分页同步，每页 40 条，请求之间主动降速。
- 再次打开或点击“刷新最新”时，从最新一页开始读取并绕过短期缓存；若远端收藏总数与本地不一致，会自动继续完整核对并隐藏已经取消收藏的视频，否则在连续命中已有记录后快速停止。
- “完整同步”会重新遍历全部页面，并把 B站中已经移除的条目标记为本地留档，而不是删除旧元数据。
- B站约 2020 年 7 月以前的部分收藏可能共享一个迁移时间。网页会按接口原值显示，不推测不存在的精确日期。

## 基于上游

本项目基于 [TLRKFXE/BiliShelf](https://github.com/TLRKFXE/BiliShelf) 修改，继续遵守仓库内的 MIT License 并保留原作者版权声明。
