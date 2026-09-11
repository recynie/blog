# Yukiguni · Quarto

独立的 Quarto 博客，使用内置 zephyr 主题。内容、图片、样式和扩展均位于本项目中。仅用于本地构建和预览，没有配置云端发布。

## 本地使用

```bash
# CLI 由 Homebrew 管理
brew install --cask quarto
quarto --version

# 构建；输出在 _site/
quarto render

# 验证文章输出、搜索索引、草稿隔离和本地链接
uv run scripts/verify.py

# 仅监听本机，不自动打开浏览器
quarto preview --host 127.0.0.1 --port 4200 --no-browser
```

访问 <http://127.0.0.1:4200/>。更新 CLI 使用 `brew upgrade --cask quarto`。

### 局域网预览

```bash
quarto render
# 只开放生成的站点；绑定 Wi-Fi 地址，地址变化后需替换
uv run --no-project python -m http.server 4201 --bind 10.5.37.225 --directory _site
```

同一局域网设备访问 <http://10.5.37.225:4201/>。防火墙需要允许 TCP 4201；当前 Wi-Fi 防火墙区域已放行此端口，无需修改规则。此服务为临时静态服务，无登录验证、无开机自启，仅在可信局域网使用。更新内容后运行 `quarto render`；服务仅暴露 `_site/`，不提供项目源文件和草稿目录。

### Tailscale 访问

在局域网服务之外，单独绑定本机 Tailscale IPv4 地址：

```bash
uv run --no-project python -m http.server 4201 --bind 100.73.186.123 --directory _site
```

已连接同一 tailnet 且访问策略允许的设备可访问 <http://100.73.186.123:4201/>。局域网入口保持不变；未启用公网 Funnel。此服务同样无开机自启。

## 内容组织

- `posts/<文章名>/index.qmd`：已发布文章，使用 Quarto 常规目录和 URL。
- `drafts/<文章名>/index.qmd`：8 篇草稿，带有 `draft: true`，排除在全站渲染范围之外，并通过 `.gitignore` 排除，保留在本地。
- `index.qmd`：原生文章列表、分类、排序与筛选。
- `gallery.qmd`：响应式瀑布流图库，使用 Quarto 原生 Lightbox 放大和切换图片。
- `styles/gallery.css`：仅用于图库的样式；桌面三列、平板两列、手机单列，保留图片比例。
- `styles/listing.css`：首页列表样式；标题和摘要占满条目宽度，日期与分类标签同排显示。
- `styles/colors.css`：顶部导航栏使用近白灰蓝色（`#dce5ed`），标题 banner 使用更浅的近白灰蓝色（`#eef3f7`），保留明暗层次，配深色文字保证可读性；页面背景保持 Zephyr 默认。
- `images/`：站点本地图片。
- `scripts/verify.py`：仅依赖当前项目和 Python 标准库的构建校验。
- `_quarto.yml`：网站配置；代码执行默认关闭。
- `includes/mathjax.html`：启用 MathJax `mathtools` 扩展，支持 `\coloneqq` 等命令；扩展随 MathJax 从 CDN 加载。

新文章可直接放到 `posts/<新文章名>/index.qmd`。发布草稿到本地文章列表时，将其目录移入 `posts/` 并删除 `draft: true`。

### 添加图库图片

在 `gallery.qmd` 的 `.gallery-masonry` 容器内添加图片，每张之间空一行：

```markdown
![图片说明](images/example.jpg){group="gallery" loading="lazy"}
```

相同的 `group="gallery"` 让图片在灯箱内前后切换，支持键盘方向键和 Esc 关闭。瀑布流采用 CSS 多栏，按先从上到下、再从左到右的顺序排列，无需额外布局脚本。当前保留六张来自 `images/` 的本地图片作为测试内容，包含不同长宽比，便于检查瀑布流和灯箱切换；已移除不可用的图库外链。

文章首页继续使用原生 `default` 列表，摘要长度保持 Quarto 默认设置。

## marimo 交互文章

文章《可视化损失地形：神经网络的训练轨迹》：`posts/marimo-reactive-article/index.qmd`，访问 <http://127.0.0.1:4200/posts/marimo-reactive-article/>，也会出现在首页列表和搜索中。

已安装 `quarto-marimo` **0.5.0** 到 `_extensions/marimo-team/marimo/`。需要 Quarto ≥ 1.9.20 和 `uv`。文章使用 `engine: marimo`，仅该文章覆盖 `execute.enabled: true`；原有文章仍关闭代码执行。`pyproject` 固定 marimo **0.24.0** 并声明 NumPy，插件通过 uv 管理构建环境，HTML 通过 Pyodide 在浏览器计算。

```bash
# 构建单篇（也更新关联文章列表）
quarto render posts/marimo-reactive-article/index.qmd
# 或构建全站，再执行校验
quarto render
uv run scripts/verify.py
```

文章把 `.marimo` 单元穿插在普通 Markdown 正文中，包含 MLP 训练表单、独立地形表单和计算结果，并介绍 PCA 投影、局部平面融合与读图边界。图表单元沿用原项目的 iframe / Plotly / ffmpeg.wasm 组件，支持播放、2D/3D 切换及 GIF/MP4 导出。手机图表上下排列。数值代码和约 36 MB 的 `public/` 资源已复制到文章目录，构建不依赖 `~/Code/marimo`，原项目未修改。来源和改动记录见该目录的 `PROVENANCE.md`。

**2026-09-11 初版验证记录（正式文章已移除平方滑块）：** 全站 24 个页面构建成功，校验脚本通过（22 篇文章，草稿未输出，本地链接无断链）。浏览器验证滑块 `3² = 9 → 4² = 16`；目标 `x → x²` 后最终 MSE `0.000061 → 0.000096`；网格 `24 → 16` 后训练 MSE 保持不变。播放/暂停停在第 112 步，复位回到 0，时间条到第 201 步时图中标记一致；3D 切换和拖动旋转正常。实际下载 GIF/MP4，ffprobe 确认均为 1100 × 560、4 帧，MP4 为 H.264。检查了 1280px 桌面和 390px 窄屏，窄屏表单可提交、图表上下排列。

**已知限制：** 第一次联网加载 marimo/Pyodide/依赖曾触发 `RPC request timed out`；缓存完成后刷新恢复正常。首屏静态输出与运行时成功启动是两项独立检查，请提交训练参数并确认结果更新。此页面不是离线包。3D 需要 WebGL，较大计算和导出会占用浏览器 CPU / 内存。插件单元中的 `code-fold` 在本次测试未产生折叠，因此部分单元直接展示代码。

## 内容约定

- 日期使用 ISO 格式的 `date`，更新日期使用 `date-modified`，摘要使用 `description`。
- 分类与标签统一填写在 `categories` 中，用于首页标签展示与分类筛选。
- `draft` 分类标签不会隐藏文章；未发布内容放在 `drafts/` 中，并设置 `draft: true`。
- `posts/_metadata.yml` 和 `drafts/_metadata.yml` 配置 Markdown 解析扩展，支持紧邻段落的标题、列表和硬换行。
- 空正文文章仍生成页面，但 Quarto 不将其加入搜索索引。
- MathJax 从 CDN 加载，部分文章使用外链图片；完整浏览需要联网。
