# 文章来源与实现

- 原项目：`~/Code/marimo/loss-landscape-visualization`，原项目保持不变。
- 复制时间：2026-09-11。
- 数值实现：`landscape.py` 完整复制到 `index.qmd` 的隐藏 marimo 单元，唯一调整为将 `import numpy as np` 放到首个共享单元。
- 原数值文件 SHA-256：`c146e64bffda23e75b372105053e912307e15bb35a6853bcc201591d6af3befe`。
- `public/` 初始完整复制自原项目；保留 Plotly、ffmpeg.wasm 的许可证和版本清单。文章副本的 `plot.js` / `app.js` 增加小于 600px 时上下排列图表及跨断点重排，原项目文件不变。
- 方法来源：Ziming Liu，Seeing sticky plateau；原文链接见文章。
- 与原 notebook 的差异：单元之间加入 Quarto 正文；围绕训练轨迹与损失地形组织内容；训练表单与地形表单使用 Markdown batch 分段展示，以适配窄屏；默认网格 40 → 24、采样间隔 10 → 20；收紧界面计算上限以适应浏览器；数值算法不变。
- Quarto 插件：`marimo-team/quarto-marimo` 0.5.0；Python / 浏览器 marimo 版本固定为 0.24.0。

此文件用于维护溯源，不作为 Quarto 文章渲染。
