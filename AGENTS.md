# Workspace Guide

本项目用于维护 Yukiguni 个人博客，涵盖学习笔记、研究综述、工程实践、交互可视化与摄影内容。网站使用 Quarto 从文章源码生成静态页面。

## Layout

```text
_quarto.yml                         # 全站配置、渲染范围与默认执行策略
index.qmd                           # 首页文章列表、分类、排序与筛选
gallery.qmd                        # 摄影图库与灯箱入口
posts/
  _metadata.yml                     # 文章共享元数据与 Markdown 解析设置
  <文章名>.qmd                      # 简单文章，单文件形式
  <文章名>/index.qmd                # 复杂文章，可包含同目录资源
drafts/                            # 本地草稿；支持单文件和独立目录，Git 忽略，排除全站渲染
images/                             # 站点标识（SVG / PNG favicon）、共享图片与摄影作品
styles/                             # 全站配色、首页列表及图库样式
includes/mathjax.html               # MathJax mathtools 扩展配置
_extensions/marimo-team/marimo/      # 随仓库保存的 quarto-marimo 扩展
scripts/verify.py                   # 构建产物、搜索索引及本地链接校验
scripts/build-cloudflare.sh         # Pages 工具安装、构建、校验与文件大小检查
README.md                           # 项目介绍、环境、写作与部署说明
_site/                              # 生成的站点，不提交
.quarto/                            # Quarto 本地缓存，不提交
```

当主要文件或目录新增、移动、删除，或其职责发生变化时，及时更新本文件的 Layout 和相关约定。环境、使用方式与部署说明同步维护在 `README.md`。

## 内容与实现约定

- 文章支持 `posts/<文章名>.qmd`（简单文章）和 `posts/<文章名>/index.qmd`（含专属资源的复杂文章，一般是含有marimo等交互资源的文章），共享设置位于 `posts/_metadata.yml`；两种布局均参与渲染、首页列表、搜索和构建校验。迁移布局会改变 URL 和相对资源路径，需同步更新引用。修改 Markdown 解析选项时留意已有文章的换行、列表和标题行为。
- 草稿保留在本地 `drafts/`，支持 `drafts/<文章名>.qmd` 和 `drafts/<文章名>/index.qmd`，设置 `draft: true`；不要强制加入 Git。`draft` 分类标签不具备隐藏作用。
- `_quarto.yml` 默认关闭代码执行。需要计算的文章自行声明引擎、依赖和执行设置，避免全站开启执行。
- 优先使用 Quarto 原生网站功能，样式集中在 `styles/` 或文章专属 CSS 中。直接修改 `_site/` 不会保留到下一次构建。
- `_extensions/` 和本地 Plotly 属于第三方分发内容。更新时核对版本、兼容性与许可证，维护对应来源记录。

## 验证

环境要求与依赖版本见 `README.md` 和交互文章的 front matter。常用命令：

```bash
quarto render
uv run scripts/verify.py
quarto preview --host 127.0.0.1 --port 4200 --no-browser
```

- 修改内容、配置或资源后，构建并运行校验脚本。该脚本覆盖文章输出、非空文章搜索收录、草稿隔离和 HTML 本地链接。
- 修改交互逻辑时，额外在浏览器检查训练提交、地形独立更新、播放控制和 2D/3D 切换；涉及布局时检查桌面和窄屏。
- 静态图表成功显示不能证明 Pyodide 已就绪；提交参数并确认结果更新才能验证 Python 交互。
- `scripts/build-cloudflare.sh` 在 Linux x86_64 环境安装固定版本工具并构建，额外检查 `_site/` 中的单文件大小不超过 25 MiB。修改云端构建流程时运行该脚本。

## 仓库与发布边界

源码仓库为 `https://github.com/recynie/blog`，使用 `main` 分支。

部署目标为 Cloudflare Pages，输出目录为 `_site/`；仓库已提供云端构建脚本，控制台的 Git 集成和首次部署需单独完成。配置项见 `README.md`。提交、推送、变更分支或切换线上部署按用户授权执行，不因本地构建成功而自动发布。
