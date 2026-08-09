# YWzzq · 研究手记

一个无外部主题依赖的中文 Hugo 个人博客，包含响应式首页、文章、归档、标签、全文搜索、RSS、深浅色主题和 GitHub Pages 自动部署。

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
- `params.role`：身份简介
- `params.description`：首页介绍
- `params.social.github`：GitHub 主页
- `params.social.email`：联系邮箱
- `params.focus`：研究方向

文章位于 `content/posts/`。新建文章：

```bash
hugo new content posts/my-new-post.md
```

## 发布到 GitHub Pages

1. 在 GitHub 新建仓库。个人主页建议命名为 `<用户名>.github.io`，项目主页也可以使用任意仓库名。
2. 将本目录提交并推送到 `main` 分支。
3. 在仓库 **Settings → Pages → Build and deployment** 中，把 **Source** 设为 **GitHub Actions**。
4. 推送后，`.github/workflows/hugo.yaml` 会自动构建和发布。

工作流会从 GitHub Pages 获取实际站点地址，因此个人主页、项目主页和自定义域名都不需要手工修改 `baseURL`。
