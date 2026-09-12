# Yukiguni

Yukiguni 是一个使用 [Quarto](https://quarto.org/) 构建的个人博客，收录学习笔记、研究综述、工程实践和摄影作品。文章以中文为主，使用 Markdown 与数学公式组织内容，部分文章提供可在浏览器中运行的交互计算。

源码仓库：[recynie/blog](https://github.com/recynie/blog)，源码分支为 `main`。

## 内容

- **数学与机器学习**：组合数学、概率论、Neural ODE、Transformer、PPO / GRPO，以及神经网络损失地形。
- **科研工具与自动化研究**：文献工具、自动化研究系统及相关方法调查。
- **开发与系统实践**：Linux 环境、Python 工具、容器、编辑器和应用部署记录。
- **摄影**：Gallery 以响应式瀑布流展示照片，支持灯箱查看。

首页提供按日期排列的文章列表，以及分类、排序和筛选功能；站内搜索用于查找文章内容。

## 技术实现

### 静态网站

Quarto 将 `.qmd` 源文件构建为 HTML，输出到 `_site/`。网站采用内置 Zephyr 主题，通过少量 CSS 调整配色、文章列表和图库布局。导航、目录、搜索和图片灯箱使用 Quarto 原生功能。

数学公式由 MathJax 渲染，额外启用 `mathtools` 扩展。普通文章默认关闭代码执行，构建时无需运行文章中的命令或代码。

## 本地使用

### 环境

- Quarto **≥ 1.9.20**，满足所用扩展的要求。
- [uv](https://docs.astral.sh/uv/)，用于管理 Python 构建依赖及运行校验脚本。
- Python **≥ 3.11**，可由 uv 管理。

Quarto 安装方式见[官方说明](https://quarto.org/docs/get-started/)。仓库已包含 `quarto-marimo` **0.5.0**；交互文章的 front matter 声明 `marimo==0.24.0` 和 `numpy>=2,<3`，扩展通过 uv 管理其环境。

```bash
# 构建全站
quarto render

# 校验构建结果
uv run scripts/verify.py

# 本机预览
quarto preview --host 127.0.0.1 --port 4200 --no-browser
```

预览地址为 <http://127.0.0.1:4200/>。校验脚本检查文章输出、非空文章的搜索收录、草稿隔离，以及生成 HTML 中的本地链接和资源路径。浏览器中的 Python 交互需要另行验证。

## 写作与维护

### 文章

文章支持两种布局，可在同一站点混用：

- **简单文章**：直接使用 `posts/<文章名>.qmd`，适合只需一个文件的内容。
- **复杂文章**：使用 `posts/<文章名>/index.qmd`，在同一目录放置专属样式、图片和交互资源。

两种布局都继承 `posts/_metadata.yml`，自动参与全站渲染、首页列表和站内搜索。输出路径分别为 `posts/<文章名>.html` 和 `posts/<文章名>/index.html`。迁移已有文章时，URL 和相对资源路径会变化，需要同步更新引用。

两种布局使用相同的文章元数据，例如：

```yaml
---
title: "文章标题"
date: 2026-09-11
categories: [python]
description: "文章摘要"
---
```

日期使用 ISO 格式，更新日期填写 `date-modified`。分类和标签统一使用 `categories`，内容使用小写，单词之间用空格分隔（如 `machine learning`）。`posts/_metadata.yml` 提供共享作者信息、标题样式和 Markdown 解析设置。

本地草稿放在 `drafts/<文章名>.qmd` 或 `drafts/<文章名>/index.qmd`，设置 `draft: true`。`drafts/` 同时排除于 Git 提交和全站渲染；克隆仓库时不会获得这些草稿。发布时将文章文件或目录移入 `posts/`，删除 `draft: true`，检查内容及资源后重新构建。单独添加 `draft` 分类标签不会隐藏文章。

### 图片与样式

站点标识采用圆形雪夜、暖白月亮与双层雪坡，配色与导航栏一致。矢量源文件为 `images/yukiguni-logo.svg`，导航栏以 36 px 显示；`images/yukiguni-favicon.png` 为同图案的 48 × 48 px 透明背景图标。两者在 `_quarto.yml` 中配置。修改 SVG 后重新生成 favicon：

```bash
uv run --with cairosvg python -c 'import cairosvg; cairosvg.svg2png(url="images/yukiguni-logo.svg", write_to="images/yukiguni-favicon.png", output_width=48, output_height=48)'
```

共享图片位于 `images/`。向图库添加照片时，在 `gallery.qmd` 的 `.gallery-masonry` 容器内插入图片，各图片之间保留空行。

全站配色、首页列表和图库样式分别位于 `styles/colors.css`、`styles/listing.css` 和 `styles/gallery.css`。交互文章的实现来源、改动说明和第三方许可证保存在文章目录中。

完整目录索引和面向代理的维护约定见 [AGENTS.md](AGENTS.md)。

## 部署

使用 **Cloudflare Pages 的 Git 集成**，从 GitHub 的 `main` 分支构建并发布。创建 Pages 项目、授权访问 `recynie/blog` 后，填写以下配置：

| 配置项 | 值 |
|---|---|
| 生产分支 | `main`（手动选择，旧站分支为 `gh-pages`） |
| 框架预设 | None |
| 构建命令 | `bash scripts/build-cloudflare.sh` |
| 构建输出目录 | `_site` |
| 根目录 | 仓库根目录，留空 |
| 构建系统 | v3 |
| 环境变量 | `PYTHON_VERSION=3.12` |

`scripts/build-cloudflare.sh` 面向 Linux x86_64 构建环境，在临时目录安装 Quarto **1.10.18** 和 uv **0.11.18**，通过 `UV_PYTHON=3.12` 选择 Python，随后构建全站、运行校验并检查输出文件不超过 Pages 的单文件 **25 MiB** 限制。脚本退出时清理临时工具，不需要 root 权限。

站点地址为 <https://yukiguni-xennon.pages.dev/>，已在 `_quarto.yml` 的 `website.site-url` 中配置。Cloudflare 控制台的仓库连接与首次部署需要单独完成。接入后推送到 `main` 会自动触发部署，无需 GitHub Actions。后续更换域名时，同步更新 `website.site-url`；自定义域名通过 Pages 项目的 Custom domains 配置。

### Google 搜索收录

配置 `website.site-url` 后，Quarto 构建会生成 `_site/sitemap.xml`。部署后检查 <https://yukiguni-xennon.pages.dev/sitemap.xml> 可公开访问。在 [Google Search Console](https://search.google.com/search-console/) 中添加网址前缀 `https://yukiguni-xennon.pages.dev/`，按提示完成所有权验证，再提交 `sitemap.xml`。可通过「网址检查」为首页和重要文章请求编入索引；实际收录情况以 Search Console 报告为准。站内搜索 `website.search` 与 Google 收录独立。

仓库中的 `gh-pages` 分支保存旧 Hexo 站点，与当前 Quarto 源码独立。新站采用自身的文章路径，不维护旧站 URL 跳转。`_site/`、`.quarto/` 和本地环境缓存不提交到源码分支。
