# UniDesktop 官网

基于现有 Astro + Starlight 仓库制作的中文官网，包含产品介绍、SDK 架构示意、核心能力、兼容矩阵、语言示例，以及中英双语的完整开发文档。

## 开发与构建

需要 Node.js 22.12+（建议 Node.js 24）。沿用仓库的 pnpm 锁文件：

```sh
pnpm install --frozen-lockfile
pnpm dev --background
pnpm build
pnpm preview
```

开发服务默认为 `http://localhost:4321`。使用 `pnpm astro dev status`、`pnpm astro dev logs`、`pnpm astro dev stop` 管理后台服务。

也可使用 `npm install --package-lock=false`、`npm run dev -- --background` 和 `npm run build`。无需添加前端 UI 框架或运行时服务。

## 打包与部署

站点是纯静态产物，`pnpm build` 生成的 `dist/` 就是可部署内容。`release/` 下是打包好的版本：

- `unidesktop-site-<日期>.zip` / `.tar.gz`：站点根目录内容，外加 `_deploy/`（服务器与容器配置、部署说明）
- `release/stage/`：同一份内容的解包形态，方便直接查看或改配置

包内 `_deploy/DEPLOY.md` 面向运维，覆盖 nginx、Docker、404、缓存策略，以及 Pagefind 的二进制文件不能被二次压缩这几件事。`_deploy/nginx.conf` 已用 nginx 1.28 实际跑过 `nginx -t` 与完整的请求验证。

部署时有两条硬约束：

- **必须部署在域名根路径下**。页面与资源用的是绝对路径（`/_astro/...`、`/zh-cn/...`），放到子路径会让所有资源 404。
- 换域名要改 `astro.config.mjs` 的 `site` 后重新构建，`sitemap` 与 `canonical` 都取这个值。

`release/` 已在 `.gitignore` 中忽略，不进版本库。

## 页面与文件

- `/`：中文官网首页；`src/pages/index.astro`。
- `/zh-cn/`：中文文档入口；`/en/`：英文文档入口，两侧逐页对应。
- 文档分四个分区，中英结构一致：`getting-started`（快速开始）、`guides`（功能指南）、`reference`（参考手册）、`internals`（内部实现）。
- `src/content/docs/zh-cn/`、`src/content/docs/en/`：双语文档内容（**由同步脚本生成，不要手改**，见下）。
- `docs-overrides/`：官网自己加的文档页，同步时覆盖进去，不会被冲掉。
- `src/styles/home.css`：首页响应式布局与交互状态。
- `src/styles/starlight-theme.css`：文档页的主题桥接，把 Starlight 的语义变量映射到同一套 Cobalt 令牌，让两侧不再像两个产品。注意 Starlight 的 `--sl-color-white/black` 命名在浅色下是**反的**（`white` 是文字色、`black` 是背景色），文件里有说明。
- `tokens.css`：颜色、字体、间距与动效变量，首页与文档共用。标题使用本地托管的 Space Grotesk，中文回退到系统字体。
- `public/unidesktop-logo.png`：来自 SDK 仓库的官方标志。

原有的 `/zh-cn/guides/example/`、`/zh-cn/reference/example/` 及英文同名路径已由手写页面换成正式文档，并保留为 301 重定向，配置见 `astro.config.mjs`。

## 首页动效

首页只有三个动效，都服务于理解产品，不服务于"看起来热闹"：

1. **架构图信号传播**（首屏播放一次）——四种语言宿主汇入 API 契约，再同时打到 Windows 与 Linux。这是产品论点本身：一次调用，两个平台。
2. **回退链探测下扫**（滚动进入视口播放一次）——高亮依次走过 `XDG Portal → 原生 IPC → CLI → Unsupported`，只标记顺序，不标记哪一层真的可用，因此不会对访客的机器做出错误陈述。
3. **代码 Tab 交叉淡入**——原来切换是硬跳。

三条硬约束，改动时不要破坏：

- **默认渲染就是最终状态**。动效只在 JS 加上 `motion-arch` / `motion-cascade` / `data-*` 类之后才存在。无 JS、脚本报错、动画被拦三种情况下页面都必须完整可见。
- **所有动效规则写在 `@media (prefers-reduced-motion: no-preference)` 里**。这一点不能省：`home.css` 顶部的减少动效块用 `!important` 关掉了全部动画，如果把 `opacity: 0` 的初始态写在守卫之外，开启减少动效的用户会永远看不到这些元素。
- **每条动效只播放一次**，没有无限循环；只用 `transform`、`opacity` 与 `stroke-dashoffset`（描线不触发重排）；缓动只取 `--ease-out` / `--ease-in` / `--ease-in-out`。

