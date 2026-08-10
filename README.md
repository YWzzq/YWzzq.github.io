# YWzzq · 笔记与项目

一个无外部主题依赖的中文 Hugo 个人博客，用于整理文章、项目与阶段性想法，包含响应式首页、归档、标签、全文搜索、RSS、深浅色主题和 GitHub Pages 自动部署。

## 本地预览

需要 Hugo Extended `0.164.0` 或更高版本。

```bash
hugo server -D
```

浏览器打开 `http://localhost:1313/`。

提交前可运行与线上部署一致的检查：

```bash
hugo --cleanDestinationDir --gc --minify --panicOnWarning \
  --printPathWarnings --printUnusedTemplates
node scripts/check-site.mjs public
```

## 修改个人信息

主要信息集中在 `hugo.toml`：

- `params.displayName`：显示名称
- `params.role`：首页简短定位
- `params.description`：首页介绍
- `params.social.github`：GitHub 主页
- `params.social.email`：联系邮箱
- `params.focus`：当前关注的话题

文章位于 `content/posts/`，项目内容位于 `content/projects/`。新建文章：

```bash
hugo new content posts/my-new-post.md
```

## 配置 Twikoo 评论

文章页已经预留 Twikoo 评论区。首次部署时，先按 [Twikoo 快速开始](https://twikoo.js.org/quick-start.html) 部署评论后端，再在 `hugo.toml` 填入环境 ID：

```toml
[params.twikoo]
  enabled = true
  envId = '你的环境 ID 或 Vercel 地址'
```

然后在 Twikoo 管理面板设置：

- `COMMENT_PAGE_SIZE = 100`：单次最多读取 100 条主评论。
- `LIMIT_LENGTH = 1000`：评论内容最多 1000 字；这是后端校验，不能只依赖浏览器输入框。
- `SHOW_EMOTION = true`：显示 Emoji 表情按钮。

博客前端会将每篇文章最多呈现 100 条主评论、每条主评论最多呈现 50 条回复，并在达到回复上限后禁用继续回复。Twikoo 的评论数据仍保存在后端；如果需要数据库层面的总量硬限制，还需要在 Twikoo 云函数的 `COMMENT_SUBMIT` 中按文章 URL 和回复楼层增加校验。

默认使用锁定版本的 `twikoo.min.js` CDN 脚本并启用 SRI。如果使用腾讯云云开发，请按 Twikoo 文档将 `script` 改为 `twikoo.all.min.js`，并同步替换对应的 `scriptIntegrity`。

## 发布到 GitHub Pages

1. 在 GitHub 新建仓库。个人主页建议命名为 `<用户名>.github.io`，项目主页也可以使用任意仓库名。
2. 将本目录提交并推送到 `main` 分支。
3. 在仓库 **Settings → Pages → Build and deployment** 中，把 **Source** 设为 **GitHub Actions**。
4. 推送后，`.github/workflows/hugo.yaml` 会自动构建和发布。

工作流会从 GitHub Pages 获取实际站点地址，因此个人主页、项目主页和自定义域名都不需要手工修改 `baseURL`。