连线描线依赖每条 `<path>` 上的 `pathLength="100"`——它把虚线长度归一化，否则 `preserveAspectRatio="none"` 的非等比缩放会让描线速度忽快忽慢。拆开 SVG 路径时别丢掉这个属性。

## 发布

`pnpm build` 生成 `dist/`，可上传到支持静态网站的托管服务。`astro.config.mjs` 中的生产域名为项目 README 公布的 `https://unidesktop.sr-studio.cn`。本次仅实现与本地验证，不自动发布。

## 内容依据

产品内容来自 [社区介绍](https://github.com/UniDesktop/.github/blob/main/profile/README.md) 与 [SDK README](https://github.com/UniDesktop/SDK/blob/main/README.md)，核对日期为 2026-09-27。

`/zh-cn/` 与 `/en/` 下的文档来自官方文档仓库 [UniDesktop/unidesktop.github.io](https://github.com/UniDesktop/unidesktop.github.io)（线上站点 <https://unidesktop.github.io/>）。

## 文档同步

官网**自己托管文档**，而不是外链到文档站——站点服务在 `unidesktop.sr-studio.cn`，把读者送去另一个域名看文档是更差的选择。代价是会漂移，所以有工具来治它：

```sh
node scripts/sync-docs.mjs                 # 拉上游、改写、落地
node scripts/sync-docs.mjs --check         # 只报告差异，不写文件（有漂移返回 1）
node scripts/sync-docs.mjs --source DIR    # 用本地已有的上游检出，便于离线调试
```

`.github/workflows/sync-docs.yml` 每天定时跑一次，也可以在 Actions 页手动触发。有变化时它会**先构建验证**，再开一个 PR——不会直接把未经验证的文档推到 main。上游是公开仓库，克隆不需要任何密钥。

**不要直接手改 `src/content/docs/` 下的正文**，那会在下次同步被覆盖。要改正文请改上游仓库，或改 `docs-overrides/`。

脚本按顺序做这几件事：

1. 读上游的 `src/content/docs`
2. 中文（上游的根语言）→ `src/content/docs/zh-cn`；英文（上游 `/en`）→ `src/content/docs/en`
3. 改写站内绝对链接：上游中文在根，官网中文在 `/zh-cn` 下，所以 `](/guides/x/)` 要变成 `](/zh-cn/guides/x/)`
4. 覆盖 `docs-overrides/`（上游没有、官网自己加的页面）
5. 重新应用去重修正（上游逐字重复的整节）
6. 把上游 commit 记进 `src/content/docs/.sync-state.json`

第 4、5 步是幂等的，而且会自愈：上游一旦修好重复，规则就不再匹配。

### 相对上游的差异一览

自动改写：

- 中文文档的站内绝对链接补 `/zh-cn` 前缀
- 中文文档首页 hero 图片的相对路径按目录深度调整

本地新增（存放在 `docs-overrides/`，同步不会冲掉）：

- `internals/protocols/index.md`（中英各一份）：协议分区概览

去重修正（上游是逐字重复，脚本每次会重新应用）：

- `zh-cn/internals/protocols/statusnotifieritem.md`：`## 注册顺序` 整节重复两次，删第二份
- `en/guides/troubleshooting.md`：`## Diagnostics CLI` 整节重复两次，删第二份

已知上游问题，本站未改动：

- `zh-cn/internals/protocols/dbusmenu.md` 与 `notifyicon.md` 存在近似重复——同一接口表、同一图标来源表各出现两次。属改稿范围，建议在上游修正。
- 中文 internals 分区的章节比英文版更多，两侧并非严格逐页对等。

### 侧边栏要手工跟一次

`astro.config.mjs` 里的"内部实现"分区是**显式列出条目**的（Starlight 的 autogenerate 会用目录名当分组标签，中文站点会因此显示 `protocols`）。所以上游若新增 internals 页面，同步脚本会把文件拉下来，但**侧边栏不会自动出现**——需要在那份配置里补一条。其余三个分区是 autogenerate，不受影响。

已实现能力与路线图分开标注；无公开预编译 Release 时提供源码 ZIP 与构建指引。后续发布安装包时，请同步更新首页与入门文档。官网不在浏览器内执行 SDK 示例。

字体使用本地托管的 Space Grotesk，许可证见 `public/fonts/OFL-Space-Grotesk.txt`；中文使用系统字体，不依赖外部字体服务。
